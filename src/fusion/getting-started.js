(()=>{
 'use strict';
 if(window.FusionGettingStarted)return;
 const SCRIPT_URL='https://cdn.ocsjs.com/ocs.user.js';
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const workspace=()=>window.FusionWorkspace;
 const accounts=()=>window.XingchanOCSFusion.model.listBrowsers(window.store);
 let active=null;
 const welcomes=new Set();
 function button(label,action,primary=false){const e=node('button','fusion-guide-action'+(primary?' fusion-guide-primary':''),label);e.type='button';e.onclick=()=>Promise.resolve().then(action).catch(error=>workspace().notifyError(error));return e;}
 function scriptState(){const scripts=window.store?.render?.scripts||[],item=scripts.find(s=>s.url===SCRIPT_URL||s.info?.code_url===SCRIPT_URL||/\bocs\b|ocs网课助手/i.test(s.info?.name||s.name||''));return{installed:!!item,enabled:!!item&&item.enable!==false};}
 async function dismiss(){workspace().savePreferences({guideDismissed:true});await workspace().flushPreferences();for(const refresh of welcomes)refresh();}
 function route(hash){active?.close();location.hash=hash;}
 function mount(host){
  const banner=node('section','fusion-welcome-banner');banner.setAttribute('aria-label','首次使用提示');
  const copy=node('div',''),title=node('strong','','欢迎使用学不通'),text=node('p','','先添加账号并配置登录，再选择浏览器或星蝉。可随时打开“使用引导”查看准备步骤。');copy.append(title,text);
  const actions=node('div','fusion-guide-actions');actions.append(button('查看使用引导',open,true),button('不再提示',async()=>{await dismiss();refresh();}));banner.append(copy,actions);host.append(banner);
  function refresh(){banner.hidden=workspace().state.prefs.guideDismissed===true||accounts().length>0;}
  refresh();workspace().state.listeners.add(refresh);welcomes.add(refresh);
  return{dispose(){workspace().state.listeners.delete(refresh);welcomes.delete(refresh);banner.remove();}};
 }
 function open(){
  active?.close();
  const previous=document.activeElement,overlay=node('div','fusion-guide-overlay'),panel=node('section','fusion-guide-dialog');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','fusion-guide-title');panel.tabIndex=-1;
  let alive=true;
  function close(){if(!alive)return;alive=false;document.removeEventListener('keydown',keys,true);overlay.remove();if(active?.close===close)active=null;if(previous?.isConnected)previous.focus();}
  active={close};
  const header=node('header','fusion-guide-header'),heading=node('div','');heading.append(node('h2','','学不通 · 使用引导'),node('p','','按账号配置，按模式准备。引导不会自动登录或启动课程。'));heading.firstChild.id='fusion-guide-title';
  const closeButton=button('关闭',close);closeButton.setAttribute('aria-label','关闭使用引导');header.append(heading,closeButton);
  const status=node('section','fusion-guide-environment');status.setAttribute('aria-live','polite');
  let checking=false;
  async function check(){
   if(checking)return;checking=true;status.replaceChildren(node('span','','正在检查本地组件…'));
   try{
    const result=await workspace().state.bridge.getInitializationStatus();if(!alive)return;
    const script=scriptState();status.replaceChildren();
    for(const [ready,label]of [[result.browserPresent,'内置浏览器'],[result.backendPresent,'星蝉组件'],[result.enabledManagerCount>0,'脚本管理器'],[script.enabled,'OCS 用户脚本']]){
     const badge=node('span','fusion-guide-badge '+(ready?'is-ready':'is-pending'),label+'：'+(ready?'已就绪':'待准备'));status.append(badge);
    }
    status.append(button('重新检查',check));
   }catch{if(alive)status.replaceChildren(node('span','','暂时无法读取组件状态，请关闭后重试；可以先按下方步骤配置账号。'));}
   finally{checking=false;}
  }
  const steps=node('div','fusion-guide-steps');
  function card(number,title,text){const section=node('section','fusion-guide-step'),h=node('h3','',''+number+' · '+title),p=node('p','',text),actions=node('div','fusion-guide-actions');section.append(h,p,actions);steps.append(section);return{section,actions};}
  const account=card(1,'添加账号与验证登录','在账号列表添加账号，打开“自动登录配置”并选择平台。填写账号、密码及所需学校信息，点击“验证登录”检查。验证码或网站确认需要本人处理。');
  account.actions.append(button('前往账号列表',()=>route('#/browsers')));
  const browser=card(2,'准备浏览器模式','浏览器模式沿用 OCS 功能，适用于其支持的平台。在应用中心安装并启用脚本猫或油猴中的一个，再导入 OCS 用户脚本。内置浏览器已经随安装包预置，无需首次解压。');
  const importButton=button('导入 OCS 脚本',async()=>{
   if(scriptState().installed){route('#/user-scripts');return;}
   importButton.disabled=true;importButton.textContent='正在导入…';
   try{await workspace().state.native.q(SCRIPT_URL);if(!scriptState().installed)throw Error('import_not_completed');if(alive){importButton.textContent='查看脚本列表';await check();}}
   catch{if(alive){importButton.textContent='重试导入 OCS 脚本';workspace().notify('导入未完成，请检查网络，或在脚本列表手动导入官方脚本。',{role:'alert'});}}
   finally{importButton.disabled=false;}
  });
  if(scriptState().installed)importButton.textContent='查看脚本列表';
  browser.actions.append(button('安装默认配置',()=>{active?.close();window.FusionDefaultSetup?.open();},true),button('前往应用中心',()=>route('#/resources')),importButton);
  const star=card(3,'准备星蝉模式','星蝉仅支持学习通。在账号抽屉配置 API、题库和搜题顺序，按需启用。启动星蝉后打开控制面板，将课程加入刷课队列，再点击“开始刷课”。未配置搜题服务也可使用不依赖搜题的功能。');
  star.actions.append(button('前往账号配置',()=>route('#/browsers')));
  const monitor=card(4,'运行、监控与保存','同一账号不能同时启动两种模式。浏览器右上角关闭按钮只隐藏窗口；需要结束任务时，使用学不通中的“停止”。在监控列表查看画面、任务或日志；工具菜单可导入、导出配置。');
  monitor.actions.append(button('前往监控列表',()=>route('#/dashboard')));
  const note=node('p','fusion-guide-note','自动启动与星蝉自动刷课默认关闭，可在账号列表右上方“设置”中按账号开启。安装或更改浏览器扩展后，需要重启相应账号浏览器。');
  const footer=node('footer','fusion-guide-footer');footer.append(node('span','','以后可从账号列表的“使用引导”再次打开。'),button('完成引导',async()=>{await dismiss();close();},true));
  panel.append(header,status,steps,note,footer);overlay.append(panel);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  function keys(event){
   if(event.key==='Escape'){event.preventDefault();close();}
   if(event.key==='Tab'){const controls=[...panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')].filter(e=>e.getClientRects().length);if(!controls.length){event.preventDefault();panel.focus();return;}const first=controls[0],last=controls.at(-1);if(!panel.contains(document.activeElement)){event.preventDefault();first.focus();}else if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  }
  document.addEventListener('keydown',keys,true);document.body.append(overlay);closeButton.focus();void check();
 }
 window.FusionGettingStarted={mount,open,close:()=>active?.close()};
})();
