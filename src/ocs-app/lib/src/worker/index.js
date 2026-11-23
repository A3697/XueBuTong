"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.launchBrowser = exports.ScriptWorker = void 0;
const chalk_1 = require("chalk");
const logger_core_1 = require("../logger.core");
const path_1 = __importStar(require("path"));
const fs_1 = __importDefault(require("fs"));
const playwright_core_1 = require("playwright-core");
const networkPolicy = require('../network-policy');
networkPolicy.installNodeDirect(require('axios'));
const index_1 = require("../scripts/index");
const get_1 = __importDefault(require("lodash/get"));
const child_process_1 = __importDefault(require("child_process"));
const browser_1 = require("../utils/browser");
const { bgRedBright, bgBlueBright, bgYellowBright, bgGray } = new chalk_1.Instance({ level: 2 });
/** 脚本工作线程 */
class ScriptWorker {
    constructor() {
        this.uid = '';
        /** 拓展路径 */
        this.extensionPaths = [];
        /** 执行的自动化脚本列表 */
        this.playwrightScripts = [];
    }
    init({ store, uid, cachePath, playwrightScripts, browserInfo, config, langs }) {
        this.debug('正在初始化进程...');
        this.store = store;
        ScriptWorker.langs = langs;
        this.uid = uid;
        // 拓展文件夹路径
        this.extensionPaths = (0, browser_1.getExtensionPaths)(store.paths.extensionsFolder);
        this.allExtensionPaths=this.extensionPaths;
        this.fusionRoot=path_1.default.resolve(__dirname,'../../../../../..');
        this.extensionPaths=require('../extension-runtime').enabledPaths(this.extensionPaths,{root:this.fusionRoot});
        config={...config,fusionRoot:this.fusionRoot,allExtensionPaths:this.allExtensionPaths};
        // 自动化脚本
        this.playwrightScripts = playwrightScripts;
        // 初始化日志
        this.logger = new logger_core_1.LoggerCore(store.paths['logs-path'], false, 'script', path_1.default.basename(cachePath));
        // 浏览器中软件设置的名字
        this.browserInfo = browserInfo;
        this.config = config;
        this.debug('初始化成功');
    }
    launch(options) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            this.config.browserScript=options.ocsAccountRuntime?.scriptSelection?.selected||'ocs';
            if(this.config.browserScript==='ocs')this.extensionPaths=this.extensionPaths.filter(p=>path_1.default.basename(p)!=='daxuesoutijiang');
            if (this.extensionPaths.length) {
                this.debug('加载拓展：', this.extensionPaths.map((p) => (0, path_1.basename)(p)));
            }
            else {
                this.debug('浏览器拓展为空');
            }
            /** 添加拓展启动参数 */
            options.args = formatExtensionArguments(this.extensionPaths);
            const start_time = Date.now();
            /** =============================== 检测谷歌浏览器是否可用 =============================== */
            if (!fs_1.default.existsSync(options.executablePath)) {
                console.error(ScriptWorker.lang('error_when_executable_not_found', `浏览器可执行文件不存在，请在设置中更换浏览器路径。：${options.executablePath}`, { executablePath: options.executablePath }));
                return yield this.close();
            }
            if (process.platform === 'win32') {
                const major = (0, browser_1.getBrowserMajorVersion)(options.executablePath);
                console.log('major', major);
                if (major && major > 137) {
                    console.error(ScriptWorker.lang('error_when_browser_version_too_high', '当前浏览器版本过高，无法自动加载脚本管理器，请在设置-浏览器路径中切换“软件内置”浏览器，如果没有内置浏览器，请使用学不通安装包修复内置浏览器'));
                    return yield this.close();
                }
            }
            /** =============================== 检测拓展是否可用 =============================== */
            for (const extensionPath of this.extensionPaths) {
                if (!fs_1.default.existsSync(extensionPath)) {
                    console.error(`拓展不存在：${extensionPath}`);
                    return yield this.close();
                }
                if (!fs_1.default.existsSync(path_1.default.join(extensionPath, 'manifest.json'))) {
                    console.error(`拓展格式不正确，缺少manifest.json：${extensionPath}`);
                    return yield this.close();
                }
                const manifest = JSON.parse(fs_1.default.readFileSync(path_1.default.join(extensionPath, 'manifest.json'), 'utf-8'));
                // 检查是否为 MV2 拓展，如果是则报错
                if ((0, get_1.default)(manifest, 'manifest_version', 2) < 3) {
                    const name = getExtensionName(extensionPath);
                    console.error(ScriptWorker.lang('error_when_extension_version_too_low', `该拓展版本较低：{{name}}，请尝试前往软件左侧-应用中心-卸载并重新安装。`, { name }));
                    return yield this.close();
                }
            }
            /** 启动浏览器 */
            try {
                options.userDataDir=require(path_1.default.join(this.fusionRoot,'src/browser-profile-isolation.cjs')).prepareBrowserProfile({uid:this.uid,cacheRoot:this.store?.paths?.userDataDirsFolder,profilePath:options.userDataDir,userDataRoot:this.store?.paths?.['user-data-path']});
                yield launchBrowser(Object.assign({ onCreated: browser => {
                    this.browser=browser;if(this.closing){void browser.close();throw Error("浏览器启动已取消");}
                    browser.__fusionSessionGuard=require(path_1.default.join(this.fusionRoot,'src/session-guard-browser.cjs')).observe(browser,{onDisplaced:signal=>{
                        try{send('session-displaced',signal);}catch{}this.closing=true;
                        // Close the account context immediately, before auxiliary teardown.
                        void browser.close().catch(()=>{});void this.close();
                    }});
                }, onLaunch: (browser) => {
                        var _a;
                        this.browser = browser;
                        /** URL事件解析器 */
                        (_a = this.browser) === null || _a === void 0 ? void 0 : _a.on('page', (page) => {
                            const match = page.url().match(/ocs-action_(.+)/);
                            if (match === null || match === void 0 ? void 0 : match[1]) {
                                const action = match[1];
                                const actions = {
                                    'bring-to-top': () => {
                                        // 通过命令行打开此页面后会置顶浏览器，并自动关闭当前事件页面
                                        page.close();
                                    }
                                };
                                actions[action]();
                            }
                        });
                        // 浏览器启动完成
                        if(this.closing)return;
                        send('launched');
                        try{const profiles=require(path_1.default.join(this.fusionRoot,'src/login-profiles.js')),login=profiles.parse(this.playwrightScripts),signature=require('node:crypto').createHash('sha256').update(profiles.signature(login)).digest('hex');require('../browser-identity').observe(browser,{login,signature,onName:info=>{browser.__fusionWindowGuard?.setIdentity(info.name);if(info.name)send('browser-identity',info);}});}catch{}
                    }, playwrightScripts: this.playwrightScripts, bookmarksPageUrl: this.store
                        ? `http://localhost:${((_a = this.store) === null || _a === void 0 ? void 0 : _a.server.port) || 15319}/index.html#/bookmarks`
                        : undefined, serverPort: ((_b = this.store) === null || _b === void 0 ? void 0 : _b.server.port) || 15319, closeableExtensionHomepages: [
                        'docs.scriptcat.org',
                        'docs.scriptcat.org/docs/change',
                        'docs.scriptcat.org/docs/use/open-dev',
                        'tampermonkey.net/index.php',
                        'tampermonkey.net/changelog.php'
                    ], authToken: ((_c = this.store) === null || _c === void 0 ? void 0 : _c.server.authToken) || '', browserInfo: this.browserInfo, uid: this.uid, config: this.config }, options));
            }
            catch (err) {
                // 浏览器异常关闭
                if (err instanceof Error) {
                    if (err.message.includes('browser has been closed') ||
                        err.message.includes('Target closed') ||
                        err.message.includes('Browser closed')) {
                        // 5秒内异常关闭，可能是浏览器问题
                        if (Date.now() - start_time < 5 * 1000) {
                            console.error(ScriptWorker.lang('error_when_browser_launch_failed_too_fast', '异常启动，请尝试重启浏览器，或者在设置中更换其他浏览器', {
                                error: err.message.substring(0, 500)
                            }));
                        }
                        else {
                            console.error('异常关闭，请尝试重启浏览器。', err.message.substring(0, 500));
                        }
                    }
                    else {
                        console.error('错误 : ', err.message.substring(0, 500));
                    }
                }
                else {
                    console.error('未知错误 : ', String(err).substring(0, 500));
                }
                yield this.close();
                return;
            }
            // 浏览器初始化完成
            send('init');
        });
    }
    close() {
        if(this.closePromise)return this.closePromise;
        this.closing=true;
        this.closePromise=(async()=>{
            const deadline=setTimeout(()=>process.exit(1),8000);
            const browser=this.browser;
            try {
                for(const helper of [browser?.__fusionSessionGuard,browser?.__fusionSoutijiang,browser?.__fusionWindowSize,browser?.__fusionLocalPort,browser?.__fusionWindowGuard]){
                    try{await helper?.dispose();}catch(error){console.warn('浏览器辅助组件关闭未完成。');}
                }
                await browser?.close();
            }catch(error){console.warn('浏览器关闭时出现异常。');}
            finally{clearTimeout(deadline);this.browser=undefined;send('browser-closed');process.exit();}
        })();return this.closePromise;
    }
    async bringToFront() {
        const browser=this.browser;if(!browser||this.closing)return;
        if(this.showPromise)return this.showPromise;
        this.showPromise=(async()=>{
            // Native restore preserves the selected tab; activating the newest
            // target can instead pick an extension/offscreen or transient tab.
            if(browser.__fusionWindowGuard)await browser.__fusionWindowGuard.show();
            else await browser.pages().filter(item=>!item.isClosed()).at(-1)?.bringToFront();
        })().finally(()=>{this.showPromise=null;});return this.showPromise;
    }
    async setPlayback({speed}) {if(!this.browser?.__fusionPlayback)throw Error('浏览器尚未就绪');const result=await this.browser.__fusionPlayback.set(speed);console.log('浏览器倍速已设为 '+result.speed+' 倍。');return result;}
    async setExtensionEnabled({id,enabled}) {if(!this.browser)return;try{const result=await require('../extension-runtime').setEnabled(this.browser,{root:this.fusionRoot,id,enabled,selectedScript:this.config.browserScript});if(result.reason==='account_uses_ocs'){console.log('当前账号选择 OCS，搜题酱扩展保持关闭；可在账号设置切换脚本。');return result;}await this.browser.__fusionLocalPort?.updateManager(result);console.log(result.restartRequired?'应用状态已保存，重启浏览器后完全生效。':'应用状态已更新。');return result;}catch{console.error('应用状态已保存，请重启浏览器应用。');}}
    async capturePreview({requestId,quality=55}) {
        try {
            const pages=this.browser?.pages().filter(page=>!page.isClosed())||[];
            const page=pages.at(-1);if(!page){send('preview',{requestId,error:'no_page'});return;}
            const image=await page.screenshot({type:'jpeg',quality:Math.min(85,Math.max(30,quality)),timeout:4000});
            send('preview',{requestId,image:image.toString('base64')});
        }catch(_){send('preview',{requestId,error:'unavailable'});}
    }
    /** 跳转到特殊图像共享浏览器窗口 */
    gotoWebRTCPage() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const page = yield ((_a = this.browser) === null || _a === void 0 ? void 0 : _a.newPage());
            if (page) {
                yield page
                    .evaluate((uid) => {
                    document.title = uid;
                    document.body.innerHTML = ScriptWorker.lang('webrtc_page_loading_notice', `正在获取图像中，请勿操作...`);
                }, this.uid)
                    .catch(console.error);
                setTimeout(() => {
                    send('webrtc-page-loaded');
                }, 200);
            }
        });
    }
    /** 关闭特殊图像共享浏览器窗口 */
    closeWebRTCPage() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const pages = ((_a = this.browser) === null || _a === void 0 ? void 0 : _a.pages()) || [];
                for (const page of pages) {
                    const title = yield page.title();
                    if (title === this.uid) {
                        yield page.close();
                    }
                }
            }
            catch (_b) { }
            setTimeout(() => {
                send('webrtc-page-closed');
            }, 200);
        });
    }
    kill() {
        process.exit();
    }
    debug(...msg) {
        console.log(bgGray(loggerPrefix()), ...msg);
    }
    warn(...msg) {
        console.log(bgYellowBright(loggerPrefix()), ...msg);
    }
    info(...msg) {
        console.log(bgBlueBright(loggerPrefix()), ...msg);
    }
    error(...msg) {
        console.error(bgRedBright(loggerPrefix()), ...msg);
    }
}
exports.ScriptWorker = ScriptWorker;
ScriptWorker.lang = (key, def, replace) => {
    const result = (0, get_1.default)(ScriptWorker.langs, key, def);
    return (replace ? result === null || result === void 0 ? void 0 : result.replace(/\{\{(\w+)\}\}/g, (_, k) => replace[k] || '') : result);
};
ScriptWorker.getTransformedErrorMessage = (error, extra_placeholder) => {
    if (error.match(/Timeout .+ exceeded/)) {
        return ScriptWorker.lang('error_when_playwright_selector_timeout', '页面元素查找超时，请检查元素是否存在/可见或选择器是否正确。', Object.assign({ error: error }, extra_placeholder));
    }
    return error;
};
/** 格式化浏览器拓展启动参数 */
function formatExtensionArguments(extensionPaths) {
    const paths = extensionPaths.map((p) => p.replace(/\\/g, '/')).join(',');
    return paths.length === 0 ? [] : [`--load-extension=${paths}`];
}
function loggerPrefix() {
    return `[学不通] ${new Date().toLocaleTimeString()}`;
}
/**
 * 运行脚本
 */
function launchBrowser({ executablePath, headless, args, userDataDir, userscripts, playwrightScripts, closeableExtensionHomepages, bookmarksPageUrl, serverPort, authToken, browserInfo, uid, config, ocsAccountRuntime, onLaunch, onCreated }) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            playwright_core_1.chromium
                .launchPersistentContext(userDataDir, {
                headless,
                viewport: null,
                executablePath,
                ignoreHTTPSErrors: true,
                acceptDownloads: true,
                ignoreDefaultArgs: ['--disable-extensions', '--enable-automation', '--no-sandbox'],
                // Keep GPU decoding; avoid the Windows video-overlay plane that
                // can flicker while a page is composed/captured in the monitor.
                args: networkPolicy.directBrowserArguments(['--window-position=0,0', '--no-first-run', '--no-default-browser-check', ...args,...(process.platform==='win32'?['--disable_direct_composition_video_overlays=1','--disable_direct_composition_sw_video_overlays=1']:[])])
            })
                .then((browser) => __awaiter(this, void 0, void 0, function* () {
                onCreated?.(browser);
                if(!headless){browser.__fusionWindowGuard=yield require('../browser-window-guard').attachWindowGuard(browser,{executablePath});browser.__fusionWindowSize=yield require(path_1.default.join(config.fusionRoot,'src/window-sizes.cjs')).attachBrowser(browser,{root:config.fusionRoot,uid});}
                browser.__fusionPlayback=yield require('../browser-playback').installPlayback(browser,config?.playbackSpeed);
                yield require('../browser-page-behavior').install(browser,{root:config.fusionRoot,uid});
                // 处理浏览器初始
                handleBrowserInit(browser, { enable_dialog: config === null || config === void 0 ? void 0 : config.enable_dialog, userDataDir });
                try {
                    /**
                     * 显示步骤提示
                     */
                    const step = (tips, opts) => __awaiter(this, void 0, void 0, function* () {
                        const { loading = true, warn = false } = opts || {};
                        console.log('[学不通] '+(Array.isArray(tips)?tips.join('；'):tips));
                        if(blankPage.isClosed())return;
                        yield blankPage.evaluate((state) => {
                            // @ts-ignore OCS官方导航页自带的方法
                            const setState = window.setBookmarkLoadingState;
                            if (setState) {
                                setState(state);
                            }
                            else {
                                window.document.body.textContent = state.tips.join('\n');
                            }
                        }, { tips: Array.isArray(tips) ? tips : [tips], loading, warn });
                    });
                    const [blankPage] = browser.pages();
                    // 加载浏览器数据
                    blankPage.on('load', (page) => __awaiter(this, void 0, void 0, function* () {
                        if (bookmarksPageUrl && blankPage.url().includes(bookmarksPageUrl)) {
                            yield blankPage.evaluate((info) => {
                                const slot = document.querySelector('#data-slot');
                                if (slot) {
                                    slot.textContent = JSON.stringify(info);
                                }
                            }, Object.assign(browserInfo || {}, { uid: uid }));
                        }
                    }));
                    // 加载本地导航页
                    yield blankPage.goto(bookmarksPageUrl || 'about:blank');
                    // 打开开发者模式
                    yield step('正在初始化脚本管理器…');
                    yield openExtensionDeveloperMode(browser, executablePath.includes('edge'));
                    const extensionState=yield require('../extension-runtime').applyInitial(browser,{root:config.fusionRoot,paths:config.allExtensionPaths||[],deferSoutijiang:true});
                    if(config.browserScript==='soutijiang'&&!extensionState.applied)throw Error('脚本管理器状态未确认，已停止启动，避免 OCS 与搜题酱同时运行');
                    if(extensionState.results.some(item=>item.id==='daxuesoutijiang'&&!item.applied))throw Error('搜题酱暂停状态未确认，已停止启动，避免脚本同时运行');
                    yield require('../ocs-script-switch').apply(browser,{managers:extensionState.results,enabled:config.browserScript!=='soutijiang',receiptFile:path_1.default.join(userDataDir,'xuebutong-script-selection.json')});
                    const registration=config.browserScript==='soutijiang'?{checked:false}:yield require('../extension-runtime').ensureScriptCatRegistration(browser,extensionState.results);
                    if(registration.recovered)console.log('已恢复脚本猫中保存的 OCS 脚本运行状态。');
                    else if(registration.checked&&!registration.ready)console.warn('脚本猫运行状态尚未就绪，将继续检查安装；如仍未运行，请重启该账号浏览器。');
                    const managedRuntime=require('../local-userscripts').bundledUpdate({root:config.fusionRoot,userDataDir,userscripts,serverPort,authToken,uid,accountRuntime:ocsAccountRuntime});
                    browser.__fusionLocalPort=yield require('../fusion-local-port').attach(browser,{serverPort,managers:extensionState.results||[],accountUid:uid,authToken,enhanced:ocsAccountRuntime?.enhanced??managedRuntime?.enhanced!==false});
                    if(managedRuntime?.enhanced&&managedRuntime.upstreamSha256){
                        const report=()=>send('ocs-plugin-conflict',{upstreamSha256:managedRuntime.upstreamSha256,reason:'浏览器中 OCS 公共接口已变化'});
                        yield browser.exposeBinding('__xuebutongOcsContractFailure',report);
                        yield browser.addInitScript(()=>{document.addEventListener('xuebutong-ocs-contract',event=>{if(event.detail?.ok===false)void globalThis.__xuebutongOcsContractFailure?.();},true);});
                    }
                    if(!browser.__fusionLocalPort.ready)console.warn('脚本管理器与学不通的本地连接尚未就绪，请重启此账号浏览器后重试。');
                    if(!extensionState.hasEnabledManager)userscripts=[];
                    // 必须先打开开发者模式，才能关闭额外拓展页，否则打开开发者模式可能会重启插件，导致出现新的额外页面
                    // 关闭拓展加载时弹出的首页
                    void waitAndCloseExtensionHomepage({ browser, closeableExtensionHomepages }).catch(() => {});
                    // 安装用户脚本
                    const scriptConfig = { ...config, scriptManagers: (extensionState.results || []).filter((item) => item.applied && item.requestedEnabled && item.enabled === true).map((item) => ({ id: item.id, chromeId: item.chromeId })) };
                    const installURLs=userscripts.map(url=>require('../local-userscripts').installationURL(url,{serverPort,authToken}));
                    scriptConfig.bundledUpdate=managedRuntime;
                    const warn = yield setupUserScripts({ browser, userscripts:installURLs, step, config: scriptConfig });
                    if(config.browserScript==='soutijiang'){
                        // Recheck after installing other user scripts, then enable the
                        // unmodified official extension. Its question-bank session is separate.
                        yield require('../ocs-script-switch').apply(browser,{managers:extensionState.results,enabled:false,receiptFile:path_1.default.join(userDataDir,'xuebutong-script-selection.json')});
                        const extensionPrefs=require('../extension-runtime').preferences(config.fusionRoot);
                        if(extensionPrefs['extensions:daxuesoutijiang']!==false){const result=yield require('../extension-runtime').setEnabled(browser,{root:config.fusionRoot,id:'daxuesoutijiang',enabled:true,selectedScript:'soutijiang'});if(!result.applied)throw Error('大学搜题酱未能启用，请重启该账号浏览器');}
                    }
                    if(config.browserScript==='soutijiang'&&ocsAccountRuntime?.soutijiangShare){browser.__fusionSoutijiang=yield require(path_1.default.join(config.fusionRoot,'src/soutijiang-browser.cjs')).attach(browser,{port:serverPort,token:ocsAccountRuntime.soutijiangShare.token,onError:message=>console.warn(message)});}
                    // 监听网络请求
                    browserNetworkRoute(authToken, browser, { accountUid: uid });
                    // 运行自动化脚本
                    warn.push(...yield runPlaywrightScripts({ browser, playwrightScripts, serverPort, step }));
                    yield step([warn.length ? '浏览器已启动，部分初始化步骤需要处理' : '浏览器初始化完成'].concat(warn), { loading: false, warn: !!warn.length });
                    // 触发onLaunch事件
                    onLaunch === null || onLaunch === void 0 ? void 0 : onLaunch(browser);
                    // 启动完成
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            }))
                .catch((err) => {
                reject(err);
            });
        });
    });
}
exports.launchBrowser = launchBrowser;
/**
 * 安装/更新脚本
 *
 */
async function initScripts(urls, browser, config = {}, options = {}) {
    const warnings = [], owned = new Set(), probed = new Set(), timers = new Set(), retries = new Map();
    const previousPages = new Set(browser.pages());
    const probeToken = 'ocs-install-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const official = {
        ndcooeababalnlpkfedmmbbbgkljhpjf: { kind: 'scriptcat', paths: ['/src/install.html', '/install.html'] },
        dhdgffkkebhmkfjojejmpbldmpobfkfo: { kind: 'tampermonkey', paths: ['/ask.html', '/install.html'] }
    };
    const managers = (config.scriptManagers || []).filter((item) => official[item.chromeId] && new RegExp('^' + official[item.chromeId].kind + '(?:[-_].*)?$', 'i').test(item.id));
    if (!urls.length) return warnings;
    if (!managers.length) return ['用户脚本未自动安装：未找到当前已启用的受支持脚本管理器，请在应用中心检查。'];
    const limit = (value, fallback, max) => Number.isFinite(value) ? Math.max(1, Math.min(max, value)) : fallback;
    const timeoutMs = limit(options.timeoutMs, 60000, 60000), itemMs = limit(options.itemTimeoutMs, 30000, 60000);
    const pollMs = limit(options.pollMs, 250, 1000), fallbackMs = limit(options.fallbackMs, 6000, 8000), expires = Date.now() + timeoutMs;
    const stopped = Symbol('script-install-stopped'), failed = Symbol('script-install-operation-failed');
    let ended = false, closeReason = '', cancel;
    const cancelled = new Promise((resolve) => { cancel = resolve; });
    const clear = (timer) => { clearTimeout(timer); timers.delete(timer); };
    const later = (run, ms) => { const timer = setTimeout(() => { timers.delete(timer); run(); }, ms); timers.add(timer); timer.unref?.(); return timer; };
    const stop = (reason) => { if (ended) return; ended = true; closeReason = reason; for (const timer of timers) clearTimeout(timer); timers.clear(); cancel(stopped); };
    const onClose = () => stop('closed');
    const guard = async (run, ms = 1500) => {
        if (!ended && Date.now() >= expires) stop('timeout');
        if (ended) return stopped;
        let timer;
        try { return await Promise.race([Promise.resolve().then(run).catch(() => failed), cancelled, new Promise((resolve) => { timer = later(() => resolve(failed), Math.max(1, Math.min(ms, expires - Date.now()))); })]); }
        finally { if (timer) clear(timer); }
    };
    const pause = async () => { let timer; try { await Promise.race([cancelled, new Promise((resolve) => { timer = later(resolve, pollMs); })]); } finally { if (timer) clear(timer); } };
    const managerPage = (page) => {
        try { const address = new URL(page.url()); const item = managers.find((entry) => entry.chromeId === address.hostname); const spec = item && official[item.chromeId]; return address.protocol === 'chrome-extension:' && spec?.paths.includes(address.pathname) ? { ...spec, chromeId: item.chromeId, pageUrl: address.href } : null; } catch { return null; }
    };
    // Match the pending installation's source metadata through the manager API
    // or its source field. Never confirm arbitrary extension pages or buttons.
    const probe = async (page, spec, url, action) => { probed.add(page); return guard(() => page.evaluate(async ({ spec, url, action, force, probeToken }) => {
        if (location.href !== spec.pageUrl || globalThis.chrome?.runtime?.id !== spec.chromeId) return 'waiting';
        const normalize = (value) => { try { const parsed = new URL(value); parsed.hash = ''; return parsed.href; } catch { return value; } };
        let matched = action === 'status', version = '';
        const address = new URL(location.href), source = address.searchParams.get('url');
        if (!matched && source && normalize(source) === normalize(url)) matched = true;
        else if (!matched && spec.kind === 'scriptcat') {
            const uuid = address.searchParams.get('uuid');
            if (!uuid || !/^[A-Za-z0-9_-]{1,120}$/.test(uuid)) return 'waiting';
            const response = await new Promise((resolve) => {
                const pending = globalThis.__ocsInstallerProbes ||= new Map();
                let complete = false; const done = (value) => { if (complete) return; complete = true; clearTimeout(timer); pending.delete(probeToken); if (!pending.size) delete globalThis.__ocsInstallerProbes; resolve(value); };
                const timer = setTimeout(() => done(null), 1000);
                pending.set(probeToken, () => done(null));
                try { chrome.runtime.sendMessage({ action: 'serviceWorker/script/getInstallInfo', data: uuid }, (value) => done(chrome.runtime.lastError ? null : value)); } catch { done(null); }
            });
            const info = !response?.code && response?.data?.[1];
            matched = !!info && normalize(info.url) === normalize(url); version = info?.metadata?.version?.[0] || '';
        } else if (!matched) {
            matched = [...document.querySelectorAll('a[href]')].some((node) => normalize(node.href) === normalize(url));
            if (!matched && spec.kind === 'tampermonkey') matched = [...document.querySelectorAll('tr.script_desc[id^="tr_"]')].some((row) => {
                try { return atob(row.id.slice(3)).startsWith('fileURL_') && row.children.length === 2 && normalize(row.children[1].textContent.trim()) === normalize(url); } catch { return false; }
            });
        }
        if (!matched) return 'waiting';
        const message = (selector) => [...document.querySelectorAll(selector)].map((node) => node.textContent || '').join(' ');
        const failure = message('.arco-message-error, .arco-alert-error');
        if (/安装失败|更新失败|信息加载失败|install(?:ation)? failed|update failed|script info.*failed/i.test(failure)) {
            return 'error:' + failure.replace(/https?:\/\/[^\s]+/g, '[地址已省略]').replace(/(?:token|password|secret|key)\s*[:=]\s*[^\s,]+/gi, '[密钥已省略]').slice(0, 240);
        }
        if (action === 'status') return /安装成功|更新成功|installed successfully|updated successfully/i.test(message('.arco-message-success, .arco-alert-success')) ? 'success' : 'waiting';
        const container = spec.kind === 'scriptcat' ? document.querySelector('#install-app-container') : document;
        if (!container) return 'waiting';
        const text = (node) => (node.textContent || node.value || node.getAttribute('value') || '').replace(/\s+/g, '').toLowerCase();
        const button = [...container.querySelectorAll('button, input[type="button"], input[type="submit"]')].find((node) => !node.disabled && node.getAttribute('aria-disabled') !== 'true' && /^(?:安装(?:脚本)?|更新(?:脚本)?|重新安装(?:脚本)?|重装(?:脚本)?|添加(?:脚本)?|降级(?:脚本)?|install(?:script)?|update(?:script)?|reinstall(?:script)?|add(?:script)?|downgrade(?:script)?)$/i.test(text(node)));
        if (!button) return 'waiting';
        const current = [...container.querySelectorAll('.arco-tag:not(.arco-tag-red)')].map((node) => (node.textContent || '').trim());
        if (!force && version && /更新|重装|重新安装|update|reinstall/.test(text(button)) && current[0] === version) return 'unchanged';
        if (action === 'click') { button.click(); return 'clicked'; }
        return 'ready';
    }, { spec, url, action, force: config.force_update_script === true || config.bundledUpdate?.url === url && (spec.kind === 'scriptcat' || config.bundledUpdate.force === true), probeToken })); };
    try {
        if (!browser.pages().length) return warnings;
        browser.once('close', onClose); later(() => stop('timeout'), timeoutMs);
        for (let index = 0; index < urls.length && !ended && Date.now() < expires; index++) {
            const url = urls[index], began = Date.now(), until = Math.min(expires, began + itemMs);
            const bundle = config.bundledUpdate?.url === url ? config.bundledUpdate : null;
            const scriptcat = bundle && managers.find(item => official[item.chromeId].kind === 'scriptcat');
            const verified = async () => {
                if (!scriptcat) return false;
                const installed = await guard(() => require('../local-userscripts').installedBundledDigest(browser, scriptcat.chromeId));
                return installed?.sha256 === bundle.hash && installed.status === 1;
            };
            if (scriptcat && config.force_update_script !== true && await verified()) {
                require('../local-userscripts').confirmBundledUpdate(bundle);
                console.log('内置 OCS 脚本内容已核验，已保留当前安装。');
                continue;
            }
            const trigger = await guard(() => browser.newPage().then((page) => { if (!ended) owned.add(page); else Promise.resolve(page.close()).catch(() => {}); return page; }), 5000);
            if (trigger === stopped) break;
            if (trigger === failed) { warnings.push('用户脚本安装页无法打开，已继续执行账号登录。'); continue; }
            let fallbackUsed = false, clicked = null, complete = false, error = false, failureDetail = '', matchedPage = null;
            const navigate = (address) => { Promise.resolve().then(() => trigger.goto(address, { waitUntil: 'domcontentloaded', timeout: Math.max(1, until - Date.now()) })).catch(() => {}); };
            navigate(url);
            while (!ended && Date.now() < until && !complete && !error) {
                if (clicked && scriptcat && await verified()) { complete = true; if (!clicked.isClosed()) await guard(() => clicked.close()); break; }
                if (clicked?.isClosed()) { if (!scriptcat) complete = true; else { error = true; failureDetail = '安装窗口已关闭，但内置脚本内容未通过核验'; } break; }
                let found = false;
                for (const page of browser.pages()) {
                    const spec = managerPage(page); if (!spec || previousPages.has(page)) continue;
                    const state = await probe(page, spec, url, clicked === page ? 'status' : 'inspect');
                    if (state === stopped) break;
                    if (typeof state === 'string' && state.startsWith('error:')) { error = true; failureDetail = state.slice(6); matchedPage = page; break; }
                    if (state === 'success') { if (scriptcat && !await verified()) continue; complete = true; await guard(() => page.close(), 1000); break; }
                    if (state === 'unchanged') { complete = true; console.log('用户脚本已是当前版本，已保留现有安装。'); await guard(() => page.close()); break; }
                    if (state === 'ready' && !clicked) {
                        found = true; matchedPage = page; await guard(() => page.bringToFront());
                        if (await probe(page, spec, url, 'click') === 'clicked') clicked = page;
                    } else if (clicked === page) found = true;
                }
                if (!complete && !error && !clicked && !found && !fallbackUsed && Date.now() - began >= fallbackMs && managers.some((item) => official[item.chromeId].kind === 'scriptcat')) {
                    fallbackUsed = true;
                    try { const publicUrl = new URL(url); if (['https:', 'http:'].includes(publicUrl.protocol) && !publicUrl.username && !publicUrl.password && !publicUrl.search && !publicUrl.hash) navigate('https://docs.scriptcat.org/docs/script_installation/#url=' + publicUrl.href); } catch {}
                }
                if (!complete && !error) await pause();
            }
            if (!complete && !ended && (retries.get(url) || 0) < 1 && expires - Date.now() > 2000) {
                retries.set(url, 1);
                console.warn('用户脚本安装暂未完成，正在重试一次' + (failureDetail ? '：' + failureDetail : '。'));
                if (matchedPage && !matchedPage.isClosed()) await guard(() => matchedPage.close());
                await guard(() => trigger.close(), 1000); if (trigger.isClosed()) owned.delete(trigger);
                await pause(); index--; continue;
            }
            if (complete && bundle) {
                require('../local-userscripts').confirmBundledUpdate(bundle);
                if (scriptcat) console.log('内置 OCS 脚本已安装，内容核验通过。');
            }
            if (!complete && closeReason !== 'closed') warnings.push(error ? '用户脚本安装失败' + (failureDetail ? '：' + failureDetail : '') + '。请在脚本管理器中重试；账号登录已继续，自动学习脚本可能仍是旧版。' : '用户脚本安装未在限定时间内完成，请在脚本管理器中确认；已继续执行账号登录。');
            await guard(() => trigger.close(), 1000); if (trigger.isClosed()) owned.delete(trigger);
        }
        if (ended && closeReason === 'timeout' && !warnings.length) warnings.push('用户脚本安装等待已结束，请在脚本管理器中完成安装；已继续执行账号登录。');
    } catch { if (closeReason !== 'closed') warnings.push('用户脚本自动安装未完成，请在脚本管理器中处理；已继续执行账号登录。'); }
    finally {
        stop(closeReason || 'finished'); browser.removeListener('close', onClose);
        const cleanup = [
            ...[...probed].map((page) => Promise.resolve().then(() => page.evaluate((token) => globalThis.__ocsInstallerProbes?.get(token)?.(), probeToken)).catch(() => {})),
            ...[...owned].map((page) => Promise.resolve().then(() => page.close()).catch(() => {}))
        ];
        if (cleanup.length) { let timer; try { await Promise.race([Promise.all(cleanup), new Promise((resolve) => { timer = setTimeout(resolve, 1000); })]); } finally { clearTimeout(timer); } }
    }
    return warnings;
}
function send(event, ...args) {
    var _a;
    (_a = process.send) === null || _a === void 0 ? void 0 : _a.call(process, { event, args });
}
function sleep(t) {
    return new Promise((resolve, reject) => setTimeout(resolve, t));
}
/**
 * 将脚本配置转换为可用的对象配置
 * @param configs
 */
function transformScriptConfigToRaw(configs) {
    const raw = Object.create({});
    for (const key in configs) {
        if (Object.prototype.hasOwnProperty.call(configs, key)) {
            Reflect.set(raw, key, configs[key].value);
        }
    }
    return raw;
}
/**
 * 安装用户脚本
 */
function setupUserScripts(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { userscripts, browser, step } = opts;
        const warn = [];
        // 安装用户脚本
        if (userscripts.length) {
            yield step('正在安装用户脚本...（最多等待 60 秒，未完成时会提示手动处理）');
            // 载入本地脚本
            try {
                warn.push(...yield initScripts(userscripts, browser, opts.config));
            }
            catch (e) {
                // @ts-ignore
                console.error('脚本安装失败：', e.message);
                warn.push('用户脚本安装失败，请在脚本管理器中检查；账号登录将继续执行。');
                // await html('脚本载入失败，请手动更新，或者忽略。' + e.message);
            }
        }
        else {
            warn.push('检测到您的软件中并未安装任何用户脚本，或者全部脚本处于不加载状态，可能会导致预期脚本不运行。');
        }
        return warn;
    });
}
/**
 * 运行自动化脚本
 */
function runPlaywrightScripts(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { playwrightScripts, browser, serverPort, step } = opts;
        const warnings=[];
        if (playwrightScripts.length) {
            // 执行自动化脚本
            for (const savedScript of playwrightScripts) {
                const ps=index_1.normalizeScript(savedScript);
                yield step(`正在执行自动化脚本 - ${ps.name} ...`);
                const configs = transformScriptConfigToRaw(ps.configs);
                for (const script of index_1.scripts) {
                    if (script.name === ps.name) {
                        const dataListener=(...msg)=>console.log(...msg);
                        const errorListener=(...msg)=>{console.error('自动化脚本错误：',...msg.map(m=>ScriptWorker.getTransformedErrorMessage(m)));warnings.push(ps.name+'未自动完成，请在平台页面检查登录提示后重试。');};
                        script.on('script-data',dataListener);script.on('script-error',errorListener);
                        try {
                            const loginPage=yield browser.newPage();
                            yield loginPage.setContent('<!doctype html><meta charset="utf-8"><title>学不通 · 正在登录</title><body style="font:18px system-ui;padding:48px;color:#27344b;background:#f5f7fb"><h2>正在打开登录页面…</h2><p>请稍候，网络响应较慢时会显示超时提示。</p></body>');
                            yield script.run(loginPage, configs, {
                                ocrApiUrl: `http://localhost:${serverPort}/ocr`,
                                ocrApiImageKey: 'image',
                                detBackgroundKey: 'det_bg',
                                detTargetKey: 'det_target'
                            });
                        }
                        catch (err) {
                            errorListener(err instanceof Error?err.message:String(err));
                        }finally{script.removeListener('script-data',dataListener);script.removeListener('script-error',errorListener);}
                        break;
                    }
                }
            }
        }
        return warnings;
    });
}
/**
 * 关闭浏览器拓展主页
 */
function waitAndCloseExtensionHomepage(opts = {}) {
    return new Promise((resolve) => {
        const browser = opts.browser, watched = new Map(), closing = new WeakSet(), titleTimers = new Set();
        let cancelTitle;
        const cancelledTitles = new Promise(done => { cancelTitle = done; });
        let poll, deadline, finished = false;
        const homepages = Array.isArray(opts.closeableExtensionHomepages) ? opts.closeableExtensionHomepages.filter(value => typeof value === 'string' && value) : [];
        const isWelcome = value => {
            try {
                const address = new URL(value), host = address.hostname.toLowerCase();
                if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password || address.port) return false;
                const pathname = address.pathname.replace(/\/+$/, '') || '/';
                const paths = host === 'docs.scriptcat.org' ? ['/', '/docs/change', '/docs/use/open-dev', '/docs/use/install_comple'] : ['tampermonkey.net', 'www.tampermonkey.net'].includes(host) ? ['/index.php', '/changelog.php'] : [];
                if (!paths.some(allowed => pathname === allowed || allowed !== '/' && pathname.startsWith(allowed + '/'))) return false;
                return homepages.some(homepage => {
                    try {
                        const permitted = new URL(homepage.includes('://') ? homepage : 'https://' + homepage), allowed = permitted.pathname.replace(/\/+$/, '') || '/';
                        return permitted.hostname.replace(/^www\./, '') === host.replace(/^www\./, '') && (allowed === '/' || pathname === allowed || pathname.startsWith(allowed + '/'));
                    } catch { return false; }
                });
            } catch { return false; }
        };
        const finish = () => {
            if (finished) return; finished = true; clearTimeout(poll); clearTimeout(deadline);
            for (const timer of titleTimers) clearTimeout(timer);titleTimers.clear();cancelTitle('');
            browser?.removeListener?.('close', finish); browser?.removeListener?.('page', watch);
            for (const [page, listeners] of watched) for (const [event, callback] of listeners) page.removeListener?.(event, callback);
            watched.clear(); resolve();
        };
        const closeWelcome = (page, url) => {
            if (finished || page.isClosed?.() || closing.has(page) || !isWelcome(url)) return;
            closing.add(page); Promise.resolve().then(() => page.close({runBeforeUnload:false})).catch(() => closing.delete(page));
        };
        function watch(page) {
            if (finished || watched.has(page)) return;
            const request = item => {
                try { if (item.isNavigationRequest() && (!item.frame || item.frame() === page.mainFrame?.())) closeWelcome(page, item.url()); } catch {}
            };
            const navigation = frame => { try { if (frame === page.mainFrame?.()) closeWelcome(page, frame.url()); } catch {} };
            const listeners = [['request', request], ['framenavigated', navigation]];
            watched.set(page, listeners); for (const [event, callback] of listeners) page.on?.(event, callback);
            closeWelcome(page, page.url());
        }
        const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(0, Math.min(60000, opts.timeoutMs)) : 60000;
        const pollMs = Number.isFinite(opts.pollIntervalMs) ? Math.max(1, Math.min(1000, opts.pollIntervalMs)) : 1000;
        const scan = async () => {
            if (finished) return;
            try {
                const pages = browser.pages(); if (!pages.length) { finish(); return; }
                for (const page of pages) {
                    watch(page); if (page.isClosed?.()) continue;
                    const url = page.url();
                    if (url !== 'chrome-error://chromewebdata/') { closeWelcome(page, url); continue; }
                    // Only an explicit failed-navigation URL can identify a welcome page.
                    let titleTimer,title;
                    try {title = await Promise.race([Promise.resolve().then(() => page.title()).catch(() => ''), cancelledTitles, new Promise(done => {titleTimer=setTimeout(()=>done(''),100);titleTimer.unref?.();titleTimers.add(titleTimer);})]);}
                    finally {if(titleTimer){clearTimeout(titleTimer);titleTimers.delete(titleTimer);}}
                    if (finished) return;
                    const target = /^https?:\/\//i.test(title) ? title : /^[A-Za-z0-9.-]+\//.test(title) ? 'https://' + title : '';
                    closeWelcome(page, target);
                }
                if (!finished) { poll=setTimeout(()=>{void scan();},pollMs);poll.unref?.(); }
            } catch { finish(); }
        };
        try {
            if (!browser || !homepages.length || !browser.pages().length) { finish(); return; }
            browser.once('close', finish); browser.on?.('page', watch);
            deadline=setTimeout(finish,timeoutMs);deadline.unref?.();
            void scan();
        } catch { finish(); }
    });
}
function browserNetworkRoute(authToken, browser, { accountUid = '' } = {}) {
    browser.route(/ocs-environment/, (route) => __awaiter(this, void 0, void 0, function* () {
        yield route.fulfill({
            status: 200,
            body: JSON.stringify({
                environment: 'playwright',
                accountConfigSync: typeof accountUid === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(accountUid)
            })
        });
    }));
    browser.route(/ocs-script-actions/, (route) => __awaiter(this, void 0, void 0, function* () {
        const req = route.request();
        if (req.method().toLocaleUpperCase() !== 'POST') {
            return;
        }
        const headerValue = yield req.headerValue('auth-token');
        if (headerValue !== authToken) {
            return;
        }
        const { page: targetPageUrl, property, args } = req.postDataJSON();
        try {
            const page = browser === null || browser === void 0 ? void 0 : browser.pages().find((p) => p.url().includes(targetPageUrl));
            if (!page) {
                return;
            }
            const targetFunction = (0, get_1.default)(page, property);
            if (typeof targetFunction !== 'function') {
                return;
            }
            if (property === 'waitForResponse' || property === 'waitForRequest') {
                args[0] = new RegExp(args[0]);
            }
            const res = yield targetFunction.apply(property.split('.').length > 1 ? (0, get_1.default)(page, property.split('.')[0]) : page, args);
            if (typeof res === 'object') {
                if (property === 'screenshot') {
                    const buffer = res;
                    yield route.fulfill({
                        status: 200,
                        body: buffer.toString('base64')
                    });
                }
                else if (property === 'waitForResponse') {
                    const response = res;
                    yield route.fulfill({
                        status: 200,
                        body: JSON.stringify({
                            url: response.url(),
                            status: response.status(),
                            headers: response.headers(),
                            body: yield response.body().then((res) => res.toString('utf8'))
                        })
                    });
                }
                else if (property === 'waitForRequest') {
                    const request = res;
                    yield route.fulfill({
                        status: 200,
                        body: JSON.stringify({
                            url: request.url(),
                            method: request.method(),
                            headers: request.headers(),
                            postData: request.postData()
                        })
                    });
                }
                else {
                    yield route.fulfill({ status: 200, body: JSON.stringify(res) });
                }
            }
            else {
                yield route.fulfill({ status: 200, body: res !== null && res !== void 0 ? res : 'OK' });
            }
        }
        catch (err) {
            yield route.continue();
            console.error('脚本软件辅助失败：', ScriptWorker.getTransformedErrorMessage(err instanceof Error ? err.message : String(err), {
                url: targetPageUrl,
                property: property === 'click' ? '点击' : property === 'fill' ? '填写' : property === 'check' ? '选中' : property,
                args: JSON.stringify(args)
            }));
        }
    }));
}
function handleBrowserInit(browser, config) {
    // 防检测
    browser.addInitScript({
        content: 'Object.defineProperty(navigator, "webdriver", { get: () => false });console.log(navigator)'
    });
    // 关闭检测
    const interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
        if (browser.pages().length === 0) {
            clearInterval(interval);
            yield browser.close({
                reason: 'no pages'
            });
        }
    }), 100);
    browser.once('close', () => {
        send('browser-closed');
        process.exit();
    });
    const pageHandle = (page) => {
        // 按照文档的说法，如果不进行任何处理，则动作会和原版浏览器一致
        // 如果不进行监听 page.on('dialog') playwright 会自动处理弹窗
        page.on('dialog', (dialog) => __awaiter(this, void 0, void 0, function* () {
            if (config === null || config === void 0 ? void 0 : config.enable_dialog) {
                // 不进行任何处理
            }
            else {
                yield dialog.accept(dialog.defaultValue());
            }
        }));
        // 修改下载逻辑
        page.on('download', (download) => __awaiter(this, void 0, void 0, function* () {
            // 不处理脚本安装
            if (download.url().endsWith('.user.js')) {
                return;
            }
            download.cancel();
            // 调用电脑本地浏览器进行文件下载
            openUrl(download.url());
            yield page.evaluate(() => alert('自动化浏览器无法下载文件，已使用本地浏览器进行下载任务。'));
        }));
    };
    for (const page of browser.pages()) {
        pageHandle(page);
    }
    browser.on('page', pageHandle);
}
function openUrl(url) {
    let cmd = 'start';
    if (process.platform === 'darwin') {
        cmd = 'open';
    }
    else if (process.platform === 'linux') {
        cmd = 'xdg-open';
    }
    child_process_1.default.exec(`${cmd} ${url}`);
}
/**
 * 打开浏览器拓展开发者模式（由于 MV3 的限制，运行脚本需要打开开发者模式）
 */
function openExtensionDeveloperMode(browser, edge = false) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const page = yield browser.newPage();
        yield page.goto('chrome://extensions/');
        try {
            yield page.bringToFront();
            yield page.waitForTimeout(200);
            if (edge) {
                const els = yield page.$$('[aria-label="扩展 菜单"]');
                yield ((_a = els[1]) === null || _a === void 0 ? void 0 : _a.click());
                const element = yield page.waitForSelector('#developer-mode', {
                    timeout: 1000
                });
                if (yield element.evaluate((el) => el.checked === false)) {
                    yield element.click();
                }
            }
            else {
                const element = yield page.waitForSelector('#devMode', {
                    timeout: 1000
                });
                // 如果没有开启开发者模式
                if (yield element.evaluate((el) => { var _a; return ((_a = el.getAttribute('aria-pressed')) === null || _a === void 0 ? void 0 : _a.toString()) === 'false'; })) {
                    yield element.click();
                    // 重新加载拓展，否则需要重启浏览器才能使用
                    const extensions = yield page.$$('[id="dev-reload-button"]');
                    for (const ext of extensions) {
                        yield ext.click();
                        yield page.waitForTimeout(200);
                    }
                }
            }
        }
        catch (_b) { }
        yield page.waitForTimeout(500);
        console.log('开发者模式已打开');
        yield page.close();
    });
}
function getExtensionName(filepath) {
    return filepath.toLocaleLowerCase().includes('tampermonkey')
        ? '油猴'
        : filepath.toLocaleLowerCase().includes('scriptcat')
            ? '脚本猫'
            : path_1.default.basename(filepath);
}
