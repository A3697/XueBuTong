'use strict';
const OFFICIAL={ndcooeababalnlpkfedmmbbbgkljhpjf:{kind:'scriptcat',options:'/src/options.html'},dhdgffkkebhmkfjojejmpbldmpobfkfo:{kind:'tampermonkey',options:'/options.html'}};
const instances=new WeakMap();
const supported=item=>!!item&&!!OFFICIAL[item.chromeId]&&new RegExp('^'+OFFICIAL[item.chromeId].kind+'(?:[-_].*)?$','i').test(item.id);
function validPort(port){if(!Number.isInteger(port)||port<1||port>65535||port===15319)throw Error('融合本地服务端口无效');return port;}

// Runs in the enabled manager's extension context, covering both its worker
// fetch and its offscreen-document XHR without modifying extension resources.
async function editRule({extensionId,port,previous,remove=false,accountUid='',configKey='',enhanced=true}){
 if(globalThis.chrome?.runtime?.id!==extensionId)return{applied:false,reason:'unexpected_extension'};
 const api=chrome.declarativeNetRequest;
 if(!api?.getSessionRules||!api?.updateSessionRules)return{applied:false,reason:'session_rules_unavailable'};
 const stable=value=>JSON.stringify((function sort(item){if(Array.isArray(item))return item.map(sort);if(item&&typeof item==='object')return Object.fromEntries(Object.keys(item).sort().map(key=>[key,sort(item[key])]));return item;})(value));
 const call=(name,value)=>new Promise((resolve,reject)=>{const done=result=>{const error=chrome.runtime.lastError;if(error)reject(Error('local_port_rule_failed'));else resolve(result);};try{if(value===undefined)api[name](done);else api[name](value,done);}catch{reject(Error('local_port_rule_failed'));}});
 try{
  const existing=await call('getSessionRules');
  const owned=previous&&existing.find(rule=>rule.id===previous.id&&stable(rule)===stable(previous));
  if(remove){if(owned)await call('updateSessionRules',{removeRuleIds:[owned.id]});return{applied:true,removed:!!owned};}
  if(!Number.isInteger(port)||port<1||port>65535||port===15319)return{applied:false,reason:'invalid_port'};
  const used=new Set(existing.map(rule=>rule.id));let id=owned?.id||20102710;
  if(!owned)while(used.has(id)&&id<20112710)id++;
  if(used.has(id)&&!owned)return{applied:false,reason:'rule_ids_unavailable'};
  const rule={id,priority:100000,action:{type:'redirect',redirect:{regexSubstitution:'http://127.0.0.1:'+port+'/\\1'+(accountUid?'?uid='+encodeURIComponent(accountUid)+'&configKey='+encodeURIComponent(configKey)+(enhanced?'':'&ocsMode=official'):'')}},condition:{regexFilter:'^http://localhost:15319/(get-actions-key|browser|is-browser-config-sync)$',isUrlFilterCaseSensitive:true,requestMethods:['get'],resourceTypes:['xmlhttprequest'],initiatorDomains:[extensionId]}};
  if(!owned||stable(owned)!==stable(rule))await call('updateSessionRules',{removeRuleIds:owned?[owned.id]:[],addRules:[rule]});
  const verified=(await call('getSessionRules')).some(item=>stable(item)===stable(rule));
  return verified?{applied:true,rule}:{applied:false,reason:'rule_verification_failed'};
 }catch{return{applied:false,reason:'local_port_rule_unavailable'};}
}

async function attach(context,{serverPort,managers=[],accountUid='',authToken='',enhanced=true}={}){
 validPort(serverPort);
 const configKey=accountUid&&authToken?require('node:crypto').createHmac('sha256',authToken).update('fusion-browser-settings:'+accountUid).digest('hex'):'';
 if(accountUid&&!/^[A-Za-z0-9_-]{1,80}$/.test(accountUid)||accountUid&&!configKey)throw Error('账号配置授权缺失');
 const old=instances.get(context);if(old){if(old.serverPort===serverPort&&old.accountUid===accountUid&&old.configKey===configKey&&old.enhanced===enhanced)return old.api;await old.api.dispose();}
 const enabled=new Map(),records=new Map(),targets=new Map(),pending=new Set(),queues=new Map(),timers=new Set();
 let active=true,closed=false,disposal,cancel;
 const stopped=Symbol('local-port-context-closed'),cancelled=new Promise(resolve=>{cancel=resolve;});
 const idOf=target=>{try{const address=new URL(target.url());return address.protocol==='chrome-extension:'&&enabled.has(address.hostname)?address.hostname:'';}catch{return'';}};
 const bounded=async run=>{let timer;try{return await Promise.race([Promise.resolve().then(run).catch(()=>null),cancelled,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1500);timers.add(timer);timer.unref?.();})]);}finally{clearTimeout(timer);timers.delete(timer);}};
 function ensure(target){
  const id=idOf(target);if(!active||!id)return Promise.resolve(false);targets.set(id,target);
  const job=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>{
   if(!active||!enabled.has(id))return false;
   const result=await bounded(()=>target.evaluate(editRule,{extensionId:id,port:serverPort,previous:records.get(id),accountUid,configKey,enhanced}));
   if(result&&result!==stopped&&result.applied&&result.rule){records.set(id,result.rule);return true;}return false;
  }).catch(()=>false).finally(()=>{pending.delete(job);if(queues.get(id)===job)queues.delete(id);});
  pending.add(job);queues.set(id,job);return job;
 }
 const onWorker=worker=>{void ensure(worker);};
 const onClose=()=>{closed=true;active=false;cancel(stopped);for(const timer of timers)clearTimeout(timer);timers.clear();context.removeListener('serviceworker',onWorker);context.removeListener('close',onClose);records.clear();targets.clear();instances.delete(context);};
 async function prepare(id){
  const available=[...(context.serviceWorkers?.()||[]),...(context.pages?.()||[])].find(target=>idOf(target)===id);
  if(available)return ensure(available);
  let page;
  try{
   page=await bounded(()=>context.newPage());if(!page||page===stopped||!active)return false;
   const loaded=await bounded(()=>page.goto('chrome-extension://'+id+OFFICIAL[id].options,{waitUntil:'domcontentloaded',timeout:1500}));
   if(loaded===stopped||!active)return false;
   return await ensure(page);
  }catch{return false;}finally{if(page&&page!==stopped)await bounded(()=>page.close());}
 }
 async function removeOwned(id){
  const previous=records.get(id);if(!previous)return true;
  const target=[...(context.serviceWorkers?.()||[]),...(context.pages?.()||[]),targets.get(id)].find(item=>{try{return item&&new URL(item.url()).hostname===id;}catch{return false;}});
  const result=target&&await bounded(()=>target.evaluate(editRule,{extensionId:id,previous,remove:true}));
  if(result&&result!==stopped&&result.applied){records.delete(id);return true;}return false;
 }
 const api={serverPort,get ready(){return [...enabled.keys()].every(id=>records.has(id));},
  async updateManager(result){
   if(!active||!supported(result)||!result.applied)return;
   if(result.requestedEnabled&&result.enabled===true){enabled.set(result.chromeId,result);await prepare(result.chromeId);}
   else if(result.requestedEnabled===false&&result.enabled===false){enabled.delete(result.chromeId);await removeOwned(result.chromeId);}
  },
  dispose(){
   if(disposal)return disposal;
   active=false;context.removeListener('serviceworker',onWorker);context.removeListener('close',onClose);
   disposal=(async()=>{await Promise.allSettled([...pending]);if(!closed)await Promise.allSettled([...records.keys()].map(removeOwned));records.clear();targets.clear();for(const timer of timers)clearTimeout(timer);timers.clear();cancel(stopped);instances.delete(context);})();return disposal;
  }
 };
 for(const item of managers)if(supported(item)&&item.applied&&item.requestedEnabled&&item.enabled===true)enabled.set(item.chromeId,item);
 instances.set(context,{api,serverPort,accountUid,configKey,enhanced});context.on('serviceworker',onWorker);context.once('close',onClose);
 await Promise.allSettled([...enabled.keys()].map(prepare));return api;
}
module.exports={attach,editRule,validPort,supported};
