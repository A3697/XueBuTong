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
exports.ZJYLoginScript = void 0;
const script_1 = require("../../script");
exports.ZJYLoginScript = new script_1.PlaywrightScript({
    username: {
        label: '账号',
        value: ''
    },
    password: {
        label: '密码',
        value: ''
    }
}, {
    name: '职教云-账号密码登录',
    run(page, configs) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield page.goto('https://zjy2.icve.com.cn/study/index');
                if (yield isNotLogin(page)) {
                    yield page.fill('[placeholder="请输入账号"]', configs.username);
                    yield page.fill('[placeholder="请输入密码"]', configs.password);
                    yield page.click('.agreement .el-checkbox__input');
                    yield page.click('.ri .login', { position: { x: 10, y: 10 } });
                    yield page.waitForTimeout(1000);
                    if (yield isNotLogin(page)) {
                        const errors = yield page.evaluate(() => Array.from(document.querySelectorAll('.xcConfirm .txtBox'))
                            .map((e) => e.textContent || '')
                            .filter(Boolean));
                        if (errors.length) {
                            throw new Error(errors.join('\n'));
                        }
                    }
                }
            }
            catch (err) {
                exports.ZJYLoginScript.emit('script-error', String(err));
            }
        });
    }
});
/** 是否未登录 */
function isNotLogin(page) {
    return __awaiter(this, void 0, void 0, function* () {
        return page.url().includes('/sso/auth');
    });
}
