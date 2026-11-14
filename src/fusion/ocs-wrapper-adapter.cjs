'use strict';
const http=require('node:http'),https=require('node:https'),path=require('node:path');
const {Worker}=require('node:worker_threads');
function failure(code){const e=Error(code);e.code=code;return e;}
let activeHandlers=0,peakHandlers=0;const handlerWaiters=[];
async function runHandler(handler,value){
 if(activeHandlers>=2)await new Promise(resolve=>handlerWaiters.push(resolve));else activeHandlers++;
 peakHandlers=Math.max(peakHandlers,activeHandlers);
 try{return await executeHandler(handler,value);}finally{const next=handlerWaiters.shift();if(next)next();else activeHandlers--;}
}
function executeHandler(handler,value){return new Promise((resolve,reject)=>{
 let settled=false;const worker=new Worker(path.join(__dirname,'ocs-wrapper-worker.cjs'),{workerData:{handler,value},resourceLimits:{maxOldGenerationSizeMb:24,maxYoungGenerationSizeMb:8,stackSizeMb:2}});
 const done=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate().finally(()=>error?reject(error):resolve(result));};
 const timer=setTimeout(()=>done(failure('ocs_bank_handler_timeout')),1800);
 worker.once('message',r=>r.ok?done(null,r.value):done(failure('ocs_bank_handler_invalid')));worker.once('error',()=>done(failure('ocs_bank_handler_invalid')));worker.once('exit',()=>{if(!settled)done(failure('ocs_bank_handler_failed'));});
});}
async function interpolate(value,env){
 if(typeof value==='string')return value.replace(/\$\{([a-zA-Z_][\w]*)\}/g,(_,name)=>Array.isArray(env[name])?env[name].join('\n'):String(env[name]??''));
 if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.handler==='string')return runHandler(value.handler,env);
 if(Array.isArray(value))return Promise.all(value.map(item=>interpolate(item,env)));
 if(value&&typeof value==='object'){const result={};for(const [key,item]of Object.entries(value))result[key]=await interpolate(item,env);return result;}return value;
}
function request(url,{method,headers,body,timeoutMs,responseType}){return new Promise((resolve,reject)=>{
 let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
 const req=(url.protocol==='https:'?https:http).request(url,{method,headers,agent:undefined},res=>{
  const chunks=[];let size=0;res.on('data',b=>{size+=b.length;if(size>1048576){done(failure('ocs_bank_response_too_large'));res.destroy();req.destroy();}else chunks.push(b);});
  res.on('error',()=>done(failure('ocs_bank_network_error')));res.on('end',()=>{if(res.statusCode!==200)return done(failure('ocs_bank_http_'+res.statusCode));const text=Buffer.concat(chunks).toString('utf8');let value=text;if(responseType!=='text'){try{value=JSON.parse(text);}catch{return done(failure('ocs_bank_invalid_json'));}}done(null,value);});
 });
 const timer=setTimeout(()=>{done(failure('ocs_bank_timeout'));req.destroy();},timeoutMs);req.on('error',()=>done(failure('ocs_bank_network_error')));req.end(body);
});}
function createWrapperAdapter({wrapper,timeoutMs=15000,answerSeparators}){return async question=>{
 const env={title:question.title,type:question.type==='short'?'completion':question.type,options:typeof question.options==='string'?question.options:(question.options||[]).map(o=>typeof o==='string'?o:o.text).join('\n'),images:question.images||[],suggestion_title:question.suggestion_title||'',suggestion_options:question.suggestion_options||''};
 const data=await interpolate(wrapper.data||{},env),url=new URL(wrapper.url.replace(/\$\{([a-zA-Z_][\w]*)\}/g,(_,key)=>encodeURIComponent(String(env[key]??'')))),method=(wrapper.method||'get').toUpperCase(),headers={...(wrapper.headers||{}),'Accept-Encoding':'identity'};let body;
 const contentType=Object.entries(headers).find(([key])=>key.toLowerCase()==='content-type')?.[1]||'application/json';
 if(method==='GET'){for(const [k,v]of Object.entries(data))url.searchParams.set(k,typeof v==='object'?JSON.stringify(v):String(v));}
 else{body=/application\/json/i.test(contentType)?JSON.stringify(data):new URLSearchParams(Object.entries(data).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])).toString();if(!Object.keys(headers).some(k=>k.toLowerCase()==='content-type'))headers['Content-Type']=contentType;headers['Content-Length']=Buffer.byteLength(body);}
 const response=await request(url,{method,headers,body,timeoutMs:Math.min(timeoutMs,question.timeoutMs||Infinity),responseType:wrapper.responseType||wrapper.contentType||'json'});
 const result=await runHandler(wrapper.handler,response);
 if(result===null)return {kind:'miss'};
 if(!Array.isArray(result))throw failure('ocs_bank_handler_result_invalid');
 const rows=result.every(item=>Array.isArray(item))?result:[result],answered=rows.filter(row=>row[1]!==undefined&&row[1]!==null&&row[1]!=='');
 const normalized=value=>String(value||'').replace(/<[^>]*>/g,'').replace(/\s+/g,'').toLowerCase();
 const tuple=answered.find(row=>normalized(row[0])===normalized(question.title))||(answered.length===1?answered[0]:!answered.length?rows[0]:null);
 if(!tuple){if(answered.length>1)throw failure('ocs_bank_ambiguous_results');return {kind:'miss'};}
 if(tuple[1]===undefined||tuple[1]===null||tuple[1]===''||Array.isArray(tuple[1])&&!tuple[1].length){
  if(/token|api.?key|鉴权|无效|余额|积分不足|频繁|限流|unauthori|forbidden/i.test(String(tuple[0]||'')))throw failure('ocs_bank_auth_or_credit_error');
  return {kind:'miss'};
 }
 let answer=tuple[1];if(typeof answer==='string'&&['multiple','completion'].includes(question.type)){
  let values;try{const json=JSON.parse(answer);if(Array.isArray(json))values=json.map(String);}catch{}
  if(!values)for(const separator of (answerSeparators===undefined?['===','###','#','---','|',';','；']:answerSeparators.split(',').map(s=>s.trim()).filter(Boolean).sort((a,b)=>b.length-a.length)))if(answer.includes(separator)){values=answer.split(separator).map(v=>v.trim()).filter(Boolean);break;}
  if(values)answer=values;else if(question.type==='multiple'&&/^[A-Z,，.。．、 #]+$/.test(answer))answer=answer.replace(/[,，.。．、 #]/g,'');
 }
 return {kind:'hit',answer,question:tuple[0],metadata:tuple[2]};
};}
module.exports={createWrapperAdapter,runHandler,interpolate,handlerStats:()=>({active:activeHandlers,queued:handlerWaiters.length,peak:peakHandlers})};
