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
exports.sleep = exports.getCurrentWebContents = exports.moveWindowToTop = exports.exportExcel = exports.getProjectPath = exports.unzip = exports.zip = exports.downloadFile = exports.task = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
const promises_1 = require("stream/promises");
const logger_1 = require("../logger");
const xlsx_1 = __importDefault(require("xlsx"));
const unzipper_1 = __importDefault(require("unzipper"));
const taskLogger = (0, logger_1.Logger)('task');
const logger = (0, logger_1.Logger)('utils');
function task(name, func) {
    return __awaiter(this, void 0, void 0, function* () {
        const time = Date.now();
        const res = yield func();
        taskLogger.info(name, ' 耗时:', Date.now() - time);
        return res;
    });
}
exports.task = task;
/**
 * 下载文件
 */
function downloadFile(fileURL, outputURL, rateHandler) {
    return __awaiter(this, void 0, void 0, function* () {
        logger.info('downloadFile', fileURL, outputURL);
        const { data, headers } = yield axios_1.default.get(fileURL, {
            responseType: 'stream'
        });
        const totalLength = parseInt(headers['content-length']);
        let chunkLength = 0;
        data.on('data', (chunk) => {
            chunkLength += String(chunk).length;
            const rate = ((chunkLength / totalLength) * 100).toFixed(2);
            rateHandler(parseFloat(rate), totalLength, chunkLength);
        });
        // 创建文件夹
        if ((0, fs_1.existsSync)(path_1.default.dirname(outputURL)) === false) {
            (0, fs_1.mkdirSync)(path_1.default.dirname(outputURL), { recursive: true });
        }
        const writer = (0, fs_1.createWriteStream)(outputURL);
        data.pipe(writer);
        yield (0, promises_1.finished)(writer);
        rateHandler(100, totalLength, totalLength);
        return outputURL;
    });
}
exports.downloadFile = downloadFile;
/**
 * 压缩文件
 */
function zip(input, output) {
    return new Promise((resolve, reject) => {
        const zip = new adm_zip_1.default();
        zip.addLocalFile(input, './');
        zip.writeZip(output, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}
exports.zip = zip;
/**
 * 解压文件
 */
function unzip(input, output) {
    return __awaiter(this, void 0, void 0, function* () {
        const directory = yield unzipper_1.default.Open.file(input);
        yield directory.extract({ path: output });
    });
}
exports.unzip = unzip;
function getProjectPath() {
    /** 这里多退出一层是因为打包后是运行在 ./lib 下面的 */
    return electron_1.app.isPackaged ? electron_1.app.getAppPath() : path_1.default.resolve('./');
}
exports.getProjectPath = getProjectPath;
/**
 * 导出excel
 */
function exportExcel(excel, filename) {
    electron_1.dialog
        .showSaveDialog({
        title: '导出Excel',
        defaultPath: filename
    })
        .then(({ canceled, filePath }) => {
        if (!canceled && filePath) {
            const book = xlsx_1.default.utils.book_new();
            for (const item of excel) {
                xlsx_1.default.utils.book_append_sheet(book, xlsx_1.default.utils.json_to_sheet(item.list), item.sheetName);
            }
            xlsx_1.default.writeFile(book, filePath);
        }
    });
}
exports.exportExcel = exportExcel;
function moveWindowToTop() {
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    // 置顶应用
    const onTop = win.isAlwaysOnTop();
    win.setAlwaysOnTop(true);
    win.setAlwaysOnTop(onTop);
    return win;
}
exports.moveWindowToTop = moveWindowToTop;
function getCurrentWebContents() {
    return electron_1.BrowserWindow.getAllWindows()[0].webContents;
}
exports.getCurrentWebContents = getCurrentWebContents;
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}
exports.sleep = sleep;
