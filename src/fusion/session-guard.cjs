'use strict';
// These are message semantics, not guessed platform status codes. A normal
// login timeout, HTTP 401/403 or risk challenge is not a displaced session.
const DOMAINS=Object.freeze({chaoxing:['chaoxing.com','chaoxing.com.cn','xuexitong.com'],zhihuishu:['zhihuishu.com'],zjy:['zjy2.icve.com.cn','zjy.icve.com.cn'],icve:['icve.com.cn'],icourse:['icourse163.org']});
function platformOf(url){try{const host=new URL(url).hostname.toLowerCase();for(const [platform,domains]of Object.entries(DOMAINS))if(domains.some(d=>host===d||host.endsWith('.'+d)))return platform;}catch{}return null;}
function displacementMessage(value){
 if(typeof value!=='string'||value.length>500)return false;
 const text=value.replace(/\s+/g,' ').trim();
 if(!text||/[?？]|(?:如何|假如|如果|例如|示例|可能|防止|避免|若|(?:^|[，。；,;])当(?!前)).{0,35}(?:登录|登陆|下线)/.test(text))return false;
 return /^(?:(?:系统|安全|温馨)?(?:提示|通知)[：:，, ]*)?(?:(?:尊敬的)?用户[，,:： ]*)?(?:您好[，,:： ]*)?(?:(?:您|你)(?:的)?|当前|此|本)?(?:账号|帐号|账户).{0,12}(?:(?:已|已经)(?:在|于)(?:另一|其他|其它|别的).{0,12}(?:设备|终端|电脑|客户端|地点).{0,8}(?:登录|登陆)|(?:已|已经)?被(?:挤|踢|顶)(?:掉|出)?下线)/.test(text)
  || /^(?:您|你)(?:的账号|的帐号|的账户)?(?:已|已经)在(?:其他|其它|另一|别的).{0,8}(?:设备|终端|电脑|客户端)(?:上)?(?:登录|登陆)/.test(text)
  || /^(?:当前|您|你)(?:的)?(?:登录|登陆|会话).{0,8}(?:已|已经)?被(?:其他|其它|另一|别的).{0,12}(?:登录|登陆|会话)(?:替换|终止|结束)/.test(text)
  || /^(?:(?:notice|warning)\s*:\s*)?(?:your|this|the current) (?:account|session) (?:has been |was |is )(?:logged (?:in|on) (?:on|from) (?:an? )?(?:another|different|other) device|(?:replaced|terminated) (?:by|due to) another (?:login|session))/i.test(text);
}
function responseMessage(body,status=200){
 if(typeof body==='string')return status>=400&&displacementMessage(body)?body:null;
 if(!body||Array.isArray(body)||typeof body!=='object')return null;
 const failed=status>=400||body.success===false||body.result===false||body.status===false||body.ok===false||body.error===true||typeof body.error==='string'||(body.code!==undefined&&![0,200,'0','200','SUCCESS','success'].includes(body.code));
 if(!failed)return null;
 for(const value of [body.message,body.msg,body.errorMessage,body.error_description,body.error,body.error?.message,body.data?.message,body.data?.msg])if(displacementMessage(value))return value;
 return null;
}
function classify({url,message,body,status=200,source='response'}={}){
 const platform=platformOf(url);if(!platform)return null;
 if(!(source==='response'?responseMessage(body,status):displacementMessage(message)))return null;
 return {reason:'concurrent-login',platform,source:source==='response'?'response':source==='dialog'?'dialog':'notice'};
}
class SessionGuard{
 constructor({controller,modes,stopBrowser,notify=()=>{},nameOf=uid=>uid}){Object.assign(this,{controller,modes,stopBrowser,notify,nameOf});this.incidents=new Map();this.seen=new Set();this.revision=0;}
 snapshot(){return {revision:this.revision,items:[...this.incidents.values()].map(item=>({...item}))};}
 acknowledge(revision){if(!Number.isSafeInteger(revision))return false;for(const [key,item]of this.incidents)if(item.revision<=revision)this.incidents.delete(key);return true;}
 publish(){try{Promise.resolve(this.notify(this.snapshot())).catch(()=>{});}catch{}}
 reportBrowser({uid,leaseId,reason,platform,source}){
  const lease=this.modes.leases.get(uid);if(lease?.mode!=='browser'||lease.id!==leaseId||reason!=='concurrent-login'||!Object.hasOwn(DOMAINS,platform))return false;
  this.report({uid,mode:'browser',key:leaseId,stop:()=>this.stopBrowser({uid,leaseId}),platform});return true;
 }
 handleStar(runtime,event){
  if(event?.type!=='integration.session-displaced'||event.payload?.reason!=='concurrent-login')return false;
  if(!runtime||this.controller.runtimes.get(runtime.uid)!==runtime||runtime.stopping||runtime.exited)return true;
  runtime.sessionDisplaced=true;this.controller.cancelAutomaticRelogin?.(runtime.uid);
  // Keep a per-runtime key. Manual restart creates a fresh runtime and is allowed.
  if(!runtime.sessionGuardId)runtime.sessionGuardId=require('node:crypto').randomUUID();
  this.report({uid:runtime.uid,mode:'xingchan',key:runtime.sessionGuardId,platform:'chaoxing',stop:()=>{if(this.controller.runtimes.get(runtime.uid)===runtime)return this.modes.stop({uid:runtime.uid});}});return true;
 }
 report({uid,mode,key,platform,stop}){
  if(this.seen.has(key))return;this.seen.add(key);
  let name=uid;try{name=this.nameOf(uid)||uid;}catch{}
  const item={id:key,uid,name:String(name).slice(0,150),mode,platform,status:'stopping',revision:++this.revision};
  for(const [previous,incident]of this.incidents)if(incident.uid===uid)this.incidents.delete(previous);
  this.incidents.set(key,item);try{this.controller.appendLog?.(uid,'WARN','检测到账号在其他设备登录，正在停止该账号任务并取消自动重新登录。多次操作会导致账号风控。');}catch{}this.publish();
  Promise.resolve().then(stop).then(()=>{item.status='stopped';},()=>{item.status='failed';try{this.controller.appendLog?.(uid,'ERROR','账号任务停止未完成，请在主窗口停止此账号。');}catch{}}).finally(()=>{if(this.incidents.get(key)===item){item.revision=++this.revision;this.publish();}});
 }
}
module.exports={DOMAINS,platformOf,displacementMessage,responseMessage,classify,SessionGuard};
