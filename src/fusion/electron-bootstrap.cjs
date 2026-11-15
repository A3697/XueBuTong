'use strict';
const {app,ipcMain,BrowserWindow,safeStorage,dialog,session,Tray,Menu,nativeTheme,screen}=require('electron');
app.setName('学不通');
const networkPolicy=require('./lib/src/network-policy');
networkPolicy.installNodeDirect(require('axios'));
const directNetwork=networkPolicy.installElectronDirect(app);
const fs=require('node:fs');const path=require('node:path');
const lab=path.resolve(__dirname,'..','..','..');
const themedDialog=require(path.join(lab,'src/themed-dialog.cjs')).createThemedDialog({root:lab});
let mainInitialized=false,startupFailureShown=false;
function reportMainError(error){
  try{fs.mkdirSync(path.join(lab,'evidence'),{recursive:true});fs.appendFileSync(path.join(lab,'evidence','lab-bootstrap-errors.log'),new Date().toISOString()+' 融合版异常: '+String(error?.name||'Error')+'\n'+String(error?.stack||'').split('\n').filter(line=>/^\s*at\s/.test(line)).slice(0,6).join('\n')+'\n');}catch{}
  if(mainInitialized||startupFailureShown)return;
  startupFailureShown=true;
  app.whenReady().then(()=>{const detail=error?.code==='FUSION_CONFIG'?error.message:'请确认安装目录可写。程序文件缺失时可使用同版本安装包修复；配置异常时可从备份恢复，重装不会清除已有账号。';dialog.showErrorBox('学不通初始化未完成',detail+'\n\n诊断记录：'+path.join(lab,'evidence','lab-bootstrap-errors.log'));app.exit(1);});
}
process.on('uncaughtException',reportMainError);
process.on('unhandledRejection',reportMainError);
if(process.platform==='win32')app.setAppUserModelId('XueBuTong.Desktop');
app.on('browser-window-created',(_event,win)=>{
  const icon=path.join(lab,'assets','fusion.ico');
  win.setIcon(icon);
  if(process.platform==='win32')win.setAppDetails({appId:'XueBuTong.Desktop',appIconPath:icon,appIconIndex:0,relaunchCommand:'"'+path.join(lab,'学不通.exe')+'"',relaunchDisplayName:'学不通'});
});
for(const name of ['ocs-profile','ocs-profile/session','private','evidence','lab-logs','bridge-data','instances'])fs.mkdirSync(path.join(lab,name),{recursive:true});
const publicRootUrl=require('node:url').pathToFileURL(path.join(lab,'ocs-lab','resources','app','public')+path.sep).href;
// Existing configurations are read once by the native store; never rewrite them here.
const configFile=path.join(lab,'ocs-profile','config.json');
require(path.join(lab,'src','initialize-config.cjs')).seedInitialConfig(configFile,path.join(lab,'ocs-lab','resources','bin','chrome','chrome','chrome.exe'));
const {IntegrationController}=require(path.join(lab,'src','live-controller.cjs'));
app.setPath('userData',path.join(lab,'ocs-profile'));
app.setPath('sessionData',path.join(lab,'ocs-profile','session'));
app.setAppLogsPath(path.join(lab,'lab-logs'));
if(process.env.OCS_FUSION_DEBUG==='1'){
app.commandLine.appendSwitch('remote-debugging-address','127.0.0.1');
app.commandLine.appendSwitch('remote-debugging-port','18540');
}
process.chdir(path.join(lab,'ocs-lab','resources','app'));
const controller=new IntegrationController({labRoot:lab,vault:safeStorage});
controller.defaultOcsEnhancementsEnabled=()=>require('./lib/src/store').getDecryptedRenderData().setting?.fusionOcsPlugins?.enhanced!==false;
controller.legacyAnswerSettings=()=>require(path.join(lab,'src/answer-settings.js')).fromOcsStore(require('./lib/src/store').getDecryptedRenderData().setting?.ocs?.store||{});
require(path.join(lab,'src/browser-answer-settings.cjs')).install(controller);
const {StarMonitor}=require(path.join(lab,'src','star-monitor.cjs'));const starMonitor=new StarMonitor(controller);
const ready=app.whenReady().then(()=>directNetwork.prepare(session.defaultSession));
ready.catch(reportMainError);
const windows=new Map();let quitting=false;
const nativeStar=require(path.join(lab,'src/native-star-settings.cjs'));
async function saveNativePanel(uid,win){
 if(!win||win.isDestroyed()||!win.fusionNativeStar||!win.fusionNativeLoaded)return;
 let timer;
 try{const value=await Promise.race([win.webContents.executeJavaScript(`Object.fromEntries(${JSON.stringify(nativeStar.KEYS)}.flatMap(key=>{const value=localStorage.getItem(key);return value===null?[]:[[key,value]];}))`),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('panel_snapshot_timeout')),1500);})]);nativeStar.write(lab,uid,value);}finally{clearTimeout(timer);}
}
async function closePanel(uid,win=windows.get(uid)){
 if(!win||win.isDestroyed())return;
 if(win.fusionClosePending)return win.fusionClosePending;
 win.fusionClosePending=(async()=>{try{await saveNativePanel(uid,win);}catch{controller.appendLog(uid,'WARN','原生面板最近一次设置未能保存；上次已保存的设置仍然保留。');}finally{if(!win.isDestroyed())win.destroy();if(windows.get(uid)===win)windows.delete(uid);}})();
 return win.fusionClosePending;
}
const nativePanelUid=event=>{const pair=[...windows.entries()].find(([,win])=>!win.isDestroyed()&&win.webContents===event.sender&&win.fusionNativeStar);if(!pair||event.senderFrame!==event.sender.mainFrame)throw Error('原生面板未授权');return pair[0];};
ipcMain.on('fusion-native-panel:get',event=>{try{event.returnValue={ok:true,value:nativeStar.read(lab,nativePanelUid(event))};}catch{event.returnValue={ok:false};}});
ipcMain.on('fusion-native-panel:set',(event,value)=>{let uid;try{uid=nativePanelUid(event);nativeStar.write(lab,uid,value);}catch{if(uid)controller.appendLog(uid,'WARN','原生面板设置未能保存，请检查执行参数。');}});
controller.getNativeRunOptions=async uid=>{await saveNativePanel(uid,windows.get(uid));return nativeStar.runOptions(nativeStar.read(lab,uid)['xxtsk.runParams']);};
const versionInfo=JSON.parse(fs.readFileSync(path.join(lab,'fusion-install.json'),'utf8'));
const {HtmlPreferences}=require(path.join(lab,'src','ui-preferences.cjs'));
const htmlPreferences=new HtmlPreferences(lab);
const {ModeCoordinator}=require(path.join(lab,'src','mode-coordinator.cjs'));
const {WorkspacePreferences}=require(path.join(lab,'src','workspace-preferences.cjs'));
const {ConfigTransfer}=require(path.join(lab,'src','config-transfer.cjs'));
const modes=new ModeCoordinator(controller),workspacePreferences=new WorkspacePreferences(lab);
const {createLoginVerifier}=require(path.join(lab,'src/login-verifier.cjs'));
const verifier=createLoginVerifier({chromium:require('playwright-core').chromium,executablePath:path.join(lab,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),ocrApiUrl:()=>`http://127.0.0.1:${require('./lib/src/store').store.store.server.port}/ocr`,ocrEnabled:()=>applicationSettings.data.items['apps:ocr']!==false});
const {LoginService}=require(path.join(lab,'src/login-service.cjs'));const loginService=new LoginService({controller,modes,verifier});
controller.resolveSchool=login=>verifier.resolveSchool(login);
const {BrowserCacheRemoval}=require(path.join(lab,'src/browser-cache-removal.cjs'));const browserCacheRemoval=new BrowserCacheRemoval({userData:app.getPath('userData')});
const {ConnectionChecks}=require(path.join(lab,'src/connection-checks.cjs'));const connectionChecks=new ConnectionChecks(controller);
const {ApplicationSettings}=require(path.join(lab,'src/application-settings.cjs'));const applicationSettings=new ApplicationSettings(lab);
const soutijiang=require(path.join(lab,'src/soutijiang.cjs')).createManager({root:lab,controller});controller.soutijiang=soutijiang;
const stopSoutijiangHelpers=()=>Promise.all([...new Set([...soutijiang.sessions.keys(),...soutijiang.pending.keys()])].map(uid=>soutijiang.stop(uid)));
const {DefaultComponents}=require(path.join(lab,'src/default-components.cjs'));const defaultComponents=new DefaultComponents({root:lab,downloadRoot:()=>require('./lib/src/store').store.store.paths.downloadFolder,applications:applicationSettings});
require(path.join(lab,'src/theme.cjs')).installTheme({ipcMain,nativeTheme,isSender:event=>isLabSender(event)});
const windowSizes=require(path.join(lab,'src/window-sizes.cjs'));
const {TrayLifecycle}=require(path.join(lab,'src/tray-lifecycle.cjs'));
const trayLifecycle=new TrayLifecycle({Tray,Menu,dialog:themedDialog,icon:path.join(lab,'assets/fusion.ico'),version:versionInfo.version,preferences:workspacePreferences,requestExit:win=>{if(win&&!win.isDestroyed())win.webContents.send('close');else void handlers.finishClose();}});
const {installAbout}=require(path.join(lab,'src/about-window.cjs'));const openAbout=installAbout({root:lab,app,BrowserWindow,ipcMain,shell:require('electron').shell,dialog:themedDialog,directNetwork,canUpdate:()=>!modes.anyActive()&&!controller.pendingStarts.size,finishClose:()=>handlers.finishClose()});
let startupPlanTaken=false;
const {AccountSettings}=require(path.join(lab,'src','account-settings.cjs'));
const accountSettings=new AccountSettings({root:lab,controller,modes,htmlPreferences,workspacePreferences});
const getTransfer=()=>new ConfigTransfer({root:lab,controller,vault:safeStorage,nativeStore:require('./lib/src/store').store,htmlPreferences,workspacePreferences,modes,applicationSettings});
const versionInfoScript='window.__fusionVersionInfo='+JSON.stringify({version:versionInfo.version,dependencies:versionInfo.dependencies})+';';
ipcMain.handle('fusion-html:preferences',(event,payload)=>{
  const pair=[...windows.entries()].find(([,win])=>!win.isDestroyed()&&win.webContents===event.sender);
  if(!pair||event.senderFrame!==event.sender.mainFrame)throw Error('管理窗口未授权');
  const uid=pair[0];
  if(payload?.action==='get')return htmlPreferences.get(uid);
  if(payload?.action==='set')return htmlPreferences.set(uid,payload.preferences??payload.hidden);
  throw Error('弹窗设置操作无效');
});
ipcMain.handle('fusion-html:about',event=>{
 if(![...windows.values()].some(win=>!win.isDestroyed()&&win.webContents===event.sender&&event.senderFrame===event.sender.mainFrame))throw Error('控制面板未授权');
 return openAbout();
});
controller.onOpenHtml=async({uid,url,mode})=>{
  const native=mode==='native',endpoint=new URL(url),token=new URLSearchParams(endpoint.hash.slice(1)).get('t');
  if(native&&!token)throw Error('原生星蝉服务凭据缺失');
  const previous=windows.get(uid);if(previous&&!previous.isDestroyed()){
   if(previous.fusionClosePending||previous.fusionNativeStar!==native||previous.fusionEndpoint!==url)await closePanel(uid,previous);
   else{if(process.env.OCS_POC_HEADLESS!=='1'){previous.show();previous.focus();}return;}
  }
  const win=new BrowserWindow({title:'学不通 · 星蝉控制面板 · '+uid,width:1200,height:820,minWidth:850,minHeight:560,show:false,autoHideMenuBar:true,icon:path.join(lab,'assets','fusion.ico'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true,preload:path.join(lab,native?'src/native-star-preload.cjs':'src/html-preload.cjs'),partition:(native?'persist:xingchan-native-':'persist:xingchan-fusion-')+uid}});win.fusionNativeStar=native;win.setMenu(null);
  win.fusionEndpoint=url;
  if(native)win.on('close',event=>{event.preventDefault();void closePanel(uid,win);});
  windowSizes.attachElectron(win,{root:lab,key:'panel-'+uid,screen});
  windows.set(uid,win);const panelSession=win.webContents.session;
  if(native){
   // Keep the upstream page unmodified. Only this account's local origin receives its token.
   panelSession.webRequest.onBeforeSendHeaders({urls:[endpoint.origin+'/*',endpoint.origin.replace(/^http:/,'ws:')+'/*']},(details,callback)=>{
    const headers={...details.requestHeaders};if(!win.isDestroyed()&&details.webContentsId===win.webContents.id){for(const key of Object.keys(headers))if(key.toLowerCase()==='x-token')delete headers[key];headers['X-Token']=token;}callback({requestHeaders:headers});
   });
  }
  win.on('closed',()=>{if(native)panelSession.webRequest.onBeforeSendHeaders(null);if(windows.get(uid)===win)windows.delete(uid);});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,target)=>{if(!target.startsWith(new URL(url).origin+'/'))event.preventDefault();});
  win.webContents.on('did-finish-load',async()=>{
    if(win.isDestroyed())return;
    if(native){win.fusionNativeLoaded=true;return;}
    try{
    if(!win.webContents.getURL().startsWith(new URL(url).origin+'/'))return;
    await win.webContents.executeJavaScript(`(()=>{const card=document.querySelector('#inAiUrl')?.closest('.cfg');if(card&&!card.dataset.ocsManaged){card.dataset.ocsManaged='true';for(const child of card.children)child.style.display='none';const title=document.createElement('h2');title.textContent='搜题配置由学不通管理';const note=document.createElement('p');note.className='note';note.textContent='请在学不通对应账号的设置抽屉中修改 API、题库密钥、搜题顺序和独立开关。保存后重新启动该账号的星蝉即可应用。';card.append(title,note);}document.title='学不通 · '+${JSON.stringify(controller.status(uid).displayName||uid.slice(0,8))};})()`);
    await win.webContents.executeJavaScript(`(async()=>{const bridge=window.fusionPanelBridge;if(!bridge||!window.fusionHtmlPreferences)return;const saved=await bridge.get();window.fusionHtmlPreferences(saved,{silent:true});let writes=Promise.resolve();window.addEventListener('fusion-html-preferences-changed',event=>{const value={panelColumnRatio:event.detail.panelColumnRatio};writes=writes.then(()=>bridge.set(value)).catch(()=>{});});})();`);
    await win.webContents.executeJavaScript(versionInfoScript);
    await win.webContents.executeJavaScript(fs.readFileSync(path.join(lab,'src','version-ui.js'),'utf8'));
    }catch(error){if(!win.isDestroyed())fs.appendFileSync(path.join(lab,'evidence','panel-errors.log'),new Date().toISOString()+' 控制面板加载失败: '+String(error?.name||'Error')+'\n');}
  });
  await directNetwork.prepare(win.webContents.session);
  if(win.isDestroyed())return;
  try{await win.loadURL(url);}catch(error){if(!win.isDestroyed())throw error;}
  if(!win.isDestroyed()&&process.env.OCS_POC_HEADLESS!=='1')win.show();
};
controller.onCloseHtml=async({uid})=>closePanel(uid);
const allowed=['getInitializationStatus','getDefaultSetupState','finishDefaultSetupPrompt','installDefaultComponents','getSettings','saveSettings','syncNativeLogin','recordBrowserName','verifyLogin','listStatus','start','stop','openHtml','getLogs','claimBrowser','releaseBrowser','prepareBrowserCacheRemoval','restoreBrowserCacheRemoval','finishBrowserCacheRemoval','getWorkspacePreferences','saveWorkspacePreferences','exportConfig','importConfig','cloneAccountSettings','removeAccountSettings','getStarMonitor','starTaskAction','confirmClose','finishClose','openAbout','getConnectionChecks','checkConnections','getApplicationStates','changeApplicationState','installSoutijiang','removeSoutijiang','clearLogs','takeStartupLaunchPlan','setPlayback','copyQuestionBank','getQuestionBankConfiguration','importQuestionBanks','removeQuestionBank','listAiModels'];
allowed.push('getAccountOcsRuntime','getOcsPlugins','changeOcsPlugins','checkOcsUpdate','reportOcsConflict');
allowed.push('getSoutijiangState','loginSoutijiang','logoutSoutijiang');
const ocsPlugins=require(path.join(lab,'src/ocs-plugin-manager.cjs')).manager(lab);
const pluginAction=async(method,input)=>{
 const native=require('./lib/src/store'),render=native.getDecryptedRenderData();
 let result=await ocsPlugins[method](render,input);
 // Only merge plugin-owned fields after network IO; preserve concurrent edits.
 const current=native.getDecryptedRenderData();current.setting??={};
 if(method==='change'||method==='reportConflict')current.setting.fusionOcsPlugins=render.setting.fusionOcsPlugins;
 if(method==='change'&&typeof input?.autoInstall==='boolean'){const script=current.scripts?.find(s=>s.fusionOcsManaged);if(script)script.enable=input.autoInstall;}
 if(method==='change'&&(Object.hasOwn(input||{},'enhanced')||Object.hasOwn(input||{},'selected'))){const script=current.scripts?.find(s=>s.fusionOcsManaged);if(script)script.enable=true;}
 result=ocsPlugins.reconcile(current);
 native.store.set('render',native.store.store.app.data_encryption?safeStorage.encryptString(JSON.stringify(current)).toString('base64'):current);
 return {...result,scripts:current.scripts,preferences:current.setting.fusionOcsPlugins};
};
const BrowserScripts=require(path.join(lab,'src/browser-script-selection.cjs'));
controller.browserScriptAvailability=uid=>BrowserScripts.state({selected:controller.base(uid).browserScript,scripts:require('./lib/src/store').getDecryptedRenderData().scripts||[],extensions:require('./lib/src/extension-runtime').inventory(undefined,{root:lab})});
const handlers={
 getSoutijiangState:async({uid,refresh=false,connect=false})=>{const before=soutijiang.view(uid),state=await soutijiang.state(uid,{refresh:refresh===true,connect:connect===true});if(before.loggedIn!==state.loggedIn||before.name!==state.name)connectionChecks.invalidate(uid,'soutijiang');return state;},
 loginSoutijiang:async({uid,visible=false})=>{const state=await soutijiang.login(uid,{visible:visible===true});connectionChecks.invalidate(uid,'soutijiang');return state;},
 logoutSoutijiang:async({uid})=>{const state=await soutijiang.logout(uid);connectionChecks.invalidate(uid,'soutijiang');return state;},
 getAccountOcsRuntime:({uid})=>{require(path.join(lab,'src/controller.cjs')).uidOf(uid);const render=require('./lib/src/store').getDecryptedRenderData(),scriptSelection=controller.browserScriptAvailability(uid);if(scriptSelection.selected==='soutijiang')return{uid,enhanced:false,runtime:null,scripts:(render.scripts||[]).filter(script=>!BrowserScripts.isOcsScript(script)),scriptSelection};return{...ocsPlugins.forAccount(render,{uid,enhanced:controller.ocsEnhancementsEnabled(uid)}),scriptSelection};},
 getOcsPlugins:()=>pluginAction('reconcile'),changeOcsPlugins:input=>pluginAction('change',input),checkOcsUpdate:input=>pluginAction('check',input),reportOcsConflict:input=>pluginAction('reportConflict',input),
 removeQuestionBank:({uid,id})=>{const Banks=require(path.join(lab,'src/question-bank-config.js')),old=controller.bankConfig(uid);if(!old.banks.some(b=>b.id===id))throw Error('题库不存在');const remaining=Banks.parse(old.banks.filter(b=>b.id!==id).map(b=>b.wrapper)),p=controller.base(uid);return controller.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,answerSettings:controller.answerSettings(uid),searchMethods:Banks.reconcile((p.searchMethods||[]).filter(m=>m.id!==id),remaining.banks),questionBankConfig:remaining.json}});},
 listAiModels:input=>require(path.join(lab,'src/ai-models.cjs')).listModels(input,controller),
 getQuestionBankConfiguration:({uid})=>({uid,json:controller.bankConfig(uid).json}),
 copyQuestionBank:({uid,id})=>{const bank=controller.bankConfig(uid).banks.find(b=>b.id===id);if(!bank)throw Error('题库不存在');require('electron').clipboard.writeText(JSON.stringify([bank.wrapper],null,2));return {copied:true};},
 importQuestionBanks:({uid,json})=>{
  const Banks=require(path.join(lab,'src/question-bank-config.js')),old=controller.bankConfig(uid),incoming=Banks.parse(json,{saved:old});
  if(!incoming.banks.length)throw Error('没有找到题库，请粘贴至少一个有效的题库配置。');
  const combined=new Map(old.banks.map(b=>[b.id,b]));for(const bank of incoming.banks)combined.set(bank.id,bank);
  const merged=Banks.parse([...combined.values()].map(b=>b.wrapper)),p=controller.base(uid),ids=new Set(incoming.banks.map(b=>b.id));
  const methods=Banks.reconcile(p.searchMethods||[],merged.banks).map(m=>ids.has(m.id)?{...m,enabled:true}:m);
  const settings=controller.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,answerSettings:controller.answerSettings(uid),searchMethods:methods,questionBankConfig:merged.json}});
  return {settings,imported:[...ids]};
 },
 getInitializationStatus:()=>{
  const native=require('./lib/src/store').store.store,folder=native.paths.extensionsFolder;
  const enabled=applicationSettings.state().items;
  const managers=fs.existsSync(folder)?fs.readdirSync(folder,{withFileTypes:true}).filter(item=>item.isDirectory()&&/^(scriptcat|tampermonkey)(?:[-_].*)?$/i.test(item.name)&&fs.existsSync(path.join(folder,item.name,'manifest.json'))&&enabled['extensions:'+item.name]!==false).map(item=>item.name):[];
  return{version:versionInfo.version,browserPresent:fs.existsSync(path.join(lab,'ocs-lab/resources/bin/chrome/chrome/chrome.exe')),backendPresent:fs.existsSync(path.join(lab,'python3144/pythonw.exe'))&&fs.existsSync(path.join(lab,'star-runtime/web/dist/index.html')),encryptionAvailable:safeStorage.isEncryptionAvailable(),configurationReady:fs.existsSync(configFile),enabledManagerCount:managers.length,defaultSetupPromptPending:native.app.fusionDefaultSetupPromptPending===true};
 },
 getDefaultSetupState:()=>defaultComponents.snapshot(),installDefaultComponents:()=>defaultComponents.install(),
 finishDefaultSetupPrompt:()=>{const store=require('./lib/src/store').store;if(store.get('app.fusionDefaultSetupPromptPending')!==false)store.set('app.fusionDefaultSetupPromptPending',false);return{saved:true};},
 recordBrowserName:({uid,name,signature})=>{require(path.join(lab,'src/controller.cjs')).uidOf(uid);const profile=controller.data.profiles[uid];if(!profile||profile.nativeLoginIdentity!==signature||typeof name!=='string'||!name.trim()||name.length>120)return false;if(!profile.displayName){profile.displayName=name.trim();profile.nameSource='browser';controller.persist();}return true;},
 saveSettings:async input=>{
  if(input.settings?.browserScript!==undefined){const selected=BrowserScripts.normalize(input.settings.browserScript),available=controller.browserScriptAvailability(input.uid);if(!available[selected])throw Error('所选脚本尚未安装，请先在应用中心完成安装。');}
  const uid=input.uid,old=controller.base(uid),oldRevision=old.revision,settingsBefore=JSON.stringify(controller.answerSettings(uid));
  const withoutAnswers=p=>JSON.stringify({...p,revision:0,answerSettings:null}),before=withoutAnswers(old),result=controller.saveSettings(input),r=controller.runtimes.get(uid);
  if(input.settings?.soutijiangEnabled===false)await soutijiang.stop(uid);
  if(r?.gateway&&settingsBefore!==JSON.stringify(result.answerSettings)){
   try{await controller.request(r,'PUT','/api/integration/answer-policy',{settings:result.answerSettings,baseUrl:r.gatewayProfile.baseUrl,apiKey:r.gatewayProfile.apiKey});r.gateway.updateAnswerSettings(uid,result.answerSettings);if(r.appliedRevision===oldRevision&&before===withoutAnswers(controller.base(uid)))r.appliedRevision=result.revision;result.answerSettingsApplied=true;controller.appendLog(uid,'INFO','自动答题设置已同步；下一次章节测试或作业开始时应用，当前正在答的试卷保持原设置。');}
   catch{result.answerSettingsApplied=false;controller.appendLog(uid,'WARN','自动答题设置已保存但暂未同步，请重启星蝉后应用。');}
  }
  return result;
 },
 verifyLogin:input=>loginService.verify(input),
 prepareBrowserCacheRemoval:input=>{if(modes.current(input.uid))throw Error('请先在学不通中停止该账号的任务；若正在验证登录，请先完成或关闭验证窗口，再删除缓存。');return browserCacheRemoval.prepare(input);},restoreBrowserCacheRemoval:input=>browserCacheRemoval.restore(input),finishBrowserCacheRemoval:input=>browserCacheRemoval.finish(input),
 openAbout,getConnectionChecks:input=>connectionChecks.snapshot(input),checkConnections:input=>connectionChecks.check(input),
 getApplicationStates:()=>applicationSettings.state(),changeApplicationState:input=>applicationSettings.set(input),installSoutijiang:async()=>{await stopSoutijiangHelpers();return applicationSettings.installSoutijiang();},removeSoutijiang:async()=>{await stopSoutijiangHelpers();return applicationSettings.removeSoutijiang();},
 clearLogs:({uid})=>{require(path.join(lab,'src/controller.cjs')).uidOf(uid);controller.logBuffers.set(uid,[]);return {cleared:true};},
 takeStartupLaunchPlan:()=>{if(startupPlanTaken)return [];startupPlanTaken=true;return Object.entries(workspacePreferences.get().launchPlans).filter(([,plan])=>plan.autoMode!=='off').map(([uid,plan])=>({uid,mode:plan.autoMode}));},
 setPlayback:async({uid,mode,speed})=>{require(path.join(lab,'src/controller.cjs')).uidOf(uid);if(!['browser','xingchan'].includes(mode)||typeof speed!=='number'||!Number.isFinite(speed)||speed<1||speed>(mode==='browser'?16:1000))throw Error('倍速数值无效');if(mode==='xingchan'&&controller.runtimes.get(uid)?.enhanced===false)throw Error('原生模式请在星蝉控制面板中设置倍速');const prefs=workspacePreferences.get();prefs.speeds[uid]=speed;workspacePreferences.set(prefs);if(mode==='xingchan'){const runtime=controller.runtimes.get(uid);if(runtime?.loggedIn)await controller.request(runtime,'PUT','/api/integration/playback',{beisu:speed});}return {speed,applies:mode==='browser'?'immediate':'next_video'};},
 finishClose:async()=>{if(quitting)return true;quitting=true;await defaultComponents.dispose();await loginService.dispose();await soutijiang.dispose();await controller.dispose();await Promise.all([...windows.entries()].map(([uid,win])=>closePanel(uid,win)));trayLifecycle.dispose();app.exit(0);return true;},
 getStarMonitor:input=>starMonitor.snapshot(input),starTaskAction:input=>starMonitor.action(input),
 confirmClose:async(input,event)=>{
   const rendererBrowsers=Number.isSafeInteger(input?.browserCount)&&input.browserCount>0?Math.min(10000,input.browserCount):0;
   if(!modes.anyActive()&&!rendererBrowsers)return true;
   const counts={browser:0,xingchan:0,verification:0};for(const lease of modes.leases.values())counts[lease.mode]=(counts[lease.mode]||0)+1;
   const result=await themedDialog.showMessageBox(BrowserWindow.fromWebContents(event.sender),{type:'question',title:'关闭 学不通',message:'仍有账号正在运行，是否关闭软件？',detail:'浏览器 '+Math.max(counts.browser,rendererBrowsers)+' 个，星蝉 '+Math.max(counts.xingchan,controller.runtimes.size)+' 个，登录验证 '+counts.verification+' 个。关闭后将结束这些账号的运行，已保存配置和课程进度保留。',buttons:['继续运行','关闭软件'],defaultId:0,cancelId:0,noLink:true});return result.response===1;
 },
 cloneAccountSettings:async input=>{await saveNativePanel(input.sourceUid,windows.get(input.sourceUid));return accountSettings.clone(input);},removeAccountSettings:async input=>{if(modes.current(input.uid))throw Error('请先停止此账号的任务，再删除账号。');await soutijiang.stop(input.uid);return accountSettings.remove(input);},
 start:async(input)=>{
  if(!controller.getSettings(input).starEligible)throw Error('星蝉仅支持学习通账号，请先选择超星登录方式并填写账号密码。');
  const result=await modes.start(input),runtime=controller.runtimes.get(input.uid),prefs=workspacePreferences.get();
  if(runtime?.loggedIn&&runtime.enhanced!==false&&prefs.speeds[input.uid]!==undefined)await controller.request(runtime,'PUT','/api/integration/playback',{beisu:prefs.speeds[input.uid]});
  if(runtime?.loggedIn&&prefs.launchPlans[input.uid]?.autoRunStar&&!runtime.autoRunApplied){
   runtime.autoRunApplied=true;
   if(runtime.enhanced===false){controller.appendLog(input.uid,'INFO','原生模式的课程与执行设置由原生面板管理，请在控制面板中开始任务。');return result;}
   const deadline=Date.now()+30000;let progress;
   do{progress=await controller.request(runtime,'GET','/api/integration/monitor-progress');if(progress.queue.restore_ready)break;await new Promise(resolve=>setTimeout(resolve,250));}while(Date.now()<deadline);
   if(progress?.queue.restore_ready&&progress.queue.course_total>0){await starMonitor.action({uid:input.uid,action:'start'});controller.appendLog(input.uid,'INFO','已按账号设置自动开始保存的课程队列。');}
   else controller.appendLog(input.uid,'INFO',progress?.queue.course_total?'课程列表尚未恢复就绪，本次未自动开始。':'已启用自动刷课，但课程列表为空，本次未开始。');
  }
  return result;
 },stop:input=>modes.stop(input),claimBrowser:input=>modes.claimBrowser(input),releaseBrowser:input=>modes.releaseBrowser(input),
 getWorkspacePreferences:()=>workspacePreferences.get(),saveWorkspacePreferences:input=>workspacePreferences.set(input),
 exportConfig:async(input,event)=>{
  await Promise.all([...windows.entries()].map(([uid,win])=>saveNativePanel(uid,win)));
  const snapshot=getTransfer().snapshot(input.ocs);
  const result=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'导出完整配置',defaultPath:'学不通配置_'+(()=>{const d=new Date();return String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');})()+'.ocsdata',filters:[{name:'学不通 / OCS 配置',extensions:['ocsdata']}]});
  if(result.canceled||!result.filePath)return {saved:false};
  const file=/\.ocsdata$/i.test(result.filePath)?result.filePath:result.filePath+'.ocsdata';
  fs.writeFileSync(file+'.tmp',JSON.stringify(snapshot,null,2),'utf8');fs.renameSync(file+'.tmp',file);return {saved:true};
 },
 importConfig:async(input,event)=>{
  if(modes.anyActive())throw Error('请先在学不通中停止所有浏览器和星蝉任务，并结束正在进行的登录验证，再导入配置。');
  let file=input?.filePath;
  if(file!==undefined){if(typeof file!=='string'||!path.isAbsolute(file)||!/^\.ocsdata$/i.test(path.extname(file)))throw Error('请拖入一个有效的 .ocsdata 配置文件。');}
  else{const result=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'导入学不通或 OCS 配置',properties:['openFile'],filters:[{name:'学不通 / OCS 配置',extensions:['ocsdata','json']}]});if(result.canceled||!result.filePaths?.length)return {applied:false};file=result.filePaths[0];}
  const stat=fs.statSync(file);if(!stat.isFile())throw Error('请选择配置文件，不能导入文件夹。');if(stat.size>64*1024*1024)throw Error('配置文件超过 64 MB');
  const transfer=getTransfer(),text=fs.readFileSync(file,'utf8'),validated=transfer.parse(text,{preserveScriptRefs:true});
  const source=JSON.parse(text.replace(/^\uFEFF/,''));source.render=validated.render;if(source.render.setting?.launchOptions?.executablePath===path.join(lab,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'))source.render.setting.launchOptions.executablePath='$BUNDLED_BROWSER';
  for(const [uid,profile]of Object.entries(source.fusion?.profiles||{}))profile.clientEnvironment=validated.data.profiles[uid].clientEnvironment;
  const native=require('./lib/src/store'),current=transfer.snapshot({...native.store.store,render:native.getDecryptedRenderData()});
  const baseline=require(path.join(lab,'src/initialize-config.cjs')).prepareNativeConfig({},native.OriginalAppStore,{vault:{isEncryptionAvailable:()=>false},browserPath:path.join(lab,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),installRoot:lab}).value;
  baseline.render=require(path.join(lab,'src/import-normalization.cjs')).normalizeRender(baseline.render);
  const defaults=transfer.snapshot(baseline);defaults.fusion.workspace=require(path.join(lab,'src/workspace-preferences.cjs')).normalize();defaults.fusion.applicationSettings={schema:1,items:{}};defaults.fusion.windowSizes={};
  const merge=require(path.join(lab,'src/config-merge.cjs')).prepare(current,source,{defaults});
  const decision=await event.sender.executeJavaScript('window.FusionImportConflicts.choose('+JSON.stringify({conflicts:merge.conflicts,newAccounts:merge.newAccounts})+')');
  if(decision.canceled)return {applied:false};
  const plan=transfer.parse(JSON.stringify(merge.finish(decision.decisions)));
  await stopSoutijiangHelpers();
  return {applied:true,...transfer.apply(plan)};
 }
};
function isLabSender(event){const u=event.senderFrame?.url||'';return u.startsWith(publicRootUrl);}
ipcMain.handle('xingchan-poc:focus-main',event=>{if(!isLabSender(event))throw Error('仅允许融合版主页面');const win=BrowserWindow.fromWebContents(event.sender);if(win&&!win.isDestroyed()){win.show();win.focus();}return true;});
for(const method of allowed)ipcMain.handle('xingchan-poc:'+method,async(event,payload)=>{
  if(!isLabSender(event))throw Error('仅允许学不通主页面调用此接口');
  try{await ready;return await (handlers[method]?handlers[method](payload||{},event):controller[method](payload||{}));}catch(err){throw Error(String(err.message||'融合接口失败').replace(/([?&](?:key|token|t)=)[^&\s]+/gi,'$1[隐藏]'));}
});
const filteredSessions=new WeakSet();
const observedWindows=new WeakSet();
app.on('web-contents-created',(_event,contents)=>{
  if(!filteredSessions.has(contents.session)){
    filteredSessions.add(contents.session);
    const nativeSession=contents.session===session.defaultSession;
    contents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,done)=>{
      let local=false;try{local=['127.0.0.1','localhost','[::1]'].includes(new URL(details.url).hostname);}catch{}
      done({cancel:nativeSession?false:!local});
    });
  }
  contents.on('did-finish-load',async()=>{
    const url=contents.getURL();if(!url.startsWith(publicRootUrl))return;
    await ready;
    const mainWindow=BrowserWindow.fromWebContents(contents);
    if(mainWindow&&!observedWindows.has(mainWindow)){
      observedWindows.add(mainWindow);trayLifecycle.attach(mainWindow);windowSizes.attachElectron(mainWindow,{root:lab,key:'main',screen});
      mainWindow.__fusionHandleClose=event=>{void trayLifecycle.closeWindow(mainWindow,event).catch(reportMainError);};
      const notify=()=>{if(!contents.isDestroyed())contents.executeJavaScript('window.__fusionWindowVisible='+JSON.stringify(mainWindow.isVisible()&&!mainWindow.isMinimized())+';window.dispatchEvent(new Event("fusionvisibility"));').catch(()=>{});};
      for(const type of ['show','hide','minimize','restore'])mainWindow.on(type,notify);
    }
    const bridge=`Object.defineProperty(window,'__xingchanFusionPublicRoot',{value:${JSON.stringify(publicRootUrl)},writable:false});window.xingchanBridge=Object.freeze({apiVersion:1,${allowed.map(method=>`${method}:(payload)=>require('electron').ipcRenderer.invoke('xingchan-poc:${method}',payload)`).join(',')}});`;
    await contents.executeJavaScript(bridge+';void 0;');
    await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','automation-config.js'),'utf8')+'\n;void 0;');
    await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','login-profiles.js'),'utf8')+'\n;void 0;');
    await contents.executeJavaScript(versionInfoScript);
    await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','version-ui.js'),'utf8'));
    const uiRoot=path.join(lab,'src','ocs-ui');
    await contents.insertCSS(fs.readFileSync(path.join(lab,'src/dialogs.css'),'utf8'));
    for(const file of ['dialogs.js','answer-settings.js','account-tags.js','ai-config.js','ai-providers.js','provider-config-ui.js','client-environment.js','enrollment-year.js','import-conflicts.js','account-form.js'])await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src',file),'utf8')+'\n;void 0;');
    const js=path.join(uiRoot,'renderer.js');const css=path.join(uiRoot,'renderer.css');
    if(fs.existsSync(css))await contents.insertCSS(fs.readFileSync(css,'utf8'));
    await contents.insertCSS(fs.readFileSync(path.join(lab,'src','workspace-ui.css'),'utf8'));
    await contents.insertCSS(fs.readFileSync(path.join(lab,'src','application-ui.css'),'utf8'));
    await contents.insertCSS(fs.readFileSync(path.join(lab,'src','getting-started.css'),'utf8'));
    await contents.insertCSS(fs.readFileSync(path.join(lab,'src','native-notifications.css'),'utf8'));
    await contents.insertCSS(fs.readFileSync(path.join(lab,'src','account-checks-ui.css'),'utf8'));
    if(fs.existsSync(js)) {
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','question-bank-config.js'),'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(js,'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','credential-sync.js'),'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','account-order.js'),'utf8')+'\n;void 0;');
      for(const file of ['monitor-layout.js','launch-plans-ui.js','application-ui.js','ocs-plugins-ui.js','getting-started.js','first-use-setup.js'])await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src',file),'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'star-runtime','web','dist','scroll-follow.js'),'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'star-runtime','web','dist','task-state.js'),'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','star-monitor-ui.js'),'utf8')+'\n;void 0;');
      await contents.executeJavaScript(fs.readFileSync(path.join(lab,'src','workspace-ui.js'),'utf8')+'\n;void 0;');
      await contents.executeJavaScript('window.XingchanOCSPoC.install({enableBrowserLaunchHook:true});void 0;');
    }
    await contents.executeJavaScript(`document.title='学不通';document.documentElement.dataset.xingchanFusion='true';`);
    mainInitialized=true;
  });
});
app.on('before-quit',event=>{if(quitting)return;event.preventDefault();const main=BrowserWindow.getAllWindows().find(win=>!win.isDestroyed()&&win.webContents.getURL().startsWith(publicRootUrl));if(main){trayLifecycle.exit();return;}if(!modes.anyActive())handlers.finishClose();});
