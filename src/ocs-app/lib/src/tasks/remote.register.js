"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRemoteEvent = exports.remoteRegister = void 0;
const electron_1 = require("electron");
const logger_1 = require("../logger");
const auto_launch_1 = require("./auto.launch");
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("../utils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
const common_1 = require("@ocs-desktop/common");
const systeminformation_1 = __importDefault(require("systeminformation"));
const store_1 = require("../store");
const index_1 = require("../utils/index");
const promises_1 = require("fs/promises");
const updater_1 = require("./updater");
const scripts_1 = require("../scripts");
const browser_1 = require("../utils/browser");
/**
 * 注册主进程远程通信事件
 * @param name 事件前缀名称
 * @param target 事件目标
 */
function registerRemoteEvent(name, target) {
    const logger = (0, logger_1.Logger)('remote');
    try {
        electron_1.ipcMain
            .on(name + '-get', (event, [property]) => {
            try {
                // logger.info({ event: name + '-get', args: [property] });
                event.returnValue = target[property];
            }
            catch (e) {
                event.returnValue = { error: e };
            }
        })
            .on(name + '-set', (event, [property, value]) => {
            try {
                // logger.info({ event: name + '-set', args: [property, value] });
                event.returnValue = target[property] = value;
            }
            catch (e) {
                event.returnValue = { error: e };
            }
        })
            /** 异步调用 */
            .on(name + '-call', (event, [
        /** 回调id */
        respondChannel, property, ...args]) => __awaiter(this, void 0, void 0, function* () {
            // logger.info({ event: name + '-call', args });
            try {
                const result = yield target[property](...args);
                event.reply(respondChannel, { data: result });
            }
            catch (e) {
                event.reply(respondChannel, { error: e });
            }
        }))
            /** 同步调用 */
            .on(name + '-call-sync', (event, [property, ...args]) => {
            // logger.info({ event: name + '-call-sync', args: [property] });
            try {
                const result = target[property](...args);
                event.returnValue = { data: result };
            }
            catch (e) {
                event.returnValue = { error: e };
            }
        });
    }
    catch (err) {
        logger.error(err);
    }
}
let win;
/** 需远程共享的方法 */
const methods = {
    autoLaunch: auto_launch_1.autoLaunch,
    get: (url, config) => axios_1.default.get(url, config).then((res) => res.data),
    post: (url, config) => axios_1.default.post(url, config).then((res) => res.data),
    download: (channel, url, dest) => {
        /** 下载文件 */
        return (0, utils_1.downloadFile)(url, dest, (rate, totalLength, chunkLength) => {
            var _a;
            (_a = win === null || win === void 0 ? void 0 : win.webContents) === null || _a === void 0 ? void 0 : _a.send('download', channel, rate, totalLength, chunkLength);
        });
    },
    zip: utils_1.zip,
    unzip: utils_1.unzip,
    getValidBrowsers: common_1.getValidBrowsers,
    getBrowserMajorVersion: browser_1.getBrowserMajorVersion,
    getExtensionPaths: browser_1.getExtensionPaths,
    systemProcesses: () => systeminformation_1.default.processes(),
    exportExcel: index_1.exportExcel,
    statisticFolderSize: statisticFolderSize,
    getPlatform: () => process.platform,
    updateApp: updater_1.updateApp,
    moveWindowToTop: utils_1.moveWindowToTop,
    encryptString: (text) => electron_1.safeStorage.encryptString(text).toString('base64'),
    decryptString: (text) => {
        return electron_1.safeStorage.decryptString(Buffer.from(text, 'base64'));
    },
    isEncryptionAvailable: () => {
        return electron_1.safeStorage.isEncryptionAvailable();
    },
    isDirectory: (path) => fs_1.default.statSync(path).isDirectory(),
    getRawScripts: () => JSON.parse(JSON.stringify(scripts_1.scripts)),
    captureDesktopScreen: () => {
        return electron_1.desktopCapturer.getSources({ types: ['window'] });
    }
};
/**
 * 初始化远程通信
 */
function remoteRegister(_win) {
    win = _win;
    registerRemoteEvent('electron-store', store_1.store);
    registerRemoteEvent('fs', fs_1.default);
    registerRemoteEvent('os', os_1.default);
    registerRemoteEvent('path', path_1.default);
    registerRemoteEvent('crypto', crypto_1.default);
    registerRemoteEvent('OCSApi', common_1.OCSApi);
    registerRemoteEvent('win', _win);
    registerRemoteEvent('webContents', _win.webContents);
    registerRemoteEvent('app', electron_1.app);
    registerRemoteEvent('dialog', electron_1.dialog);
    registerRemoteEvent('methods', methods);
    registerRemoteEvent('logger', (0, logger_1.Logger)('render'));
    registerRemoteEvent('desktopCapturer', electron_1.desktopCapturer);
}
exports.remoteRegister = remoteRegister;
const _registerRemoteEvent = registerRemoteEvent;
exports.registerRemoteEvent = _registerRemoteEvent;
async function statisticFolderSize(dir) {
    let total=0;const folders=[dir];
    while(folders.length){
        const folder=folders.pop(),files=await (0,promises_1.readdir)(folder,{withFileTypes:true}),regular=[];
        for(const file of files){const target=path_1.default.join(folder,file.name);if(file.isDirectory())folders.push(target);else if(file.isFile())regular.push(target);}
        for(let i=0;i<regular.length;i+=16){const stats=await Promise.all(regular.slice(i,i+16).map(p=>(0,promises_1.stat)(p)));for(const item of stats)total+=item.size;}
    }
    return total;
}
