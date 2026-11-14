'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const DEFAULT_ROOT=path.resolve(__dirname,'../../../../../');
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id);
const manager=id=>/^(scriptcat|tampermonkey)(?:[-_].*)?$/i.test(id);
const queues=new WeakMap();
function preferences(root){
 const file=path.join(root,'bridge-data/application-settings.json');if(!fs.existsSync(file))return{};
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.schema!==1||!data.items||typeof data.items!=='object'||Array.isArray(data.items)||Object.values(data.items).some(value=>typeof value!=='boolean'))throw Error('应用启用配置无效，已停止加载扩展');
 return data.items;
}
function extensionId(directory,manifest){
 if(manifest.key){
  if(typeof manifest.key!=='string'||!/^[A-Za-z0-9+/=\s]+$/.test(manifest.key))throw Error('扩展公钥格式无效');
  const key=Buffer.from(manifest.key,'base64');if(!key.length)throw Error('扩展公钥为空');
  return digestId(key);
 }
 let absolute=path.resolve(directory);if(process.platform==='win32')absolute=absolute.replace(/^[a-z]:/,value=>value.toUpperCase());
 return digestId(Buffer.from(absolute,process.platform==='win32'?'utf16le':'utf8'));
}
function digestId(bytes){return crypto.createHash('sha256').update(bytes).digest('hex').slice(0,32).replace(/[0-9a-f]/g,value=>String.fromCharCode(97+parseInt(value,16)));}
function inventory(paths,{root=DEFAULT_ROOT}={}){
 root=path.resolve(root);const folder=path.join(root,'ocs-profile/downloads/extensions');
 const source=paths|| (fs.existsSync(folder)?fs.readdirSync(folder).map(id=>path.join(folder,id)):[]);
 const result=[];
 for(const entry of source){
  const directory=path.resolve(entry),id=path.basename(directory);
  if(!valid(id)||path.dirname(directory)!==folder)continue;
  let current=root,unsafe=false;for(const part of path.relative(root,directory).split(path.sep)){
   current=path.join(current,part);try{if(fs.lstatSync(current).isSymbolicLink()){unsafe=true;break;}}catch(error){if(error.code==='ENOENT'){unsafe=true;break;}throw error;}
  }
  if(unsafe)continue;
  try{if(!fs.statSync(directory).isDirectory())continue;const file=path.join(directory,'manifest.json');if(fs.lstatSync(file).isSymbolicLink())continue;const manifest=JSON.parse(fs.readFileSync(file,'utf8'));result.push({id,path:directory,chromeId:extensionId(directory,manifest),manifest});}catch(_){}
 }return result;
}
function enabledPaths(paths,options={}){const root=options.root||DEFAULT_ROOT,prefs=preferences(root);return inventory(paths,{root}).filter(item=>prefs['extensions:'+item.id]!==false).map(item=>item.path);}
function hasEnabledManager(paths,options={}){const root=options.root||DEFAULT_ROOT,prefs=preferences(root);return inventory(paths,{root}).some(item=>manager(item.id)&&prefs['extensions:'+item.id]!==false);}
async function managementSwitch(page,chromeId,enabled){
 return page.evaluate(async ({chromeId,enabled})=>{
  const api=globalThis.chrome?.management;if(!api?.getAll||!api?.setEnabled)return{applied:false,reason:'management_api_unavailable'};
  const call=(name,...args)=>new Promise((resolve,reject)=>{api[name](...args,value=>{const error=globalThis.chrome?.runtime?.lastError;if(error)reject(Error(error.message||'extension_management_failed'));else resolve(value);});});
  try{
   const all=await call('getAll'),found=all.find(item=>item.id===chromeId);
   if(!found)return{applied:!enabled,installed:false,enabled:false,reason:enabled?'extension_not_loaded':''};
   if(found.enabled!==enabled)await call('setEnabled',chromeId,enabled);
   const after=(await call('getAll')).find(item=>item.id===chromeId);
   return{applied:!!after&&after.enabled===enabled,installed:!!after,enabled:!!after?.enabled,reason:after?.enabled===enabled?'':'browser_did_not_apply'};
  }catch(_){return{applied:false,reason:'browser_confirmation_or_restart_required'};}
 },{chromeId,enabled});
}
async function switchInPage(page,item,enabled){
 let result=await managementSwitch(page,item.chromeId,enabled);
 if(result.applied||result.reason==='extension_not_loaded')return result;
 // Playwright's CSS locator crosses Chromium WebUI shadow roots. Clicking
 // the real toggle supplies a browser user gesture if management needs one.
 try{
  const toggle=page.locator('extensions-item#'+item.chromeId+' #enableToggle');
  if(await toggle.count()){
   if(await toggle.evaluate(element=>!!element.checked)!==enabled)await toggle.click({timeout:1500});
   for(let i=0;i<10;i++){
    if(await toggle.evaluate(element=>!!element.checked)===enabled)return{applied:true,installed:true,enabled};
    await page.waitForTimeout(100);
   }
  }
 }catch(_){}
 return result;
}
async function useManagementPage(context,operation){
 if(!context?.newPage)return{applied:false,reason:'browser_not_running'};
 const previous=queues.get(context)||Promise.resolve();
 const pending=previous.catch(()=>{}).then(async()=>{
  let page,timer;try{page=await context.newPage();await page.goto('chrome://extensions/',{waitUntil:'domcontentloaded',timeout:5000});return await Promise.race([operation(page),new Promise(resolve=>{timer=setTimeout(()=>resolve({applied:false,reason:'extension_controls_timed_out'}),8000);})]);}
  catch(_){return{applied:false,reason:'extension_controls_unavailable'};}
  finally{clearTimeout(timer);if(page)await page.close().catch(()=>{});}
 });
 queues.set(context,pending);return pending;
}
async function setEnabled(context,{root=DEFAULT_ROOT,id,enabled}={}){
 if(!valid(id)||typeof enabled!=='boolean')throw Error('扩展开关参数无效');
 const prefs=preferences(root);if((prefs['extensions:'+id]!==false)!==enabled)return{id,enabled,applied:false,restartRequired:true,reason:'preference_mismatch'};
 const item=inventory(undefined,{root}).find(item=>item.id===id);
 if(!item)return{id,enabled,applied:!enabled,restartRequired:enabled,reason:enabled?'extension_not_installed':''};
 const result=await useManagementPage(context,page=>switchInPage(page,item,enabled));
 return{...result,id,chromeId:item.chromeId,requestedEnabled:enabled,restartRequired:!result.applied};
}
async function applyInitial(context,{root=DEFAULT_ROOT,paths}={}){
 // Include disabled directories even when the caller passes filtered launch
 // arguments: an existing Chrome profile can retain an old unpacked extension.
 const prefs=preferences(root),items=inventory(undefined,{root}),results=[];
 if(!items.length)return{applied:true,results,restartRequired:false,hasEnabledManager:false};
 const batch=await useManagementPage(context,async page=>{
  for(const item of items){const enabled=prefs['extensions:'+item.id]!==false;const result=await switchInPage(page,item,enabled);results.push({...result,id:item.id,chromeId:item.chromeId,requestedEnabled:enabled,restartRequired:!result.applied});}
  return{applied:results.every(result=>result.applied)};
 });
 return{applied:!!batch.applied,results,restartRequired:!batch.applied,hasEnabledManager:results.some(result=>manager(result.id)&&result.requestedEnabled&&result.applied&&result.enabled===true)};
}
async function ensureScriptCatRegistration(context,results=[]){
 const id='ndcooeababalnlpkfedmmbbbgkljhpjf';
 if(!results.some(item=>item.chromeId===id&&item.applied&&item.enabled&&item.requestedEnabled))return {checked:false};
 let page;
 const inspect=async()=>{
  if(!page||page.isClosed()){page=await context.newPage();await page.goto('chrome-extension://'+id+'/src/options.html',{waitUntil:'domcontentloaded',timeout:5000});}
  return page.evaluate(async()=>{
   const keys=(await chrome.storage.local.getKeys()).filter(k=>k.startsWith('script:'));
   const items=Object.values(await chrome.storage.local.get(keys)).filter(s=>s?.namespace==='https://enncy.cn'&&s.name==='OCS 网课助手'&&s.status===1);
   if(!items.length)return {ready:true,installed:false};
   const scripts=await chrome.userScripts.getScripts();
   return {ready:items.every(item=>scripts.some(script=>script.id===item.uuid)),installed:true};
  });
 };
 try{
  let result=await inspect();if(result.ready)return {checked:true,...result};
  // Persisted metadata is not proof that Chrome registered a runnable script.
  // Give startup one short grace period, then reload only the affected manager.
  await page.waitForTimeout(400);result=await inspect();if(result.ready)return {checked:true,...result};
  await page.close();page=null;
  const reloaded=await useManagementPage(context,async management=>{
   await management.locator('extensions-item#'+id+' #dev-reload-button').click({timeout:2000});return {applied:true};
  });
  if(!reloaded.applied)return {checked:true,ready:false};
  for(let attempt=0;attempt<12;attempt++){
   try{result=await inspect();if(result.ready)return {checked:true,...result,recovered:true};}catch{if(page)await page.close().catch(()=>{});page=null;}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  return {checked:true,ready:false};
 }catch{return {checked:true,ready:false};}
 finally{if(page)await page.close().catch(()=>{});}
}
module.exports={enabledPaths,applyInitial,setEnabled,hasEnabledManager,extensionId,inventory,preferences,DEFAULT_ROOT,ensureScriptCatRegistration};
