'use strict';
function pageController(){
 if(window.__xuebutongMediaController)return;
 const native=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'playbackRate');
 let speed=1,enabled=false;
 function apply(media){if(enabled&&media instanceof HTMLMediaElement){try{media.defaultPlaybackRate=speed;if(Math.abs(native.get.call(media)-speed)>.001)native.set.call(media,speed);}catch{}}}
 function scan(node){if(node?.nodeType!==1)return;if(node.matches?.('video,audio'))apply(node);for(const media of node.querySelectorAll?.('video,audio')||[])apply(media);}
 function enable(){
  if(enabled)return;enabled=true;
  Object.defineProperty(HTMLMediaElement.prototype,'playbackRate',{...native,set(value){native.set.call(this,enabled?speed:value);}});
  document.addEventListener('play',event=>apply(event.target),true);
  const observe=()=>{if(!document.documentElement)return;new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(document.documentElement,{childList:true,subtree:true});};
  if(document.documentElement)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});
 }
 window.__xuebutongSetPlayback=settings=>{if(settings?.enabled&&Number.isFinite(settings.speed)&&settings.speed>=1&&settings.speed<=16){speed=settings.speed;enable();for(const media of document.querySelectorAll('video,audio'))apply(media);}};
 window.__xuebutongMediaController=true;
}
async function installPlayback(context,initialSpeed){
 let speed=Number.isFinite(initialSpeed)&&initialSpeed>=1&&initialSpeed<=16?initialSpeed:null;
 await context.exposeBinding('__xuebutongPlaybackSettings',()=>({speed,enabled:speed!==null}));
 await context.addInitScript({content:'('+pageController.toString()+')(); (async()=>{try{const settings=await window.__xuebutongPlaybackSettings();window.__xuebutongSetPlayback(settings);}catch{}})();'});
 const set=async value=>{
  if(!Number.isFinite(value)||value<1||value>16)throw Error('浏览器倍速须为 1 到 16');speed=value;
  for(const page of context.pages())for(const frame of page.frames())try{await frame.evaluate(pageController);await frame.evaluate(value=>window.__xuebutongSetPlayback?.({speed:value,enabled:true}),speed);}catch{}
  return{speed,applies:'immediate'};
 };
 context.on('page',page=>{page.on('domcontentloaded',()=>{if(speed!==null)page.evaluate(pageController).then(()=>page.evaluate(value=>window.__xuebutongSetPlayback?.({speed:value,enabled:true}),speed)).catch(()=>{});});});
 if(speed!==null)await set(speed);
 return{set,get speed(){return speed;}};
}
module.exports={installPlayback,pageController};
