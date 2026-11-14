"use strict";
// @ts-nocheck
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedEventEmitter = void 0;
const events_1 = __importDefault(require("events"));
class TypedEventEmitter extends events_1.default {
    emit(eventName, ...args) {
        return super.emit(eventName, ...args);
    }
    on(eventName, listener) {
        return super.on(eventName, listener);
    }
    once(eventName, listener) {
        return super.once(eventName, listener);
    }
    off(eventName, listener) {
        return super.off(eventName, listener);
    }
    removeListener(eventName, listener) {
        return super.removeListener(eventName, listener);
    }
    removeAllListeners(event) {
        return super.removeAllListeners(event);
    }
    addListener(eventName, listener) {
        return super.addListener(eventName, listener);
    }
    listeners(eventName) {
        return super.listeners(eventName);
    }
    prependListener(eventName, listener) {
        return super.prependListener(eventName, listener);
    }
    prependOnceListener(eventName, listener) {
        return super.prependOnceListener(eventName, listener);
    }
}
exports.TypedEventEmitter = TypedEventEmitter;
