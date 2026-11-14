(()=>{
 'use strict';
 if(window.FusionDefaultSetup)return;
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const workspace=()=>window.FusionWorkspace;let current=null,operation=null;
 async function markPromptSeen(){
  const native=workspace().state.native;if(native?.s?.app)native.s.app.fusionDefaultSetupPromptPending=false;
  await workspace().state.bridge.finishDefaultSetupPrompt();
 }
 function applyScript(script){
  if(!script)return;const scripts=workspace().state.native.s.render.scripts;
  const replaceable=scripts.filter(item=>{const source=item.info?.code_url||item.url||'';return source===script.info?.code_url||/^https:\/\/cdn\.ocsjs\.com\/ocs\.user\.js(?:[?#]|$)/i.test(source);});
  if(!replaceable.length&&scripts.some(item=>/^OCS\s*网课助手$/i.test(item.info?.name||'')))return;
  const before=replaceable.find(item=>item.enable!==false)||replaceable[0],next={...script,id:before?.id??script.id,enable:before?before.enable!==false:true,info:{...script.info,id:before?.id??script.id}};
  if(before)scripts.splice(0,scripts.length,...scripts.flatMap(item=>item===before?[next]:replaceable.includes(item)?[]:[item]));
  else{while(scripts.some(item=>item.id===next.id))next.id++;next.info.id=next.id;scripts.push(next);}
 }
 function open(){
  if(current){current.panel.focus();return;}
  const previous=document.activeElement,overlay=node('div','fusion-guide-overlay fusion-setup-overlay'),panel=node('section','fusion-guide-dialog fusion-setup-dialog');panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','fusion-default-setup-title');
  let alive=true,timer;
  const close=()=>{if(!alive)return;alive=false;clearInterval(timer);document.removeEventListener('keydown',keys,true);overlay.remove();current=null;if(previous?.isConnected)previous.focus();};
  current={panel,close};
  const title=node('h2','','是否自动安装默认配置？');title.id='fusion-default-setup-title';
  const intro=node('p','fusion-guide-note','准备脚本猫、OCR 识别组件和随软件提供的 OCS 网课助手脚本。已有账号、题库和脚本开关会保留。');
  const list=node('div','fusion-setup-status'),rows={};
  for(const [id,label]of [['scriptcat','脚本猫'],['ocr','OCR 识别组件'],['ocs','OCS 网课助手脚本']]){const row=node('div','fusion-setup-item'),name=node('strong','',label),status=node('span','','等待准备');status.setAttribute('role','status');row.append(name,status);list.append(row);rows[id]={row,status};}
  const message=node('p','fusion-guide-note','需要联网。可以暂不安装，以后从“使用引导”再次打开。若已有油猴启用，脚本猫下载后保持关闭，避免同时运行。');message.setAttribute('aria-live','polite');
  const footer=node('footer','fusion-guide-footer'),actions=node('div','fusion-guide-actions'),skip=node('button','fusion-guide-action','暂不安装'),install=node('button','fusion-guide-action fusion-guide-primary','安装默认配置');skip.type=install.type='button';actions.append(skip,install);footer.append(actions);
  const busy=()=>!!operation;
  async function refresh(){
   if(!alive||document.hidden||window.__fusionWindowVisible===false)return;
   try{const state=await workspace().state.bridge.getDefaultSetupState();if(!alive)return;for(const [id,item]of Object.entries(state.items||{})){const view=rows[id];if(!view)continue;view.row.dataset.state=item.state;const percent=item.total?Math.min(100,Math.floor(item.received/item.total*100)):null;view.status.textContent=item.message||(item.state==='installing'?'正在安装…':item.state==='downloading'?'正在下载'+(percent!==null?' '+percent+'%':'…'):'等待准备');}}catch{}
  }
  skip.onclick=async()=>{if(!busy())await markPromptSeen();close();};
  install.onclick=async()=>{
   if(busy())return;install.disabled=true;install.textContent='正在准备…';skip.textContent='后台继续';
   try{
    await markPromptSeen();
    operation=workspace().state.bridge.installDefaultComponents();
    const result=await operation;applyScript(result.script);await refresh();
    if(alive){message.textContent=result.complete?'默认配置已准备完成。可以添加账号并验证登录；已有浏览器需要重启后加载新组件。':'部分组件尚未准备完成，已成功的组件和内置脚本保留。检查网络后可重试。';install.textContent=result.complete?'重新检查默认配置':'重试未完成组件';skip.textContent='完成';}
   }catch{if(alive){message.textContent='默认配置准备未完成，请检查网络后重试。';install.textContent='重试准备';skip.textContent='关闭';}}
   finally{operation=null;if(alive)install.disabled=false;}
  };
  function keys(event){if(event.key==='Escape'){event.preventDefault();void skip.onclick();}else if(event.key==='Tab'){const controls=[skip,install].filter(item=>!item.disabled);if(!panel.contains(document.activeElement)||event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}}}
  panel.append(title,intro,list,message,footer);overlay.append(panel);document.body.append(overlay);document.addEventListener('keydown',keys,true);skip.focus();timer=setInterval(()=>{void refresh();},700);void refresh();
 }
 async function maybePrompt(){const status=await workspace().state.bridge.getInitializationStatus();if(status.defaultSetupPromptPending)open();}
 window.FusionDefaultSetup={open,maybePrompt,close:()=>current?.close(),applyScript};
})();
