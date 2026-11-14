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
exports.NewPageScript = void 0;
const script_1 = require("../../script");
exports.NewPageScript = new script_1.PlaywrightScript({
    url: {
        label: '网页链接',
        value: ''
    }
}, {
    name: '通用-新建页面',
    run(page, configs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (configs.url.startsWith('http')) {
                yield page.goto(configs.url);
            }
            else {
                throw new Error('网页链接格式不正确，请输入 http 开头的链接。');
            }
        });
    }
});
