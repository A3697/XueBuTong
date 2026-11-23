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
exports.startupServer = void 0;
const express_1 = __importDefault(require("express"));
const logger_1 = require("../logger");
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const store_1 = require("../store");
const utils_1 = require("../utils");
const ocr_1 = require("../utils/ocr");
const crypto_1 = require("crypto");
const logger = (0, logger_1.Logger)('server');
function startupServer() {
    return __awaiter(this, void 0, void 0, function* () {
        const app = (0, express_1.default)();
        store_1.store.set('server', {
            port: 18539,
            authToken: (0, crypto_1.randomUUID)().replace(/-/g, '')
        });
        app.use((req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'unknown');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            // A ScriptCat GM request redirected to this instance retains its
            // request marker in the browser's preflight header list.
            const localHelper = ['/browser', '/is-browser-config-sync', '/get-actions-key','/fusion/answer'].includes(req.path);
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, request-id, if-none-match' + (localHelper ? ', X-Scriptcat-GM-XHR-Request-Id' : ''));
            if (localHelper) res.setHeader('Access-Control-Expose-Headers', 'X-XueBuTong-Account-Sync');
            res.setHeader('Access-Control-Allow-Methods', '*');
            if (req.method === 'OPTIONS') {
                res.sendStatus(204);
                return;
            }
            next();
        });
        // 解析 post 数据
        app.use(express_1.default.urlencoded({ extended: false, limit: '10mb' }));
        app.use(express_1.default.json({ limit: '10mb' }));
        app.get('/state', (req, res) => {
            res.json({
                public: path_1.default.join((0, utils_1.getProjectPath)(), './public'),
                project: (0, utils_1.getProjectPath)()
            });
        });
        app.get('/ocs-global-setting', (req, res) => {
            const render = (0, store_1.getDecryptedRenderData)();
            res.json(render.setting.ocs);
        });
        /** 获取 browser 数据 */
        app.get('/browser', (req, res) => {
            var _a, _b, _c, _d;
            const render = (0, store_1.getDecryptedRenderData)();
            // 如果开启了同步配置，就返回，否则返回空对象
            const data = ((_b = (_a = render === null || render === void 0 ? void 0 : render.setting) === null || _a === void 0 ? void 0 : _a.ocs) === null || _b === void 0 ? void 0 : _b.openSync) ? (_d = (_c = render === null || render === void 0 ? void 0 : render.setting) === null || _c === void 0 ? void 0 : _c.ocs) === null || _d === void 0 ? void 0 : _d.store : {};
            try {
                const shared=require(require('path').resolve(__dirname,'../../../../../..','src/browser-answer-settings.cjs')).read(req.query,store_1.store.store.server.authToken,data);
                if(shared)res.setHeader('X-XueBuTong-Account-Sync','1');
                res.setHeader('Cache-Control','no-store');res.json(shared?shared.store:data);
            }catch{res.status(403).json({error:'account_settings_unauthorized'});}
        });
        app.get('/is-browser-config-sync', (req, res) => {
            const render = (0, store_1.getDecryptedRenderData)();
            try{const shared=require(require('path').resolve(__dirname,'../../../../../..','src/browser-answer-settings.cjs')).read(req.query,store_1.store.store.server.authToken,{});res.setHeader('Cache-Control','no-store');res.end(String(shared?shared.enabled:render.setting.ocs.openSync));}catch{res.status(403).end('false');}
        });
        app.post('/fusion/soutijiang-session',require(require('path').resolve(__dirname,'../../../../../..','src/soutijiang-broker.cjs')).handle);
        app.post('/fusion/answer', async(req,res)=>{
            res.setHeader('Cache-Control','no-store');
            try{res.json(await require(require('path').resolve(__dirname,'../../../../../..','src/browser-answer-settings.cjs')).answer(req.query,store_1.store.store.server.authToken,req.body));}
            catch(error){res.status(Number.isInteger(error.status)?error.status:403).json({error:'学不通搜题未完成（配置、连接或接口错误），本题不会随机补答。',code:error.code||'account_query_rejected'});}
        });
        /** 脚本操作 */
        app.get('/ocs-script-actions', (req, res) => {
            res.json({ allow: true });
        });
        app.get('/get-actions-key', (req, res) => {
            res.send(store_1.store.store.server.authToken);
        });
        /** 请求转发 */
        app.post('/proxy', (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { method, url, data, headers } = req.body || {};
            axios_1.default
                .request({
                method,
                url,
                data,
                headers
            })
                .then(({ data }) => {
                res.send(data);
            })
                .catch((err) => {
                res.send(err);
            });
        }));
        app.get(/\/ocs-action_.+/, (req, res) => {
            res.send('正在执行脚本 : ' + req.path + ' 请勿操作。');
        });
        // ocr 验证码破解
        app.post('/ocr', (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const base64 = (_a = req.body.image) === null || _a === void 0 ? void 0 : _a.toString();
            const det_target = (_b = req.body.det_target) === null || _b === void 0 ? void 0 : _b.toString();
            const det_bg = (_c = req.body.det_bg) === null || _c === void 0 ? void 0 : _c.toString();
            if ((0, ocr_1.canOCR)()) {
                try {
                    if (base64) {
                        res.json({ canOCR: true, code: yield (0, ocr_1.ocr)(base64) });
                    }
                    else if (det_target && det_bg) {
                        res.json({ canOCR: true, det: yield (0, ocr_1.det)(det_target, det_bg) });
                    }
                    else {
                        res.send({ error: '参数缺失!' });
                    }
                }
                catch (err) {
                    res.json({ canOCR: true, error: err });
                }
            }
            else {
                res.json({ canOCR: false });
            }
        }));
        app.get('/api/bookmark/show-browser-in-app', (req, res) => {
            (0, utils_1.moveWindowToTop)();
            // 显示浏览器文件
            (0, utils_1.getCurrentWebContents)().send('show-browser-in-app', req.query.uid);
        });
        require('../local-userscripts').installRoute(app,()=>({scripts:store_1.getDecryptedRenderData().scripts,authToken:store_1.store.store.server.authToken,root:require('path').resolve(__dirname,'../../../../../..')}));
        // 静态资源
        app.use(express_1.default.static(path_1.default.join((0, utils_1.getProjectPath)(), './public')));
        const server = app.listen(store_1.store.store.server.port, '127.0.0.1', () => {
            const address = server.address();
            if (address && typeof address === 'object') {
                // 存储本次服务的端口
                logger.info(`学不通本地服务启动成功 => ${address.port}`);
            }
        });
    });
}
exports.startupServer = startupServer;
