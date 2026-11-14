"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoLaunch = void 0;
const electron_1 = require("electron");
const store_1 = require("../store");
/** 配置自动启动 */
function autoLaunch(enabled) {
    if (electron_1.app.isPackaged && process.platform === 'win32') {
        // Remove only this product's historical startup name before registering the current one.
        const launcher=require('path').resolve(electron_1.app.getAppPath(),'../../..','学不通.exe');
        electron_1.app.setLoginItemSettings({openAtLogin:false,name:'OCS-Xingchan-Fusion',path:launcher,args:[]});
        electron_1.app.setLoginItemSettings({
            openAtLogin: typeof enabled === 'boolean' ? enabled : store_1.store.store.window.autoLaunch === true,
            name: 'XueBuTong',
            path: require('path').resolve(electron_1.app.getAppPath(), '../../..', '学不通.exe'),
            args: []
        });
    }
}
exports.autoLaunch = autoLaunch;
