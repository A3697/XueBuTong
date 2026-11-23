'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {normalizeSearchMethods}=require('./search-methods.cjs');
const {uidOf}=require('./controller.cjs');
const Banks=require('./question-bank-config.js');
const AnswerSettings=require('./answer-settings.js');
const ClientEnvironment=require('./client-environment.js');
const Enrollment=require('./enrollment-year.js');
const NativeStar=require('./native-star-settings.cjs');
const AccountOrder=require('./account-order.js');
const WindowSizes=require('./window-sizes.cjs');
const {normalizeRender,reconcileLogin,loginMetadata}=require('./import-normalization.cjs');
const {normalize:normalizeWorkspace}=require('./workspace-preferences.cjs');
const {normalize:normalizeHtml}=require('./ui-preferences.cjs');
const SECRET_KEYS=['password','yanxiToken','questionBankConfig','aiKey','aiConfigurations','xingchanBankKey'];
const NAME_SOURCES=new Set(['xingchan','verification','browser']);
const GATEWAY_KEYS=new Set(['config.fusion_answer_policy','config.host','config.token','config.ai_base_url','config.ai_api_key','config.ai_model','config.ai_style','config.bank_fallback','config.bank_fallback_api_key']);
const FACE_KEYS=new Set(['face.object_id','face.photo_file','face.uploaded_at','face.bytes','face.filename']);
const customKey=key=>key==='integration.queue'||key==='integration.pending_queue_removals'||key.startsWith('config.')&&!GATEWAY_KEYS.has(key)||FACE_KEYS.has(key);
const photoName=value=>typeof value==='string'&&/^photo\.(?:png|jpe?g|webp|gif|bmp)$/i.test(value);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function clone(value){return JSON.parse(JSON.stringify(value));}
function validateJson(value,depth=0){
 if(depth>64)throw Error('配置层级过深');
 if(value&&typeof value==='object')for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('配置含不支持的字段');validateJson(value[key],depth+1);}
}
function entities(render){
 const root=render?.browser?.root;if(!root||root.type!=='root'||!root.children||typeof root.children!=='object')throw Error('缺少有效的 OCS 账号列表');
 const result=new Map(),ids=new Set();let count=0;
 function visit(item,depth){
  if(depth>48||++count>20000)throw Error('账号列表过大或层级过深');
  if(!item||typeof item!=='object'||!['root','folder','browser'].includes(item.type))throw Error('账号条目格式无效');
  uidOf(item.uid);if(ids.has(item.uid))throw Error('账号标识重复');ids.add(item.uid);
  if(item.type==='browser'){result.set(item.uid,item);return;}
  if(!item.children||typeof item.children!=='object'||Array.isArray(item.children))throw Error('账号分组格式无效');
  for(const [key,child] of Object.entries(item.children)){if(key!==child.uid)throw Error('账号索引与标识不匹配');visit(child,depth+1);}
 }
 visit(root,0);return result;
}
function readJson(file,fallback){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;}
class ConfigTransfer {
 constructor({root,controller,vault,nativeStore,htmlPreferences,workspacePreferences,modes,applicationSettings}){Object.assign(this,{root,controller,vault,nativeStore,htmlPreferences,workspacePreferences,modes,applicationSettings});}
 snapshot(source){
  validateJson(source);const ocs=clone(source),accounts=entities(ocs.render),profiles={},runtimeSettings={},accountAssets={},nativeStar={};
  ocs.render.browser.accountOrders=AccountOrder.snapshot(ocs.render.browser);
  delete ocs.server;delete ocs.name;delete ocs.version;
  for(const item of accounts.values())item.cachePath='$CACHE_PATH';
  if(ocs.render?.setting?.launchOptions?.executablePath?.replace(/\\/g,'/').includes('/resources/bin/chrome/'))ocs.render.setting.launchOptions.executablePath='$BUNDLED_BROWSER';
  for(const uid of accounts.keys()){
   const stored=this.controller.data.profiles[uid],p=stored||{ai:{baseUrl:'',model:'',type:'openai'}};
   // Freeze each account's effective values, including inherited legacy OCS settings.
   profiles[uid]={browserScript:require('./browser-script-selection.cjs').normalize(p.browserScript),soutijiangAccounts:require('./soutijiang-accounts.cjs').normalize(p.soutijiangAccounts),soutijiangEnabled:p.soutijiangEnabled===true,ocsEnhancementsEnabled:typeof p.ocsEnhancementsEnabled==='boolean'?p.ocsEnhancementsEnabled:ocs.render.setting?.fusionOcsPlugins?.enhanced!==false,username:p.username||'',schoolId:p.schoolId||'',...loginMetadata(p),starEnhancementsEnabled:p.starEnhancementsEnabled!==false,enrollmentYear:Enrollment.normalize(p.enrollmentYear),keepPlayingOnLeave:p.keepPlayingOnLeave===true,clientEnvironment:ClientEnvironment.normalize(p.clientEnvironment),ai:clone(p.ai),answerSettings:AnswerSettings.normalize(p.answerSettings??AnswerSettings.fromOcsStore(ocs.render.setting?.ocs?.store)),questionStrategy:p.questionStrategy,searchMethods:normalizeSearchMethods(p.searchMethods,p.questionStrategy),displayName:p.displayName||'',nameSource:NAME_SOURCES.has(p.nameSource)?p.nameSource:'',verifiedDetails:p.verifiedDetails?require('./login-api.cjs').information(p.verifiedDetails):null,secrets:Object.fromEntries(SECRET_KEYS.map(key=>[key,stored?this.controller.plainSecret(uid,key):'']))};
   nativeStar[uid]=NativeStar.snapshot(this.root,uid);
   const state=readJson(path.join(this.root,'instances',uid,'data/storage/state.json'),{});
   const settings=Object.fromEntries(Object.entries(state).filter(([key])=>customKey(key)));
   if(Object.keys(settings).length)runtimeSettings[uid]=settings;
   const name=state['face.photo_file'];
   if(photoName(name)){
    const file=path.join(this.root,'instances',uid,'data/storage/face',name);
    if(fs.existsSync(file)){const image=fs.readFileSync(file);if(image.length>8*1024*1024)throw Error('自定义照片超过 8 MB');accountAssets[uid]=[{name,sha256:crypto.createHash('sha256').update(image).digest('hex'),content:image.toString('base64')}];}
   }
  }
  const assets=[];
  for(const script of ocs.render.scripts||[]){
   const ref=script.info?.code_url||script.url;if(typeof ref!=='string'||/^https?:/i.test(ref))continue;
   let file=ref.replace(/^file:\/\//,'');if(!path.isAbsolute(file)||!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
   const content=fs.readFileSync(file);if(content.length>8*1024*1024)throw Error('本地脚本超过 8 MB，请单独备份。');
   const digest=crypto.createHash('sha256').update(content).digest('hex');assets.push({ref,sha256:digest,name:path.basename(file),content:content.toString('base64')});
  }
  return {...ocs,fusion:{format:'ocs-xingchan-settings',schema:1,profiles,runtimeSettings,accountAssets,nativeStar,windowSizes:WindowSizes.snapshot(this.root),htmlPreferences:Object.fromEntries([...accounts.keys()].map(uid=>[uid,this.htmlPreferences.get(uid)])),workspace:this.workspacePreferences.get(),applicationSettings:clone(this.applicationSettings?.data||{schema:1,items:{}}),assets}};
 }
 parse(text,{preserveScriptRefs=false}={}){
  if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>64*1024*1024)throw Error('配置文件超过 64 MB');
  let source;try{source=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('配置不是有效的 JSON 文件');}
  validateJson(source);
  if(typeof source?.render==='string'){
   try{source.render=JSON.parse(this.vault.decryptString(Buffer.from(source.render,'base64')).toString());}catch{throw Error('无法读取此加密配置，请先在原 OCS 中导出 .ocsdata 再导入。');}
  }
  const accounts=entities(source.render),render=normalizeRender(source.render);
  render.state??={};render.state.setup=false;render.state.first=false;render.browser.currentBrowserUid='';render.browser.currentFolderUid=render.browser.root.uid;
  const cacheRoot=this.nativeStore.store.paths.userDataDirsFolder;
  function normalizeTree(item,parent){
   item.parent=parent;item.name=typeof item.name==='string'?item.name:(item.type==='browser'?'未命名账号':'未命名分组');item.renaming=false;
   if(item.type==='browser'){item.cachePath=path.join(cacheRoot,item.uid);item.checked=false;item.notes=typeof item.notes==='string'?item.notes:'';item.tags=Array.isArray(item.tags)?item.tags.map(x=>typeof x==='string'?{name:x,color:'#409eff'}:x).filter(x=>x&&typeof x.name==='string'&&x.name.trim()):[];item.histories=Array.isArray(item.histories)?item.histories:[];item.playwrightScripts=Array.isArray(item.playwrightScripts)?item.playwrightScripts:[];}
   else for(const child of Object.values(item.children))normalizeTree(child,item.uid);
  }
  normalizeTree(render.browser.root,undefined);
  if(render.browser.accountOrders!==undefined){
   if(!render.browser.accountOrders||typeof render.browser.accountOrders!=='object'||Array.isArray(render.browser.accountOrders))throw Error('账号排序配置格式无效');
   render.browser.accountOrders=AccountOrder.snapshot(render.browser);
  }
  if(render.browser.search)delete render.browser.search.results;
  render.setting??={};render.setting.launchOptions??={};
  let executable=render.setting.launchOptions.executablePath;
  if(!executable||executable==='$BUNDLED_BROWSER'||/[/\\]resources[/\\]bin[/\\]chrome[/\\]/.test(executable)||!fs.existsSync(executable))render.setting.launchOptions.executablePath=path.join(this.root,'ocs-lab/resources/bin/chrome/chrome/chrome.exe');
  const data={schema:1,profiles:{}},writes=[],incoming=source.fusion;
  if(incoming){
   if(incoming.format!=='ocs-xingchan-settings'||incoming.schema!==1)throw Error('不支持此融合版配置版本');
   for(const [uid,p] of Object.entries(incoming.profiles||{})){
    uidOf(uid);if(!accounts.has(uid)||!p||typeof p!=='object')throw Error('星蝉配置与账号列表不匹配');
    if(typeof p.username!=='string'||p.username.length>500||typeof p.schoolId!=='string'||p.schoolId.length>500||!p.ai||!['auto','openai','anthropic','gemini','ollama'].includes(p.ai.type))throw Error('星蝉账号配置格式无效');
    if(typeof p.ai.baseUrl!=='string'||typeof p.ai.model!=='string'||p.ai.model.length>500)throw Error('AI 配置格式无效');
    if(p.ai.baseUrl){let url;try{url=new URL(p.ai.baseUrl);}catch{throw Error('AI 地址无效');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('AI 地址格式不受支持');}
    const secrets={};for(const key of SECRET_KEYS){const value=p.secrets?.[key]||'';if(typeof value!=='string'||value.length>(['questionBankConfig','aiConfigurations'].includes(key)?262144:8192))throw Error('账号密码或 API 密钥格式无效');if(value)secrets[key]=this.vault.encryptString(value).toString('base64');}
    if(p.soutijiangEnabled!==undefined&&typeof p.soutijiangEnabled!=='boolean')throw Error('搜题酱开关无效');
    if(p.ocsEnhancementsEnabled!==undefined&&typeof p.ocsEnhancementsEnabled!=='boolean')throw Error('OCS 增强开关无效');
    if(p.starEnhancementsEnabled!==undefined&&typeof p.starEnhancementsEnabled!=='boolean')throw Error('星蝉增强开关无效');
    if(p.secrets?.questionBankConfig)Banks.parse(p.secrets.questionBankConfig);
    if(p.secrets?.aiConfigurations)require('./ai-config.js').normalize(JSON.parse(p.secrets.aiConfigurations));
    data.profiles[uid]={revision:1,browserScript:require('./browser-script-selection.cjs').normalize(p.browserScript),soutijiangAccounts:require('./soutijiang-accounts.cjs').normalize(p.soutijiangAccounts),soutijiangEnabled:p.soutijiangEnabled===true,ocsEnhancementsEnabled:typeof p.ocsEnhancementsEnabled==='boolean'?p.ocsEnhancementsEnabled:render.setting?.fusionOcsPlugins?.enhanced!==false,username:p.username,schoolId:p.schoolId,...loginMetadata(p),starEnhancementsEnabled:p.starEnhancementsEnabled!==false,enrollmentYear:Enrollment.normalize(p.enrollmentYear),keepPlayingOnLeave:p.keepPlayingOnLeave===true,clientEnvironment:ClientEnvironment.normalize(p.clientEnvironment),ai:clone(p.ai),...(p.answerSettings?{answerSettings:require('./answer-settings.js').normalize(p.answerSettings)}:{}),searchMethods:normalizeSearchMethods(p.searchMethods,p.questionStrategy),questionStrategy:p.questionStrategy==='ai-first'?'ai-first':'yanxi-first',secrets,displayName:typeof p.displayName==='string'?p.displayName.slice(0,120):'',nameSource:NAME_SOURCES.has(p.nameSource)?p.nameSource:'',verifiedDetails:p.verifiedDetails?require('./login-api.cjs').information(p.verifiedDetails):null};
   }
   if(incoming.nativeStar!==undefined){
    if(!incoming.nativeStar||typeof incoming.nativeStar!=='object'||Array.isArray(incoming.nativeStar))throw Error('原生星蝉配置无效');
    for(const [uid,value]of Object.entries(incoming.nativeStar)){uidOf(uid);if(!accounts.has(uid))throw Error('原生星蝉配置与账号列表不匹配');writes.push(...NativeStar.prepare(this.root,uid,value));}
   }
   const runtimeSettings=incoming.runtimeSettings||{};
   if(typeof runtimeSettings!=='object'||Array.isArray(runtimeSettings))throw Error('星蝉控制面板设置无效');
   for(const [uid,settings] of Object.entries(runtimeSettings)){
    uidOf(uid);if(!accounts.has(uid)||!settings||typeof settings!=='object')throw Error('星蝉控制面板设置无效');
    if(Object.keys(settings).some(key=>!customKey(key)))throw Error('星蝉设置包含非自定义内容');
    if(settings['face.photo_file']&&!photoName(settings['face.photo_file']))throw Error('自定义照片名称无效');
    const queue=settings['integration.queue'];if(queue!==undefined&&(!queue||typeof queue!=='object'||Array.isArray(queue)||queue.schema!==1||!Array.isArray(queue.items)||queue.items.length>1000||Buffer.byteLength(JSON.stringify(queue))>2097152))throw Error('保存的课程列表格式无效');
   }
   for(const uid of accounts.keys()){
    const file=path.join(this.root,'instances',uid,'data/storage/state.json'),current=readJson(file,{});
    const retained=Object.fromEntries(Object.entries(current).filter(([key])=>!customKey(key)));
    writes.push({file,value:{...retained,...clone(runtimeSettings[uid]||{})}});
   }
   for(const [uid,photos] of Object.entries(incoming.accountAssets||{})){
    uidOf(uid);if(!accounts.has(uid)||!Array.isArray(photos)||photos.length>2)throw Error('账号照片设置无效');
    for(const photo of photos){
     if(!photo||!photoName(photo.name)||typeof photo.content!=='string'||photo.content.length>12*1024*1024||!/^[a-f0-9]{64}$/.test(photo.sha256))throw Error('自定义照片内容无效');
     const image=Buffer.from(photo.content,'base64');if(crypto.createHash('sha256').update(image).digest('hex')!==photo.sha256)throw Error('自定义照片校验失败');
     writes.push({file:path.join(this.root,'instances',uid,'data/storage/face',photo.name),raw:image});
    }
   }
   const assets=incoming.assets||[];if(!Array.isArray(assets)||assets.length>1000)throw Error('本地脚本列表无效');
   for(const asset of assets){
    if(!asset||!/^\w{64}$/.test(asset.sha256)||typeof asset.ref!=='string'||typeof asset.content!=='string'||asset.content.length>12*1024*1024)throw Error('本地脚本内容无效');
    const content=Buffer.from(asset.content,'base64');if(crypto.createHash('sha256').update(content).digest('hex')!==asset.sha256)throw Error('本地脚本校验失败');
    const file=path.join(this.root,'ocs-profile/imported-scripts',asset.sha256+'.user.js');writes.push({file,raw:content});
     if(!preserveScriptRefs)for(const script of render.scripts||[])for(const object of [script,script.info])if(object)for(const key of ['url','code_url'])if(object[key]===asset.ref)object[key]=file;
   }
  }else{
   // A legacy OCS import replaces its account tree while preserving matching Xingchan settings.
   for(const [uid] of accounts)if(this.controller.data.profiles[uid])data.profiles[uid]=clone(this.controller.data.profiles[uid]);
  }
  // Native OCS login values are authoritative, including clearing a login or
  // selecting another platform. Keep API/bank settings on matching account IDs.
  for(const [uid,item]of entities(render)){
   const profile=data.profiles[uid]||{revision:1,username:'',schoolId:'',ai:{baseUrl:'',model:'',type:'openai'},searchMethods:normalizeSearchMethods(),questionStrategy:'yanxi-first',secrets:{},displayName:'',nameSource:''};
   profile.clientEnvironment=ClientEnvironment.normalize(profile.clientEnvironment);
   data.profiles[uid]=reconcileLogin(profile,item,this.vault);
  }
  const html={schema:1,accounts:{}};for(const uid of accounts.keys())html.accounts[uid]=normalizeHtml(incoming?.htmlPreferences?.[uid]||this.htmlPreferences.get(uid));
  if(incoming&&own(incoming,'applicationSettings')&&(!incoming.applicationSettings||typeof incoming.applicationSettings!=='object'||Array.isArray(incoming.applicationSettings)))throw Error('应用开关设置无效');
  const applicationSettings=clone(incoming?.applicationSettings||this.applicationSettings?.data||{schema:1,items:{}});
  if(applicationSettings.schema!==1||!applicationSettings.items||typeof applicationSettings.items!=='object'||Array.isArray(applicationSettings.items)||Object.keys(applicationSettings.items).length>1000||Object.entries(applicationSettings.items).some(([key,value])=>!/^([A-Za-z0-9][A-Za-z0-9_-]{0,79}):([A-Za-z0-9][A-Za-z0-9_-]{0,79})$/.test(key)||typeof value!=='boolean'))throw Error('应用开关设置无效');
  for(const [key,value] of Object.entries(WindowSizes.normalize(incoming?.windowSizes)))if(key==='main'||accounts.has(key.slice(key.indexOf('-')+1)))writes.push({file:WindowSizes.location(this.root,key),value});
  const workspace=normalizeWorkspace(incoming?.workspace||this.workspacePreferences.get());
  const app=source.app&&typeof source.app==='object'?clone(source.app):{};
  if(!incoming||typeof app.data_encryption!=='boolean')app.data_encryption=true;
  return {render,app,window:source.window&&typeof source.window==='object'?clone(source.window):null,data,html,workspace,applicationSettings,writes,accountCount:accounts.size,isLegacy:!incoming};
 }
 apply(plan){
  if(this.modes.anyActive())throw Error('请先在学不通中停止所有浏览器和星蝉任务，并结束正在进行的登录验证，再导入配置。');
  if(!this.vault.isEncryptionAvailable())throw Error('系统数据加密暂不可用，未导入配置。');
  // Validate the complete merged account set, after UID remapping but before
  // creating backups or writing anything. Explicit identifiers are never
  // silently replaced during an import.
  this.controller.validateClientEnvironments?.(plan.data.profiles);
  const beforeStore=clone(this.nativeStore.store),nextStore=clone(beforeStore);
  if(plan.app)nextStore.app={...nextStore.app,...plan.app};if(plan.window)nextStore.window={...nextStore.window,...plan.window};
  nextStore.app??={};nextStore.app.fusionEncryptionDefaultApplied=true;
  nextStore.render=nextStore.app.data_encryption===false?plan.render:this.vault.encryptString(JSON.stringify(plan.render)).toString('base64');
  const writes=[{file:this.controller.settingsFile,value:plan.data},{file:this.htmlPreferences.file,value:plan.html},{file:this.workspacePreferences.file,value:{schema:1,...plan.workspace}},...(this.applicationSettings?[{file:this.applicationSettings.file,value:plan.applicationSettings}]:[]),...plan.writes];
  const realRoot=fs.realpathSync(this.root);
  for(const write of writes){let ancestor=path.dirname(write.file);while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw Error('配置目标目录无效');ancestor=parent;}const resolved=fs.realpathSync(ancestor);if(resolved!==realRoot&&!resolved.startsWith(realRoot+path.sep))throw Error('配置目录存在指向软件外部的链接，未导入。');}
  const backup=path.join(this.root,'private','config-import-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(backup,{recursive:true});
  const previous=[];for(let i=0;i<writes.length;i++){const {file}=writes[i];const exists=fs.existsSync(file);previous.push({file,exists,backup:path.join(backup,String(i))});if(exists)fs.copyFileSync(file,previous.at(-1).backup);}
  fs.writeFileSync(path.join(backup,'native-store.json'),JSON.stringify(beforeStore),'utf8');
  const committed=[];
  try{
   for(const write of writes){fs.mkdirSync(path.dirname(write.file),{recursive:true});fs.writeFileSync(write.file+'.import-tmp',write.raw||JSON.stringify(write.value,null,2));fs.renameSync(write.file+'.import-tmp',write.file);committed.push(write.file);}
   this.nativeStore.store=nextStore;
   this.controller.data=plan.data;this.controller.secretCache.clear();this.controller.redactorCache.clear();this.controller.bankCache?.clear();
   this.htmlPreferences.accounts=plan.html.accounts;this.workspacePreferences.data=plan.workspace;
   if(this.applicationSettings){this.applicationSettings.data=plan.applicationSettings;this.applicationSettings.pendingTickets.clear();}
   return {accountCount:plan.accountCount,isLegacy:plan.isLegacy,needsRestart:true};
  }catch(error){
   for(const prior of previous)if(committed.includes(prior.file)){if(prior.exists)fs.copyFileSync(prior.backup,prior.file);else fs.unlinkSync(prior.file);}
   for(const write of writes)if(fs.existsSync(write.file+'.import-tmp'))fs.unlinkSync(write.file+'.import-tmp');
   this.nativeStore.store=beforeStore;throw error;
  }
 }
}
module.exports={ConfigTransfer,entities,validateJson,customKey,photoName};
