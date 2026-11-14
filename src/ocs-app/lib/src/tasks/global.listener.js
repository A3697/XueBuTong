"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileInArguments = exports.globalListenerRegister = void 0;
const window_1 = require("../window");
const electron_1 = require("electron");
const fs_1 = require("fs");
function globalListenerRegister(win) {
    electron_1.app.on('second-instance', (e, argv) => {
        if (win && process.platform === 'win32') {
            if (win.isMinimized()) {
                win.restore();
            }
            if (win.isVisible()) {
                win.focus();
            }
            else {
                win.show();
            }
            const file = getFileInArguments(argv);
            win.webContents.send('open-file', file);
        }
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            (0, window_1.createWindow)();
        }
    });
}
exports.globalListenerRegister = globalListenerRegister;
/**
 *
 * 获取命令行参数中的url信息
 * @param {string[]} argv
 * @returns
 */
function getFileInArguments(argv) {
    argv.shift();
    for (const arg of argv) {
        if (!arg.startsWith('-')) {
            if ((0, fs_1.existsSync)(arg) && (0, fs_1.statSync)(arg).isFile()) {
                return arg;
            }
        }
    }
}
exports.getFileInArguments = getFileInArguments;
