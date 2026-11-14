"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
// @ts-check
const logger_core_1 = require("./logger.core");
const electron_1 = require("electron");
function Logger(...name) {
    return new logger_core_1.LoggerCore(electron_1.app.getPath('logs'), true, ...name);
}
exports.Logger = Logger;
