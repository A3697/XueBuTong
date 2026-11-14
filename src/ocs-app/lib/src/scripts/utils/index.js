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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBase64 = exports.breakSliderVerify = exports.breakVerifyCode = exports.slowType = void 0;
const axios_1 = __importDefault(require("axios"));
/** 缓慢输入 */
function slowType(page, selector, text) {
    return page.type(selector, text, { delay: 100 });
}
exports.slowType = slowType;
/** 验证码破解 */
function breakVerifyCode(page, imageElement, inputElement, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const box = yield imageElement.boundingBox();
        if (box) {
            /** 请求验证码破解接口 */
            const body = Object.create([]);
            const buffer = yield page.screenshot({ clip: box });
            Reflect.set(body, options.ocrApiImageKey, buffer.toString('base64'));
            const { data: { code, canOCR, error } } = yield axios_1.default.post(options.ocrApiUrl, body);
            if (canOCR) {
                /** 破解验证码 */
                if (code) {
                    yield inputElement.fill(code);
                }
                else if (error) {
                    throw new Error(error);
                }
            }
            else {
                throw new Error('未检测到图片验证码识别模块, 请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。。');
            }
        }
    });
}
exports.breakVerifyCode = breakVerifyCode;
/** 滑块验证码破解 */
function breakSliderVerify(page, 
/**
 * 滑块目标元素
 */
det_slider_el, 
/**
 * 拼图元素
 */
det_target_base64, 
/**
 * 滑块背景元素
 */
det_bg_base64, opts) {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        const body = Object.create({});
        Reflect.set(body, opts.detTargetKey, det_target_base64);
        Reflect.set(body, opts.detBackgroundKey, det_bg_base64);
        const data = yield axios_1.default.post(opts.ocrApiUrl, body);
        console.log('slider ocr', JSON.stringify(data === null || data === void 0 ? void 0 : data.data));
        if ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.error) {
            console.error(data.data.error);
        }
        else {
            if ((_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.canOCR) {
                /** 破解滑块验证码 */
                const result = (_c = data === null || data === void 0 ? void 0 : data.data) === null || _c === void 0 ? void 0 : _c.det;
                if (result) {
                    const bg_rect = yield det_slider_el.evaluate((node) => node.getBoundingClientRect());
                    const x1 = bg_rect.x;
                    const y1 = bg_rect.y;
                    const x2 = bg_rect.x + result.target[0] + ((_d = opts.offset) !== null && _d !== void 0 ? _d : 0);
                    const y2 = bg_rect.y;
                    console.log('slider ocr', { x1, y1, x2, y2, offset: (_e = opts.offset) !== null && _e !== void 0 ? _e : 0 });
                    yield page.mouse.move(x1, y1);
                    yield page.mouse.down();
                    yield page.mouse.down();
                    yield page.mouse.move(x2, y2, { steps: 10 });
                    yield page.mouse.up();
                    try {
                        yield page.waitForNavigation({ timeout: 3000, waitUntil: 'domcontentloaded' });
                    }
                    catch (_f) { }
                }
                else {
                    console.error(`OCR_DET: `, {
                        data,
                        opts,
                        det_target_base64: det_target_base64.length,
                        det_bg_base64: det_bg_base64.length
                    });
                    throw new Error('滑块验证识别失败，请尝试手动登录。');
                }
            }
            else {
                throw new Error('未检测到图片验证码识别模块, 请手动输入验证码，或在软件左侧应用中心安装识别模块后重启浏览器。');
            }
        }
    });
}
exports.breakSliderVerify = breakSliderVerify;
function getBase64(url) {
    return axios_1.default
        .get(url, {
        responseType: 'arraybuffer'
    })
        .then((response) => Buffer.from(response.data, 'binary').toString('base64'));
}
exports.getBase64 = getBase64;
