import {workspace, Logger, ExtensionContext, window, DocumentSymbol} from 'coc.nvim';
import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

var sscanf = require('sscanf');

const cocLpcConfig = workspace.getConfiguration('coc-lpc');
const workspaceStr = cocLpcConfig.get<string>("workspace", "newtxii");
const complieCommand = cocLpcConfig.get<string>("complie", "lpc_compile");
const efuncObjects = cocLpcConfig.get<Array<string>>('efunc', ["/etc/efun_define.c", "/sys/object/simul_efun.c"]);

let logger: Logger;

export function debug(message: any, ...args: any) {
    logger.info(message, ...args)
}

export function getFileRelativePath(absPath: string): string {
    if (workspaceStr == "") getProjectFolder();
    return absPath.slice(absPath.indexOf(`${workspaceStr}/`) + `${workspaceStr}/`.length, absPath.length);
}

export function getProjectFolder(): string {
    let curPath = workspace.cwd;
    if (curPath.length <= 0) return "";
    let pos = -1;
    pos = curPath.lastIndexOf(workspaceStr);
    if (pos < 0) return "";
    return curPath.slice(0, pos + `${workspaceStr}/`.length);
};

function complie(filename: string): Boolean {
    try {
        execSync(`cd ${getProjectFolder()} && ${complieCommand} ${filename}`, {shell: "/bin/bash", stdio: 'ignore'});
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
    let absFilename = path.resolve(getProjectFolder(), symbolDir, filename);
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
    // detail?: string,
    args?: string[],
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
    let fileSymbol: FileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0}
    let localArgs: string[] = []
    let currentLine = 0;
    let hasIncluded = new Set();

    lineInfo.forEach(line => {
        let lineSymbol: LineSymbol = sscanf(line, "%d %s %d %S", 'op', 'filename', 'lineno', 'detail');
        let targetSymbol: FileSymbol | undefined = fileSymbol;

        if (lineSymbol.filename == filename) currentLine = lineSymbol.lineno;

        if (lineSymbol.filename != filename) {
            if (!fileSymbol.childFileSymbol[lineSymbol.filename]) {

                fileSymbol.childFileSymbol[lineSymbol.filename] = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: lineSymbol.lineno};
            }
            targetSymbol = fileSymbol.childFileSymbol[lineSymbol.filename];
        }
        if (targetSymbol) {
            switch (lineSymbol.op) {
                case OP.INC:
                    if (!hasIncluded.has(lineSymbol.filename)) {
                        fileSymbol.include.push({name: lineSymbol.filename, line: currentLine});
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
                        targetSymbol.defined.push({name: define.substring(0, hasArgs), line: lineSymbol.lineno, args: args})
                    }
                    else {
                        if (spacePos < 0) {
                            targetSymbol.defined.push({name: define, line: lineSymbol.lineno})
                        }
                        else {
                            targetSymbol.defined.push({name: define.substring(0, spacePos), line: lineSymbol.lineno})
                        }
                    }
                    break
                case OP.VAR:
                    targetSymbol.variable.push({name: lineSymbol.detail, line: lineSymbol.lineno});
                    break
                case OP.FUNC:
                    targetSymbol.func.push({name: lineSymbol.detail, line: lineSymbol.lineno, args: [...localArgs]});
                    break
                case OP.NEW:
                    localArgs.push(lineSymbol.detail);
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
    });
    return fileSymbol;
}

function generateFileSymbol(filename: string) {
    let fileSymbol: FileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0}
    if (!complie(filename)) {
        return fileSymbol;
    }
    let res = loadSymbol(filename);
    fileSymbol = parse(filename, res);
    return fileSymbol;
}

function getDefineFunction(filename: string, line: number): Symbol[] {
    let ret: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);

    fileSymbol.func.forEach(func => {
        if (line < 0 || func.line <= line) {
            ret.push(func);
        }
    });
    return ret;
}

/**
 * include efun and simul_efun
 */
function getVisibleFunction(filename: string, line: number): Symbol[] {
    let res = getDefineFunction(filename, line);
    efuncObjects.forEach(efuncFile => {
        res.push(...getDefineFunction(efuncFile, -1))
    });
    return res;
}

function getMacroDefine(filename: string, line: number): Symbol[] {
    let ret: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);

    fileSymbol.defined.forEach(func => {
        if (line < 0 || func.line <= line) {
            ret.push(func);
        }
    });
    return ret;
}

function getGlobalVariable(filename: string, line: number): Symbol[] {
    let ret: Symbol[] = []
    let fileSymbol = generateFileSymbol(filename);

    fileSymbol.variable.forEach(func => {
        if (line < 0 || func.line <= line) {
            ret.push(func);
        }
    });
    return ret;

}

function getLocalVariable(filename: string, lineAt: number): Symbol[] {
    let symbolInfo = loadSymbol(filename);
    let lineInfo = symbolInfo.split('\n')
    let localArgs: Symbol[] = []

    for (let index = 0; index < lineInfo.length; index++) {
        let line = lineInfo[index];
        let lineSymbol: LineSymbol = sscanf(line, "%d %s %d %S", 'op', 'filename', 'lineno', 'detail');

        if (lineSymbol.filename == filename && lineSymbol.lineno > lineAt) {
            break
        }

        switch (lineSymbol.op) {
            case OP.NEW:
                localArgs.push({name: lineSymbol.detail, line: lineSymbol.lineno});
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
    return localArgs;
}

function test() {
    let res = generateFileSymbol("huodong/mall/main.c");
    debug(res);
}

export function init(context: ExtensionContext) {
    logger = context.logger;
    test();
}
