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
exports.initChrome = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const logger_1 = require("../logger");
const glob_1 = require("glob");
const child_process_1 = __importDefault(require("child_process"));
const logger = (0, logger_1.Logger)('chrome-init');
function initChrome(win) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 解压浏览器内核
            const chromePath = path_1.default.join(process.resourcesPath, 'bin', 'chrome');
            logger.log('chromePath', chromePath);
            if (!fs_1.default.existsSync(chromePath)) {
                logger.error(`内置浏览器目录不存在: ${chromePath}`);
                return;
            }
            const chrome_filename = process.platform === 'win32'
                ? 'chrome.exe'
                : process.platform === 'linux'
                    ? 'chrome'
                    : 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
            if (fs_1.default.existsSync(path_1.default.join(chromePath, 'chrome', chrome_filename))) {
                logger.log(`内置浏览器已存在，无需初始化`);
                return;
            }
            const ab = new AbortController();
            require(require('path').resolve(__dirname,'../../../../../..','src/themed-dialog.cjs')).createThemedDialog({root:require('path').resolve(__dirname,'../../../../../..')}).showMessageBox(win, {
                title: electron_1.app.name,
                message: '正在初始化资源...，请稍等',
                type: 'info',
                noLink: true,
                signal: ab.signal
            });
            try {
                if (process.platform === 'darwin') {
                    child_process_1.default.execSync('unzip -o ./chrome.zip -d ./chrome_temp', { cwd: chromePath });
                }
                else {
                    yield (0, utils_1.unzip)(path_1.default.join(chromePath, 'chrome.zip'), path_1.default.join(chromePath, 'chrome_temp'));
                }
                const searchPattern = process.platform === 'darwin' ? '**/*/' + 'Google Chrome for Testing.app' : '**/*/' + chrome_filename;
                const chrome_file = yield (0, glob_1.glob)(searchPattern, {
                    nodir: process.platform !== 'darwin',
                    absolute: true,
                    cwd: path_1.default.join(chromePath, 'chrome_temp')
                });
                logger.log('chrome_file', chrome_file);
                if (!chrome_file || chrome_file.length === 0) {
                    throw new Error('浏览器压缩包数据错误');
                }
                fs_1.default.renameSync(path_1.default.dirname(chrome_file[0]), path_1.default.join(chromePath, 'chrome'));
                fs_1.default.rmdirSync(path_1.default.join(chromePath, 'chrome_temp'), { recursive: true });
                require(require('path').resolve(__dirname,'../../../../../..','src/themed-dialog.cjs')).createThemedDialog({root:require('path').resolve(__dirname,'../../../../../..')}).showMessageBox(win, {
                    title: electron_1.app.name,
                    message: '内置浏览器初始化完成，即将重启...',
                    type: 'info',
                    noLink: true
                });
                yield (0, utils_1.sleep)(1000);
                electron_1.app.relaunch();
                electron_1.app.quit();
            }
            catch (e) {
                logger.error('初始化谷歌浏览器失败', e);
                electron_1.dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
            }
            finally {
                ab.abort();
            }
        }
        catch (e) {
            logger.error('初始化谷歌浏览器失败', e);
            electron_1.dialog.showErrorBox('初始化谷歌浏览器失败', String(e));
        }
    });
}
exports.initChrome = initChrome;
