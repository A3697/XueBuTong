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
exports.CXPhoneLoginScript = exports.CXUnitLoginScript = void 0;
const utils_1 = require("../../utils");
const script_1 = require("../../script");
exports.CXUnitLoginScript = new script_1.PlaywrightScript({
    unit: {
        label: '学校/单位',
        value: ''
    },
    id: {
        label: '学号/工号',
        value: ''
    },
    password: {
        label: '密码',
        value: ''
    }
}, {
    name: '超星-学校机构登录',
    run(page, configs, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield isNotLogin(page)) {
                    /** 其他登录 */
                    yield Promise.all([page.waitForLoadState('networkidle'), page.click('#otherlogin')]);
                    yield page.waitForTimeout(3000);
                    /** 输入机构名, 并等待搜索结果 */
                    yield (0, utils_1.slowType)(page, '#inputunitname', configs.unit);
                    yield page.waitForTimeout(2000);
                    /** 点击第一个结果 */
                    yield page.click('.filter-list > ul > li');
                    yield page.fill('#uname', configs.id);
                    yield page.fill('#password', configs.password);
                    yield login(page, options);
                }
            }
            catch (err) {
                exports.CXUnitLoginScript.emit('script-error', String(err));
            }
        });
    }
});
exports.CXPhoneLoginScript = new script_1.PlaywrightScript({
    phone: {
        label: '手机号',
        value: ''
    },
    password: {
        label: '密码',
        value: ''
    }
}, {
    name: '超星-手机密码登录',
    run(page, configs) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield isNotLogin(page)) {
                    yield page.fill('#phone', configs.phone);
                    yield page.fill('#pwd', configs.password);
                    yield login(page);
                }
            }
            catch (err) {
                exports.CXPhoneLoginScript.emit('script-error', String(err));
            }
        });
    }
});
function login(page, opts) {
    return new Promise((resolve, reject) => {
        let settled=false;
        const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);page.off('load',listenerLogin);page.off('close',onClose);error?reject(error):resolve();};
        const onClose=()=>finish(new Error('登录窗口已关闭。'));
        // 监听登录状态
        const listenerLogin = (page) => {
            // 登录成功
            if (page.url().includes('/space/index') || page.url().includes('/base')) {
                finish();
            }
        };
        page.on('load', listenerLogin);page.once('close',onClose);
        // 1分钟登录超时
        const timeout = setTimeout(() => {
            finish(new Error('登录超时，请检查平台页面提示并重试。'));
        }, 60 * 1000);
        // 重试5次
        let tryCount = 5;
        // 尝试登录
        const tryLogin = () => __awaiter(this, void 0, void 0, function* () {
            if(settled)return;
            if(tryCount<=0)throw new Error('自动登录未完成，请在平台页面手动处理验证后重试。');
            tryCount--;
            const area = yield page.$('#numVerCode');
            const codeInput = yield page.$('#vercode');
            if (area && codeInput) {
                /** 破解验证码 */
                if ((opts === null || opts === void 0 ? void 0 : opts.ocrApiUrl) && (opts === null || opts === void 0 ? void 0 : opts.ocrApiImageKey) && area) {
                    yield (0, utils_1.breakVerifyCode)(page, area, codeInput, {
                        ocrApiUrl: opts.ocrApiUrl,
                        ocrApiImageKey: opts.ocrApiImageKey
                    });
                }
                // 点击登录
                yield page.click('#loginBtn');
                yield page.waitForTimeout(3000);
            }
            // 2024年新增-滑块验证码
            const captchaEl = yield page.$('#captcha');
            if (captchaEl) {
                // 先登录才会出现验证码
                if (tryCount === 4) {
                    yield page.click('#loginBtn');
                    yield page.waitForTimeout(3000);
                }
                /** 破解验证码 */
                if ((opts === null || opts === void 0 ? void 0 : opts.ocrApiUrl) && (opts === null || opts === void 0 ? void 0 : opts.detBackgroundKey) && (opts === null || opts === void 0 ? void 0 : opts.detTargetKey)) {
                    if (tryCount === 4) {
                        yield page.waitForFunction(() => { var _a; return ((_a = document.querySelector('.u-opacity')) === null || _a === void 0 ? void 0 : _a.style.display) === 'block'; }, {}, { timeout: 10 * 1000 });
                    }
                    // 删除遮挡
                    yield page.evaluate(() => document.querySelectorAll('.u-opacity').forEach((el) => el.remove()));
                    const det_target_el = yield page.$('.cx_imgBtn > img');
                    const det_slider_el = yield page.$('.cx_rightBtn');
                    const src = yield (det_target_el === null || det_target_el === void 0 ? void 0 : det_target_el.getAttribute('src'));
                    if (det_slider_el && src) {
                        const target_base64 = yield (0, utils_1.getBase64)(src);
                        // 隐藏拼图，要不然会影响算法
                        yield page.evaluate(() => { var _a; return (_a = document.querySelector('.cx_imgBtn')) === null || _a === void 0 ? void 0 : _a.style.setProperty('display', 'none'); });
                        const det_bg_base64 = yield page.$('#cx_obstacle_canvas').then((el) => el === null || el === void 0 ? void 0 : el.screenshot());
                        if (det_bg_base64) {
                            yield (0, utils_1.breakSliderVerify)(page, det_slider_el, target_base64, det_bg_base64.toString('base64'), {
                                ocrApiUrl: opts.ocrApiUrl,
                                detTargetKey: opts.detTargetKey,
                                detBackgroundKey: opts.detBackgroundKey,
                                offset: 25
                            });
                        }
                        // 显示拼图
                        yield page.evaluate(() => { var _a; return (_a = document.querySelector('.cx_imgBtn')) === null || _a === void 0 ? void 0 : _a.style.setProperty('display', 'block'); });
                    }
                }
                try {
                    const captcha = yield page.$('#captcha');
                    if (captcha && (yield captcha.isVisible())) {
                        if (tryCount === 0) {
                            throw new Error('滑动验证失败，请尝试手动处理。');
                        }
                        else {
                            console.log('tryLogin');
                            yield tryLogin();
                        }
                    }
                }
                catch (e) {
                    console.log(e);
                    yield tryLogin();
                }
            }
            // 检测错误
            const vercodeMsg = yield page.evaluate(() => Array.from(document.querySelectorAll('#vercodeMsg.err-txt'))
                .map((e) => { var _a; return ((_a = e.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ''; })
                .filter(Boolean));
            const errors = yield page.evaluate(() => Array.from(document.querySelectorAll('.err-txt,.err-tip'))
                .map((e) => { var _a; return ((_a = e.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ''; })
                .filter(Boolean));
            if (vercodeMsg.concat(errors).some((str) => str.includes('验证码'))) {
                if (tryCount === 0) {
                    throw new Error(vercodeMsg.join('\n').trim() + '，请尝试手动输入。');
                }
                else {
                    yield tryLogin();
                }
            }
            else if (errors.length) {
                throw new Error(errors.join('\n').trim());
            }
        });
        tryLogin().then(()=>listenerLogin(page)).catch(finish);
    });
}
function isNotLogin(page) {
    return __awaiter(this, void 0, void 0, function* () {
        // 不能使用 https ，这里如果使用 https 在登录后会导致某些同学的课程无法访问
        yield page.goto('http://i.chaoxing.com/');
        yield page.waitForTimeout(2000);
        return page.url().includes('passport2.chaoxing.com');
    });
}
