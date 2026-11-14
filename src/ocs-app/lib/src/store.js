"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecryptedRenderData = exports.store = exports.OriginalAppStore = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
// IO操作只能在 app.getPath('userData') 下进行，否则会有权限问题。
exports.OriginalAppStore = {
    name: electron_1.app.getName(),
    version: electron_1.app.getVersion(),
    /** 路径数据 */
    paths: {
        'app-path': electron_1.app.getAppPath(),
        'user-data-path': electron_1.app.getPath('userData'),
        'exe-path': electron_1.app.getPath('exe'),
        'logs-path': electron_1.app.getPath('logs'),
        'config-path': path_1.default.resolve(electron_1.app.getPath('userData'), './config.json'),
        /** 浏览器用户数据文件夹 */
        userDataDirsFolder: '',
        /** 浏览器下载文件夹 */
        downloadFolder: path_1.default.resolve(electron_1.app.getPath('userData'), './downloads'),
        /** 加载拓展路径 */
        extensionsFolder: path_1.default.resolve(electron_1.app.getPath('userData'), './downloads/extensions')
    },
    /** 软件设置 */
    app: {
        video_frame_rate: 1,
        data_encryption: true
    },
    /** 窗口设置 */
    window: {
        /** 开机自启 */
        alwaysOnTop: false,
        autoLaunch: false
    },
    /** 本地服务器数据 */
    server: {
        port: 18539,
        authToken: ''
    },
    /** 渲染进程数据 */
    render: {}
};
/**
 * - electron 本地存储对象
 * - 可以使用 store.store 访问
 * - 设置数据请使用 store.set('key', value)
 */
exports.store = new electron_store_1.default();
/**
 * 获取解密后的渲染进程数据
 */
function getDecryptedRenderData() {
    var _a, _b, _c;
    if (typeof ((_a = exports.store === null || exports.store === void 0 ? void 0 : exports.store.store) === null || _a === void 0 ? void 0 : _a.render) === 'string') {
        return JSON.parse(electron_1.safeStorage.decryptString(Buffer.from((_b = exports.store === null || exports.store === void 0 ? void 0 : exports.store.store) === null || _b === void 0 ? void 0 : _b.render, 'base64')));
    }
    return ((_c = exports.store === null || exports.store === void 0 ? void 0 : exports.store.store) === null || _c === void 0 ? void 0 : _c.render) || {};
}
exports.getDecryptedRenderData = getDecryptedRenderData;
