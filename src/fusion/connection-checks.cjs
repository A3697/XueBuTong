'use strict';
const fs=require('node:fs'),path=require('node:path');
const http=require('node:http'),https=require('node:https'),crypto=require('node:crypto');
const AIConfig=require('./ai-config.js');
const {uidOf}=require('./controller.cjs');
const {createWrapperAdapter}=require('./ocs-wrapper-adapter.cjs');
const SAMPLE={title:'连接测试：1+1等于多少？',type:'single',options:[{label:'A',text:'1'},{label:'B',text:'2'}],blankCount:0};
function endpoint(base,suffix){const url=new URL(base);if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('invalid_endpoint');const start=url.href.replace(/\/+$/,'');return new URL(start.endsWith(suffix)?start:start+suffix);}
function requestJson(url,{headers={},body,method='POST'}={}){return new Promise((resolve,reject)=>{
 const data=body===undefined?null:Buffer.from(JSON.stringify(body));let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
 const request=(url.protocol==='https:'?https:http).request(url,{method,headers:{Accept:'application/json',...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers},agent:false},response=>{
  const parts=[];let length=0;response.on('data',part=>{length+=part.length;if(length>1048576){request.destroy();done(Error('response_too_large'));}else parts.push(part);});response.on('error',()=>done(Error('network_error')));response.on('end',()=>{let json;try{json=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{}done(null,{status:response.statusCode,json});});
 });const timer=setTimeout(()=>{request.destroy();done(Error('timeout'));},12000);request.on('error',()=>done(Error('network_error')));request.end(data);
});}
function networkResult(status){if(status===401||status===403)return {state:'failed',message:'接口可达，但密钥或权限无效'};if(status===402)return {state:'limited',message:'接口可达，但余额不足'};if(status===429)return {state:'limited',message:'接口可达，但请求受到限流'};if(status>=400&&status<500)return {state:'failed',message:'接口可达，但模型或请求参数不被接受'};return {state:'failed',message:'接口返回异常响应'};}
class ConnectionChecks{
 constructor(controller,{transport=requestJson,wrapper=createWrapperAdapter}={}){this.controller=controller;this.transport=transport;this.wrapper=wrapper;this.results=new Map();this.pending=new Map();this.file=controller.dataDir?path.join(controller.dataDir,'connection-checks.json'):null;if(this.file)try{const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));for(const [key,value]of Object.entries(saved)){if(value&&/^[a-f0-9]{64}$/.test(value.fingerprint)&&['connected','failed','limited','waiting','unconfigured'].includes(value.state))this.results.set(key,value);}}catch{}}
 persist(){if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(Object.fromEntries(this.results)),'utf8');fs.renameSync(this.file+'.tmp',this.file);}
 invalidate(uid,id){uidOf(uid);if(this.results.delete(uid+':'+id))this.persist();}
 items(uid,includeConfigured=false){const settings=this.controller.getSettings({uid}),ais=includeConfigured?(settings.aiConfigurations||AIConfig.read(this.controller,uid)):[];
  const configured=id=>AIConfig.isId(id)?AIConfig.configured(ais.find(ai=>ai.id===id)):id==='soutijiang'?settings.soutijiangConfigured===true:id==='xingchan-bank'?!!this.controller.plainSecret(uid,'xingchanBankKey'):settings.questionBanks?.some(bank=>bank.id===id);
  return settings.searchMethods.filter(item=>item.enabled||includeConfigured&&configured(item.id)).map(item=>({id:item.id,name:AIConfig.isId(item.id)?settings.aiConfigurations?.find(ai=>ai.id===item.id)?.name||'AI 搜题':item.id==='soutijiang'?'大学搜题酱':item.id==='xingchan-bank'?'万能题库':settings.questionBanks?.find(bank=>bank.id===item.id)?.name||'言溪题库'}));
 }
 enabled(uid){return this.items(uid);}
 fingerprint(uid,id){const c=this.controller,souti=id==='soutijiang'?c.soutijiang?.view(uid):null;const data=id==='soutijiang'?[c.base(uid).soutijiangEnabled===true,souti?.version,souti?.compatible,souti?.connectionKey]:AIConfig.isId(id)?AIConfig.read(c,uid).find(ai=>ai.id===id):id==='xingchan-bank'?[c.plainSecret(uid,'xingchanBankKey')]:c.bankConfig(uid).banks.find(b=>b.id===id)?.wrapper;return crypto.createHash('sha256').update(JSON.stringify(data||null)).digest('hex');}
 snapshot({uid}){uidOf(uid);return{uid,items:this.items(uid,true).map(item=>{const cached=this.results.get(uid+':'+item.id);const result=cached?.fingerprint===this.fingerprint(uid,item.id)?cached:null;return {...item,...(result||{state:'unchecked',message:'尚未验证'})};})};}
 async check({uid,only,draftAI}){
  uidOf(uid);let items;
  // The AI editor may validate a new, unsaved draft. Row checks only accept
  // existing account methods and never apply one draft to multiple providers.
  if(typeof only==='string'&&AIConfig.isId(only)&&draftAI)items=[{id:only,name:draftAI.name||'AI 搜题'}];
  else if(only===undefined&&!draftAI)items=this.enabled(uid);
  else{
   const ids=typeof only==='string'&&AIConfig.isId(only)?[only]:only;
   const known=new Set(this.controller.getSettings({uid}).searchMethods.map(item=>item.id));
   if(draftAI||!Array.isArray(ids)||ids.length>50||ids.some(id=>typeof id!=='string'||!known.has(id)))throw Error('只能验证当前账号已有的搜题方式');
   items=this.items(uid,true).filter(item=>ids.includes(item.id));
  }
  const results=[];
  for(const item of items)results.push(await this.one(uid,item,draftAI));
  return{uid,items:results};
 }
 async one(uid,item,draftAI){
  const c=this.controller,p=c.base(uid),savedAI=AIConfig.read(c,uid).find(ai=>ai.id===item.id),fingerprint=this.fingerprint(uid,item.id),signature=crypto.createHash('sha256').update(JSON.stringify([uid,item.id,fingerprint,draftAI||null])).digest('hex');
  if(this.pending.has(signature))return this.pending.get(signature);
  const operation=(async()=>{
   const start=Date.now();let result;
   try{
    if(AIConfig.isId(item.id)){
     const ai=draftAI?{baseUrl:String(draftAI.baseUrl||''),model:String(draftAI.model||''),type:String(draftAI.type||'openai')}:savedAI;
     const key=draftAI?require('./ai-models.cjs').draftKey({...draftAI,id:item.id},c,uid):savedAI?.key||'';
     let type=ai?.type;if(type==='auto')type=/generativelanguage\.googleapis\.com/i.test(ai.baseUrl)?'gemini':/anthropic/i.test(ai.baseUrl)?'anthropic':/11434|ollama/i.test(ai.baseUrl)?'ollama':'openai';
     if(!ai?.baseUrl||!ai.model||!key&&type!=='ollama')result={state:'unconfigured',message:type==='ollama'?'请填写接口地址和模型':'请填写接口地址、模型和 API Key'};
     else{
      let url,headers={},body;
      if(type==='gemini'){const root=ai.baseUrl.replace(/\/+$/,'');url=endpoint(root,/\/v1(?:beta)?$/.test(root)?'/models/'+encodeURIComponent(ai.model)+':generateContent':'/v1beta/models/'+encodeURIComponent(ai.model)+':generateContent');headers['x-goog-api-key']=key;body={contents:[{role:'user',parts:[{text:'Reply OK.'}]}],generationConfig:{maxOutputTokens:1}};}
      else if(type==='anthropic'){url=endpoint(ai.baseUrl,'/messages');headers={'x-api-key':key,'anthropic-version':'2023-06-01'};body={model:ai.model,max_tokens:1,messages:[{role:'user',content:'Reply OK.'}]};}
      else if(type==='ollama'){url=endpoint(ai.baseUrl,'/api/chat');body={model:ai.model,stream:false,messages:[{role:'user',content:'Reply OK.'}],options:{num_predict:1}};if(key)headers.Authorization='Bearer '+key;}
      else{url=endpoint(ai.baseUrl,'/chat/completions');headers.Authorization='Bearer '+key;body={model:ai.model,messages:[{role:'user',content:'Reply OK.'}],max_tokens:1,stream:false};}
      const response=await this.transport(url,{headers,body});
      const json=response.json;
      const valid=json&&!json.error&&(type==='gemini'?Array.isArray(json.candidates)&&json.candidates.length>0:type==='anthropic'?Array.isArray(json.content)&&json.content.length>0:type==='ollama'?json.message&&typeof json.message==='object'&&typeof json.message.content==='string':Array.isArray(json.choices)&&json.choices.length>0);
      result=response.status>=200&&response.status<300?(valid?{state:'connected',message:'连接与鉴权正常，模型已响应'}:{state:'failed',message:'接口返回了不符合所选类型的数据'}):networkResult(response.status);result.httpStatus=response.status;
     }
    }else if(item.id==='soutijiang'){
     const overview=c.soutijiang?.view(uid),noneEnabled=Array.isArray(overview?.accounts)&&!overview.accounts.some(account=>account.enabled!==false);
     const state=noneEnabled?overview:await c.soutijiang?.state(uid,{refresh:true,connect:true,forBank:true});
     result=!state?.installed?{state:'unconfigured',message:'请先安装大学搜题酱官方扩展'}:!state.compatible?{state:'waiting',message:'此扩展版本尚未验证，接管已停止'}:noneEnabled?{state:'unconfigured',message:'请在题库配置中启用至少一个搜题酱账号'}:state.blocked?{state:'limited',message:'请在官方应用中处理验证后重新登录'}:!state.loggedIn?{state:'waiting',message:'请在题库配置中扫码登录搜题酱'}:state.screenshotExhausted&&state.solveExhausted?{state:'limited',message:'今日额度已耗尽，次日恢复'}:{state:'connected',message:'官方登录状态有效；此检查不消耗搜题额度'};
    }else if(item.id==='xingchan-bank'){
     const token=c.plainSecret(uid,'xingchanBankKey'),runtime=c.runtimes.get(uid);
     if(!token)result={state:'unconfigured',message:'尚未配置万能题库 Key'};
     else if(!runtime?.loggedIn||runtime.enhanced===false)result={state:'waiting',message:'请先启动此账号的星蝉增强模式，再验证原题库接口'};
     else{const response=await c.request(runtime,'POST','/api/integration/original-bank',{...SAMPLE,key:token},16000);result=['hit','miss'].includes(response?.kind)?{state:'connected',message:'接口与鉴权正常'}:{state:'failed',message:'题库未返回有效结果'};}
    }else{
     const bank=c.bankConfig(uid).banks.find(bank=>bank.id===item.id);
     if(!bank)result={state:'unconfigured',message:'尚未配置此题库'};
     else{const response=await this.wrapper({...bank,timeoutMs:12000})(SAMPLE);result=['hit','miss'].includes(response?.kind)?{state:'connected',message:response.kind==='miss'?'接口已响应，测试题未命中':'接口与鉴权正常'}:{state:'failed',message:'题库返回格式无效'};}
    }
   }catch(error){const code=String(error?.code||error?.message||'');result={state:'failed',message:/auth|401|403|credit|balance|quota/i.test(code)?'密钥、权限或余额检查未通过':/timeout/i.test(code)?'连接超时':'连接或协议验证失败'};}
   const value={...item,...result,latencyMs:Date.now()-start,checkedAt:new Date().toISOString()},finalFingerprint=this.fingerprint(uid,item.id);const draftMatches=!draftAI||(savedAI&&String(draftAI.baseUrl||'')===savedAI.baseUrl&&String(draftAI.model||'')===savedAI.model&&String(draftAI.type||'openai')===savedAI.type&&require('./ai-models.cjs').draftKey({...draftAI,id:item.id},c,uid)===savedAI.key);if(draftMatches&&(finalFingerprint===fingerprint||item.id==='soutijiang')){this.results.set(uid+':'+item.id,{...value,fingerprint:finalFingerprint});this.persist();}return value;
  })().finally(()=>this.pending.delete(signature));this.pending.set(signature,operation);return operation;
 }
}
module.exports={ConnectionChecks,requestJson,endpoint};
