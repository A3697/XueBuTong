"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWindow = void 0;
// @ts-check
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        title: '学不通',
        icon: path_1.default.resolve('./public/favicon.ico'),
        backgroundColor: '#ffffff',
        minWidth: 700,
        minHeight: 400,
        width: Math.min(1280,electron_1.screen.getPrimaryDisplay().workAreaSize.width),
        height: Math.min(860,electron_1.screen.getPrimaryDisplay().workAreaSize.height),
        center: true,
        hasShadow: true,
        autoHideMenuBar: true,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: 'white',
            symbolColor: 'black'
        },
        frame: false,
        show: false,
        webPreferences: {
            backgroundThrottling: false,
            zoomFactor: 1,
            // 关闭拼写矫正
            spellcheck: false,
            webSecurity: true,
            // 开启node
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    win.webContents.on('will-navigate', (event, url) => {
        event.preventDefault();
        electron_1.shell.openExternal(url);
    });
    win.webContents.setWindowOpenHandler((detail) => {
        electron_1.shell.openExternal(detail.url);
        return {
            action: 'deny'
        };
    });
    return win;
}
exports.createWindow = createWindow;
