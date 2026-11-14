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
exports.ICVELoginScript = void 0;
const script_1 = require("../../script");
exports.ICVELoginScript = new script_1.PlaywrightScript({
    username: {
        label: '账号',
        value: ''
    },
    password: {
        label: '密码',
        value: ''
    }
}, {
    name: '智慧职教-账号密码登录',
    run(page, configs) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield isNotLogin(page)) {
                    yield page.fill('[placeholder="请输入账号"]', configs.username);
                    yield page.fill('[placeholder="请输入密码"]', configs.password);
                    // 同意协议
                    yield page.click('.agreement label.el-checkbox');
                    yield page.click('form .login');
                }
            }
            catch (err) {
                exports.ICVELoginScript.emit('script-error', String(err));
            }
        });
    }
});
function isNotLogin(page) {
    return __awaiter(this, void 0, void 0, function* () {
        yield page.goto('https://sso.icve.com.cn/sso/auth?mode=simple&source=2&redirect=https://mooc.icve.com.cn/cms/');
        yield page.waitForTimeout(2000);
        return page.url().includes('sso/auth');
    });
}
