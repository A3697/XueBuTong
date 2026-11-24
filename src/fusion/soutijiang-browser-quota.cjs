'use strict';
const {EXTENSION_ID,classifyError}=require('./soutijiang.cjs');
const PREFIX='chrome-extension://'+EXTENSION_ID+'/';
function methodFor(url){
 try{const u=new URL(url);if(u.protocol!=='https:'||!['www.daxuesoutijiang.com','api.daxuesoutijiang.com'].includes(u.hostname))return null;
  const pathname=u.pathname.replace(/^\/dxkits(?=\/)/,'');
  if(pathname==='/dxai/submit/exercise/solve')return 'solve';
  if(pathname==='/dxtools/pc/picsearch')return 'screenshot';
  if(u.pathname==='/dxkits/aisearch/pc/askstream')return 'sse';
 }catch{}return null;
}
function quotaResult(method,text){
 if(typeof text!=='string'||text.length>1048576)return null;
 const values=[];
 if(method==='sse'){
  for(const block of text.split(/\r?\n\r?\n/)){const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(data)try{values.push(JSON.parse(data));}catch{}}
 }else try{values.push(JSON.parse(text));}catch{}
 for(const value of values){const result={error:value?.errNo,message:String(value?.errstr||value?.data?.errstr||'').slice(0,500),method:method==='solve'?'solve':'screenshot',...(method==='sse'?{protocol:'sse'}:{})};
  if(Number.isInteger(result.error)&&result.error!==0&&classifyError(result)==='quota')return result;
 }return null;
}
function watch(context,{identity,onQuota}){
 let stopped=false;const observed=new WeakMap();
 const request=request=>{
  const method=methodFor(request.url());if(!method)return;
  let owner='';try{owner=request.serviceWorker?.()?.url()||request.frame?.()?.url()||'';}catch{}
  if(owner.startsWith(PREFIX))observed.set(request,{method,identity:identity()});
 };
 const response=response=>{const entry=observed.get(response.request());if(!entry?.identity||stopped)return;
  void (async()=>{const headers=await response.allHeaders();if(Number(headers['content-length'])>1048576)return;const result=quotaResult(entry.method,await response.text());if(!stopped&&result)await onQuota({...result,identity:entry.identity});})().catch(()=>{});
 };
 context.on('request',request);context.on('response',response);
 return {dispose(){stopped=true;context.off('request',request);context.off('response',response);}};
}
module.exports={watch,methodFor,quotaResult};
