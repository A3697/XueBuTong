require('../xingchan-lab-bootstrap.cjs');
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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const remote_register_1 = require("./src/tasks/remote.register");
const init_store_1 = require("./src/tasks/init.store");
const auto_launch_1 = require("./src/tasks/auto.launch");
const window_1 = require("./src/window");
const global_listener_1 = require("./src/tasks/global.listener");
const utils_1 = require("./src/utils");
const error_handler_1 = require("./src/tasks/error.handler");
const updater_1 = require("./src/tasks/updater");
const startup_server_1 = require("./src/tasks/startup.server");
const init_chrome_1 = require("./src/tasks/init.chrome");
const store_1 = require("./src/store");
electron_1.app.setName('学不通');
// 防止软件崩溃以及兼容
if(process.env.OCS_FUSION_SOFTWARE_RENDER==='1'){
 electron_1.app.commandLine.appendSwitch('disable-gpu');
 electron_1.app.disableHardwareAcceleration();
}
/** 获取单进程锁 */
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    bootstrap();
}
/** 启动渲染进程 */
function bootstrap() {
    (0, utils_1.task)('学不通启动程序', () => Promise.all([
        (0, utils_1.task)('初始化错误处理', () => (0, error_handler_1.handleError)()),
        (0, utils_1.task)('初始化本地设置', async () => {
            await electron_1.app.whenReady();
            (0, init_store_1.initStore)();
            (0, utils_1.task)('启动接口服务', () => (0, startup_server_1.startupServer)());
        }),
        (0, utils_1.task)('初始化自动启动', () => electron_1.app.whenReady().then(() => (0, auto_launch_1.autoLaunch)())),
        (0, utils_1.task)('启动渲染进程', () => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // 设置 webrtc 的影像帧率比例，最高100，太高会造成卡顿，参数默认50
            electron_1.app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', ((_b = (_a = store_1.store.store.app) === null || _a === void 0 ? void 0 : _a.video_frame_rate) !== null && _b !== void 0 ? _b : 1).toString());
            yield electron_1.app.whenReady();
            const window = (0, window_1.createWindow)();
            yield (0, utils_1.task)('初始化谷歌浏览器', () => Promise.resolve());
            electron_1.app.on('quit', (e) => {
                e.preventDefault();
                // 交给渲染层去关闭浏览器
                if(!window.isDestroyed()&&!window.webContents.isDestroyed())window.webContents.send('close');
            });
            window.on('close', (e) => {
                if(typeof window.__fusionHandleClose==='function'){window.__fusionHandleClose(e);return;}
                e.preventDefault();
                if(!window.isDestroyed()&&!window.webContents.isDestroyed())window.webContents.send('close');
            });
            window.webContents.once('did-finish-load', () => {
                setTimeout(() => {
                    // 因为需要对渲染进程发送信息，所以要在显示完成后开始监听
                    if (electron_1.app.isPackaged) {
                        (0, utils_1.task)('软件更新', () => Promise.resolve());
                    }
                }, 1000);
            });
            (0, utils_1.task)('初始化远程通信模块', () => (0, remote_register_1.remoteRegister)(window));
            (0, utils_1.task)('注册app事件监听器', () => (0, global_listener_1.globalListenerRegister)(window));
            if (electron_1.app.isPackaged) {
                yield window.loadFile('./public/index.html');
            }
            else {
                yield window.loadURL('http://localhost:3000');
                window.webContents.openDevTools();
            }
            // 加载完成显示，解决一系列的显示/黑屏问题
            if (process.env.OCS_POC_HEADLESS !== '1') window.show();
        }))
    ]));
}
