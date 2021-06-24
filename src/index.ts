import * as cocNvim from 'coc.nvim';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vslp from "vscode-languageserver-protocol";

var sscanf = require('sscanf');
var uri2path = require('file-uri-to-path');

const cocLpcConfig = cocNvim.workspace.getConfiguration('coc-lpc');
const workspaceStr = cocLpcConfig.get<string>("workspace", "newtxii");
const complieCommand = cocLpcConfig.get<string>("complie", "lpc_compile");
const efuncObjects = cocLpcConfig.get<Array<string>>('efunc', ["/etc/efun_define.c", "/sys/object/simul_efun.c"]);

var projectFolder: string = "";
var inc: string = "";

let logger: cocNvim.Logger;

function debug(message: any, ...args: any) {
    logger.info(message, ...args)
}

function getFileRelativePath(uri: string): string {
    return path.relative(projectFolder, uri2path(uri));
}

function InitProjectFolder() {
    let curPath = cocNvim.workspace.cwd;
    let pos = curPath.lastIndexOf(workspaceStr);

    if (pos >= 0) {
        projectFolder = curPath.slice(0, pos + `${workspaceStr}/`.length);
        inc = path.resolve(projectFolder, cocLpcConfig.get<string>('include', "inc"));
    }
};

function complie(filename: string): Boolean {
    try {
        // too ugly
        child_process.execSync(`cd ${projectFolder}; mv log/debug.log log/bak.log; ${complieCommand} ${filename}; mv log/debug.log log/complie.log ; mv log/bak.log log/debug.log`, {shell: "/bin/bash", stdio: "pipe"});
        return true;
    } catch (e) {
        logger.error(e)
        return false;
    }
}

const symbolDir = 'log/symbol/';

function loadSymbol(filename: string) {
    if (filename.startsWith("/")) {
        filename = filename.substring(1);
    }
    filename = filename.replace(/\//g, "#");
    let absFilename = path.resolve(projectFolder, symbolDir, filename);
    if (!fs.existsSync(absFilename)) {
        return "";
    }
    return fs.readFileSync(absFilename).toString();
}

enum OP {
    INC = 1,
    DEFINE,
    VAR,
    FUNC,
    NEW,
    POP,
    FREE,
}

interface LineSymbol {
    op: OP,
    filename: string,
    lineno: number,
    detail: string,
}

interface Symbol {
    name: string,
    line: number,
    filename: string,
    // detail?: string,
    args?: string[],
    op?: LineSymbol[],
    detail?: string,
}

interface FileSymbol {
    lineno: number;
    defined: Symbol[],
    include: Symbol[],
    variable: Symbol[],
    func: Symbol[],
    childFileSymbol: {[key: string]: FileSymbol},
}

function parse(filename: string, symbolInfo: string) {
    let lineInfo = symbolInfo.split('\n')
    let fileSymbol: FileSymbol = {
        defined: [],
        include: [],
        variable: [],
        func: [],
        childFileSymbol: {},
        lineno: 0
    }
    let localArgs: string[] = []
    let currentLine = 0;
    let hasIncluded = new Set();
    let lastFunction: Symbol | null = null;

    lineInfo.forEach(line => {
        if (line.length == 0) return;

        let lineSymbol: LineSymbol = sscanf(line, "%d %s %d %S", 'op', 'filename', 'lineno', 'detail');
        let targetSymbol: FileSymbol | undefined = fileSymbol;

        if (!lineSymbol.detail) lineSymbol.detail = "";

        if (lineSymbol.filename == filename) currentLine = lineSymbol.lineno;

        if (lineSymbol.filename != filename) {
            if (!fileSymbol.childFileSymbol[lineSymbol.filename]) {
                fileSymbol.childFileSymbol[lineSymbol.filename] = {
                    defined: [],
                    include: [],
                    variable: [],
                    func: [],
                    childFileSymbol: {},
                    lineno: lineSymbol.lineno
                };
            }
            targetSymbol = fileSymbol.childFileSymbol[lineSymbol.filename];
        }
        if (targetSymbol) {
            switch (lineSymbol.op) {
                case OP.INC:
                    if (!hasIncluded.has(lineSymbol.filename)) {
                        fileSymbol.include.push({
                            name: lineSymbol.filename,
                            line: currentLine,
                            filename: lineSymbol.filename
                        });
                        hasIncluded.add(lineSymbol.filename)
                    }
                    break;
                case OP.DEFINE:
                    let hasArgs = 0;
                    let define = lineSymbol.detail.trim()
                    let spacePos = define.search(`\\s+`);

                    for (let index = 0; index < spacePos; index++) {
                        const element = define[index];
                        if (element == '(') {
                            hasArgs = index;
                            break;
                        }
                    }
                    if (hasArgs) {
                        let right = hasArgs;
                        while (right < define.length && define[right] != ')') right++;
                        let args = define.substring(hasArgs + 1, right).replace(',', ' ').split(' ');
                        args = args.filter(function (value: string) {
                            return value.length > 0;
                        })
                        targetSymbol.defined.push({
                            name: define.substring(0, hasArgs),
                            line: lineSymbol.lineno,
                            args: args,
                            filename: lineSymbol.filename,
                            detail: lineSymbol.detail.substring(right + 1, lineSymbol.detail.length).trim()
                        })
                    }
                    else {
                        if (spacePos < 0) {
                            targetSymbol.defined.push({
                                name: define,
                                line: lineSymbol.lineno,
                                filename: lineSymbol.filename,
                                detail: undefined,
                            })
                        }
                        else {
                            targetSymbol.defined.push({
                                name: define.substring(0, spacePos),
                                line: lineSymbol.lineno,
                                filename: lineSymbol.filename,
                                detail: lineSymbol.detail.substring(spacePos, lineSymbol.detail.length).trim()
                            })
                        }
                    }
                    break
                case OP.VAR:
                    targetSymbol.variable.push({
                        name: lineSymbol.detail,
                        line: lineSymbol.lineno,
                        filename: lineSymbol.filename
                    });
                    break
                case OP.FUNC:
                    targetSymbol.func.push({
                        name: lineSymbol.detail,
                        line: lineSymbol.lineno,
                        args: [...localArgs],
                        op: [],
                        filename: lineSymbol.filename
                    });
                    lastFunction = targetSymbol.func[targetSymbol.func.length - 1]
                    break
                case OP.NEW:
                    localArgs.push(lineSymbol.detail);
                    if (lastFunction && lastFunction.op) {
                        lastFunction.op.push(lineSymbol)
                    }
                    break
                case OP.POP:
                    let n = parseInt(lineSymbol.detail)
                    while (localArgs.length > 0 && n > 0) {
                        localArgs.pop();
                        n--;
                    }
                    if (lastFunction && lastFunction.op) {
                        lastFunction.op.push(lineSymbol)
                    }
                    break
                case OP.FREE:
                    localArgs = []
                    if (lastFunction && lastFunction.op) {
                        lastFunction.op.push(lineSymbol)
                    }
                    break
                default:
            }
        }
    });
    return fileSymbol;
}

var fileSymbolCache: {[key: string]: FileSymbol} = {}
var fileSymbolCacheTime: {[key: string]: number} = {}

function generateFileSymbol(filename: string): FileSymbol {
    let fileSymbol: FileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0}
    if (filename in fileSymbolCacheTime && (Date.now() / 1000 - fileSymbolCacheTime[filename] < 2)) {
        return fileSymbolCache[filename];
    }

    if (!complie(filename)) {
        if (filename in fileSymbolCache) return fileSymbolCache[filename];
        return fileSymbol;
    }
    let res = loadSymbol(filename);
    fileSymbol = parse(filename, res);
    fileSymbolCache[filename] = fileSymbol;
    fileSymbolCacheTime[filename] = Date.now() / 1000;
    return fileSymbol;
}

/**
 * for object call function completion
 */
function getDefineFunction(filename: string, line: number, includeChild: Boolean): Symbol[] {
    let ret: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);

    fileSymbol.func.forEach(func => {
        if (line < 0 || func.line <= line) {
            ret.push(func);
        }
    });

    if (includeChild) {
        for (var file in fileSymbol.childFileSymbol) {
            let childSymbol = fileSymbol.childFileSymbol[file]
            if (line < 0 || childSymbol.lineno <= line) {
                ret.push(...childSymbol.func);
            }
        }
    }
    return ret;
}

/**
 * include efun and simul_efun, for completion in this file
 */
function getVisibleFunction(filename: string, line: number): Symbol[] {
    let res = getDefineFunction(filename, line, true);
    efuncObjects.forEach(efuncFile => {
        res.push(...getDefineFunction(prettyFilename(efuncFile), -1, true))
    });
    return res;
}

function getMacroDefine(filename: string, line: number, includeChild: Boolean): Symbol[] {
    let ret: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);

    fileSymbol.defined.forEach(defined => {
        if (line < 0 || defined.line <= line) {
            ret.push(defined);
        }
    });

    if (includeChild) {
        for (var file in fileSymbol.childFileSymbol) {
            let childSymbol = fileSymbol.childFileSymbol[file]

            if (line < 0 || childSymbol.lineno <= line) {
                ret.push(...childSymbol.defined);
            }
        }
    }
    return ret;
}

function getGlobalVariable(filename: string, line: number, includeChild: Boolean): Symbol[] {
    let ret: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);

    fileSymbol.variable.forEach(variable => {
        if (line < 0 || variable.line <= line) {
            ret.push(variable);
        }
    });

    if (includeChild) {
        for (var file in fileSymbol.childFileSymbol) {
            let childSymbol = fileSymbol.childFileSymbol[file]

            if (line < 0 || childSymbol.lineno <= line) {
                ret.push(...childSymbol.variable);
            }
        }
    }
    return ret;
}

function getLocalVariable(filename: string, lineAt: number): Symbol[] {
    let localArgs: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);
    let lastFunction: Symbol | null = null

    for (let index = 0; index < fileSymbol.func.length; index++) {
        const func = fileSymbol.func[index];
        if (func.line <= lineAt) {
            lastFunction = func;
        }
        else {
            break
        }
    }
    if (lastFunction && lastFunction.args && lastFunction.op) {
        for (let index = 0; index < lastFunction.args.length; index++) {
            const arg = lastFunction.args[index];
            localArgs.push({name: arg, line: lastFunction.line, filename: filename})
        }
        for (let index = 0; index < lastFunction.op.length; index++) {
            const lineSymbol = lastFunction.op[index];

            if (lineSymbol.lineno > lineAt) break;

            switch (lineSymbol.op) {
                case OP.NEW:
                    localArgs.push({
                        name: lineSymbol.detail,
                        line: lineSymbol.lineno,
                        filename: lineSymbol.filename
                    });
                    break
                case OP.POP:
                    let n = parseInt(lineSymbol.detail)
                    while (localArgs.length > 0 && n > 0) {
                        localArgs.pop();
                        n--;
                    }
                    break
                case OP.FREE:
                    localArgs = []
                    break
                default:
            }
        }
    }
    return localArgs;
}

function getLine(document: cocNvim.TextDocument, line: number): string {
    return document.getText({start: {line: line - 1, character: 100000}, end: {line: line, character: 100000}});
}

var completionCache: {[key: string]: cocNvim.CompletionItem[]} = {}
var completionCacheTime: {[key: string]: number} = {}

function provideCompletionItems(document: cocNvim.TextDocument, position: cocNvim.Position, token: cocNvim.CancellationToken, context?: cocNvim.CompletionContext): cocNvim.CompletionItem[] {
    const line = getLine(document, position.line)
    const lineText = line.substring(0, position.character);
    let reg: RegExp;

    // #include <
    reg = /#include\s+?(<)\w*?$/;
    if (reg.test(lineText)) {
        let result = getFileAndDir(inc);
        return result;
    }

    // #include "
    reg = /#include\s+?(\")([\w|\/]*?)$/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText)
        let result: cocNvim.CompletionItem[] = [];

        if (exec_result) {
            if (exec_result[2].search('/') == -1) result.push(...getFileAndDir(inc));
            let dir = exec_result[2].split("/")
            let target = "";

            dir.pop()
            if (!exec_result[2].startsWith("/")) {
                target = path.resolve(path.dirname(uri2path(document.uri)), ...dir);
            }
            else {
                target = path.resolve(projectFolder, ...dir);
            }
            result.push(...getFileAndDir(target));
        }
        return result;
    }

    // "cmd/"
    reg = /(\")([\w\/]*)$/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText);
        if (exec_result != null) {
            let dir = exec_result[2].split("/")
            dir.pop()
            return getFileAndDir(path.resolve(projectFolder, ...dir));
        }
        return []
    }

    // object call
    reg = /([\w\/\"\.]+|this_object\(\))->$/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText);
        let file = "";
        if (exec_result == null) return []
        if (exec_result[1] == 'this_object()') {
            file = `"${getFileRelativePath(document.uri)}"`;
        } else {
            file = exec_result[1];
        }
        if (!file.startsWith("\"")) {
            let define = getMacroDefine(getFileRelativePath(document.uri), position.line, true);
            for (let index = 0; index < define.length; index++) {
                const def = define[index];
                if (def.name == exec_result[1] && def.detail) {
                    file = def.detail;
                }
            }
        }
        file = prettyFilename(file.substring(1, file.length - 1));
        let res: cocNvim.CompletionItem[] = []
        let allFunction = getDefineFunction(file, -1, true);
        for (let index = 0; index < allFunction.length; index++) {
            const func = allFunction[index];
            res.push({
                label: func.name,
                kind: cocNvim.CompletionItemKind.Function,
                insertText: func.name + makeSnippetPlaceHolderStr(func.args || []),
                insertTextFormat: cocNvim.InsertTextFormat.Snippet,
            })
        }
        return res;
    }

    if (lineText.endsWith(">")) return [];

    // call this file
    let filename = getFileRelativePath(document.uri)

    if (filename in completionCache && filename in completionCacheTime
        && Date.now() / 1000 - completionCacheTime[filename] < 5) {
        return completionCache[filename];
    }

    let res: cocNvim.CompletionItem[] = []
    for (const local of getLocalVariable(filename, position.line)) {
        res.push({
            label: local.name,
            kind: cocNvim.CompletionItemKind.Variable,
            insertText: local.name,
            insertTextFormat: cocNvim.InsertTextFormat.PlainText,
        });

    }
    for (const func of getVisibleFunction(filename, position.line)) {
        res.push({
            label: func.name,
            kind: cocNvim.CompletionItemKind.Function,
            insertText: func.name + makeSnippetPlaceHolderStr(func.args || []),
            insertTextFormat: cocNvim.InsertTextFormat.Snippet,
        })
    }
    for (const define of getMacroDefine(filename, position.line, true)) {
        if (define.args?.length) {
            res.push({
                label: define.name,
                kind: cocNvim.CompletionItemKind.Constant,
                insertText: define.name + makeSnippetPlaceHolderStr(define.args || []),
                insertTextFormat: cocNvim.InsertTextFormat.Snippet,
            })
        }
        else {
            res.push({
                label: define.name,
                kind: cocNvim.CompletionItemKind.Constant,
                insertText: define.name,
                insertTextFormat: cocNvim.InsertTextFormat.PlainText,
            })
        }
    }
    for (const variable of getGlobalVariable(filename, position.line, true)) {
        res.push({
            label: variable.name,
            kind: cocNvim.CompletionItemKind.Variable,
            insertText: variable.name,
            insertTextFormat: cocNvim.InsertTextFormat.PlainText,
        })
    }
    completionCache[filename] = res;
    completionCacheTime[filename] = Date.now() / 1000;
    return res;
}

function makeSnippetPlaceHolderStr(args: string[]): string {
    let res = "";
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (index > 0) {
            res += ", ";
        }
        res += "${" + (index + 1) + ":" + arg.trim() + "}"
    }
    return "(" + res + ")";
}

function prettyFilename(filename: string): string {
    if (filename.startsWith("/")) filename = filename.substring(1)
    if (!filename.endsWith(".c")) filename = filename + ".c";
    return path.resolve("/", ...filename.replace(/\//, ' ').split(' ')).substring(1);
}

function getFileAndDir(dirPath: string): cocNvim.CompletionItem[] {
    let output: cocNvim.CompletionItem[] = [];

    if (!fs.existsSync(dirPath)) return output;

    let files = fs.readdirSync(dirPath);

    for (let i = 0; i < files.length; ++i) {
        let filedir = path.join(dirPath, files[i]);
        let stats = fs.statSync(filedir);

        if (stats == null) return [];
        let isFile = stats.isFile();
        let isDir = stats.isDirectory();
        if (isFile && (filedir.search('\\.c') != -1 || filedir.search('\\.h') != -1)) {
            filedir = filedir.replace(dirPath, "").replace(/\\/g, '/').substr(1)
            output.push({label: filedir, kind: cocNvim.CompletionItemKind.File, insertText: filedir});
        }
        else if (isDir) {
            filedir = filedir.replace(dirPath, "").replace(/\\/g, '/').substr(1) + "/";
            if (filedir.substring(0, 1) == '.') continue;
            output.push({
                label: filedir,
                kind: cocNvim.CompletionItemKind.Folder,
                insertText: filedir.replace('/', ''),
            });
        }
    }
    return output;
};

function getWordRangeAtPosition(document: cocNvim.TextDocument, position: cocNvim.Position): cocNvim.Range {
    let line = getLine(document, position.line)
    let lineNumber = position.line
    let left = position.character, right = position.character
    while (left >= 0 && ((line[left] >= 'a' && line[left] <= 'z')
        || (line[left] >= 'A' && line[left] <= 'Z')
        || (line[left] >= '0' && line[left] <= '9')
        || line[left] == '_'
        || line[left] == '/')) left--;

    left++;
    while (right < line.length && ((line[right] >= 'a' && line[right] <= 'z')
        || (line[right] >= 'A' && line[right] <= 'Z')
        || (line[right] >= '0' && line[right] <= '9')
        || line[right] == '_'
        || line[right] == '/')) right++;

    return {start: {line: lineNumber, character: left}, end: {line: lineNumber, character: right}};
}

function getActiveTextEditorData(document: cocNvim.TextDocument): string {
    return cocNvim.workspace.getDocument(document.uri).content;
};

function searchInLine(line: string, word: string): number {
    let reg = new RegExp(`\\b${word}\\b`)
    if (reg.test(line)) {
        let exec_result = reg.exec(line)
        if (exec_result) {
            return exec_result["index"];
        }
    }
    return 0;
}

function getRangeofWordInFileLine(filename: string, line: number, word: string): cocNvim.Range {
    let res: cocNvim.Range = {start: {line: line, character: 0}, end: {line: line, character: 0}};
    if (fs.existsSync(filename)) {
        let filelines = fs.readFileSync(filename).toString().split("\n");

        if (line < filelines.length) {
            let linePos = searchInLine(filelines[line], word);
            res.start.character = linePos;
            res.start.character = linePos;
        }
    }
    return res;
}

var lastdotcfile: string = "";

function provideDefinition(document: cocNvim.TextDocument, position: cocNvim.Position): cocNvim.ProviderResult<cocNvim.Definition> {
    const word = document.getText(getWordRangeAtPosition(document, position));
    const lineText = getLine(document, position.line).trim();
    var filename = getFileRelativePath(document.uri)

    if (filename.endsWith(".c")) {
        lastdotcfile = filename;
    }
    else if (filename.endsWith(".h") && lastdotcfile.length) {
        // when deal with .h file, try best find 
        filename = lastdotcfile;
    }

    // -> call jump
    let reg = new RegExp(`([\\w\\/\\"\\.]+|this_object\\(\\))->${word.replace(/\//g, '\\/')}`);
    let exec_result = reg.exec(lineText)
    if (exec_result != null && exec_result[1] != null) {
        let from = "";

        if (exec_result[1] == 'this_object()') {
            from = `"${getFileRelativePath(document.uri)}"`;
        } else {
            from = exec_result[1];
        }

        if (!from.startsWith("\"")) {
            let define = getMacroDefine(filename, position.line, true);
            for (let index = 0; index < define.length; index++) {
                const def = define[index];
                if (def.name == from && def.detail) {
                    from = def.detail
                    break;
                }
            }
        }

        if (!from.startsWith("\"") || !from.endsWith("\"")) return;
        from = prettyFilename(from.substring(1, from.length - 1));
        if (!fs.existsSync(path.resolve(projectFolder, from))) return;
        let definefunc = getDefineFunction(from, -1, true);
        for (let index = 0; index < definefunc.length; index++) {
            const func = definefunc[index];
            if (func.name == word) {
                return {
                    uri: path.resolve(projectFolder, func.filename),
                    range: getRangeofWordInFileLine(path.resolve(projectFolder, func.filename), func.line - 1, func.name),
                };
            }
        }
    }

    // #include <
    reg = /#include\s+?<([\w|\/|\.]+)*?>(\s+)?/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText)
        if (exec_result) {
            let uri = path.resolve(inc, exec_result[1]);
            if (fs.existsSync(uri)) {
                return {
                    uri: uri,
                    range: {
                        start: {line: 0, character: 0}, end: {line: 0, character: 0}
                    }
                };
            }
        }
        return
    }

    // #include "
    reg = /#include\s+?\"([\w|\/|\.]+)*?\"(\s+)?/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText)

        if (exec_result) {
            let target = exec_result[1]
            if (!target.startsWith("/")) {
                let inner = path.resolve(projectFolder, path.dirname(getFileRelativePath(document.uri)), target)
                if (fs.existsSync(inner)) {
                    return {
                        uri: inner,
                        range: {
                            start: {line: 0, character: 0}, end: {line: 0, character: 0}
                        }
                    };
                }
                inner = path.resolve(inc, target);
                if (fs.existsSync(inner)) {
                    return {
                        uri: path.resolve(projectFolder, inner),
                        range: {
                            start: {line: 0, character: 0}, end: {line: 0, character: 0}
                        }
                    };
                }
                return null;
            }
            else {
                target = target.substring(1)
                return {
                    uri: path.resolve(projectFolder, target),
                    range: {
                        start: {line: 0, character: 0}, end: {line: 0, character: 0}
                    }
                };

            }
        }
        return;
    }

    // "cmd/"
    if (word.search(/\//) != -1) {
        let target = prettyFilename(word);
        return {
            uri: path.resolve(projectFolder, target),
            range: {
                start: {line: 0, character: 0}, end: {line: 0, character: 0}
            }
        };
    }

    for (const local of getLocalVariable(filename, position.line)) {
        if (local.name == word) {
            return {
                uri: document.uri,
                range: getRangeofWordInFileLine(uri2path(document.uri), local.line - 1, local.name),
            };
        }
    }

    for (const variable of getGlobalVariable(filename, position.line, true)) {
        if (variable.name == word) {
            return {
                uri: path.resolve(projectFolder, variable.filename),
                range: getRangeofWordInFileLine(path.resolve(projectFolder, variable.filename), variable.line - 1, variable.name),
            };
        }
    }

    for (const func of getDefineFunction(filename, position.line, true)) {
        if (func.name == word) {
            return {
                uri: path.resolve(projectFolder, func.filename),
                range: getRangeofWordInFileLine(path.resolve(projectFolder, func.filename), func.line - 1, func.name),
            };
        }
    }

    for (let index = 0; index < efuncObjects.length; index++) {
        const efuncFile = efuncObjects[index];
        for (const func of getDefineFunction(efuncFile, position.line, true)) {
            if (func.name == word) {
                return {
                    uri: path.resolve(projectFolder, func.filename),
                    range: getRangeofWordInFileLine(path.resolve(projectFolder, func.filename), func.line - 1, func.name),
                };
            }
        }
    }

    for (const define of getMacroDefine(filename, position.line, true)) {
        if (define.name == word) {
            return {
                uri: path.resolve(projectFolder, define.filename),
                range: getRangeofWordInFileLine(path.resolve(projectFolder, define.filename), define.line - 1, define.name),
            }
        }
    }
    return null;
}

function provideDocumentSymbols(document: cocNvim.TextDocument, token: cocNvim.CancellationToken): cocNvim.DocumentSymbol[] {
    let filename = getFileRelativePath(document.uri);

    let output: cocNvim.DocumentSymbol[] = [];
    for (const define of getMacroDefine(filename, -1, false)) {
        let child: cocNvim.DocumentSymbol[] = [];
        if (define.args) {
            for (const arg of define.args) {
                child.push({
                    name: arg,
                    detail: arg,
                    kind: vslp.SymbolKind.Variable,
                    range: getRangeofWordInFileLine(filename, define.line - 1, define.name),
                    selectionRange: getRangeofWordInFileLine(filename, define.line - 1, define.name),
                });
            }
        }

        output.push({
            name: define.name,
            detail: define.detail,
            kind: vslp.SymbolKind.Constant,
            range: getRangeofWordInFileLine(filename, define.line - 1, define.name),
            selectionRange: getRangeofWordInFileLine(filename, define.line - 1, define.name),
            children: child,
        });
    }
    for (const variable of getGlobalVariable(filename, -1, false)) {
        output.push({
            name: variable.name,
            detail: variable.detail,
            kind: vslp.SymbolKind.Variable,
            range: getRangeofWordInFileLine(filename, variable.line - 1, variable.name),
            selectionRange: getRangeofWordInFileLine(filename, variable.line - 1, variable.name),
        });
    }

    for (const func of getDefineFunction(filename, -1, false)) {
        let child: cocNvim.DocumentSymbol[] = [];
        if (func.args) {
            for (const arg of func.args) {
                child.push({
                    name: arg,
                    detail: arg,
                    kind: vslp.SymbolKind.Variable,
                    range: getRangeofWordInFileLine(filename, func.line - 1, func.name),
                    selectionRange: getRangeofWordInFileLine(filename, func.line - 1, func.name),
                });
            }
        }
        output.push({
            name: func.name,
            detail: func.detail,
            kind: vslp.SymbolKind.Function,
            range: getRangeofWordInFileLine(filename, func.line - 1, func.name),
            selectionRange: getRangeofWordInFileLine(filename, func.line - 1, func.name),
            children: child,
        });
    }
    return output;
}

export async function activate(context: cocNvim.ExtensionContext): Promise<void> {
    logger = context.logger;
    InitProjectFolder();
    context.subscriptions.push(cocNvim.languages.registerCompletionItemProvider('coc-lpcd', 'LPC', 'lpc', {provideCompletionItems}, ['/', '>', '<']));
    context.subscriptions.push(cocNvim.languages.registerDefinitionProvider([{language: 'lpc'}], {provideDefinition}));
    context.subscriptions.push(cocNvim.languages.registerDocumentSymbolProvider([{language: "lpc"}], {provideDocumentSymbols}));
}
