'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
const {createGateway,GatewayError}=require('./gateway/index.cjs');
const active=new Map();
function originalQuery(root,source,payload,timeoutMs){return new Promise((resolve,reject)=>{
 const child=spawn(path.join(root,'python3144/python.exe'),['-B',path.join(root,'tools/browser_search.py')],{cwd:root,windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,PYTHONUTF8:'1'}});
 let size=0,parts=[],settled=false;
 const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)child.kill();error?reject(error):resolve(result);};
 const timer=setTimeout(()=>finish(new GatewayError('original_provider_timeout',504)),Math.min(120000,Math.max(1,timeoutMs)));
 child.on('error',()=>finish(new GatewayError('original_provider_unavailable',503)));
 child.stdin.on('error',()=>{});
 child.stdout.on('data',part=>{size+=part.length;if(size>1048576)finish(new GatewayError('original_provider_response_too_large'));else parts.push(part);});
 child.on('close',code=>{if(settled)return;try{const data=JSON.parse(Buffer.concat(parts).toString('utf8'));if(code!==0||data.error)throw Error();finish(null,data);}catch{finish(new GatewayError('original_provider_query_failed'));}});
 child.stdin.end(JSON.stringify({source,payload}));
});}
async function query(controller,uid,body,{provider=originalQuery}={}){
 const p=controller.data.profiles[uid],settings=controller.answerSettings(uid),count=active.get(uid)||0;
 if(count>=settings.thread)throw new GatewayError('account_query_busy',429);
 active.set(uid,count+1);
 try{
  const AIConfig=require('./ai-config.js'),ais=AIConfig.read(controller,uid),bankKey=controller.plainSecret(uid,'xingchanBankKey');
  const account={id:uid,answerSettings:settings,maxConcurrent:settings.thread,searchMethods:controller.getSettings({uid}).searchMethods,questionBanks:controller.bankConfig(uid).banks};
  const legacyToken=controller.plainSecret(uid,'yanxiToken');if(legacyToken)account.bank={driver:'yanxi-post-v2',endpoint:'https://tk.enncy.cn/query',token:legacyToken,timeoutMs:15000};
  const gateway=createGateway({mode:'live',accounts:[account],soutijiangSearch:(id,q)=>{if(!controller.soutijiang)throw new GatewayError('soutijiang_unavailable',503);return controller.soutijiang.query(id,q);},originalSearch:async(id,question)=>{
   if(!['single','multiple','completion','judgement','short'].includes(question.type))throw new GatewayError('provider_question_type_unsupported',400);
   const isAI=AIConfig.isId(id),ai=ais.find(item=>item.id===id),aiKey=ai?.key||'';
   if(isAI?!AIConfig.configured(ai):!bankKey)throw new GatewayError('provider_not_configured',409);
   return provider(controller.labRoot,isAI?'ai':'original-bank',{title:question.title,type:question.type,options:question.options,courseName:question.courseName||'',blankCount:question.blankCount||0,key:isAI?aiKey:bankKey,...(isAI?{enrollmentYear:require('./enrollment-year.js').normalize(p?.enrollmentYear),ai:{...ai,type:AIConfig.type(ai)}}:{})},question.timeoutMs);
  }});
  return await gateway.queryBrowser(uid,body);
 }finally{const left=(active.get(uid)||1)-1;if(left)active.set(uid,left);else active.delete(uid);}
}
module.exports={query,originalQuery};
