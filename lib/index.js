var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __commonJS = (callback, module2) => () => {
  if (!module2) {
    module2 = {exports: {}};
    callback(module2.exports, module2);
  }
  return module2.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __exportStar = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __exportStar(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};

// node_modules/sscanf/lib/utils.js
var require_utils = __commonJS((exports2) => {
  "use strict";
  var DEBUG = true;
  var ASCII = {
    a: "a".charCodeAt(),
    f: "f".charCodeAt(),
    A: "A".charCodeAt(),
    F: "F".charCodeAt(),
    0: "0".charCodeAt(),
    8: "8".charCodeAt(),
    9: "9".charCodeAt()
  };
  exports2.hex2int = function(str) {
    let ret = 0, digit = 0;
    str = str.replace(/^[0O][Xx]/, "");
    for (let i = str.length - 1; i >= 0; i--) {
      let num = intAtHex(str[i], digit++);
      if (num !== null) {
        ret += num;
      } else {
        if (DEBUG) {
          console.warn("[WARN] scanf: Invalid hex [%s]", str);
        }
        return null;
      }
    }
    return ret;
  };
  var intAtHex = function(c, digit) {
    let ret = null;
    let ascii = c.charCodeAt();
    if (ASCII.a <= ascii && ascii <= ASCII.f) {
      ret = ascii - ASCII.a + 10;
    } else if (ASCII.A <= ascii && ascii <= ASCII.F) {
      ret = ascii - ASCII.A + 10;
    } else if (ASCII[0] <= ascii && ascii <= ASCII[9]) {
      ret = ascii - ASCII[0];
    } else {
      if (DEBUG) {
        console.warn("[WARN] scanf: Invalid ascii [%s]", c);
      }
      return null;
    }
    while (digit--) {
      ret *= 16;
    }
    return ret;
  };
  exports2.octal2int = function(str) {
    str = str.replace(/^0/, "");
    let ret = 0, digit = 0;
    for (let i = str.length - 1; i >= 0; i--) {
      let num = intAtOctal(str[i], digit++);
      if (num !== null) {
        ret += num;
      } else {
        if (DEBUG) {
          console.warn("[WARN] scanf: Invalid octal [%s]", str);
        }
        return null;
      }
    }
    return ret;
  };
  var intAtOctal = function(c, digit) {
    let num = null;
    let ascii = c.charCodeAt();
    if (ascii >= ASCII[0] && ascii <= ASCII[8]) {
      num = ascii - ASCII[0];
    } else {
      if (DEBUG) {
        console.warn("[WARN] scanf: Invalid char to Octal [%s]", c);
      }
      return null;
    }
    while (digit--) {
      num *= 8;
    }
    return num;
  };
  exports2.regslashes = function(pre) {
    return pre.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\|/g, "\\|");
  };
  exports2.stripslashes = function(str) {
    return str.replace(/\\([\sA-Za-z\\]|[0-7]{1,3})/g, function(str2, c) {
      switch (c) {
        case "\\":
          return "\\";
        case "0":
          return "\0";
        default:
          if (/^\w$/.test(c)) {
            return getSpecialChar(c);
          } else if (/^\s$/.test(c)) {
            return c;
          } else if (/([0-7]{1,3})/.test(c)) {
            return getASCIIChar(c);
          }
          return str2;
      }
    });
  };
  var getASCIIChar = function(str) {
    let num = exports2.octal2int(str);
    return String.fromCharCode(num);
  };
  var getSpecialChar = function(letter) {
    switch (letter.toLowerCase()) {
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "	";
      case "v":
        return "\v";
      default:
        return letter;
    }
  };
});

// node_modules/sscanf/lib/format.js
var require_format = __commonJS((exports2, module2) => {
  "use strict";
  var utils = require_utils();
  function Format(str) {
    this.input = str;
  }
  Format.prototype.getInteger = function(pre, next) {
    let text = getInput(this, pre, next, "[-]?[A-Za-z0-9]+");
    if (!text) {
      return null;
    } else if (text[0] == "0") {
      if (text[1] == "x" || text[1] == "X") {
        return utils.hex2int(text);
      } else {
        return utils.octal2int(text);
      }
    } else {
      return parseInt(text);
    }
  };
  Format.prototype.getFloat = function(pre, next) {
    let text = getInput(this, pre, next, "[-]?[0-9]+[.]?[0-9]*");
    return parseFloat(text);
  };
  Format.prototype.getHex = function(pre, next) {
    let text = getInput(this, pre, next, "[A-Za-z0-9]+");
    return utils.hex2int(text);
  };
  Format.prototype.getOctal = function(pre, next) {
    let text = getInput(this, pre, next, "[A-Za-z0-9]+");
    return utils.octal2int(text);
  };
  Format.prototype.getString = function(pre, next) {
    let text = getInput(this, pre, next, "([\\w\\]=-]|\\S[^\\][^\\ ])+(\\\\[\\w\\ ][\\w\\:]*)*", "STR");
    if (/\\/.test(text))
      text = utils.stripslashes(text);
    return text;
  };
  Format.prototype.getLine = function(pre, next) {
    let text = getInput(this, pre, next, "[^\n\r]*");
    if (/\\/.test(text))
      text = utils.stripslashes(text);
    return text;
  };
  var getInput = function(self, pre, next, match, type) {
    let result, input = self.input;
    if (!input.length || input === "\r") {
      return null;
    }
    let replace = "(" + match + ")";
    let tmp = input;
    if (type === "STR" && next.trim().length > 0) {
      let before_macth = utils.regslashes(pre);
      let after_match = utils.regslashes(next) + "[\\w\\W]*";
      if (before_macth.length) {
        tmp = tmp.replace(new RegExp(before_macth), "");
      }
      tmp = tmp.replace(new RegExp(after_match), "");
    } else {
      replace = utils.regslashes(pre) + replace;
    }
    let m = tmp.match(new RegExp(replace));
    if (!m) {
      self.input = input.replace(utils.regslashes(pre) + utils.regslashes(next), "");
      return null;
    }
    result = m[1];
    self.input = input.substr(input.indexOf(result)).replace(result, "").replace(next, "");
    return result;
  };
  module2.exports = Format;
});

// node_modules/sscanf/lib/sscanf.js
var require_sscanf = __commonJS((exports2, module2) => {
  "use strict";
  var Format = require_format();
  module2.exports = function(input, formats) {
    let format = new Format(input);
    let re = new RegExp("[^%]*%[A-Za-z][^%]*", "g");
    let selectors = formats.match(re);
    let result, len = selectors.length;
    let jsonFlag = false, count = 0;
    let deal = dealType.bind(null, format);
    let keys = Array.prototype.slice.call(arguments, 2);
    if (keys.length > 0) {
      result = {};
      jsonFlag = true;
    } else if (len > 1) {
      result = [];
    } else {
      return deal(selectors[0]);
    }
    selectors.map((val) => {
      if (jsonFlag) {
        result[keys.shift() || count++] = deal(val);
      } else {
        result.push(deal(val));
      }
    });
    return result;
  };
  function dealType(format, selector) {
    let ret;
    let res = selector.match(/%[A-Za-z]+/);
    let res2 = selector.match(/[^%]*/);
    if (!res) {
      return null;
    }
    let type = res[0];
    let pre = !!res2 ? res2[0] : null;
    let next = selector.substr(selector.indexOf(type) + type.length);
    switch (type) {
      case "%d":
      case "%ld":
      case "%llu":
      case "%lu":
      case "%u":
        ret = format.getInteger(pre, next);
        break;
      case "%c":
      case "%s":
        ret = format.getString(pre, next);
        break;
      case "%S":
        ret = format.getLine(pre, next);
        break;
      case "%X":
      case "%x":
        ret = format.getHex(pre, next);
        break;
      case "%O":
      case "%o":
        ret = format.getOctal(pre, next);
        break;
      case "%f":
        ret = format.getFloat(pre, next);
        break;
      default:
        throw new Error('Unknown type "' + type + '"');
    }
    return ret;
  }
});

// node_modules/file-uri-to-path/dist/src/index.js
var require_src = __commonJS((exports2, module2) => {
  "use strict";
  var path_1 = require("path");
  function fileUriToPath(uri) {
    if (typeof uri !== "string" || uri.length <= 7 || uri.substring(0, 7) !== "file://") {
      throw new TypeError("must pass in a file:// URI to convert to a file path");
    }
    const rest = decodeURI(uri.substring(7));
    const firstSlash = rest.indexOf("/");
    let host = rest.substring(0, firstSlash);
    let path2 = rest.substring(firstSlash + 1);
    if (host === "localhost") {
      host = "";
    }
    if (host) {
      host = path_1.sep + path_1.sep + host;
    }
    path2 = path2.replace(/^(.+)\|/, "$1:");
    if (path_1.sep === "\\") {
      path2 = path2.replace(/\//g, "\\");
    }
    if (/^.+:/.test(path2)) {
    } else {
      path2 = path_1.sep + path2;
    }
    return host + path2;
  }
  module2.exports = fileUriToPath;
});

// src/index.ts
__markAsModule(exports);
__export(exports, {
  activate: () => activate
});
var import_coc2 = __toModule(require("coc.nvim"));

// src/core.ts
var import_coc = __toModule(require("coc.nvim"));
var import_child_process = __toModule(require("child_process"));
var fs = __toModule(require("fs"));
var path = __toModule(require("path"));
var sscanf = require_sscanf();
var uri2path = require_src();
var cocLpcConfig = import_coc.workspace.getConfiguration("coc-lpc");
var workspaceStr = cocLpcConfig.get("workspace", "newtxii");
var complieCommand = cocLpcConfig.get("complie", "lpc_compile");
var efuncObjects = cocLpcConfig.get("efunc", ["/etc/efun_define.c", "/sys/object/simul_efun.c"]);
var logger;
function debug(message, ...args) {
  logger.info(message, ...args);
}
function getFileRelativePath(uri) {
  return path.relative(projectFolder, uri2path(uri));
}
var projectFolder = "";
var inc = "";
function InitProjectFolder() {
  let curPath = import_coc.workspace.cwd;
  let pos = curPath.lastIndexOf(workspaceStr);
  if (pos >= 0) {
    projectFolder = curPath.slice(0, pos + `${workspaceStr}/`.length);
    inc = path.resolve(projectFolder, cocLpcConfig.get("include", "inc"));
  }
}
function complie(filename) {
  try {
    (0, import_child_process.execSync)(`cd ${projectFolder} && ${complieCommand} ${filename}`, {shell: "/bin/bash", stdio: "ignore"});
    return true;
  } catch (error) {
    import_coc.window.showMessage(`complie ${filename} error`);
    return false;
  }
}
var symbolDir = ".symbol";
function loadSymbol(filename) {
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
var OP;
(function(OP2) {
  OP2[OP2["INC"] = 1] = "INC";
  OP2[OP2["DEFINE"] = 2] = "DEFINE";
  OP2[OP2["VAR"] = 3] = "VAR";
  OP2[OP2["FUNC"] = 4] = "FUNC";
  OP2[OP2["NEW"] = 5] = "NEW";
  OP2[OP2["POP"] = 6] = "POP";
  OP2[OP2["FREE"] = 7] = "FREE";
})(OP || (OP = {}));
function parse(filename, symbolInfo) {
  let lineInfo = symbolInfo.split("\n");
  let fileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0};
  let localArgs = [];
  let currentLine = 0;
  let hasIncluded = new Set();
  let lastFunction = null;
  lineInfo.forEach((line) => {
    if (line.length == 0)
      return;
    let lineSymbol = sscanf(line, "%d %s %d %S", "op", "filename", "lineno", "detail");
    let targetSymbol = fileSymbol;
    if (!lineSymbol.detail)
      lineSymbol.detail = "";
    if (lineSymbol.filename == filename)
      currentLine = lineSymbol.lineno;
    if (lineSymbol.filename != filename) {
      if (!fileSymbol.childFileSymbol[lineSymbol.filename]) {
        fileSymbol.childFileSymbol[lineSymbol.filename] = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: lineSymbol.lineno};
      }
      targetSymbol = fileSymbol.childFileSymbol[lineSymbol.filename];
    }
    if (targetSymbol) {
      switch (lineSymbol.op) {
        case 1:
          if (!hasIncluded.has(lineSymbol.filename)) {
            fileSymbol.include.push({name: lineSymbol.filename, line: currentLine, filename: lineSymbol.filename});
            hasIncluded.add(lineSymbol.filename);
          }
          break;
        case 2:
          let hasArgs = 0;
          let define = lineSymbol.detail.trim();
          let spacePos = define.search(`\\s+`);
          for (let index = 0; index < spacePos; index++) {
            const element = define[index];
            if (element == "(") {
              hasArgs = index;
              break;
            }
          }
          if (hasArgs) {
            let right = hasArgs;
            while (right < define.length && define[right] != ")")
              right++;
            let args = define.substring(hasArgs + 1, right).replace(",", " ").split(" ");
            args = args.filter(function(value, index, array) {
              return value.length > 0;
            });
            targetSymbol.defined.push({
              name: define.substring(0, hasArgs),
              line: lineSymbol.lineno,
              args,
              filename: lineSymbol.filename,
              detail: lineSymbol.detail.substring(right + 1, lineSymbol.detail.length).trim()
            });
          } else {
            if (spacePos < 0) {
              targetSymbol.defined.push({
                name: define,
                line: lineSymbol.lineno,
                filename: lineSymbol.filename,
                detail: void 0
              });
            } else {
              targetSymbol.defined.push({
                name: define.substring(0, spacePos),
                line: lineSymbol.lineno,
                filename: lineSymbol.filename,
                detail: lineSymbol.detail.substring(spacePos, lineSymbol.detail.length).trim()
              });
            }
          }
          break;
        case 3:
          targetSymbol.variable.push({name: lineSymbol.detail, line: lineSymbol.lineno, filename: lineSymbol.filename});
          break;
        case 4:
          targetSymbol.func.push({name: lineSymbol.detail, line: lineSymbol.lineno, args: [...localArgs], op: [], filename: lineSymbol.filename});
          lastFunction = targetSymbol.func[targetSymbol.func.length - 1];
          break;
        case 5:
          localArgs.push(lineSymbol.detail);
          if (lastFunction && lastFunction.op) {
            lastFunction.op.push(lineSymbol);
          }
          break;
        case 6:
          let n = parseInt(lineSymbol.detail);
          while (localArgs.length > 0 && n > 0) {
            localArgs.pop();
            n--;
          }
          if (lastFunction && lastFunction.op) {
            lastFunction.op.push(lineSymbol);
          }
          break;
        case 7:
          localArgs = [];
          if (lastFunction && lastFunction.op) {
            lastFunction.op.push(lineSymbol);
          }
          break;
        default:
      }
    }
  });
  return fileSymbol;
}
var fileSymbolCache = {};
var fileSymbolCacheTime = {};
function generateFileSymbol(filename) {
  let fileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: {}, lineno: 0};
  if (filename in fileSymbolCacheTime && Date.now() / 1e3 - fileSymbolCacheTime[filename] < 2) {
    return fileSymbolCache[filename];
  }
  if (!complie(filename)) {
    if (filename in fileSymbolCache)
      return fileSymbolCache[filename];
    return fileSymbol;
  }
  let res = loadSymbol(filename);
  fileSymbol = parse(filename, res);
  fileSymbolCache[filename] = fileSymbol;
  fileSymbolCacheTime[filename] = Date.now() / 1e3;
  return fileSymbol;
}
function getDefineFunction(filename, line, includeChild) {
  let ret = [];
  let fileSymbol = generateFileSymbol(filename);
  fileSymbol.func.forEach((func) => {
    if (line < 0 || func.line <= line) {
      ret.push(func);
    }
  });
  if (includeChild) {
    for (var file in fileSymbol.childFileSymbol) {
      let childSymbol = fileSymbol.childFileSymbol[file];
      if (line < 0 || childSymbol.lineno <= line) {
        ret.push(...childSymbol.func);
      }
    }
  }
  return ret;
}
function getVisibleFunction(filename, line) {
  let res = getDefineFunction(filename, line, true);
  efuncObjects.forEach((efuncFile) => {
    res.push(...getDefineFunction(efuncFile, -1, true));
  });
  return res;
}
function getMacroDefine(filename, line, includeChild) {
  let ret = [];
  let fileSymbol = generateFileSymbol(filename);
  fileSymbol.defined.forEach((defined) => {
    if (line < 0 || defined.line <= line) {
      ret.push(defined);
    }
  });
  if (includeChild) {
    for (var file in fileSymbol.childFileSymbol) {
      let childSymbol = fileSymbol.childFileSymbol[file];
      if (line < 0 || childSymbol.lineno <= line) {
        ret.push(...childSymbol.defined);
      }
    }
  }
  return ret;
}
function getGlobalVariable(filename, line, includeChild) {
  let ret = [];
  let fileSymbol = generateFileSymbol(filename);
  fileSymbol.variable.forEach((variable) => {
    if (line < 0 || variable.line <= line) {
      ret.push(variable);
    }
  });
  if (includeChild) {
    for (var file in fileSymbol.childFileSymbol) {
      let childSymbol = fileSymbol.childFileSymbol[file];
      if (line < 0 || childSymbol.lineno <= line) {
        ret.push(...childSymbol.variable);
      }
    }
  }
  return ret;
}
function getLocalVariable(filename, lineAt) {
  let localArgs = [];
  let fileSymbol = generateFileSymbol(filename);
  let lastFunction = null;
  for (let index = 0; index < fileSymbol.func.length; index++) {
    const func = fileSymbol.func[index];
    if (func.line <= lineAt) {
      lastFunction = func;
    } else {
      break;
    }
  }
  if (lastFunction && lastFunction.args && lastFunction.op) {
    for (let index = 0; index < lastFunction.args.length; index++) {
      const arg = lastFunction.args[index];
      localArgs.push({name: arg, line: lastFunction.line, filename});
    }
    for (let index = 0; index < lastFunction.op.length; index++) {
      const lineSymbol = lastFunction.op[index];
      if (lineSymbol.lineno > lineAt)
        break;
      switch (lineSymbol.op) {
        case 5:
          localArgs.push({name: lineSymbol.detail, line: lineSymbol.lineno, filename: lineSymbol.filename});
          break;
        case 6:
          let n = parseInt(lineSymbol.detail);
          while (localArgs.length > 0 && n > 0) {
            localArgs.pop();
            n--;
          }
          break;
        case 7:
          localArgs = [];
          break;
        default:
      }
    }
  }
  return localArgs;
}
function getLine(document, line) {
  return document.getText({start: {line: line - 1, character: 1e5}, end: {line, character: 1e5}});
}
var completionCache = {};
var completionCacheTime = {};
function provideCompletionItems(document, position, token, context) {
  var _a;
  const line = getLine(document, position.line);
  const lineText = line.substring(0, position.character);
  let reg;
  reg = /#include\s+?(<)\w*?$/;
  if (reg.test(lineText)) {
    let result = getFileAndDir(inc);
    return result;
  }
  reg = /#include\s+?(\")([\w|\/]*?)$/;
  if (reg.test(lineText)) {
    let exec_result = reg.exec(lineText);
    let result = [];
    if (exec_result) {
      if (exec_result[2].search("/") == -1)
        result.push(...getFileAndDir(inc));
      let dir = exec_result[2].split("/");
      let target = "";
      dir.pop();
      if (!exec_result[2].startsWith("/")) {
        target = path.resolve(path.dirname(uri2path(document.uri)), ...dir);
      } else {
        target = path.resolve(projectFolder, ...dir);
      }
      result.push(...getFileAndDir(target));
    }
    return result;
  }
  reg = /(\")([\w\/]*)$/;
  if (reg.test(lineText)) {
    let exec_result = reg.exec(lineText);
    if (exec_result != null) {
      let dir = exec_result[2].split("/");
      dir.pop();
      return getFileAndDir(path.resolve(projectFolder, ...dir));
    }
    return [];
  }
  reg = /([\w\/\"\.]+|this_object\(\))->/;
  if (reg.test(lineText)) {
    let exec_result = reg.exec(lineText);
    let file = "";
    if (exec_result == null)
      return [];
    if (exec_result[1] == "this_object()") {
      file = `"${getFileRelativePath(document.uri)}"`;
    } else {
      file = exec_result[1];
    }
    if (!file.startsWith('"')) {
      let define = getMacroDefine(getFileRelativePath(document.uri), position.line, true);
      for (let index = 0; index < define.length; index++) {
        const def = define[index];
        if (def.name == exec_result[1] && def.detail) {
          file = def.detail;
        }
      }
    }
    file = prettyFilename(file.substring(1, file.length - 1));
    let res2 = [];
    let allFunction = getDefineFunction(file, -1, true);
    for (let index = 0; index < allFunction.length; index++) {
      const func = allFunction[index];
      res2.push({
        label: func.name,
        kind: import_coc.CompletionItemKind.Function,
        insertText: func.name + makeSnippetPlaceHolderStr(func.args || []),
        insertTextFormat: import_coc.InsertTextFormat.Snippet
      });
    }
    return res2;
  }
  let filename = getFileRelativePath(document.uri);
  if (filename in completionCache && filename in completionCacheTime && Date.now() / 1e3 - completionCacheTime[filename] < 5) {
    return completionCache[filename];
  }
  let res = [];
  for (const local of getLocalVariable(filename, position.line)) {
    res.push({
      label: local.name,
      kind: import_coc.CompletionItemKind.Variable,
      insertText: local.name,
      insertTextFormat: import_coc.InsertTextFormat.PlainText
    });
  }
  for (const func of getVisibleFunction(filename, position.line)) {
    res.push({
      label: func.name,
      kind: import_coc.CompletionItemKind.Function,
      insertText: func.name + makeSnippetPlaceHolderStr(func.args || []),
      insertTextFormat: import_coc.InsertTextFormat.Snippet
    });
  }
  for (const define of getMacroDefine(filename, position.line, true)) {
    debug(define);
    if ((_a = define.args) == null ? void 0 : _a.length) {
      res.push({
        label: define.name,
        kind: import_coc.CompletionItemKind.Constant,
        insertText: define.name + makeSnippetPlaceHolderStr(define.args || []),
        insertTextFormat: import_coc.InsertTextFormat.Snippet
      });
    } else {
      res.push({
        label: define.name,
        kind: import_coc.CompletionItemKind.Constant,
        insertText: define.name,
        insertTextFormat: import_coc.InsertTextFormat.PlainText
      });
    }
  }
  for (const variable of getGlobalVariable(filename, position.line, true)) {
    res.push({
      label: variable.name,
      kind: import_coc.CompletionItemKind.Variable,
      insertText: variable.name,
      insertTextFormat: import_coc.InsertTextFormat.PlainText
    });
  }
  completionCache[filename] = res;
  completionCacheTime[filename] = Date.now() / 1e3;
  return res;
}
function makeSnippetPlaceHolderStr(args) {
  let res = "";
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (index > 0) {
      res += ", ";
    }
    res += "${" + (index + 1) + ":" + arg.trim() + "}";
  }
  return "(" + res + ")";
}
function prettyFilename(filename) {
  return path.resolve("/", ...filename.replace(/\//, " ").split(" ")).substring(1);
}
function getFileAndDir(dirPath) {
  let output = [];
  if (!fs.existsSync(dirPath))
    return output;
  let files = fs.readdirSync(dirPath);
  for (let i = 0; i < files.length; ++i) {
    let filedir = path.join(dirPath, files[i]);
    let stats = fs.statSync(filedir);
    if (stats == null)
      return [];
    let isFile = stats.isFile();
    let isDir = stats.isDirectory();
    if (isFile && (filedir.search("\\.c") != -1 || filedir.search("\\.h") != -1)) {
      filedir = filedir.replace(dirPath, "").replace(/\\/g, "/").substr(1);
      output.push({label: filedir, kind: import_coc.CompletionItemKind.File, insertText: filedir});
    } else if (isDir) {
      filedir = filedir.replace(dirPath, "").replace(/\\/g, "/").substr(1) + "/";
      if (filedir.substring(0, 1) == ".")
        continue;
      output.push({label: filedir, kind: import_coc.CompletionItemKind.Folder, insertText: filedir.replace("/", "")});
    }
  }
  return output;
}
function init(context) {
  logger = context.logger;
  InitProjectFolder();
  context.subscriptions.push(import_coc.languages.registerCompletionItemProvider("coc-lpcd", "LPC", "lpc", {provideCompletionItems}, ["/", ">", "<"]));
}

// src/index.ts
async function activate(context) {
  import_coc2.window.showMessage(`coc-lpcd works!`);
  init(context);
}
