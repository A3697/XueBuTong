"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerCore = void 0;
// @ts-check
const path_1 = require("path");
const util_1 = require("util");
const fs_1 = require("fs");
function formatDate() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        date.getDate().toString().padStart(2, '0')
    ].join('-');
}
/**
 * 日志对象
 * ```js
 * const l = new LoggerCore(app.getPath("logs"), true, 'test') // create `${logs}/YYYY-MM-DD/test.log`
 * const l2 = new LoggerCore(app.getPath("logs"), true,'project','error','1') // create `${logs}/YYYY-MM-DD/project/error/1.log`
 * ```
 */
class LoggerCore {
    constructor(basePath, withConsole = true, ...name) {
        this.log = (...msg) => this._log(this.dest, '信息', ...msg);
        this.info = (...msg) => this._log(this.dest, '信息', ...msg);
        this.error = (...msg) => this._log(this.dest, '错误', ...msg);
        this.debug = (...msg) => this._log(this.dest, '调试', ...msg);
        this.warn = (...msg) => this._log(this.dest, '警告', ...msg);
        this.basePath = basePath;
        this.withConsole = withConsole;
        this.dest = (0, path_1.join)(this.basePath, '/', formatDate(), '/', name.join('/') + '.log');
    }
    _log(dest, level, ...msg) {
        const data = msg
            .map((s) => {
            if (typeof s === 'object' || typeof s === 'function') {
                s = (0, util_1.inspect)(s);
            }
            return s;
        })
            .join(' ');
        const txt = `[${level}] ${new Date().toLocaleString()} \t ` + data;
        if (this.withConsole) {
            console.log(txt);
        }
        return new Promise((resolve) => {
            if (!(0, fs_1.existsSync)((0, path_1.dirname)(dest))) {
                (0, fs_1.mkdirSync)((0, path_1.dirname)(dest), { recursive: true });
            }
            (0, fs_1.appendFileSync)(dest, txt + '\n');
            resolve();
        });
    }
}
exports.LoggerCore = LoggerCore;
