'use strict';
const {classify,platformOf}=require('./session-guard.cjs');
const NOTICE_SELECTOR='[role="alert"],[role="alertdialog"],[role="dialog"],.layui-layer-dialog .layui-layer-content,.el-message-box__message,.ant-modal-confirm-content,.ant-message-error,.toast-error';
function observe(context,{onDisplaced}={}){
 let disposed=false,tripped=false;const pages=new Map();
 const report=sample=>{if(disposed||tripped)return false;const signal=classify(sample);if(!signal)return false;tripped=true;onDisplaced?.(signal);return true;};
 const onResponse=async response=>{try{
  const url=response.url();if(disposed||tripped||!platformOf(url))return;
  const headers=response.headers(),type=headers['content-type']||'',size=Number(headers['content-length']||0);
  // Do not buffer media, long documents, or course question payloads as notices.
  if(!/json|^text\/plain/i.test(type)||size>64*1024)return;
  const text=await response.text();if(text.length>64*1024)return;
  let body;try{body=JSON.parse(text);}catch{body=text;}
  report({url,body,status:response.status(),source:'response'});
 }catch{}};
 const poll=async page=>{if(disposed||tripped||page.isClosed())return;try{
  for(const frame of page.frames()){
   if(!platformOf(frame.url()))continue;
   const messages=await frame.locator(NOTICE_SELECTOR).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>n.innerText?.trim()).filter(s=>s&&s.length<=500).slice(0,12));
   for(const message of messages)if(report({url:frame.url(),message,source:'notice'}))return;
  }
 }catch{}};
 const attach=page=>{if(disposed||pages.has(page))return;const dialog=d=>report({url:page.url(),message:d.message(),source:'dialog'});page.on('dialog',dialog);const entry={dialog,timer:null};pages.set(page,entry);
  const next=async()=>{await poll(page);if(!disposed&&!tripped&&!page.isClosed())entry.timer=setTimeout(next,1000);};void next();
  page.once('close',()=>{clearTimeout(entry.timer);pages.delete(page);});
 };
 context.on('page',attach);context.on('response',onResponse);context.pages().forEach(attach);
 return {get tripped(){return tripped;},dispose(){disposed=true;context.off('page',attach);context.off('response',onResponse);for(const [page,entry]of pages){clearTimeout(entry.timer);page.off('dialog',entry.dialog);}pages.clear();}};
}
module.exports={observe,NOTICE_SELECTOR};
