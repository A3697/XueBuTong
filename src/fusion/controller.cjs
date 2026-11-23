'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork } = require('node:child_process');
const { createGateway } = require('./gateway/index.cjs');
const { normalizeSearchMethods } = require('./search-methods.cjs');

const AIConfig=require('./ai-config.js');
const MODES = new Set(['openai', 'auto', 'anthropic', 'gemini', 'ollama']);
const SECRET_KEYS = ['password','aiKey','aiConfigurations','yanxiToken','questionBankConfig','xingchanBankKey'];
const YanxiConfig=require('./yanxi-config.js');
const Banks=require('./question-bank-config.js');
const AnswerSettings=require('./answer-settings.js');
const LoginProfiles=require('./login-profiles.js');
const ClientEnvironment=require('./client-environment.js');
const Enrollment=require('./enrollment-year.js');
function uidOf(uid) {
  if (typeof uid !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(uid) || ['__proto__','constructor','prototype'].includes(uid)) throw new Error('账号标识不合法');
  return uid;
}
function cleanText(value, length = 500) { return String(value ?? '').slice(0, length); }
function keyPreview(value){return value?Banks.preview(value):'';}
function redact(value) {
  return String(value).replace(/([?&](?:key|token|t)=)[^&\s]+/gi, '$1[隐藏]')
    .replace(/(Bearer\s+)[\w.\-]+/gi, '$1[隐藏]');
}
class IntegrationController {
  constructor({ labRoot, vault, nodePath = process.execPath }) {
    this.labRoot = path.resolve(labRoot); this.vault = vault; this.nodePath = nodePath;
    this.dataDir = path.join(this.labRoot, 'bridge-data');
    this.settingsFile = path.join(this.dataDir, 'settings.json');
    this.runtimes = new Map(); this.logBuffers = new Map(); this.pendingStarts = new Map(); this.stoppedAt=new Map();
    this.secretCache=new Map();this.redactorCache=new Map();this.logSequences=new Map();
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.data = fs.existsSync(this.settingsFile) ? JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')) : { schema: 1, profiles: {} };
    this.onOpenHtml = null; this.onCloseHtml = null;
  }
  base(uid) {
    uidOf(uid);
    if (!Object.hasOwn(this.data.profiles, uid)) this.data.profiles[uid] = {
      revision: 0, ocsEnhancementsEnabled:true, username: '', schoolId: '', ai: { baseUrl: '', model: '', type: 'openai' },
      questionStrategy: 'yanxi-first', searchMethods:normalizeSearchMethods(), secrets: {}
    };
    return this.data.profiles[uid];
  }
  persist() {
    const temp = this.settingsFile + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, this.settingsFile);
  }
  bankConfig(uid){
    const raw=this.plainSecret(uid,'questionBankConfig'),token=this.plainSecret(uid,'yanxiToken');
    this.bankCache??=new Map();const stamp=raw||token,cached=this.bankCache.get(uid);
    if(cached?.stamp===stamp)return cached.value;
    const value=Banks.parse(raw||(token?YanxiConfig.template(token):[]));this.bankCache.set(uid,{stamp,value});return value;
  }
  aiConfigurations(uid){return AIConfig.read(this,uid);}
  answerSettings(uid){return AnswerSettings.normalize(this.base(uid).answerSettings??this.legacyAnswerSettings?.()??{});}
  clientEnvironmentDeviceId(uid){
    uidOf(uid);const file=path.join(this.labRoot,'instances',uid,'data/storage/state.json');
    try{const stat=fs.statSync(file);this.clientDeviceCache??=new Map();let saved=this.clientDeviceCache.get(uid);
      if(!saved||saved.time!==stat.mtimeMs||saved.size!==stat.size){const value=JSON.parse(fs.readFileSync(file,'utf8'))['ua.device_id'];saved={time:stat.mtimeMs,size:stat.size,value:typeof value==='string'&&/^[a-f0-9]{32}$/i.test(value)?value.toLowerCase():''};this.clientDeviceCache.set(uid,saved);}return saved.value;
    }catch{return '';}
  }
  validateClientEnvironments(profiles){
    const owners=new Map();
    for(const [uid,profile]of Object.entries(profiles)){
      uidOf(uid);const value=ClientEnvironment.normalize(profile.clientEnvironment).deviceId||this.clientEnvironmentDeviceId(uid);
      if(!value)continue;if(owners.has(value)&&owners.get(value)!==uid)throw Error('多个账号使用了同一个星蝉设备号，请在账号设置中为其中一个账号随机生成新的设备号后再保存或导入。');owners.set(value,uid);
    }
    return true;
  }
  ocsEnhancementsEnabled(uid){const value=this.base(uid).ocsEnhancementsEnabled;return typeof value==='boolean'?value:this.defaultOcsEnhancementsEnabled?.()!==false;}
  getSettings({ uid }) {
    const p = this.base(uid), token=this.plainSecret(uid,'yanxiToken'), config=this.bankConfig(uid);
    return { uid,browserScript:require('./browser-script-selection.cjs').normalize(p.browserScript),browserScriptAvailability:this.browserScriptAvailability?.(uid)??null,soutijiangAccounts:require('./soutijiang-accounts.cjs').normalize(p.soutijiangAccounts),soutijiangEnabled:p.soutijiangEnabled===true,soutijiangConfigured:this.soutijiang?.configured?.(uid)===true,ocsEnhancementsEnabled:this.ocsEnhancementsEnabled(uid),starEnhancementsEnabled:p.starEnhancementsEnabled!==false,enrollmentYear:Enrollment.normalize(p.enrollmentYear),keepPlayingOnLeave:p.keepPlayingOnLeave===true,clientEnvironment:ClientEnvironment.normalize(p.clientEnvironment),clientEnvironmentDeviceId:this.clientEnvironmentDeviceId(uid),answerSettings:this.answerSettings(uid),questionBanks:Banks.summaries(config),questionBankConfig:Banks.display(config), revision: p.revision, username: p.username,password:this.plainSecret(uid,'password'),schoolId: p.schoolId,
      displayName:p.displayName||'',nameSource:p.nameSource||'',verifiedDetails:p.verifiedDetails||null,nativeLoginIdentity:p.nativeLoginIdentity||'',nativeLoginConfigured:typeof p.loginKind==='string',loginKind:p.loginKind||'none',loginPlatform:p.loginPlatform||'none',loginUnit:p.loginUnit||'',starEligible:['cx-phone','cx-unit'].includes(p.loginKind),
      aiConfigurations:AIConfig.summaries(this.aiConfigurations(uid),keyPreview),
      ai: { ...p.ai, hasKey: Boolean(p.secrets.aiKey),keyPreview:keyPreview(this.plainSecret(uid,'aiKey')) }, yanxi: { hasToken: Boolean(p.secrets.yanxiToken),tokenPreview:keyPreview(token) },
      questionStrategy: p.questionStrategy, searchMethods:normalizeSearchMethods(p.searchMethods,p.questionStrategy),
      xingchanBank:{hasKey:Boolean(p.secrets.xingchanBankKey),keyPreview:keyPreview(this.plainSecret(uid,'xingchanBankKey'))}, hasPassword: Boolean(p.secrets.password) };
  }
  saveSettings({ uid, expectedRevision, settings = {}, secretUpdates = {} }) {
    const original = this.base(uid);
    if (expectedRevision !== original.revision) throw new Error('配置已在其他窗口更新，请重新读取后保存');
    const p = JSON.parse(JSON.stringify(original));
    if (!settings.ai || !MODES.has(settings.ai.type)) throw new Error('AI 接口类型不合法');
    const searchMethods=normalizeSearchMethods(settings.searchMethods,settings.questionStrategy);
    const address = cleanText(settings.ai.baseUrl, 2000).trim();
    if (address) {
      let url; try { url = new URL(address); } catch { throw new Error('AI 地址格式不合法'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('AI 地址不允许包含凭据、查询参数或片段');
      if (url.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('远程 AI 地址必须使用 HTTPS');
    }
    // Native OCS login owns credentials. Legacy profiles remain migratable once.
    if(typeof original.loginKind!=='string'){
      if(settings.username!==undefined)p.username = cleanText(settings.username).trim();
      if(settings.schoolId!==undefined)p.schoolId = cleanText(settings.schoolId).trim();
    }
    p.ai = { baseUrl: address, model: cleanText(settings.ai.model).trim(), type: settings.ai.type };
    if(settings.browserScript!==undefined)p.browserScript=require('./browser-script-selection.cjs').normalize(settings.browserScript);
    if(settings.enrollmentYear!==undefined)p.enrollmentYear=Enrollment.normalize(settings.enrollmentYear);
    if(settings.ocsEnhancementsEnabled!==undefined){if(typeof settings.ocsEnhancementsEnabled!=='boolean')throw Error('OCS 增强开关无效');p.ocsEnhancementsEnabled=settings.ocsEnhancementsEnabled;}
    if(settings.starEnhancementsEnabled!==undefined){if(typeof settings.starEnhancementsEnabled!=='boolean')throw Error('星蝉增强开关无效');p.starEnhancementsEnabled=settings.starEnhancementsEnabled;}
    if(settings.keepPlayingOnLeave!==undefined){if(typeof settings.keepPlayingOnLeave!=='boolean')throw Error('浏览器播放开关无效');p.keepPlayingOnLeave=settings.keepPlayingOnLeave;}
    if(settings.clientEnvironment!==undefined){p.clientEnvironment=ClientEnvironment.normalize(settings.clientEnvironment);this.validateClientEnvironments({...this.data.profiles,[uid]:p});}
    if(settings.answerSettings!==undefined)p.answerSettings=AnswerSettings.normalize(settings.answerSettings);
    p.searchMethods=searchMethods;
    if(settings.soutijiangEnabled!==undefined){
      if(typeof settings.soutijiangEnabled!=='boolean')throw Error('搜题酱开关无效');p.soutijiangEnabled=settings.soutijiangEnabled;
      let method=p.searchMethods.find(m=>m.id==='soutijiang');if(p.soutijiangEnabled&&!method){method={id:'soutijiang',enabled:true};p.searchMethods.push(method);}if(method){if(!p.soutijiangEnabled)method.enabled=false;else if(original.soutijiangEnabled!==true)method.enabled=true;}
    }
    if(p.soutijiangEnabled!==true)p.searchMethods=p.searchMethods.map(m=>m.id==='soutijiang'?{...m,enabled:false}:m);
    p.questionStrategy=searchMethods[0].id==='xingchan-ai'?'ai-first':'yanxi-first';
    secretUpdates={...secretUpdates};
    if(settings.aiConfigurations===undefined && original.ai.baseUrl && address && new URL(original.ai.baseUrl).origin!==new URL(address).origin && (!secretUpdates.aiKey||secretUpdates.aiKey.action==='keep'))secretUpdates.aiKey={action:'clear'};
    const savedAI=this.aiConfigurations(uid);
    let nextAI=savedAI;
    if(settings.aiConfigurations!==undefined){
      nextAI=AIConfig.normalize(settings.aiConfigurations,{saved:savedAI,requireComplete:true});
      const legacy=nextAI.find(ai=>ai.id==='xingchan-ai');p.ai=legacy?{baseUrl:legacy.baseUrl,model:legacy.model,type:legacy.type}:AIConfig.empty();
      secretUpdates.aiKey=legacy?.key?{action:'set',value:legacy.key}:{action:'clear'};
      p.searchMethods=AIConfig.reconcile(p.searchMethods,nextAI);
    }else if(JSON.stringify(p.ai)!==JSON.stringify(original.ai)||secretUpdates.aiKey&&secretUpdates.aiKey.action!=='keep'){
      const key=secretUpdates.aiKey?.action==='clear'?'':secretUpdates.aiKey?.action==='set'?secretUpdates.aiKey.value:this.plainSecret(uid,'aiKey');
      nextAI=savedAI.filter(ai=>ai.id!=='xingchan-ai');
      if(p.ai.baseUrl||p.ai.model||key)nextAI.unshift({...p.ai,id:'xingchan-ai',name:savedAI.find(ai=>ai.id==='xingchan-ai')?.name||p.ai.model||'AI 搜题',key});
      nextAI=AIConfig.normalize(nextAI);
    }
    if(JSON.stringify(nextAI)!==JSON.stringify(savedAI)||settings.aiConfigurations!==undefined&&!this.plainSecret(uid,'aiConfigurations'))secretUpdates.aiConfigurations={action:'set',value:JSON.stringify(nextAI)};
    const aiIds=new Set(nextAI.map(ai=>ai.id));
    if(p.searchMethods.some(method=>/^ai-/.test(method.id)&&!aiIds.has(method.id)))throw Error('搜题顺序含有不存在的 AI 配置');
    if(typeof original.loginKind==='string')delete secretUpdates.password;
    if(settings.questionBankConfig!==undefined){
      const config=Banks.parse(settings.questionBankConfig,{saved:this.bankConfig(uid)}),valid=new Set(config.banks.map(b=>b.id));
      if(searchMethods.some(m=>!['xingchan-ai','xingchan-bank','soutijiang'].includes(m.id)&&!AIConfig.isId(m.id)&&!valid.has(m.id)))throw Error('搜题列表与解析后的题库不一致，请先解析题库配置。');
      secretUpdates.questionBankConfig={action:'set',value:config.json};
      const token=config.banks.find(b=>b.id==='yanxi')?.wrapper.data?.token;
      secretUpdates.yanxiToken=typeof token==='string'&&token?{action:'set',value:token}:{action:'clear'};
    }else if(secretUpdates.yanxiToken?.action==='set'){
      secretUpdates.questionBankConfig={action:'set',value:JSON.stringify(YanxiConfig.template(secretUpdates.yanxiToken.value))};
    }else if(secretUpdates.yanxiToken?.action==='clear')secretUpdates.questionBankConfig={action:'set',value:'[]'};
    for (const key of SECRET_KEYS) {
      const change = secretUpdates[key] || { action: 'keep' };
      if (change.action === 'clear') delete p.secrets[key];
      else if (change.action === 'set') {
        if (!this.vault.isEncryptionAvailable()) throw new Error('系统加密不可用，未保存密钥');
        if (typeof change.value !== 'string' || !change.value || change.value.length > (['questionBankConfig','aiConfigurations'].includes(key)?262144:8192)) throw new Error('密码或密钥为空或过长');
        p.secrets[key] = this.vault.encryptString(change.value).toString('base64');
      } else if (change.action !== 'keep') throw new Error('密钥更新方式不合法');
    }
    const passwordChange=secretUpdates.password;
    const nextPassword=passwordChange?.action==='set'?passwordChange.value:passwordChange?.action==='clear'?'':this.plainSecret(uid,'password');
    if(p.username!==original.username||p.schoolId!==original.schoolId||nextPassword!==this.plainSecret(uid,'password')){p.displayName='';p.nameSource='';}
    p.revision++; this.data.profiles[uid] = p;
    try{this.persist();}catch(error){this.data.profiles[uid]=original;throw error;}
    // A running gateway owns a snapshot of its bank adapters and credentials.
    // Apply the whole new profile together on restart, never activate a bank ID
    // whose adapter has not been created in this process yet.
    this.appendLog(uid, 'INFO', '账号配置已保存；运行中的星蝉任务重启后应用。');
    return this.getSettings({ uid });
  }
  syncNativeLogin({uid,login}){
    uidOf(uid);const original=this.base(uid),p=JSON.parse(JSON.stringify(original));
    const profile=['none','ambiguous'].includes(login?.kind)?{kind:login.kind,platform:'none',starEligible:false,username:'',password:'',unit:''}:LoginProfiles.normalize(login);
    const password=profile.starEligible?profile.password:'',username=profile.starEligible?profile.username:'';
    const schoolId=profile.kind==='cx-unit'?(/^\d+$/.test(profile.unit)?profile.unit:original.loginKind==='cx-unit'&&original.loginUnit===profile.unit?original.schoolId||'':''):'';
    const oldPassword=this.plainSecret(uid,'password');
    const identityChanged=original.username!==username||original.schoolId!==schoolId||original.loginKind!==profile.kind||original.loginUnit!==profile.unit||oldPassword!==password;
    const nativeLoginIdentity=require('./login-api.cjs').identity(profile);
    const verifiedIdentityChanged=typeof original.nativeLoginIdentity==='string'&&original.nativeLoginIdentity!==nativeLoginIdentity;
    const changed=identityChanged||verifiedIdentityChanged||original.nativeLoginIdentity!==nativeLoginIdentity||original.loginPlatform!==profile.platform||typeof original.loginKind!=='string';
    if(!changed)return this.getSettings({uid});
    p.username=username;p.schoolId=schoolId;p.loginKind=profile.kind;p.loginPlatform=profile.platform;p.loginUnit=profile.unit;p.nativeLoginIdentity=nativeLoginIdentity;
    if(password!==oldPassword){
      if(password){if(!this.vault.isEncryptionAvailable())throw Error('系统加密不可用，未同步登录配置');p.secrets.password=this.vault.encryptString(password).toString('base64');}
      else delete p.secrets.password;
    }
    if(identityChanged||verifiedIdentityChanged){p.displayName='';p.nameSource='';delete p.verifiedDetails;}
    p.revision=(p.revision||0)+1;this.data.profiles[uid]=p;
    try{this.persist();}catch(error){this.data.profiles[uid]=original;throw error;}
    this.secretCache.delete(uid);this.redactorCache.delete(uid);
    const runtime=this.runtimes.get(uid);if(runtime&&identityChanged)runtime.identityChanged=true;
    return this.getSettings({uid});
  }
  plainSecret(uid, key) {
    const raw = this.base(uid).secrets[key];
    let cache=this.secretCache.get(uid);
    if(!cache){cache=new Map();this.secretCache.set(uid,cache);}
    if(!raw){cache.delete(key);return '';}
    const entry=cache.get(key);if(entry?.raw===raw)return entry.value;
    const value=this.vault.decryptString(Buffer.from(raw,'base64')).toString('utf8');
    cache.set(key,{raw,value});return value;
  }
  additionalRedactionValues(){return [];}
  appendLog(uid, level, message) {
    let sanitized=redact(message);const values=[];
    for(const key of SECRET_KEYS){try{const value=this.plainSecret(uid,key);if(value&&!['questionBankConfig','aiConfigurations'].includes(key))values.push(value);}catch{}}
    try{const config=this.bankConfig(uid);this.bankRedactions??=new WeakMap();if(!this.bankRedactions.has(config))this.bankRedactions.set(config,Banks.secrets(config));values.push(...this.bankRedactions.get(config));}catch{}
    try{values.push(...this.aiConfigurations(uid).map(ai=>ai.key));}catch{}
    values.push(...this.additionalRedactionValues(uid));
    const stamp=JSON.stringify(values);let plan=this.redactorCache.get(uid);
    if(plan?.stamp!==stamp){const escaped=[...new Set(values.filter(Boolean))].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));plan={stamp,pattern:escaped.length?new RegExp(escaped.join('|'),'g'):null};this.redactorCache.set(uid,plan);}
    if(plan.pattern)sanitized=sanitized.replace(plan.pattern,'[隐藏]');
    const lines = this.logBuffers.get(uid) || [];
    const id=(this.logSequences.get(uid)||0)+1;this.logSequences.set(uid,id);
    lines.push({id,time:new Date().toISOString(),level,message:sanitized});
    if(lines.length>500)lines.splice(0,lines.length-500);
    this.logBuffers.set(uid,lines);
  }
  status(uid) {
    const r = this.runtimes.get(uid),p=this.base(uid);
    return { uid, mode: r ? 'mock' : 'unconnected', state: r?.state || 'stopped',
      summary: r ? '协议模拟：未启动真正星蝉，未连接真实题库或 AI。' : '未连接真正星蝉。',
      settingsApplied: false, updatedAt: r?.updatedAt || this.stoppedAt.get(uid) || null,
      displayName:p.displayName||'',nameSource:p.nameSource||'',loggedIn:Boolean(r?.loggedIn),
      ...(r ? { pid: r.child.pid, port: r.port } : {}) };
  }
  listStatus({ uids = [] }) { return { items: uids.map(uid => this.status(uidOf(uid))) }; }
  async start({ uid }) {
    uidOf(uid);
    if(this.pendingStarts.has(uid))return this.pendingStarts.get(uid);
    if (this.runtimes.has(uid)) return this.status(uid);
    const operation=this.startRuntime(uid).finally(()=>this.pendingStarts.delete(uid));
    this.pendingStarts.set(uid,operation);return operation;
  }
  async startRuntime(uid) {
    const home = path.join(this.labRoot, 'instances', uid); fs.mkdirSync(home, { recursive: true });
    const gateway=createGateway({mode:'mock',accounts:[{id:uid,searchMethods:this.getSettings({uid}).searchMethods,mock:{entries:[{type:'single',title:'2+2等于几？',options:['3','4'],answer:'B'}],aiAnswer:'A'}}],
      logger:event=>{
        if(event.event==='miss')this.appendLog(uid,'INFO','模拟方式 '+event.source+' 明确无题，按顺序检查下一项。');
        if(event.event==='answer')this.appendLog(uid,'INFO',event.source==='bank'?'本地模拟题库命中；未调用 AI。':event.source==='ai_mock'?'本地模拟 AI 返回答案。':'本地模拟万能题库返回答案。');
      }});
    await gateway.listen();
    const gatewayProfile=gateway.clientProfiles()[0];
    const child = fork(path.join(__dirname, 'mock-xingchan.cjs'), [], {
      execPath: this.nodePath, cwd: home, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    const r = { child, home, gateway, gatewayProfile, state: 'starting', port: 0, token: '', updatedAt: new Date().toISOString() };
    this.runtimes.set(uid, r);
    child.stdout.on('data', () => this.appendLog(uid, 'INFO', '模拟子进程输出已接收。'));
    child.stderr.on('data', () => this.appendLog(uid, 'ERROR', '模拟子进程出现错误。'));
    child.on('exit', () => { if (this.runtimes.get(uid) === r) this.runtimes.delete(uid);this.stoppedAt.set(uid,new Date().toISOString());gateway.close().catch(()=>{}); this.appendLog(uid, 'INFO', '模拟子进程已退出。'); });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('模拟服务启动超时')), 12000);
        child.once('error', err => { clearTimeout(timer); reject(err); });
        child.on('message', msg => {
          if (msg.type === 'ready') { r.port = msg.port; r.token = msg.token; r.state = 'running'; r.updatedAt = new Date().toISOString(); clearTimeout(timer); resolve(); }
          if (msg.type === 'log') this.appendLog(uid, msg.level || 'INFO', msg.message || '模拟事件');
          if (msg.type === 'session') {
            const p=this.base(uid);r.loggedIn=msg.loggedIn===true;
            if(typeof msg.displayName==='string'&&msg.displayName.trim()){p.displayName=cleanText(msg.displayName,120).trim();p.nameSource='mock';this.persist();}
            r.updatedAt=new Date().toISOString();
          }
        });
        child.send({ type: 'init', uid, home, webDir: path.join(this.labRoot, 'fixtures', 'star-web'), gatewayProfile });
      });
    } catch (err) { child.kill(); this.runtimes.delete(uid); await gateway.close(); throw err; }
    this.appendLog(uid, 'INFO', '模拟本地服务已就绪；本次没有真实登录、搜题或提交任务。');
    return this.status(uid);
  }
  async stop({ uid }) {
    uidOf(uid); if(this.pendingStarts.has(uid))await this.pendingStarts.get(uid).catch(()=>{}); const r = this.runtimes.get(uid);
    if (r) {
      await new Promise(resolve => {
        const timer = setTimeout(() => { r.child.kill(); resolve(); }, 2500);
        r.child.once('exit', () => { clearTimeout(timer); resolve(); });
        r.child.send({ type: 'stop' });
      });
      this.runtimes.delete(uid);
      await r.gateway.close();
    }
    if(this.onCloseHtml)await this.onCloseHtml({uid});
    return this.status(uid);
  }
  async openHtml({ uid }) {
    uidOf(uid); const r = this.runtimes.get(uid);
    if (!r || !r.port) throw new Error('请先启动该账号的协议模拟服务');
    if (!this.onOpenHtml) throw new Error('HTML 窗口处理器未连接');
    await this.onOpenHtml({ uid, url: `http://127.0.0.1:${r.port}/#t=${r.token}`, mode: 'mock' });
    return { opened: true, mode: 'mock', uid };
  }
  getLogs({ uid, limit = 200 }) {
    uidOf(uid); return { uid, mode: this.runtimes.has(uid) ? 'mock' : 'unconnected', lines: (this.logBuffers.get(uid) || []).slice(-Math.min(500, Math.max(1, Number(limit) || 200))) };
  }
  async dispose() { try{await Promise.all([...new Set([...this.runtimes.keys(),...this.pendingStarts.keys()])].map(uid => this.stop({ uid })));}finally{this.secretCache.clear();this.redactorCache.clear();} }
}
module.exports = { IntegrationController, uidOf, redact };
