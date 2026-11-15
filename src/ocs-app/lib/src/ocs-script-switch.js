'use strict';
const fs=require('node:fs'),path=require('node:path');
const MANAGERS={ndcooeababalnlpkfedmmbbbgkljhpjf:{kind:'scriptcat',page:'/src/options.html'},dhdgffkkebhmkfjojejmpbldmpobfkfo:{kind:'tampermonkey',page:'/options.html'}};
// Both adapters call the manager's existing enable action. They do not edit
// extension files, unregister unrelated scripts, or change global preferences.
async function managerOperation({kind,action,uuid,enabled}){
 const call=data=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('脚本管理器未响应')),5000);
  const done=result=>{clearTimeout(timer);const error=chrome.runtime.lastError;if(error)return reject(Error('脚本管理器调用失败'));if(!result||result.error||result.code)reject(Error('脚本管理器拒绝操作'));else resolve(result);};
  try{if(kind==='scriptcat')chrome.runtime.sendMessage(data,done);else if(typeof window.sendMessage==='function')window.sendMessage(data,done);else{clearTimeout(timer);reject(Error('油猴接口尚未就绪'));}}catch(error){clearTimeout(timer);reject(error);}
 });
 if(action==='set'){
  if(typeof uuid!=='string'||!uuid||typeof enabled!=='boolean')throw Error('脚本启停参数无效');
  await call(kind==='scriptcat'?{action:'serviceWorker/script/enable',data:{uuid,enable:enabled}}:{method:'modifyScriptOptions',uuid,enabled,reload:false});return true;
 }
 const result=await call(kind==='scriptcat'?{action:'serviceWorker/script/getAllScripts'}:{method:'loadTree',referrer:'options.scripts'});
 if(kind==='scriptcat'){
  if(!Array.isArray(result.data))throw Error('脚本猫返回了未知列表格式');
  const registered=new Set((await chrome.userScripts.getScripts()).map(s=>s.id));
  return result.data.filter(s=>s?.name==='OCS 网课助手'&&s.namespace==='https://enncy.cn').map(s=>({uuid:s.uuid,enabled:s.status===1,registered:registered.has(s.uuid)}));
 }
 if(!Array.isArray(result.items))throw Error('油猴返回了未知列表格式');
 const scripts=[];
 function visit(items){for(const item of items){if(item?.name==='OCS 网课助手'&&item.namespace==='https://enncy.cn'&&typeof item.uuid==='string'&&typeof item.enabled==='boolean')scripts.push({uuid:item.uuid,enabled:item.enabled});if(Array.isArray(item?.items))visit(item.items);}}
 visit(result.items);return scripts;
}
function readReceipt(file){
 if(!fs.existsSync(file))return {schema:1,suspended:[]};
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(data.schema!==1||!Array.isArray(data.suspended)||data.suspended.length>200||data.suspended.some(x=>!MANAGERS[x?.manager]||typeof x.uuid!=='string'||!x.uuid||x.uuid.length>160))throw Error('脚本切换记录无效，请保留账号数据并检查');
 return data;
}
function saveReceipt(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);}
async function apply(context,{managers=[],enabled,receiptFile}){
 if(typeof enabled!=='boolean'||!receiptFile)throw Error('脚本切换参数无效');
 const receipt=readReceipt(receiptFile),results=[];
 for(const item of managers.filter(x=>x.applied&&x.requestedEnabled&&x.enabled)){
  if(!/^(scriptcat|tampermonkey)(?:[-_].*)?$/i.test(item.id))continue;
  const manager=MANAGERS[item.chromeId];
  if(!manager)throw Error('当前脚本管理器无法验证 OCS 启停，已停止启动，避免两个脚本同时运行');
  if(enabled&&!receipt.suspended.some(x=>x.manager===item.chromeId))continue;
  const page=await context.newPage();
  try{
   await page.goto('chrome-extension://'+item.chromeId+manager.page,{waitUntil:'domcontentloaded',timeout:8000});
   if(manager.kind==='tampermonkey')await page.waitForFunction(()=>typeof window.sendMessage==='function',{},{timeout:5000});
   const read=()=>page.evaluate(managerOperation,{kind:manager.kind,action:'list'}),scripts=await read();
   const targets=scripts.filter(script=>enabled?!script.enabled&&receipt.suspended.some(x=>x.manager===item.chromeId&&x.uuid===script.uuid):script.enabled);
   for(const script of targets){
    if(!enabled&&!receipt.suspended.some(x=>x.manager===item.chromeId&&x.uuid===script.uuid)){receipt.suspended.push({manager:item.chromeId,uuid:script.uuid});saveReceipt(receiptFile,receipt);}
    await page.evaluate(managerOperation,{kind:manager.kind,action:'set',uuid:script.uuid,enabled});
   }
   const settled=after=>(enabled||!after.some(s=>s.enabled||s.registered===true))&&targets.every(s=>{const state=after.find(x=>x.uuid===s.uuid);return state?.enabled===enabled&&(manager.kind!=='scriptcat'||state.registered===enabled);});
   let after=await read();
   for(let attempt=0;attempt<30&&!settled(after);attempt++){await page.waitForTimeout(100);after=await read();}
   if(!settled(after))throw Error('OCS 脚本启停未通过核验，已停止启动');
   if(enabled){receipt.suspended=receipt.suspended.filter(x=>x.manager!==item.chromeId);saveReceipt(receiptFile,receipt);}
   results.push({manager:item.id,changed:targets.length,enabled});
  }finally{await page.close().catch(()=>{});}
 }
 return {applied:true,results};
}
module.exports={apply,managerOperation,readReceipt,MANAGERS};
