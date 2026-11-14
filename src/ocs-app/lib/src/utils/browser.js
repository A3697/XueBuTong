"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtensionPaths = exports.getBrowserMajorVersion = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 获取浏览器主版本号
 * @param executablePath 浏览器可执行文件路径
 */
function getBrowserMajorVersion(executablePath) {
    if (fs_1.default.existsSync(executablePath) === false)
        return;
    if (process.platform === 'darwin') {
        // 内置浏览器的版本查找方法
        const versionsFolder = path_1.default.join(path_1.default.dirname(executablePath), '..', './Frameworks/Google Chrome for Testing Framework.framework/Versions/');
        const exists = fs_1.default.existsSync(versionsFolder);
        if (exists === false)
            return;
        const versions = fs_1.default
            .readdirSync(versionsFolder)
            .filter((f) => f !== '.DS_Store' && fs_1.default.statSync(path_1.default.join(versionsFolder, f)).isDirectory())
            .filter((f) => f.split('.').length > 1);
        if (versions.length === 0)
            return;
        const version = versions
            .map((v) => {
            const major = parseInt(v.split('.')[0]);
            if (isNaN(major))
                return 0;
            return major;
        })
            .sort((a, b) => b - a)[0];
        if (version === 0)
            return;
        return version;
    }
    // 普通浏览器的版本查找方法
    let manifest = fs_1.default.readdirSync(path_1.default.dirname(executablePath)).find((f) => {
        const file = path_1.default.join(path_1.default.dirname(executablePath), f);
        return fs_1.default.statSync(file).isDirectory() && fs_1.default.readdirSync(file).some((f) => f.endsWith('.manifest'));
    });
    if (!manifest) {
        // 内置浏览器的版本查找方法
        manifest = fs_1.default.readdirSync(path_1.default.dirname(executablePath)).find((f) => f.endsWith('.manifest'));
    }
    if (manifest && manifest.split('.').length > 1) {
        return parseInt(manifest.split('.')[0]);
    }
}
exports.getBrowserMajorVersion = getBrowserMajorVersion;
function getExtensionPaths(extensionsFolder) {
    return fs_1.default
        .readdirSync(extensionsFolder)
        .filter((f) => f !== '.DS_Store')
        .filter((f) => !f.endsWith('.zip'))
        .map((file) => path_1.default.join(extensionsFolder, file));
}
exports.getExtensionPaths = getExtensionPaths;
