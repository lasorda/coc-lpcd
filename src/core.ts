import {workspace, Logger, ExtensionContext, window, DocumentSymbol} from 'coc.nvim';
import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

var sscanf = require('sscanf');

const cocLpcConfig = workspace.getConfiguration('coc-lpc');
const workspaceStr = cocLpcConfig.get<string>("workspace", "newtxii");
const complieCommand = cocLpcConfig.get<string>("complie", "lpc_compile");
const defaultInclude = cocLpcConfig.get<Array<string>>('efunc', ["/etc/vscode_efun_define/efun_define.h", "/sys/object/simul_efun.c"]);

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

function complie(filename: string) {
    try {
        execSync(`cd ${getProjectFolder()} && ${complieCommand} ${filename}`, {shell: "/bin/bash", stdio: 'ignore'});
    } catch (error) {
        window.showMessage(`complie ${filename} error`);
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
    args?: Array<string>,
}

interface FileSymbol {
    lineno: number;
    defined: Array<Symbol>,
    include: Array<Symbol>,
    variable: Array<Symbol>,
    func: Array<Symbol>,
    childFileSymbol: Map<string, FileSymbol>,
}

function parse(filename: string, symbolInfo: string) {
    let lineInfo = symbolInfo.split('\n')
    let fileSymbol: FileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: new Map(), lineno: 0}
    let localArgs: Array<string> = []

    lineInfo.forEach(line => {
        let lineSymbol: LineSymbol = sscanf(line, "%d %s %d %S", 'op', 'filename', 'lineno', 'detail');
        let targetSymbol: FileSymbol | undefined = fileSymbol;

        if (lineSymbol.filename != filename) {
            if (!fileSymbol.childFileSymbol.has(lineSymbol.filename)) {
                fileSymbol.childFileSymbol.set(lineSymbol.filename, {defined: [], include: [], variable: [], func: [], childFileSymbol: new Map(), lineno: lineSymbol.lineno});
            }
            targetSymbol = fileSymbol.childFileSymbol.get(lineSymbol.filename);
        }
        if (targetSymbol) {
            switch (lineSymbol.op) {
                case OP.INC:
                    targetSymbol.include.push({name: lineSymbol.filename, line: lineSymbol.lineno});
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

    debug(JSON.stringify(fileSymbol, null, 4))
    fileSymbol.childFileSymbol.forEach((value: FileSymbol, key: string, m: Map<string, FileSymbol>) => {
        debug(JSON.stringify(value, null, 4))
    });
}

function test() {
    let filename = "huodong/mall/main.c";
    complie(filename);
    let res = loadSymbol(filename);
    parse(filename, res);
}

export function init(context: ExtensionContext) {
    logger = context.logger;
    test();
}
