"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = void 0;
const electron_1 = require("electron");
const logger_1 = require("../logger");
/**
 * 处理错误
 */
function handleError() {
    const logger = (0, logger_1.Logger)('error');
    electron_1.app.on('render-process-gone', (e, c, details) => {
        logger.error('render-process-gone', details);
        process.exit(0);
    });
    electron_1.app.on('child-process-gone', (e, details) => {
        logger.error('child-process-gone', details);
        process.exit(0);
    });
    process.on('uncaughtException', (e) => {
        logger.error('rejectionHandled', e);
    });
    process.on('unhandledRejection', (e) => {
        logger.error('unhandledRejection', e);
    });
}
exports.handleError = handleError;
