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
var cocLpcConfig = import_coc.workspace.getConfiguration("coc-lpc");
var workspaceStr = cocLpcConfig.get("workspace", "newtxii");
var complieCommand = cocLpcConfig.get("complie", "lpc_compile");
var defaultInclude = cocLpcConfig.get("efunc", ["/etc/vscode_efun_define/efun_define.h", "/sys/object/simul_efun.c"]);
var logger;
function debug(message, ...args) {
  logger.info(message, ...args);
}
function getProjectFolder() {
  let curPath = import_coc.workspace.cwd;
  if (curPath.length <= 0)
    return "";
  let pos = -1;
  pos = curPath.lastIndexOf(workspaceStr);
  if (pos < 0)
    return "";
  return curPath.slice(0, pos + `${workspaceStr}/`.length);
}
function complie(filename) {
  try {
    (0, import_child_process.execSync)(`cd ${getProjectFolder()} && ${complieCommand} ${filename}`, {shell: "/bin/bash", stdio: "ignore"});
  } catch (error) {
    import_coc.window.showMessage(`complie ${filename} error`);
  }
}
var symbolDir = ".symbol";
function loadSymbol(filename) {
  if (filename.startsWith("/")) {
    filename = filename.substring(1);
  }
  filename = filename.replace(/\//g, "#");
  let absFilename = path.resolve(getProjectFolder(), symbolDir, filename);
  debug(absFilename);
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
  let fileSymbol = {defined: [], include: [], variable: [], func: [], childFileSymbol: new Map()};
  let localArgs = [];
  lineInfo.forEach((line) => {
    let lineSymbol = sscanf(line, "%d %s %d %s", "op", "filename", "lineno", "detail");
    let targetSymbol = fileSymbol;
    if (lineSymbol.filename != filename) {
      if (!fileSymbol.childFileSymbol.has(lineSymbol.filename)) {
        fileSymbol.childFileSymbol.set(lineSymbol.filename, {defined: [], include: [], variable: [], func: [], childFileSymbol: new Map()});
      }
      targetSymbol = fileSymbol.childFileSymbol.get(lineSymbol.filename);
    }
    if (targetSymbol) {
      switch (lineSymbol.op) {
        case 1:
          targetSymbol.include.push({name: lineSymbol.filename, line: lineSymbol.lineno});
          break;
        case 2:
          break;
        case 3:
          targetSymbol.variable.push({name: lineSymbol.filename, line: lineSymbol.lineno});
          break;
        case 4:
          targetSymbol.include.push({name: lineSymbol.filename, line: lineSymbol.lineno, args: localArgs});
          break;
        case 5:
          localArgs.push(lineSymbol.detail);
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
  });
}
function test() {
  let filename = "huodong/mall/main.c";
  complie(filename);
  let res = loadSymbol(filename);
  parse(filename, res);
}
function init(context) {
  logger = context.logger;
  test();
}

// src/index.ts
async function activate(context) {
  import_coc2.window.showMessage(`coc-lpcd works!`);
  init(context);
}
