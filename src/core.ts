import { workspace, Logger, ExtensionContext, window, languages, TextDocument, Position, CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, StreamInfo, InsertTextFormat } from 'coc.nvim';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

var sscanf = require('sscanf');

const cocLpcConfig = workspace.getConfiguration('coc-lpc');
const workspaceStr = cocLpcConfig.get<string>("workspace", "newtxii");
const complieCommand = cocLpcConfig.get<string>("complie", "lpc_compile");
const efuncObjects = cocLpcConfig.get<Array<string>>('efunc', ["/etc/efun_define.c", "/sys/object/simul_efun.c"]);

let logger: Logger;

function debug(message: any, ...args: any) {
    logger.info(message, ...args)
}

function getFileRelativePath(absPath: string): string {
    return absPath.slice(absPath.indexOf(`${workspaceStr}/`) + `${workspaceStr}/`.length, absPath.length);
}

var projectFolder: string = "";
var inc: string = "";

function InitProjectFolder() {
    let curPath = workspace.cwd;
    let pos = curPath.lastIndexOf(workspaceStr);

    if (pos >= 0) {
        projectFolder = curPath.slice(0, pos + `${workspaceStr}/`.length);
        inc = path.resolve(projectFolder, cocLpcConfig.get<string>('include', "inc"));
    }
};

function complie(filename: string): Boolean {
    try {
        execSync(`cd ${projectFolder} && ${complieCommand} ${filename}`, { shell: "/bin/bash", stdio: 'ignore' });
        return true;
    } catch (error) {
        window.showMessage(`complie ${filename} error`);
        return false;
    }
}

const symbolDir = '.symbol';

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
    childFileSymbol: { [key: string]: FileSymbol },
}

function parse(filename: string, symbolInfo: string) {
    let lineInfo = symbolInfo.split('\n')
    let fileSymbol: FileSymbol = { defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0 }
    let localArgs: string[] = []
    let currentLine = 0;
    let hasIncluded = new Set();
    let lastFunction: Symbol | null = null;

    lineInfo.forEach(line => {
        let lineSymbol: LineSymbol = sscanf(line, "%d %s %d %S", 'op', 'filename', 'lineno', 'detail');
        let targetSymbol: FileSymbol | undefined = fileSymbol;

        if (lineSymbol.filename == filename) currentLine = lineSymbol.lineno;

        if (lineSymbol.filename != filename) {
            if (!fileSymbol.childFileSymbol[lineSymbol.filename]) {
                fileSymbol.childFileSymbol[lineSymbol.filename] = { defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: lineSymbol.lineno };
            }
            targetSymbol = fileSymbol.childFileSymbol[lineSymbol.filename];
        }
        if (targetSymbol) {
            switch (lineSymbol.op) {
                case OP.INC:
                    if (!hasIncluded.has(lineSymbol.filename)) {
                        fileSymbol.include.push({ name: lineSymbol.filename, line: currentLine, filename: lineSymbol.filename });
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
                        let args = define.substring(hasArgs + 1, right).split(' ');
                        args = args.filter(function (value: string, index: number, array: string[]) {
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
                    targetSymbol.variable.push({ name: lineSymbol.detail, line: lineSymbol.lineno, filename: lineSymbol.filename });
                    break
                case OP.FUNC:
                    targetSymbol.func.push({ name: lineSymbol.detail, line: lineSymbol.lineno, args: [...localArgs], op: [], filename: lineSymbol.filename });
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

var fileSymbolCache: { [key: string]: FileSymbol } = {}
var fileSymbolCacheTime: { [key: string]: number } = {}

function generateFileSymbol(filename: string): FileSymbol {
    let fileSymbol: FileSymbol = { defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0 }
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
            fileSymbol = fileSymbol.childFileSymbol[file]

            if (line < 0 || fileSymbol.lineno <= line) {
                ret.push(...fileSymbol.func);
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
        res.push(...getDefineFunction(efuncFile, -1, true))
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
            fileSymbol = fileSymbol.childFileSymbol[file]

            if (line < 0 || fileSymbol.lineno <= line) {
                ret.push(...fileSymbol.defined);
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
            fileSymbol = fileSymbol.childFileSymbol[file]

            if (line < 0 || fileSymbol.lineno <= line) {
                ret.push(...fileSymbol.variable);
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
            localArgs.push({ name: arg, line: lastFunction.line, filename: filename })
        }
        for (let index = 0; index < lastFunction.op.length; index++) {
            const lineSymbol = lastFunction.op[index];

            if (lineSymbol.lineno > lineAt) break;

            switch (lineSymbol.op) {
                case OP.NEW:
                    localArgs.push({ name: lineSymbol.detail, line: lineSymbol.lineno, filename: lineSymbol.filename })
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

function test() {
    let res = generateFileSymbol("huodong/mall/main.c");
    debug(res);
}

function getLine(document: TextDocument, line: number): string {
    return document.getText({ start: { line: line - 1, character: 100000 }, end: { line: line, character: 100000 } });
}

function provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context?: CompletionContext): CompletionItem[] {
    const line = getLine(document, position.line)
    const lineText = line.substring(0, position.character);
    let reg: RegExp;

    // #include <
    reg = /#include\s+?(<)\w*?$/;
    if (reg.test(lineText)) {
        let result = fileDisplay(inc);
        return result;
    }

    // #include "
    reg = /#include\s+?(\")\w*?$/;
    if (reg.test(lineText)) {
        let result = fileDisplay(inc);
        result.push(...fileDisplay(path.dirname(document.uri)));
        return result;
    }

    // "cmd/"
    reg = /(\")([\w\/]*)$/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText);
        if (exec_result != null) {
            return fileDisplay(path.resolve(projectFolder, exec_result[2]));
        }
        return []
    }

    reg = /([\w\/\"\.]+|this_object\(\))->/;
    if (reg.test(lineText)) {
        let exec_result = reg.exec(lineText);
        let file = "";
        if (exec_result == null) return []
        if (exec_result[1] == 'this_object()') {
            file = `"${document.uri.replace(projectFolder, "")}"`;
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
        let res: CompletionItem[] = []
        let allFunction = getDefineFunction(file, -1, true);
        for (let index = 0; index < allFunction.length; index++) {
            const func = allFunction[index];
            res.push({
                label: func.name,
                kind: CompletionItemKind.Function,
                insertText: func.name + makeSnippetPlaceHolderStr(func.args || []),
                insertTextFormat: InsertTextFormat.Snippet,
            })
        }
        return res;
        //  file = getDefineValue(readFromFileSync(document.uri), exec_result[1], dirname);
        // if (file.substring(0, 1) == "/") file = "." + file;
        // return getFileFunctions(projectPath, file);
    }

    return [];
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
    return path.resolve(...filename.replace(/\//, ' ').split(' '));
}

function fileDisplay(dirPath: string): CompletionItem[] {
    let output: CompletionItem[] = [];

    let files = fs.readdirSync(dirPath);

    for (let i = 0; i < files.length; ++i) {
        let filedir = path.join(dirPath, files[i]);
        let stats = fs.statSync(filedir);

        if (stats == null) return [];
        let isFile = stats.isFile();
        let isDir = stats.isDirectory();
        if (isFile && (filedir.search('\\.c') != -1 || filedir.search('\\.h') != -1)) {
            filedir = filedir.replace(dirPath, "").replace(/\\/g, '/').substr(1)
            output.push({ label: filedir, kind: CompletionItemKind.File, insertText: filedir });
        }
        else if (isDir) {
            filedir = filedir.replace(dirPath, "").replace(/\\/g, '/').substr(1) + "/";
            if (filedir.substring(0, 1) == '.') continue;
            output.push({ label: filedir, kind: CompletionItemKind.Folder, insertText: filedir.replace('/', ''), });
        }
    }
    return output;
};

export function init(context: ExtensionContext) {
    logger = context.logger;
    InitProjectFolder();
    context.subscriptions.push(languages.registerCompletionItemProvider('coc-lpcd', 'LPC', 'lpc', { provideCompletionItems }, ['/', '>', '<']));
    test();
}
