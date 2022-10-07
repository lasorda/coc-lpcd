# coc-lpcd

LPmud C Language extension for vim with coc.nvim

if you use vscode, see [https://github.com/lasorda/lpcd](https://github.com/lasorda/lpcd)

## Install

1. `:CocInstall coc-lpcd`
2. if you use fluffos, `:CocConfig` with
```json
{
    "coc-lpcd.efunc": [
        "/single/simul_efun.c",
        "/etc/efun_define.c"
    ],
    "coc-lpcd.include": "include",
    "coc-lpcd.workspace": "testsuite",
    "coc-lpcd.complie": "/home/panzhihao/fluffos/build/src/symbol etc/config.test "
}
```
`coc-lpcd.complie` is the command to get the complie result

see commit at `lpc auto completion supports in vim` [#820](https://github.com/fluffos/fluffos/pull/820)
