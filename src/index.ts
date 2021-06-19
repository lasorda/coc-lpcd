import {ExtensionContext, window} from 'coc.nvim';
import * as core from './core'

export async function activate(context: ExtensionContext): Promise<void> {
    window.showMessage(`coc-lpcd works!`);
    core.init(context);
}


