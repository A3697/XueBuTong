(()=>{
 'use strict';
 let activeConfirmation=null;
 function confirmConflict({waitMs=3000}={}){return new Promise(resolve=>{
  activeConfirmation?.(false);
  const previous=document.activeElement,shade=document.createElement('div');shade.className='fusion-launch-settings-overlay fusion-app-conflict';
  const panel=document.createElement('section');panel.className='fusion-launch-settings-dialog';panel.style.maxWidth='460px';panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');
  const title=document.createElement('h2');title.textContent='脚本管理器可能冲突';
  const text=document.createElement('p');text.textContent='同时启用脚本猫和油猴，可能重复运行脚本或导致页面异常。建议只启用其中一个。请阅读后确认是否仍要同时启用。';
  const actions=document.createElement('div');actions.className='fusion-launch-settings-actions';
  const cancel=document.createElement('button'),accept=document.createElement('button');cancel.type=accept.type='button';cancel.className='fusion-button';accept.className='fusion-button fusion-primary-button';cancel.textContent='取消';accept.disabled=true;
  const deadline=performance.now()+Math.max(0,Number(waitMs)||3000);let closed=false,timer;
  const close=value=>{if(closed)return;closed=true;clearInterval(timer);shade.remove();if(activeConfirmation===close)activeConfirmation=null;previous?.focus();resolve(value);};
  const tick=()=>{const remaining=Math.max(0,deadline-performance.now());accept.disabled=remaining>0;accept.textContent=remaining?'请阅读 '+Math.ceil(remaining/1000)+' 秒':'仍然启用';};
  cancel.onclick=()=>close(false);accept.onclick=()=>{tick();if(!accept.disabled)close(true);};
  timer=setInterval(tick,100);tick();activeConfirmation=close;actions.append(cancel,accept);panel.append(title,text,actions);shade.append(panel);
  shade.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(false);}if(event.key==='Tab'){event.preventDefault();(document.activeElement===cancel&&!accept.disabled?accept:cancel).focus();}});
  document.body.append(shade);cancel.focus();
 });}
 async function applyRuntime(id,enabled){
  const native=window.FusionWorkspace?.state.native;let requested=0,failed=0,unverified=0;
  for(const process of native?.x||[]){
   if(process.status!=='launched'||typeof process.worker!=='function'||window.FusionWorkspace?.isStarActive?.(process.uid))continue;
   requested++;
   try{const result=await process.worker('setExtensionEnabled',{id,enabled});if(result?.applied===false)failed++;else if(result?.applied!==true)unverified++;}catch(_){failed++;}
  }
  return{requested,failed,unverified,restartRequired:failed>0||unverified>0};
 }
 async function change(group,id,enabled,{installing=false}={}){
  const bridge=window.xingchanBridge;if(!bridge?.changeApplicationState)throw Error('应用开关服务尚未就绪');
  let result=await bridge.changeApplicationState({group,id,enabled,installing});
  for(let attempts=0;result.requiresConfirmation&&attempts<2;attempts++){
   if(!await confirmConflict({waitMs:result.waitMs}))return{enabled:false,canceled:true};
   result=await bridge.changeApplicationState({group,id,enabled,installing,ticket:result.ticket});
  }
  if(result.requiresConfirmation)throw Error('冲突确认已失效，请重新操作');
  const runtime=group==='extensions'&&!installing?await applyRuntime(id,result.enabled):{requested:0,restartRequired:false};
  const value={...result,runtime,restartRequired:runtime.restartRequired};
  window.dispatchEvent(new CustomEvent('fusion-application-state',{detail:value}));
  return value;
 }
 window.FusionApplicationUI={change,confirmConflict,applyRuntime};
})();
