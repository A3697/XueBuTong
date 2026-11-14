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
exports.ZHSPhoneLoginScript = exports.ZHSUnitLoginScript = void 0;
const utils_1 = require("../../utils");
const script_1 = require("../../script");
exports.ZHSUnitLoginScript = new script_1.PlaywrightScript({
    schoolname: {
        label: '学校',
        value: ''
    },
    id: {
        label: '学号',
        value: ''
    },
    password: {
        label: '密码',
        value: ''
    }
}, {
    name: '智慧树-学校登录',
    run(page, configs, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield isNotLogin(page)) {
                    if (yield isModernLogin(page)) {
                        yield loginModern(page, {school: configs.schoolname, username: configs.id, password: configs.password}, 'unit', options);
                        return;
                    }
                    yield page.click('#qStudentID');
                    // 取消我知道了弹窗
                    yield page.waitForTimeout(1000);
                    yield page.evaluate('userindex.closeStuCodeFirstLoginTip();');
                    yield (0, utils_1.slowType)(page, '#quickSearch', configs.schoolname);
                    // 显示学校列表
                    yield Promise.all([
                        /** 为防止页面未加载学校数据，所以这里即可能为远程加载或者缓存读取学校记录 */
                        Promise.race([
                            /** 等待请求完成 */
                            page.waitForResponse(/getAllSchool/),
                            /** 等待元素出现 */
                            page.waitForSelector('#schoolListCode li')
                        ]),
                        page.evaluate('userindex.selectSchoolByName();')
                    ]);
                    // 单击第一个匹配的学校
                    yield page.click('#schoolListCode li');
                    yield page.fill('#clCode', configs.id);
                    yield page.fill('#clPassword', configs.password);
                    yield page.waitForTimeout(3000);
                    yield page.click('.wall-sub-btn');
                    if ((options === null || options === void 0 ? void 0 : options.ocrApiUrl) && (options === null || options === void 0 ? void 0 : options.detTargetKey) && (options === null || options === void 0 ? void 0 : options.detBackgroundKey)) {
                        let count = 5;
                        while (yield isNotVerified(page)) {
                            if (count > 0) {
                                count--;
                                yield verify(page, {
                                    ocrApiUrl: options.ocrApiUrl,
                                    detTargetKey: options.detTargetKey,
                                    detBackgroundKey: options.detBackgroundKey
                                });
                                yield page.waitForTimeout(2000);
                            }
                            else {
                                throw new Error('滑块识别失败，请手动登录。');
                            }
                        }
                    }
                }
            }
            catch (err) {
                exports.ZHSUnitLoginScript.emit('script-error', String(err));
            }
        });
    }
});
exports.ZHSPhoneLoginScript = new script_1.PlaywrightScript({
    phone: {
        label: '手机号',
        value: ''
    },
    password: {
        label: '密码',
        value: ''
    }
}, {
    name: '智慧树-手机密码登录',
    run(page, configs, options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield isNotLogin(page)) {
                    if (yield isModernLogin(page)) {
                        yield loginModern(page, {username: configs.phone, password: configs.password}, 'phone', options);
                        return;
                    }
                    yield page.click('#qSignin');
                    yield page.fill('#lUsername', configs.phone);
                    yield page.fill('#lPassword', configs.password);
                    yield page.waitForTimeout(3000);
                    yield page.click('.wall-sub-btn');
                    if ((options === null || options === void 0 ? void 0 : options.ocrApiUrl) && (options === null || options === void 0 ? void 0 : options.detTargetKey) && (options === null || options === void 0 ? void 0 : options.detBackgroundKey)) {
                        let count = 5;
                        while ((yield isNotVerified(page)) && count > 0) {
                            count--;
                            yield verify(page, {
                                ocrApiUrl: options.ocrApiUrl,
                                detTargetKey: options.detTargetKey,
                                detBackgroundKey: options.detBackgroundKey
                            });
                            yield page.waitForTimeout(2000);
                        }
                    }
                }
            }
            catch (err) {
                exports.ZHSPhoneLoginScript.emit('script-error', String(err));
            }
        });
    }
});
/**
 * 滑块验证
 */
function verify(page, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        // 删除yidun遮挡
        yield page.evaluate(() => document.querySelectorAll('.yidun_cover-frame,.yidun_popup__mask').forEach((el) => el.remove()));
        const det_slider_el = yield page.$('.yidun_slider');
        const det_target_el = yield page.$('[alt="验证码滑块"]');
        const det_bg_el = yield page.$('[alt="验证码背景"]');
        if (det_target_el && det_slider_el && det_bg_el) {
            const det_target_src = yield det_target_el.getAttribute('src');
            const det_bg_src = yield det_bg_el.getAttribute('src');
            if (det_target_src && det_bg_src) {
                yield (0, utils_1.breakSliderVerify)(page, det_slider_el, yield (0, utils_1.getBase64)(det_target_src), yield (0, utils_1.getBase64)(det_bg_src), Object.assign(Object.assign({}, opts), { offset: 10 }));
            }
        }
    });
}
/** 是否未通过验证 */
function isNotVerified(page) {
    return __awaiter(this, void 0, void 0, function* () {
        yield page.waitForTimeout(2000);
        const errors = yield page.evaluate(() => Array.from(document.querySelectorAll('.switch-wrap-signin.active .form-ipt-error.is-visible'))
            .map((e) => e.textContent || '')
            .filter(Boolean));
        if (errors.length) {
            throw new Error(errors.join('\n'));
        }
        return page.url().includes('passport.zhihuishu.com');
    });
}
// Login-center compatibility is scoped to the native ZHS scripts. Existing
// legacy captcha handling above remains available on the legacy login page.
function zhsAuthError(message) { const error = new Error(message); error.code = 'ZHS_AUTH'; return error; }
function zhsUrl(value) { try { return new URL(value); } catch { return null; } }
function studentUrl(value) {
    const url = zhsUrl(value);
    return !!url && ['onlineweb.zhihuishu.com', 'studyservice.zhihuishu.com', 'online2.zhihuishu.com', 'hike.zhihuishu.com'].includes(url.hostname) &&
        !/(?:login|logout|error)/i.test(url.pathname);
}
function loginUrl(value) { const url = zhsUrl(value); return !!url && ['login.zhihuishu.com', 'passport.zhihuishu.com'].includes(url.hostname); }
async function loginSnapshot(page) {
    return page.evaluate(() => {
        const visible = element => !!element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).display !== 'none';
        const texts = selector => Array.from(document.querySelectorAll(selector)).filter(visible).map(element => (element.textContent || '').trim()).filter(Boolean);
        const accountHeader = location.protocol === 'https:' && location.hostname === 'onlineweb.zhihuishu.com' && /^\/onlinestuh5(?:\/|$)/.test(location.pathname) && texts('.header-content_rightBox .user-logo_name').length > 0;
        return {
            marker: accountHeader || texts('a[href*="logout"],a[href*="logoff"],[onclick*="logout"],[onclick*="logOut"],#userName,.user-name,.userName,.user-info,.userInfo').length > 0,
            password: Array.from(document.querySelectorAll('input[type="password"]')).some(visible),
            ready: Array.from(document.querySelectorAll('#qSignin,#qStudentID,input[name="mobile"],input[name="unid"],.btn-block__grandient_login')).some(visible),
            challenge: Array.from(document.querySelectorAll('.yidun_slider,[alt="验证码滑块"],[alt="验证码背景"],.geetest_panel,.nc_scale,.tencent-captcha-dy__verify-bg-img')).some(visible),
            errors: texts('.el-form-item__error,.el-message--error,.switch-wrap-signin.active .form-ipt-error.is-visible').join('\n')
        };
    });
}
async function authenticatedPage(page) {
    if (!studentUrl(page.url())) return false;
    const state = await loginSnapshot(page);
    return state.marker && !state.password;
}
async function isModernLogin(page) {
    return zhsUrl(page.url())?.hostname === 'login.zhihuishu.com' ||
        await page.locator('.btn-block__grandient_login').count() > 0;
}
async function waitForLoginPage(page, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        try {
            if (await authenticatedPage(page)) return false;
            if (loginUrl(page.url()) && (await loginSnapshot(page)).ready) return true;
        } catch (error) {
            if (page.isClosed()) throw zhsAuthError('智慧树登录窗口已关闭。');
        }
        await page.waitForTimeout(200);
    }
    throw zhsAuthError('智慧树登录页面未能就绪，请检查网络或在浏览器中手动登录。');
}
async function isNotLogin(page) {
    try {
        if (await authenticatedPage(page)) return false;
        if (loginUrl(page.url())) return await waitForLoginPage(page);
        // A student page may still be loading or redirecting to SSO. Preserve
        // that navigation and the account session instead of reopening home.
        if (studentUrl(page.url())) return await waitForLoginPage(page, 8000);
        const current = zhsUrl(page.url());
        if (current?.hostname !== 'www.zhihuishu.com')
            await page.goto('https://www.zhihuishu.com/', {waitUntil: 'domcontentloaded', timeout: 30000});
        if (await authenticatedPage(page)) return false;
        if (loginUrl(page.url())) return await waitForLoginPage(page);
        if (await page.locator('#notLogin').isVisible()) await page.locator('#notLogin').click({timeout:10000});
        else if (await page.locator('#login').isVisible()) {
            // On the current homepage #login is the signed-in user menu.
            // Clicking it only opens a dropdown; continue through the student
            // entry so its SSO redirect can preserve the existing session.
            await page.goto('https://onlineweb.zhihuishu.com/onlinestuh5', {waitUntil:'domcontentloaded', timeout:30000});
        }
        else {
            const href = await page.locator('a[href*="login.zhihuishu.com"]').first().getAttribute('href', {timeout:10000});
            const target = new URL(href, 'https://www.zhihuishu.com/');
            if (target.protocol !== 'https:' || target.hostname !== 'login.zhihuishu.com') throw zhsAuthError('智慧树登录入口未能确认，请从官网手动登录。');
            await page.goto(target.href, {waitUntil:'domcontentloaded', timeout:30000});
        }
        return await waitForLoginPage(page);
    } catch (error) {
        if (error?.code === 'ZHS_AUTH') throw error;
        throw zhsAuthError('智慧树登录页面未能打开，请检查网络或在浏览器中手动登录。');
    }
}
async function loginModern(page, configs, kind, options = {}) {
    let failed = false, captchaAttempted = false, authenticatedResponse = false;
    const onResponse = response => {
        try {
            const request = response.request(), status = response.status();
            const url=new URL(response.url());
            if(url.protocol==='https:'&&url.hostname==='user.zhihuishu.com'&&request.method()==='POST'&&['/zhsuser/login/account','/zhsuser/login/code'].includes(url.pathname))
                void response.json().then(value=>{if(value?.status===1&&(value.rt?.uuid||value.rt?.cacheId))authenticatedResponse=true;}).catch(()=>{});
            if ((request.isNavigationRequest() && status >= 400) ||
                (status >= 500 && ['xhr', 'fetch'].includes(request.resourceType()) && /login|signin|authenticate/i.test(new URL(response.url()).pathname))) failed = true;
        } catch {}
    };
    const onFailed = request => {
        try { if (request.isNavigationRequest() || (['xhr','fetch'].includes(request.resourceType()) && /login|signin|authenticate/i.test(new URL(request.url()).pathname))) failed = true; } catch {}
    };
    try {
        if (!String(configs.username || '').trim() || !String(configs.password || '') || (kind === 'unit' && !String(configs.school || '').trim()))
            throw zhsAuthError('请完整填写智慧树的账号、密码及所需的学校名称。');
        if ((await loginSnapshot(page)).challenge) throw zhsAuthError('智慧树需要验证码或安全验证，请在当前浏览器窗口中手动完成。');
        if (kind === 'unit') {
            await page.getByRole('tab', {name:'学号登录', exact:true}).click({timeout:10000});
            const input = page.locator('.school input[role="combobox"]'), school = String(configs.school).trim(), target = school.replace(/\s+/g,'');
            await input.fill('', {timeout:10000}); await input.type(school, {delay:20, timeout:10000});
            await page.waitForFunction(target => Array.from(document.querySelectorAll('.el-select-dropdown__item')).some(element => element.getClientRects().length && (element.textContent || '').replace(/\s+/g,'') === target), target, {timeout:10000});
            const choices = page.locator('.el-select-dropdown__item'), names = await choices.allTextContents();
            const matches = names.map((name,index) => ({name,index})).filter(item => item.name.replace(/\s+/g,'') === target);
            if (matches.length !== 1) throw zhsAuthError('未找到唯一匹配的智慧树学校，请检查学校名称。');
            await choices.nth(matches[0].index).click({timeout:10000});
            await page.locator('input[name="unid"]').fill(String(configs.username).trim(), {timeout:10000});
        } else {
            await page.getByRole('tab', {name:'账号登录', exact:true}).click({timeout:10000});
            await page.locator('input[name="mobile"]').fill(String(configs.username).trim(), {timeout:10000});
        }
        await page.locator('input[type="password"]:visible').fill(String(configs.password), {timeout:10000});
        const privacy = page.locator('.privacy-checkbox input[type="checkbox"]');
        if (await privacy.count() && !(await privacy.first().isChecked())) {
            const box = page.locator('.privacy-checkbox .el-checkbox__input');
            await (await box.count() ? box.first() : page.locator('.privacy-checkbox').first()).click({timeout:10000});
        }
        if ((await loginSnapshot(page)).challenge) throw zhsAuthError('智慧树需要验证码或安全验证，请在当前浏览器窗口中手动完成。');
        page.on('response', onResponse); page.on('requestfailed', onFailed);
        // The retained login flow delegates only the post-submit captcha to OCS v3.9.1.
        await page.locator('.btn-block__grandient_login').click({timeout:10000});
        const end = Date.now() + (options.ocrApiUrl ? 180000 : 45000);
        while (Date.now() < end) {
            let state;
            try { state = await loginSnapshot(page); } catch (error) {
                if (page.isClosed()) throw error;
                await page.waitForTimeout(200); continue;
            }
            if (state.challenge || /验证码|滑块|安全验证|captcha/i.test(state.errors)) {
                if(captchaAttempted||!options.ocrApiUrl||!options.detTargetKey||!options.detBackgroundKey)
                    throw zhsAuthError('智慧树安全验证未自动完成，请在当前浏览器窗口中完成验证。');
                captchaAttempted=true;
                try{await require('../../utils/zhs-captcha').loopVerify(page,options);}
                catch{throw zhsAuthError('OCS 验证码处理未能完成智慧树安全验证，请在当前浏览器窗口中完成验证。');}
                if(await authenticatedPage(page))return;
                continue;
            }
            if (/密码(?:错误|不正确|有误)|(?:账号|帐号|用户名)(?:或密码)?(?:错误|不存在|不正确|不匹配)/.test(state.errors))
                throw zhsAuthError('智慧树提示账号或密码不正确，请检查登录配置。');
            if (state.errors) throw zhsAuthError('智慧树暂未完成登录，请检查当前窗口中的登录提示。');
            if (failed) throw zhsAuthError('智慧树登录请求未能完成，请检查网络后重试。');
            if (studentUrl(page.url()) && (state.marker || authenticatedResponse) && !state.password) return;
            await page.waitForTimeout(200);
        }
        throw zhsAuthError('智慧树登录验证超时，暂不能确认登录结果，请检查当前浏览器窗口。');
    } catch (error) {
        // Playwright action errors can contain fill() values; never forward them.
        if (error?.code === 'ZHS_AUTH') throw error;
        throw zhsAuthError('智慧树登录未完成，请检查学校名称、网络和当前浏览器窗口。');
    } finally {
        page.off('response', onResponse); page.off('requestfailed', onFailed);
    }
}
