'use strict';
const crypto=require('node:crypto'),Login=require('./login-profiles.js'),Order=require('./account-order.js');
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const stable=value=>JSON.stringify(function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}(value));
function flatten(tree){const out=new Map();function walk(item){out.set(item.uid,item);for(const child of Object.values(item.children||{}))walk(child);}walk(tree);return out;}
function identity(item){const p=Login.parse(item.playwrightScripts);return !['none','ambiguous'].includes(p.kind)&&p.username?JSON.stringify([p.kind,p.username,p.unit||'']):null;}
function accountView(document,item){const p=document.fusion||{};return {账号:{名称:item.name,备注:item.notes,标签:item.tags,自动登录:item.playwrightScripts},搜题设置:p.profiles?.[item.uid],控制面板:p.runtimeSettings?.[item.uid],原生星蝉:p.nativeStar?.[item.uid],面板布局:p.htmlPreferences?.[item.uid],窗口大小:{browser:p.windowSizes?.['browser-'+item.uid],panel:p.windowSizes?.['panel-'+item.uid]},自定义照片:p.accountAssets?.[item.uid],启动计划:p.workspace?.launchPlans?.[item.uid],手动倍速:p.workspace?.speeds?.[item.uid]};}
function diff(before,after){
 const rows=[];
 function display(value,path){if(value===undefined)return '（没有此项）';if(typeof value==='string'&&/^(?:.*key|.*token|secret|authorization)$/i.test(path.split(' / ').at(-1)))return value?value.length>8?value.slice(0,4)+'…'+value.slice(-4):'已设置':'（空）';return typeof value==='string'?value:JSON.stringify(value,null,2);}
 function walk(a,b,path){if(path.endsWith('questionBankConfig')){try{a=JSON.parse(a||'[]');b=JSON.parse(b||'[]');}catch{}}const object=v=>v&&typeof v==='object';if((object(a)||object(b))&&(a===undefined||object(a))&&(b===undefined||object(b))){const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);if(keys.size){for(const key of keys)walk(a?.[key],b?.[key],path?path+' / '+key:key);return;}}rows.push({path:path||'配置',before:display(a,path),after:display(b,path),equal:stable(a)===stable(b)});}
 walk(before,after,'');return rows;
}
// Give each embedded script content its own reference before conflict decisions.
// Two exports may reuse a filesystem path while containing different script code.
function bindAssets(document){
 document=copy(document);const refs=new Map();
 for(const asset of document.fusion?.assets||[]){const previous=refs.get(asset.ref);if(previous&&previous.sha256!==asset.sha256)throw Error('同一本地脚本引用包含不同内容，无法确定应导入的版本');refs.set(asset.ref,asset);}
 for(const script of document.render.scripts||[])for(const object of [script,script.info])if(object)for(const key of ['url','code_url']){const asset=refs.get(object[key]);if(asset)object[key]='fusion-asset:'+asset.sha256;}
 for(const asset of document.fusion?.assets||[])asset.ref='fusion-asset:'+asset.sha256;
 return document;
}
function hasCustomDifference(before,after,defaults){
 if(stable(before)===stable(after)||before===undefined||before===null||before===''||stable(before)===stable(defaults))return false;
 if(Array.isArray(before))return before.length>0;
 if(typeof before==='object')return Object.keys(before).some(key=>hasCustomDifference(before[key],after?.[key],defaults?.[key]));
 return true;
}
function prepare(current,incoming,{defaults}={}){
 current=bindAssets(current);incoming=bindAssets(incoming);defaults=defaults?bindAssets(defaults):{};
 // System-derived theme state and onboarding flags are not user configuration conflicts.
 for(const document of [current,incoming,defaults])if(document.render?.setting?.theme?.mode==='system')delete document.render.setting.theme.dark;
 const oldTree=flatten(current.render.browser.root),newTree=flatten(incoming.render.browser.root),mapping=new Map(),conflicts=[],actions=[];
 const byIdentity=new Map();for(const item of oldTree.values())if(item.type==='browser'){const key=identity(item);if(key)byIdentity.set(key,byIdentity.has(key)?null:item);}
 const conflict=(id,label,before,after,apply)=>{if(stable(before)===stable(after))return;conflicts.push({id,label,rows:diff(before,after)});actions.push({id,apply});};
 const mergeDefault=(id,label,before,after,baseline,apply)=>{if(stable(before)===stable(after))return;if(hasCustomDifference(before,after,baseline))conflict(id,label,before,after,apply);else apply();};
 const target=copy(current);target.fusion??={format:'ocs-xingchan-settings',schema:1};
 for(const key of ['profiles','runtimeSettings','accountAssets','htmlPreferences','nativeStar'])target.fusion[key]??={};
 target.fusion.windowSizes??={};target.fusion.workspace??={};target.fusion.workspace.launchPlans??={};target.fusion.workspace.speeds??={};
 const dest=flatten(target.render.browser.root),allocated=new Set(dest.keys());mapping.set(incoming.render.browser.root.uid,target.render.browser.root.uid);
 function newId(id){if(!allocated.has(id)){allocated.add(id);return id;}let next;do{next=crypto.randomBytes(16).toString('hex');}while(allocated.has(next));allocated.add(next);return next;}
 for(const item of newTree.values())if(item.type==='folder')mapping.set(item.uid,oldTree.get(item.uid)?.type==='folder'?item.uid:newId(item.uid));
 const replacements=new Map();
 for(const item of newTree.values())if(item.type==='browser'){
  const old=oldTree.get(item.uid)?.type==='browser'?oldTree.get(item.uid):byIdentity.get(identity(item));
  if(old&&[...replacements.values()].includes(old.uid))throw Error('导入内容包含指向同一本机账号的重复项，请先合并导入文件中的账号。');
  const id=old?old.uid:newId(item.uid);mapping.set(item.uid,id);if(old)replacements.set(item.uid,id);
 }
 function ensureFolder(uid){if(dest.has(uid))return dest.get(uid);const item=[...newTree.values()].find(i=>i.type==='folder'&&mapping.get(i.uid)===uid);if(!item)return target.render.browser.root;const folder={...copy(item),uid,children:{},parent:mapping.get(item.parent)||target.render.browser.root.uid};const parent=ensureFolder(folder.parent);parent.children[uid]=folder;dest.set(uid,folder);return folder;}
 function put(item,old){const uid=mapping.get(item.uid),next={...copy(item),uid,parent:old?old.parent:mapping.get(item.parent)||target.render.browser.root.uid};if(old)next.cachePath=old.cachePath;const parent=ensureFolder(next.parent);parent.children[uid]=next;dest.set(uid,next);
  for(const key of ['profiles','runtimeSettings','accountAssets','htmlPreferences','nativeStar']){const value=incoming.fusion?.[key]?.[item.uid];if(value!==undefined)target.fusion[key][uid]=copy(value);else if(incoming.fusion)delete target.fusion[key][uid];}
  for(const kind of ['browser','panel']){const value=incoming.fusion?.windowSizes?.[kind+'-'+item.uid];if(value!==undefined)target.fusion.windowSizes[kind+'-'+uid]=copy(value);}
  for(const key of ['launchPlans','speeds']){const value=incoming.fusion?.workspace?.[key]?.[item.uid];if(value!==undefined)target.fusion.workspace[key][uid]=copy(value);else if(incoming.fusion)delete target.fusion.workspace[key][uid];}
 }
 for(const item of newTree.values())if(item.type==='browser'){
  const old=replacements.has(item.uid)?oldTree.get(replacements.get(item.uid)):null;
  if(!old)put(item,null);else conflict('account:'+item.uid,'账号：'+(old.notes||old.name),accountView(current,old),accountView(incoming,item),()=>put(item,old));
 }
 for(const [sourceUid,ids]of Object.entries(incoming.render.browser.accountOrders||{})){
  const uid=mapping.get(sourceUid),group=dest.get(uid);if(!group||group.type==='browser'||!Array.isArray(ids))continue;
  const children=Object.values(group.children),allowed=new Set(children.filter(item=>item.type==='browser').map(item=>item.uid));
  const imported=[...new Set(ids.map(id=>mapping.get(id)).filter(id=>allowed.has(id)))];if(!imported.length)continue;
  const selected=new Set(imported),before=Order.ordered(children,target.render.browser.accountOrders?.[uid]).filter(item=>item.type==='browser').map(item=>item.uid);
  // Replace only imported account slots; unrelated local accounts keep their places and relative order.
  let index=0;const after=before.map(id=>selected.has(id)?imported[index++]:id);
  const oldIds=new Set(Object.values(oldTree.get(uid)?.children||{}).filter(item=>item.type==='browser').map(item=>item.uid));
  const currentCommon=before.filter(id=>oldIds.has(id)&&selected.has(id)),incomingCommon=imported.filter(id=>oldIds.has(id));
  const apply=()=>{target.render.browser.accountOrders??={};target.render.browser.accountOrders[uid]=after;};
  if(stable(currentCommon)===stable(incomingCommon))apply();
  else{const describe=ids=>ids.map(id=>({名称:dest.get(id)?.name||'未命名账号',标识:id}));conflict('account-order:'+uid,'账号排序：'+(group.name||'根目录'),describe(before),describe(after),apply);}
 }
 const flags=['fusionDefaultSetupPromptPending','fusionBundledScriptSeeded','fusionEncryptionDefaultApplied'];
 const appSettings=app=>app&&Object.fromEntries(Object.entries(app).filter(([key])=>!flags.includes(key)));
 const categories=[['setting','软件设置',current.render.setting,incoming.render.setting,defaults.render?.setting,v=>target.render.setting=v],['languages','界面自定义语言',current.render.langs,incoming.render.langs,defaults.render?.langs,v=>target.render.langs=v],['window','窗口设置',current.window,incoming.window,defaults.window,v=>target.window=v],['app','应用设置',appSettings(current.app),appSettings(incoming.app),appSettings(defaults.app),v=>target.app={...v,...Object.fromEntries(flags.filter(key=>Object.hasOwn(current.app||{},key)).map(key=>[key,current.app[key]]))}],['applications','应用开关',current.fusion?.applicationSettings,incoming.fusion?.applicationSettings,defaults.fusion?.applicationSettings,v=>target.fusion.applicationSettings=v]];
 for(const [id,label,before,after,baseline,set]of categories)if(after!==undefined)mergeDefault(id,label,before,after,baseline,()=>set(copy(after)));
 // Scripts merge by their stable ID or source identity, instead of replacing unrelated scripts.
 target.render.scripts??=[];const scriptId=s=>s.uid||s.id||s.info?.code_url||s.url||JSON.stringify([s.info?.namespace,s.info?.name]);
 const baselineScripts=defaults.render?.scripts||[],isOCS=require('./bundled-script.cjs').isOCSScript;
 for(const script of incoming.render.scripts||[]){const id=scriptId(script);let index=target.render.scripts.findIndex(s=>scriptId(s)===id);if(index<0&&isOCS(script))index=target.render.scripts.findIndex(s=>isOCS(s)&&baselineScripts.some(b=>stable(b)===stable(s)));if(index<0)target.render.scripts.push(copy(script));else{const before=target.render.scripts[index],baseline=baselineScripts.find(s=>scriptId(s)===scriptId(before));mergeDefault('script:'+id,'脚本：'+(script.info?.name||script.name||id),before,script,baseline,()=>{target.render.scripts[index]=copy(script);});}}
 if(incoming.fusion?.assets){target.fusion.assets??=[];const refs=new Map(target.fusion.assets.map(a=>[a.sha256,a]));for(const asset of incoming.fusion.assets)refs.set(asset.sha256,copy(asset));target.fusion.assets=[...refs.values()];}
 for(const [key,value]of Object.entries(incoming.fusion?.workspace||{}))if(!['launchPlans','speeds','cardOrder','guideDismissed','trayNoticeAccepted'].includes(key))mergeDefault('workspace:'+key,'监控设置：'+key,current.fusion?.workspace?.[key],value,defaults.fusion?.workspace?.[key],()=>{target.fusion.workspace[key]=copy(value);});
 if(incoming.fusion?.windowSizes?.main)mergeDefault('windowSizes:main','主窗口大小',current.fusion?.windowSizes?.main,incoming.fusion.windowSizes.main,defaults.fusion?.windowSizes?.main,()=>{target.fusion.windowSizes.main=copy(incoming.fusion.windowSizes.main);});
 const order=target.fusion.workspace.cardOrder??=[];for(const uid of incoming.fusion?.workspace?.cardOrder||[]){const id=mapping.get(uid);if(id&&!order.includes(id))order.push(id);}
  return {conflicts,newAccounts:[...newTree.values()].filter(i=>i.type==='browser'&&!replacements.has(i.uid)).length,finish(decisions){for(const action of actions){const choice=decisions[action.id];if(!['overwrite','skip'].includes(choice))throw Error('尚未处理全部配置冲突');if(choice==='overwrite')action.apply();}const used=new Set((target.render.scripts||[]).flatMap(s=>[s.url,s.code_url,s.info?.url,s.info?.code_url]));target.fusion.assets=(target.fusion.assets||[]).filter(a=>used.has(a.ref));require('./account-tags.js').repair(target.render.browser);target.render.browser.accountOrders=Order.snapshot(target.render.browser);return target;}};
}
module.exports={prepare,diff,identity,flatten};
