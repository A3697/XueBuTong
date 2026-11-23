'use strict';
// Only the official extension's login state crosses between two environments
// belonging to ONE XueBuTong account. Learning-site data and tokens are excluded.
const crypto=require('node:crypto');
const EXTENSION_ID='egfkhocobmgeafdbjbphhfdfbmlobgdc';
const KEYS=['userInfo','isVp','dxuss','pcuid','sourceAppId'].map(key=>'college_ai_'+key);
const COOKIE_NAMES=['DXUSS','ZYBUSS','pcuid'];
const DOMAINS=['daxuesoutijiang.com','zuoyebang.com'];
function allowedCookie(cookie){return cookie&&typeof cookie.domain==='string'&&COOKIE_NAMES.includes(cookie.name)&&DOMAINS.some(domain=>cookie.domain===domain||cookie.domain==='.'+domain||cookie.domain.endsWith('.'+domain));}
function normalize(value){
 if(!value||value.schema!==1||!value.storage||Array.isArray(value.storage)||!Array.isArray(value.cookies)||JSON.stringify(value).length>262144)throw Error('搜题酱登录状态格式无效');
 const storage={};for(const key of KEYS)if(Object.hasOwn(value.storage,key))storage[key]=value.storage[key];
 const cookies=value.cookies.filter(allowedCookie).map(c=>({name:c.name,value:String(c.value),domain:c.domain,path:c.path||'/',secure:!!c.secure,httpOnly:!!c.httpOnly,sameSite:['strict','lax','no_restriction','unspecified'].includes(c.sameSite)?c.sameSite:'no_restriction',...(Number.isFinite(c.expirationDate)?{expirationDate:c.expirationDate}:{})}));
 cookies.sort((a,b)=>(a.domain+a.path+a.name).localeCompare(b.domain+b.path+b.name));return {schema:1,storage,cookies};
}
function user(snapshot){let raw=snapshot?.storage?.college_ai_userInfo;try{if(typeof raw==='string')raw=JSON.parse(raw);}catch{return {loggedIn:false};}return raw&&raw.uid?{loggedIn:true,providerUid:String(raw.uid),name:String(raw.nickname||raw.nickName||raw.uname||raw.name||'大学搜题酱账号').slice(0,80)}:{loggedIn:false};}
function digest(snapshot){const value=normalize(snapshot);for(const cookie of value.cookies)if(cookie.name==='pcuid')delete cookie.expirationDate;return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function identity(snapshot){const u=user(snapshot);return u.loggedIn?crypto.createHash('sha256').update(u.providerUid).digest('hex'):'';}
function loginDigest(snapshot){const value=normalize(snapshot);return crypto.createHash('sha256').update(JSON.stringify({identity:identity(value),dxuss:value.storage.college_ai_dxuss??null,cookies:value.cookies.filter(cookie=>cookie.name!=='pcuid').map(({name,value,domain,path})=>({name,value,domain,path}))})).digest('hex');}
async function target(context){
 const worker=context.serviceWorkers().find(w=>w.url().startsWith('chrome-extension://'+EXTENSION_ID+'/'));
 return worker||context.waitForEvent('serviceworker',{predicate:w=>w.url().startsWith('chrome-extension://'+EXTENSION_ID+'/'),timeout:10000});
}
async function read(context){
 let storage,cookies=[];
 for(let attempt=0;attempt<30;attempt++){
  storage=await (await target(context)).evaluate(keys=>globalThis.chrome?.storage?.local?.get(keys)||null,KEYS).catch(()=>null);
  cookies=(await context.cookies()).filter(allowedCookie).map(c=>({...c,sameSite:{None:'no_restriction',Lax:'lax',Strict:'strict'}[c.sameSite],...(c.expires>0?{expirationDate:c.expires}:{})}));
  if(storage?.college_ai_pcuid&&cookies.some(c=>c.name==='pcuid'))break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!storage)throw Error('搜题酱扩展尚未初始化完成');return normalize({schema:1,storage,cookies});
}
async function apply(context,input){const snapshot=normalize(input);
 await read(context); // Wait for the extension's first-run pcuid initialization.
 // BrowserContext handles HttpOnly cookies consistently in headed/headless
 // Chromium; service-worker worlds do not always expose chrome.cookies.
 const includesDevice=snapshot.cookies.some(c=>c.name==='pcuid');
 for(const cookie of (await context.cookies()).filter(allowedCookie))if(cookie.name!=='pcuid'||includesDevice)await context.clearCookies({name:cookie.name,domain:cookie.domain,path:cookie.path});
 if(snapshot.cookies.length)await context.addCookies(snapshot.cookies.map(c=>({name:c.name,value:c.value,domain:c.domain,path:c.path,secure:c.secure,httpOnly:c.httpOnly,sameSite:{no_restriction:'None',lax:'Lax',strict:'Strict',unspecified:'Lax'}[c.sameSite],...(c.expirationDate?{expires:c.expirationDate}:{})})));
 await (await target(context)).evaluate(async({snapshot,keys})=>{
 // No calls to a login endpoint, and no logout of a different saved account.
 await chrome.storage.local.remove([...keys.filter(key=>key!=='college_ai_pcuid'||snapshot.storage.college_ai_pcuid),'college_ai_sessionId','college_ai_operateType']);
 await chrome.storage.local.set(snapshot.storage);
 let info=snapshot.storage.college_ai_userInfo;try{if(typeof info==='string')info=JSON.parse(info);}catch{info='';}
 for(const tab of await chrome.tabs.query({}))if(tab.id)chrome.tabs.sendMessage(tab.id,{messageType:'getUserInfoByTab',data:info||''},()=>{void chrome.runtime.lastError;});
},{snapshot,keys:KEYS});return user(snapshot);}
module.exports={read,apply,normalize,user,digest,identity,loginDigest,KEYS,COOKIE_NAMES,DOMAINS,EXTENSION_ID};
