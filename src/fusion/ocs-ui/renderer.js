/* OCS 2.9.24 Xingchan fusion renderer. Launch/login stays behind explicit user actions. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.XingchanOCSFusion = api;
  root.XingchanOCSPoC = api; // Compatibility with the existing trusted loader.
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STRATEGIES = ['yanxi-first','ai-first'];
  const METHOD_LABELS = {'soutijiang':'大学搜题酱','yanxi':'言溪题库','xingchan-ai':'星蝉 AI','xingchan-bank':'万能题库'};
  const DEFAULT_METHODS = [{id:'yanxi',enabled:false},{id:'xingchan-ai',enabled:false},{id:'xingchan-bank',enabled:false}];
  const AI_TYPES = ['auto', 'openai', 'anthropic', 'gemini', 'ollama'];
  const CHECK_STATES={unchecked:'未检测',unconfigured:'未配置',connected:'连接正常',failed:'连接失败',limited:'额度或频率受限',waiting:'等待检查'};
  const MODES = { live: '真实集成', unconnected: '未连接' };
  const STATES = { 'not-configured': '未配置', stopped: '已停止', starting: '启动中', 'logging-in': '登录中', ready: '服务就绪', running: '运行中', paused: '已暂停', failed: '失败', unknown: '状态未知' };
  const METHODS = ['getSettings', 'saveSettings', 'listStatus', 'start', 'stop', 'openHtml', 'getLogs'];
  const text = value => typeof value === 'string' ? value : '';
  const statusReaders=new WeakMap();
  const visible=()=>!document.hidden&&(typeof window!=='object'||window.__fusionWindowVisible!==false);
  function invalidateStatuses(bridge){statusReaders.get(bridge)?.cache.clear();}
  function readStatuses(bridge,uids){
    let reader=statusReaders.get(bridge);if(!reader){reader={cache:new Map(),pending:new Map(),queue:new Set(),scheduled:false};statusReaders.set(bridge,reader);}
    const now=Date.now(),promises=uids.map(uid=>{const cached=reader.cache.get(uid);if(cached&&cached.until>now)return Promise.resolve(cached.item);if(reader.pending.has(uid))return reader.pending.get(uid).promise;let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});reader.pending.set(uid,{promise,resolve,reject});reader.queue.add(uid);return promise;});
    if(reader.queue.size&&!reader.scheduled){reader.scheduled=true;Promise.resolve().then(async()=>{const ids=[...reader.queue];reader.queue.clear();reader.scheduled=false;try{const result=await bridge.listStatus({uids:ids}),items=new Map((result?.items||[]).map(item=>[item.uid,item]));for(const uid of ids){const item=items.get(uid);if(item)reader.cache.set(uid,{item,until:Date.now()+600});reader.pending.get(uid)?.resolve(item);reader.pending.delete(uid);}}catch(error){for(const uid of ids){reader.pending.get(uid)?.reject(error);reader.pending.delete(uid);}}});}
    return Promise.all(promises).then(items=>({items:items.filter(Boolean)}));
  }
  const validUid = uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(uid) && !['__proto__', 'constructor', 'prototype'].includes(uid);
  const requiredUid = uid => { if (!validUid(uid)) throw new Error('无效的浏览器 UID'); return uid; };
  function apiPreview(value,present) {
    if(!present)return '';
    const raw=text(value).replace(/^sk-/i,'');return /…|•/.test(raw)?raw.replace(/•+/g,'…'):raw.length>8?raw.slice(0,4)+'…'+raw.slice(-4):'********';
  }
  const NAME_SOURCES=['xingchan','verification','browser'];
  function verifiedName(name,source) {return NAME_SOURCES.includes(source)?text(name):'';}
  function normalizeSearchMethods(value,legacy) {
    if(value===undefined){const result=DEFAULT_METHODS.map(item=>({...item}));if(legacy==='ai-first')result.splice(0,2,result[1],result[0]);return result;}
    if(!Array.isArray(value)||value.length<2||value.length>50)throw new Error('搜题方式列表无效');
    const ids=new Set(),result=value.map(item=>{
      if(!item||!(Object.hasOwn(METHOD_LABELS,item.id)||/^(?:ocs-[a-f0-9]{8}|ai-[a-f0-9]{16})$/.test(item.id))||ids.has(item.id)||typeof item.enabled!=='boolean')throw new Error('搜题方式重复或开关无效');
      ids.add(item.id);return{id:item.id,enabled:item.enabled};
    });
    if(!ids.has('xingchan-ai'))throw new Error('缺少搜题方式入口');
    if(!ids.has('xingchan-bank'))result.push({id:'xingchan-bank',enabled:false});
    return result;
  }
  function reorderSearchMethods(value,from,to) {
    const result=normalizeSearchMethods(value),a=result.findIndex(x=>x.id===from),b=result.findIndex(x=>x.id===to);
    if(a<0||b<0)throw new Error('拖动的搜题方式无效');
    const moved=result.splice(a,1)[0];result.splice(b,0,moved);return result;
  }

  function listBrowsers(store) {
    const node = store && store.render && store.render.browser && store.render.browser.root;
    const result = [], seen = new Set(), ids = new Set();
    function visit(value, depth) {
      if (!value || typeof value !== 'object' || seen.has(value) || depth > 64) return;
      seen.add(value);
      if (value.type === 'browser' && validUid(value.uid) && !ids.has(value.uid)) {
        ids.add(value.uid); result.push({ uid: value.uid, name: text(value.name) || value.uid });
      } else if ((value.type === 'root' || value.type === 'folder') && value.children && typeof value.children === 'object') {
        for (const child of Object.values(value.children)) visit(child, depth + 1);
      }
    }
    visit(node, 0); return result;
  }

  function selectedBrowser(store) {
    const uid = store && store.render && store.render.browser && store.render.browser.currentBrowserUid;
    return listBrowsers(store).find(item => item.uid === uid) || null;
  }

  function normalizeSettings(uid, source) {
    requiredUid(uid);
    const s = source && typeof source === 'object' ? source : {};
    if (s.uid !== uid) throw new Error('后端返回的配置 UID 不匹配，已阻止显示');
    const ai = s.ai || {};
    return {
      uid,soutijiangEnabled:s.soutijiangEnabled===true,soutijiangConfigured:s.soutijiangConfigured===true,ocsEnhancementsEnabled:s.ocsEnhancementsEnabled!==false,starEnhancementsEnabled:s.starEnhancementsEnabled!==false,enrollmentYear:s.enrollmentYear??null,keepPlayingOnLeave:s.keepPlayingOnLeave===true,clientEnvironment:s.clientEnvironment&&typeof s.clientEnvironment==='object'&&!Array.isArray(s.clientEnvironment)?{...s.clientEnvironment}:{},clientEnvironmentDeviceId:text(s.clientEnvironmentDeviceId),answerSettings:s.answerSettings||{},questionBanks:Array.isArray(s.questionBanks)?s.questionBanks:[],questionBankConfig:text(s.questionBankConfig)||'[]', revision: Number.isSafeInteger(s.revision) && s.revision >= 0 ? s.revision : 0,
      username: text(s.username),password:text(s.password),schoolId: text(s.schoolId),loginKind:text(s.loginKind)||'none',loginPlatform:text(s.loginPlatform)||'none',loginUnit:text(s.loginUnit),starEligible:s.starEligible===true,nativeLoginConfigured:s.nativeLoginConfigured===true,displayName:verifiedName(s.displayName,s.nameSource),nameSource:NAME_SOURCES.includes(s.nameSource)?s.nameSource:'',
      hasPassword: s.hasPassword === true, yanxi: { hasToken: !!(s.yanxi && s.yanxi.hasToken === true),tokenPreview:apiPreview(s.yanxi?.tokenPreview,s.yanxi?.hasToken===true),config:text(s.yanxi?.config),hasConfig:s.yanxi?.hasConfig===true },
      xingchanBank:{hasKey:s.xingchanBank?.hasKey===true,keyPreview:apiPreview(s.xingchanBank?.keyPreview,s.xingchanBank?.hasKey===true)},
      aiConfigurations:Array.isArray(s.aiConfigurations)?s.aiConfigurations.map(ai=>({...ai})):[],
      ai: { baseUrl: text(ai.baseUrl), model: text(ai.model), type: AI_TYPES.includes(ai.type) ? ai.type : 'auto', hasKey: ai.hasKey === true,keyPreview:apiPreview(ai.keyPreview,ai.hasKey===true) },
      questionStrategy: STRATEGIES.includes(s.questionStrategy) ? s.questionStrategy : 'yanxi-first',
      searchMethods:normalizeSearchMethods(s.searchMethods,s.questionStrategy)
    };
  }

  function validateBaseUrl(value) {
    const input = text(value).trim();
    if (!input) return '';
    let url; try { url = new URL(input); } catch (_) { throw new Error('AI 地址必须是完整的 http 或 https URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('AI 地址只允许 http/https，且不能含账号、查询参数或片段');
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('远程 AI 接口必须使用 HTTPS；HTTP 仅允许本机接口');
    return url.href.replace(/\/$/, '');
  }

  function secretUpdate(value, clear) {
    if (typeof value !== 'string' || value.length > 16384) throw new Error('密钥格式或长度无效');
    if (clear && value) throw new Error('不能同时填写新密钥和清除密钥');
    if (clear) return { action: 'clear' };
    return value ? { action: 'set', value } : { action: 'keep' };
  }

  function buildSaveRequest(uid, snapshot, form) {
    requiredUid(uid);
    if (!snapshot || snapshot.uid !== uid) throw new Error('配置已切换，已阻止写入');
    if (!AI_TYPES.includes(form.aiType) || (form.questionStrategy!==undefined&&!STRATEGIES.includes(form.questionStrategy))) throw new Error('接口类型或题库策略无效');
    const searchMethods=normalizeSearchMethods(form.searchMethods??snapshot.searchMethods,form.questionStrategy);
    const model = text(form.aiModel).trim();
    if (model.length > 256) throw new Error('模型字段过长');
    return {
      uid, expectedRevision: snapshot.revision,
      settings: { ...(form.soutijiangEnabled!==undefined?{soutijiangEnabled:form.soutijiangEnabled}:{}),...(form.ocsEnhancementsEnabled!==undefined?{ocsEnhancementsEnabled:form.ocsEnhancementsEnabled}:{}),...(form.starEnhancementsEnabled!==undefined?{starEnhancementsEnabled:form.starEnhancementsEnabled}:{}),...(form.enrollmentYear!==undefined?{enrollmentYear:form.enrollmentYear}:{}),...(form.aiConfigurations!==undefined?{aiConfigurations:form.aiConfigurations}:{}),...(form.keepPlayingOnLeave!==undefined?{keepPlayingOnLeave:form.keepPlayingOnLeave===true}:{}),ai: { baseUrl: validateBaseUrl(form.aiBaseUrl), model, type: form.aiType }, questionStrategy: searchMethods[0].id==='xingchan-ai'?'ai-first':'yanxi-first', searchMethods,...(form.answerSettings?{answerSettings:form.answerSettings}:{}),...(form.questionBankConfig!==undefined?{questionBankConfig:form.questionBankConfig}:{}),...(form.clientEnvironment!==undefined?{clientEnvironment:{...form.clientEnvironment}}:{}) },
      secretUpdates: {
        yanxiToken: secretUpdate(form.yanxiToken || '', form.clearYanxiToken === true),
        aiKey: secretUpdate(form.aiKey || '', form.clearAiKey === true),
        xingchanBankKey:secretUpdate(form.xingchanBankKey||'',form.clearXingchanBankKey===true)
      }
    };
  }

  function normalizeConnectionChecks(uid,raw,secrets=[]) {
    requiredUid(uid);if(!raw||raw.uid!==uid)throw new Error('连接检查 UID 不匹配');
    const clean=value=>{let out=text(value);for(const secret of secrets)if(typeof secret==='string'&&secret)out=out.split(secret).join('[已隐藏]');return out.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=~-]+/gi,'$1 [已隐藏]').replace(/((?:api[_ -]?key|authorization|bearer|token|secret|password)\s*[:=]\s*)[^\s,;，；]+/gi,'$1[已隐藏]').slice(0,1200);};
    const seen=new Set(),items=[];
    for(const item of Array.isArray(raw.items)?raw.items:[]){if(!item||!(Object.hasOwn(METHOD_LABELS,item.id)||/^(?:ocs-[a-f0-9]{8}|ai-[a-f0-9]{16})$/.test(item.id))||seen.has(item.id))continue;seen.add(item.id);items.push({id:item.id,name:clean(item.name).slice(0,120),state:Object.hasOwn(CHECK_STATES,item.state)?item.state:'unchecked',message:clean(item.message),latencyMs:typeof item.latencyMs==='number'&&Number.isFinite(item.latencyMs)&&item.latencyMs>=0?item.latencyMs:null,checkedAt:typeof item.checkedAt==='string'||typeof item.checkedAt==='number'?item.checkedAt:null});}
    return {uid,items};
  }

  function normalizeStatus(uid, item) {
    requiredUid(uid); const s = item && typeof item === 'object' ? item : {};
    if (s.uid && s.uid !== uid) throw new Error('状态 UID 不匹配');
    const mode=Object.hasOwn(MODES,s.mode)?s.mode:'unconnected';
    return { uid, mode,starEnhancementsEnabled:s.starEnhancementsEnabled!==false, state: Object.hasOwn(STATES, s.state) ? s.state : 'unknown', summary: text(s.summary).slice(0,2000), settingsApplied: mode==='live'&&s.settingsApplied === true, updatedAt: s.updatedAt || null,
      displayName:verifiedName(s.displayName,s.nameSource),nameSource:NAME_SOURCES.includes(s.nameSource)?s.nameSource:'',loggedIn:mode==='live'&&s.loggedIn===true,needsRestart:mode==='live'&&s.needsRestart===true,
      ...(Number.isSafeInteger(s.appliedRevision)&&s.appliedRevision>=0?{appliedRevision:s.appliedRevision}:{}),
      ...(Number.isInteger(s.pid)&&s.pid>0?{pid:s.pid}:{}),...(Number.isInteger(s.port)&&s.port>0&&s.port<65536?{port:s.port}:{}) };
  }

  function statusLabel(item) {
    const s = normalizeStatus(item.uid, item);
    return MODES[s.mode]+' · '+STATES[s.state]+(s.mode==='live'?' · '+(s.loggedIn?'已登录':'未登录')+' · '+(s.needsRestart?'配置待重启应用':s.settingsApplied?'配置已应用':'配置待应用'):'');
  }

  function getBridge(candidate) {
    const value = candidate || (typeof window === 'object' && window.xingchanBridge);
    return value && value.apiVersion === 1 && METHODS.every(method => typeof value[method] === 'function') ? value : null;
  }

  // The compiled 2.9.24 entry exports the actual Browser class as B. Importing the
  // same module URL returns that class, so UID binding does not depend on icons
  // or transient Vue DOM properties. The loader must explicitly enable this.
  const BROWSER_HOOK = Symbol.for('OCS.XingchanFusion.BrowserLaunchHook.v1');
  const FUSION_FILE_ROOT = typeof window==='object'&&window.__xingchanFusionPublicRoot ? decodeURIComponent(new URL(window.__xingchanFusionPublicRoot).pathname).replace(/\\/g,'/').toLowerCase() : ''; 
  function browserModuleUrl(pageHref, sources) {
    const page = new URL(pageHref);
    function isFusionFile(url) {
      if (url.protocol !== 'file:' || url.hostname) return false;
      let path; try { path = decodeURIComponent(url.pathname).replace(/\\/g, '/').toLowerCase(); } catch (_) { return false; }
      return !!FUSION_FILE_ROOT && path.startsWith(FUSION_FILE_ROOT) && !path.split('/').some(part => part === '.' || part === '..');
    }
    const localHttp = ['http:', 'https:'].includes(page.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname);
    if (!isFusionFile(page) && !localHttp) throw new Error('OCS_FUSION_PAGE_REQUIRED');
    for (const source of Array.isArray(sources) ? sources : []) {
      if (typeof source !== 'string') continue;
      let url; try { url = new URL(source, page); } catch (_) { continue; }
      if (url.username || url.password || url.search || url.hash || !/\/assets\/index\.c87a5b08\.js$/.test(url.pathname)) continue;
      if (page.protocol === 'file:' ? isFusionFile(url) : url.origin === page.origin) return url.href;
    }
    throw new Error('OCS_BROWSER_MODULE_UNAVAILABLE');
  }

  function hookBrowserClass(Browser, bridgeCandidate, options = {}) {
    const bridge = getBridge(bridgeCandidate), proto = Browser && Browser.prototype;
    if (!bridge || !proto) throw new Error('OCS_BROWSER_HOOK_UNAVAILABLE');
    if (Object.hasOwn(proto, BROWSER_HOOK)) return proto[BROWSER_HOOK];
    const originals = new Map(), wrappers = new Map(), operations = new Map(), managed = new Set(), statuses = new Map();
    let active = true;
    const setStatus = (uid, status) => {
      if (statuses.get(uid) === status) return;
      if (status) statuses.set(uid, status); else statuses.delete(uid);
      options.setStatus?.(uid, status || null);
    };
    const statusOf = item => item?.mode !== 'live' ? null :
      ['starting', 'logging-in'].includes(item.state) ? 'launching' :
      ['ready', 'running', 'paused'].includes(item.state) ? 'launched' : null;
    function applyStatus(item) {
      if (!item || !validUid(item.uid)) return;
      const status = statusOf(item);
      if (status) managed.add(item.uid); else managed.delete(item.uid);
      setStatus(item.uid, status);
    }
    for (const method of ['launch', 'relaunch', 'close', 'bringToFront']) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, method);
      if (!descriptor && ['close', 'bringToFront'].includes(method)) continue;
      if (!descriptor || typeof descriptor.value !== 'function' || !descriptor.configurable || !descriptor.writable) throw new Error('OCS_BROWSER_METHOD_UNAVAILABLE');
      originals.set(method, descriptor);
    }
    function operate(uid, method) {
      const previous = operations.get(uid);
      if (previous) {
        if (method !== 'close' || previous.method === 'close') return previous.promise;
        return previous.promise.catch(() => {}).then(() => {
          if (!active) throw new Error('OCS_BROWSER_HOOK_DISPOSED');
          return operate(uid, 'close');
        });
      }
      managed.add(uid);
      setStatus(uid, method === 'close' ? 'closing' : 'launching');
      invalidateStatuses(bridge);
      const operation = {method};
      const pending = Promise.resolve().then(async () => {
        if (!active) throw new Error('OCS_BROWSER_HOOK_DISPOSED');
        if (method === 'relaunch' || method === 'close') await bridge.stop({uid});
        if (!active) throw new Error('OCS_BROWSER_HOOK_DISPOSED');
        const result = method === 'close' ? null : await bridge.start({uid});
        if (active) {
          if (result?.uid && result.uid !== uid) throw new Error('OCS_BROWSER_STATUS_UID_MISMATCH');
          if (method === 'close') { managed.delete(uid); setStatus(uid, null); }
          else if (result?.state) applyStatus(result);
          else setStatus(uid, 'launched');
        }
        return result;
      }).catch(error => {
        if (active) { managed.delete(uid); setStatus(uid, null); }
        throw error;
      }).finally(() => {
        if (operations.get(uid) === operation) operations.delete(uid);
        invalidateStatuses(bridge);
        if (active) options.onChange?.();
      });
      operation.promise = pending; operations.set(uid, operation);
      return pending;
    }
    for (const [method, descriptor] of originals) {
      const wrapper = async function (...args) {
        if (!active) throw new Error('OCS_BROWSER_HOOK_DISPOSED');
        const uid = this && this.uid;
        if (!validUid(uid)) return descriptor.value.apply(this, args);
        if (method === 'close' || method === 'bringToFront') {
          if (!managed.has(uid) && !operations.has(uid)) return descriptor.value.apply(this, args);
          return method === 'close' ? operate(uid, method) : bridge.openHtml({uid});
        }
        let settings;
        try { settings = await bridge.getSettings({uid}); }
        catch (_) {
          if (!active) throw new Error('OCS_BROWSER_HOOK_DISPOSED');
          if (managed.has(uid)) throw new Error('OCS_BROWSER_SETTINGS_UNAVAILABLE');
          return descriptor.value.apply(this, args);
        }
        if (!active) throw new Error('OCS_BROWSER_HOOK_DISPOSED');
        if (settings && settings.uid !== uid) throw new Error('OCS_BROWSER_SETTINGS_UID_MISMATCH');
        if (!managed.has(uid) && (!settings || !text(settings.username).trim() || settings.hasPassword !== true)) return descriptor.value.apply(this, args);
        return operate(uid, method);
      };
      wrappers.set(method, wrapper); Object.defineProperty(proto, method, {...descriptor, value: wrapper});
    }
    const handle = Object.freeze({
      methods: Object.freeze([...originals.keys()]),
      get active() { return active; },
      syncStatus(items) {
        if (!active) return;
        for (const item of Array.isArray(items) ? items : []) if (!operations.has(item?.uid)) applyStatus(item);
      },
      dispose() {
        if (!active) return; active = false;
        for (const uid of [...statuses.keys()]) setStatus(uid, null);
        managed.clear();
        for (const [method, descriptor] of originals) if (Object.getOwnPropertyDescriptor(proto, method)?.value === wrappers.get(method)) Object.defineProperty(proto, method, descriptor);
        if (Object.getOwnPropertyDescriptor(proto, BROWSER_HOOK)?.value === handle) delete proto[BROWSER_HOOK];
      }
    });
    Object.defineProperty(proto, BROWSER_HOOK, {value: handle, configurable: true});
    return handle;
  }

  function element(tag, className, value) {
    const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = String(value); return el;
  }
  function button(label, handler, disabled) {
    const el = element('button', 'xc-poc-button', label); el.type = 'button'; el.disabled = !!disabled;
    el.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); Promise.resolve().then(handler).catch(() => {}); }); return el;
  }
  function messageFor(error) {
    const detail=String(error?.message||'');if(detail.includes('配置已在其他窗口更新'))return '配置已更新，请重新载入后保存；当前填写内容仍保留。';
    if (error && error.code === 'REVISION_CONFLICT') return '配置已在其他位置修改，请重新载入后再保存。';
    if (error && error.code === 'BRIDGE_UNAVAILABLE') return '主进程桥接未连接；配置和启动均不可用。';
    // Do not echo arbitrary IPC errors, which might contain a secret or command line.
    return '操作未完成，请查看该账号的脱敏诊断日志。';
  }

  function mountAccount(container,uid,options){
    requiredUid(uid);return window.FusionAccountForm.mount({container,uid,options,bridge:getBridge(options?.bridge),model:{normalizeSettings,buildSaveRequest,reorderSearchMethods,validateBaseUrl}});
  }

  function showLogs(uid, bridge) {
    requiredUid(uid); if (!bridge) return;
    const overlay = element('section','xc-poc-root xc-poc-log-overlay'); overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
    const panel = element('div','xc-poc-log-panel'); panel.append(element('h3','','星蝉日志 · '+uid)); const label=element('p','xc-poc-note','正在读取脱敏日志…'), pre=element('pre','xc-poc-log','');
    let alive=true,busy=false,timer,cursor,lines=[]; const close=button('关闭',()=>{alive=false;clearInterval(timer);overlay.remove();}); panel.append(label,pre,close); overlay.append(panel); document.body.append(overlay); close.focus();
    async function refresh(){if(!alive||!overlay.isConnected){clearInterval(timer);return;}if(busy||!visible())return;busy=true;try{const data=await bridge.getLogs({uid,limit:200,...(cursor===undefined?{}:{after:cursor})});if(!alive)return;if(!data||data.uid!==uid)throw new Error('UID mismatch');const title=(MODES[data.mode]||'未连接')+' · 仅该账号日志 · 每 2 秒刷新';if(label.textContent!==title)label.textContent=title;const incoming=(Array.isArray(data.lines)?data.lines:[]).map(line=>typeof line==='string'?line.slice(0,4000):[line.time||'',line.level||'',text(line.message).slice(0,4000)].join(' '));const reset=data.reset!==false||cursor===undefined;cursor=Number.isSafeInteger(data.cursor)?data.cursor:undefined;if(!reset&&!incoming.length)return;const atBottom=pre.scrollHeight-pre.scrollTop-pre.clientHeight<40,previous=lines.length;lines=(reset?incoming:lines.concat(incoming)).slice(-200);if(reset||previous+incoming.length>200||!previous){const value=lines.join('\n')||'暂无日志';if(pre.textContent!==value)pre.textContent=value;}else if(incoming.length)pre.append(document.createTextNode('\n'+incoming.join('\n')));if(atBottom)pre.scrollTop=pre.scrollHeight;}catch(_){if(alive)label.textContent='读取日志失败；未显示未经确认的数据。';}finally{busy=false;}}
    refresh();timer=setInterval(refresh,2000);
  }

  function mountMonitor(container, options) {
    if (!container || !container.append) throw new Error('缺少 OCS 监控挂载点');
    const bridge=getBridge(options&&options.bridge), getBrowsers=options&&options.getBrowsers||(()=>listBrowsers(window.store));
    const node=element('section','xc-poc-root xc-poc-monitor'); node.append(element('h3','','每账号星蝉状态'));
    node.append(element('p','xc-poc-note','每个浏览器 UID 对应独立星蝉实例和本地网关。“启动并登录”会应用本账号配置；姓名来自星蝉真实登录结果。'));
    const notice=element('p','xc-poc-state',bridge?'正在读取状态…':'未连接主进程桥接'),table=element('table','xc-poc-table'),head=element('thead'),hr=element('tr'),body=element('tbody');
    for(const label of ['OCS 浏览器','运行状态','操作'])hr.append(element('th','',label));head.append(hr);table.append(head,body);node.append(notice,table);container.prepend(node);
    let alive=true,busy=false,statuses=new Map();const views=new Map();
    async function action(uid,method) { if(!alive||!bridge)return; notice.textContent=method==='start'?'正在启动并登录此账号…':'正在处理此账号操作…';try{const result=await bridge[method]({uid});invalidateStatuses(bridge);if(!alive)return;if(method==='openHtml'){notice.textContent=result&&result.opened===true&&result.mode==='live'?'已请求打开该账号的星蝉 HTML。':'未打开 HTML；该账号实例尚未就绪。';}else{notice.textContent='已处理本账号操作，请查看服务、登录和配置应用状态。';await refresh();}}catch(error){if(alive)notice.textContent=messageFor(error);} }
    function render() {
      if(!alive)return;const browsers=getBrowsers(),ids=new Set(browsers.map(b=>b.uid));
      for(const[uid,view]of views)if(!ids.has(uid)){view.row.remove();views.delete(uid);}
      if(!browsers.length){if(!body.querySelector('[data-xc-empty]')){body.replaceChildren();const row=element('tr'),cell=element('td','','没有 OCS 浏览器账号；请先创建浏览器。');row.dataset.xcEmpty='true';cell.colSpan=3;row.append(cell);body.append(row);}return;}
      body.querySelector('[data-xc-empty]')?.remove();let cursor=body.firstElementChild;
      for(const browser of browsers){const state=statuses.get(browser.uid)||normalizeStatus(browser.uid,{mode:'unconnected',state:'unknown'});let view=views.get(browser.uid);
        if(!view){const uid=browser.uid,row=element('tr'),name=element('td'),status=element('td'),ops=element('td'),title=element('strong'),login=element('small','xc-poc-summary'),mode=element('span'),summary=element('small','xc-poc-summary'),process=element('small','xc-poc-summary');name.append(title,element('small','xc-poc-uid',uid),login);status.append(mode,summary,process);const start=button('',()=>action(uid,'start')),stop=button('停止',()=>action(uid,'stop')),html=button('启动控制面板',()=>action(uid,'openHtml'));ops.append(button('设置',()=>{if(window.store?.render?.browser)window.store.render.browser.currentBrowserUid=uid;}),start,stop,button('日志',()=>showLogs(uid,bridge),!bridge),html);row.append(name,status,ops);view={row,title,login,mode,summary,process,start,stop,html,signature:''};views.set(uid,view);}
        const signature=JSON.stringify([browser.name,state.mode,state.state,state.loggedIn,state.settingsApplied,state.needsRestart,state.displayName,state.summary,state.pid,state.port]);
        if(signature!==view.signature){view.signature=signature;const set=(node,value)=>{if(node.textContent!==value)node.textContent=value;};set(view.title,browser.name);set(view.login,state.displayName?(state.loggedIn?'登录姓名：':'上次验证姓名：')+state.displayName+(state.nameSource==='verification'?'（登录验证）':'（星蝉）'):'');view.login.hidden=!state.displayName;view.mode.className='xc-poc-mode xc-poc-mode-'+state.mode;set(view.mode,statusLabel(state));set(view.summary,state.summary);set(view.process,[state.pid?'PID '+state.pid:'',state.port?'本地端口 '+state.port:''].filter(Boolean).join(' · '));const ready=['ready','running','paused'].includes(state.state)&&state.mode==='live';set(view.start,state.needsRestart?'重启并重新登录':ready&&state.loggedIn?'已登录':'启动并登录');view.start.disabled=!bridge||['starting','logging-in'].includes(state.state)||ready&&state.loggedIn&&!state.needsRestart;view.stop.disabled=!bridge||!['ready','running','paused','starting','logging-in'].includes(state.state);view.html.disabled=!bridge||!ready;}
        if(view.row!==cursor)body.insertBefore(view.row,cursor);cursor=view.row.nextElementSibling;
      }
    }
    async function refresh(){if(!alive||busy||!visible())return;render();if(!bridge)return;const uids=getBrowsers().map(x=>x.uid);if(!uids.length){notice.textContent='等待创建 OCS 浏览器账号。';return;}busy=true;
      try{const result=await readStatuses(bridge,uids);if(!alive)return;const wanted=new Set(uids),returned=new Map();for(const item of result&&Array.isArray(result.items)?result.items:[]){if(item&&wanted.has(item.uid)&&!returned.has(item.uid))returned.set(item.uid,normalizeStatus(item.uid,item));}for(const uid of uids)if(!returned.has(uid))returned.set(uid,normalizeStatus(uid,{mode:'unconnected',state:'unknown',summary:'后端未返回此账号状态'}));statuses=returned;const message='状态已刷新。服务启动、学习通登录及配置应用分别显示。';if(notice.textContent!==message)notice.textContent=message;}
      catch(_){if(alive){statuses=new Map(uids.map(uid=>[uid,normalizeStatus(uid,{mode:'unconnected',state:'unknown',summary:'无法获取主进程状态'})]));notice.textContent='状态读取失败，已标为未连接。';}}
      finally{busy=false;if(alive)render();}
    }
    render();refresh();const timer=setInterval(refresh,2000);
    return {node,refresh,dispose(){alive=false;clearInterval(timer);body.replaceChildren();node.remove();statuses.clear();}};
  }

  function install(options) {
    if(typeof window!=='object'||!window.document)throw new Error('安装需在真实 OCS renderer 中进行');
    if(window.__xingchanOCsDispose)return window.__xingchanOCsDispose;
    const bridge=getBridge(options&&options.bridge);let account=null,monitor=null,monitorContainer=null,disposed=false,launchHook=null,stateBusy=false;
    let hookStatus=Object.freeze({state:'disabled',methods:[],reason:'需由融合版加载器显式启用'});
    const updateHookStatus=(state,reason,methods=[])=>{hookStatus=Object.freeze({state,reason,methods:[...methods]});window.__xingchanOCsLaunchHookStatus=hookStatus;};
    async function attachLaunchHook(){
      if(!(options&&options.enableBrowserLaunchHook===true)){updateHookStatus('disabled','需由融合版加载器显式启用');return;}
      if(!bridge){updateHookStatus('unavailable','主进程桥接未连接');return;}
      updateHookStatus('pending','正在绑定 OCS Browser 方法');
      try{
        const sources=Array.from(document.querySelectorAll('script[type="module"][src]'),script=>script.src||script.getAttribute('src'));
        const source=browserModuleUrl(window.location.href,sources),loaded=await import(source);
        if(disposed)return;
        if(!window.FusionWorkspace)throw Error('FUSION_WORKSPACE_UNAVAILABLE');launchHook=await window.FusionWorkspace.initialize(loaded,bridge);updateHookStatus('active','浏览器和星蝉入口分别管理，同一账号互斥启动',launchHook.methods);await refreshBrowserStates();
      }catch(_){if(!disposed)updateHookStatus('unavailable','无法确认固定版本 OCS Browser 模块；保留原 OCS 按钮行为');}
    }
    async function refreshBrowserStates(){
      if(disposed||!launchHook||stateBusy||!visible())return;
      const uids=listBrowsers(window.store).map(item=>item.uid);if(!uids.length)return;
      stateBusy=true;
      try{const result=await readStatuses(bridge,uids);if(!disposed)launchHook.syncStatus(result.items);}
      catch(_){}finally{stateBusy=false;}
    }
    function reconcile(){
      const selected=selectedBrowser(window.store),mini=!!(window.store&&window.store.render&&window.store.render.state&&window.store.render.state.mini);
      const host=selected?document.querySelector(mini?'.arco-modal .profile':'#browser-panel .profile'):null;
      if(account&&(!selected||selected.uid!==account.uid||!host||account.node.parentElement!==host)){account.dispose();account=null;}
      if(selected&&host&&!account){const accountUid=selected.uid;account=mountAccount(host,accountUid,{bridge,isCurrent:()=>selectedBrowser(window.store)?.uid===accountUid&&host.isConnected});}
      account?.placeConnection();


    }
    let scheduled=null;function schedule(){if(disposed||scheduled!==null||!visible())return;scheduled=setTimeout(()=>{scheduled=null;reconcile();refreshBrowserStates();},16);}
    const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.xc-poc-root')))schedule();});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',schedule);window.addEventListener('fusionvisibility',schedule);window.addEventListener('fusion-login-profiles-changed',schedule);document.addEventListener('visibilitychange',schedule);
    reconcile();const timer=setInterval(()=>{if(visible()){reconcile();refreshBrowserStates();}},2000);
    const dispose=()=>{disposed=true;clearInterval(timer);clearTimeout(scheduled);observer.disconnect();window.removeEventListener('hashchange',schedule);window.removeEventListener('fusionvisibility',schedule);window.removeEventListener('fusion-login-profiles-changed',schedule);document.removeEventListener('visibilitychange',schedule);account&&account.dispose();monitor&&monitor.dispose();launchHook&&launchHook.dispose();updateHookStatus('disposed','已撤销本模块 Browser 方法包装');document.querySelectorAll('.xc-poc-log-overlay').forEach(n=>n.remove());delete window.__xingchanOCsDispose;};
    dispose.hookReady=attachLaunchHook();dispose.getHookStatus=()=>hookStatus;
    window.__xingchanOCsDispose=dispose;return dispose;
  }

  return { apiVersion:1, install,mountAccount,mountMonitor,hookBrowserClass,model:{validUid,listBrowsers,selectedBrowser,normalizeSettings,validateBaseUrl,buildSaveRequest,normalizeStatus,statusLabel,secretUpdate,normalizeSearchMethods,reorderSearchMethods,apiPreview,verifiedName,browserModuleUrl,normalizeConnectionChecks} };
});
