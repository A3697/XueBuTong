'use strict';
const fs=require('node:fs'),path=require('node:path');

function pageController(){
 if(window.__xuebutongLeavePlayback)return;
 window.__xuebutongLeavePlayback=true;
 const pause=HTMLMediaElement.prototype.pause;
 let enabled=false,leaveUntil=0,manualUntil=0,timer,closed=false;
 const now=()=>performance.now();
 const manual=()=>{manualUntil=now()+750;leaveUntil=0;};
 // Do not suppress movement events: page controls and drag gestures still work.
 for(const event of ['pointerdown','mousedown','touchstart','keydown'])window.addEventListener(event,manual,true);
 const leave=event=>{if(event.relatedTarget==null)leaveUntil=now()+250;};
 for(const event of ['mouseout','mouseleave','pointerout','pointerleave'])window.addEventListener(event,leave,true);
 Object.defineProperty(HTMLMediaElement.prototype,'pause',{configurable:true,writable:true,value:function(){
  const leaving=now()<leaveUntil&&now()>=manualUntil;
  if(enabled&&leaving&&!this.paused&&!this.ended&&!this.error)return;
  return pause.call(this);
 }});
 window.__xuebutongSetLeavePlayback=value=>{enabled=value===true;if(!enabled)leaveUntil=0;};
 async function refresh(){
  if(closed)return;
  try{window.__xuebutongSetLeavePlayback(await window.__xuebutongLeavePlaybackSetting());}catch{}
  if(!closed)timer=setTimeout(refresh,3000);
 }
 window.addEventListener('pagehide',()=>{closed=true;clearTimeout(timer);});
 window.addEventListener('pageshow',event=>{if(event.persisted){closed=false;void refresh();}});
 void refresh();
}
async function install(context,{root,uid}){
 const file=path.join(root,'bridge-data/settings.json');let checked=0,stamp='',enabled=false;
 const read=()=>{
  if(Date.now()-checked<2000)return enabled;checked=Date.now();
  try{const info=fs.statSync(file),next=info.mtimeMs+':'+info.size;if(next!==stamp){const data=JSON.parse(fs.readFileSync(file,'utf8'));enabled=data.profiles?.[uid]?.keepPlayingOnLeave===true;stamp=next;}}catch{}
  return enabled;
 };
 await context.exposeBinding('__xuebutongLeavePlaybackSetting',read);
 await context.addInitScript(pageController);
 for(const page of context.pages())for(const frame of page.frames())await frame.evaluate(pageController).catch(()=>{});
}
module.exports={install,pageController};
