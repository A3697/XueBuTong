(()=>{
 'use strict';
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const planDefault=()=>({bulkBrowser:false,bulkStar:false,autoMode:'off',autoRunStar:false});
 const allAccounts=()=>window.XingchanOCSFusion.model.listBrowsers(window.store);
 const workspace=()=>window.FusionWorkspace;
 const switchInput=()=>{const input=el('input','fusion-answer-switch');input.type='checkbox';input.setAttribute('role','switch');return input;};
 function settings(){
  document.querySelector('.fusion-launch-settings-overlay')?.remove();
  const state=workspace().state,draft=JSON.parse(JSON.stringify(state.prefs.launchPlans||{}));
  const overlay=el('div','fusion-launch-settings-overlay'),dialog=el('section','fusion-launch-settings-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','账号列表设置');
  const title=el('h2','','账号列表设置'),note=el('p','fusion-launch-settings-note','每个账号独立配置。自动启动和星蝉自动刷课默认关闭；同一账号不能同时运行两种模式。');
  const video=el('section','fusion-global-video-settings'),videoTitle=el('h3','fusion-launch-section-title','星蝉视频'),videoLabel=el('label','fusion-global-video-toggle'),autoVideo2x=switchInput();
  const videoHelp='仅作用于开启星蝉增强的账号视频。课程明确允许 2 倍速时自动使用 2 倍速；禁止倍速、最高允许倍速不足 2 倍或无法判断时使用 1 倍速。关闭后沿用每账号手动倍速。保存后从下一段视频生效；原生模式在原生面板设置倍速。';
  autoVideo2x.type='checkbox';autoVideo2x.checked=state.prefs.autoVideo2x!==false;autoVideo2x.id='fusionAutoVideo2x';autoVideo2x.setAttribute('aria-label','星蝉自动二倍速');autoVideo2x.title=videoLabel.title=videoHelp;
  videoLabel.append(autoVideo2x,document.createTextNode('星蝉自动二倍速'));video.append(videoTitle,videoLabel,el('p','fusion-launch-settings-note','作用于开启增强的星蝉账号；保存后从下一段视频生效。'));
  const plansTitle=el('h3','fusion-launch-section-title','按账号启动计划');
  const table=el('table','fusion-launch-settings-table'),head=el('thead'),row=el('tr');for(const name of ['账号','一键启动浏览器','一键启动星蝉','软件启动时','星蝉启动后'])row.append(el('th','',name));head.append(row);table.append(head);const body=el('tbody');table.append(body);
  for(const account of allAccounts()){
   const p=draft[account.uid]={...planDefault(),...draft[account.uid]},allowed=workspace().canStartStar(account.uid),tr=el('tr');tr.append(el('td','',account.name));
   for(const key of ['bulkBrowser','bulkStar']){const td=el('td'),input=switchInput();input.checked=p[key];input.disabled=key==='bulkStar'&&!allowed;if(input.disabled)input.title='星蝉仅支持已配置完整的学习通账号';input.setAttribute('aria-label',account.name+(key==='bulkBrowser'?'加入一键浏览器启动':'加入一键星蝉启动'));input.onchange=()=>p[key]=input.checked;td.append(input);tr.append(td);}
   const td=el('td'),mode=el('select');mode.setAttribute('aria-label',account.name+'软件启动方式');for(const [value,text]of [['off','不自动启动'],['browser','启动浏览器'],['xingchan','启动星蝉']]){const option=el('option','',text);option.value=value;option.disabled=value==='xingchan'&&!allowed;mode.append(option);}mode.value=p.autoMode;mode.onchange=()=>p.autoMode=mode.value;td.append(mode);tr.append(td);
   const runTd=el('td'),label=el('label'),run=switchInput();run.checked=p.autoRunStar;run.disabled=!allowed;run.onchange=()=>p.autoRunStar=run.checked;run.setAttribute('aria-label',account.name+'星蝉启动后自动刷课');label.title='仅在星蝉增强模式下自动开始保存的队列；原生 1.3 不恢复队列，请在原生控制面板中开始任务。';label.append(run,document.createTextNode('自动刷课（增强）'));runTd.append(label);tr.append(runTd);body.append(tr);
  }
  const actions=el('div','fusion-launch-settings-actions'),cancel=el('button','fusion-button','取消'),save=el('button','fusion-button fusion-primary-button','保存设置');
  const close=()=>overlay.remove();cancel.onclick=close;save.onclick=async()=>{save.disabled=true;try{workspace().savePreferences({autoVideo2x:autoVideo2x.checked,launchPlans:draft});await workspace().flushPreferences();close();workspace().notify('账号列表设置已保存。');}catch(error){workspace().notifyError(error);}finally{save.disabled=false;}};
  actions.append(cancel,save);const scroll=el('div','fusion-launch-settings-body');scroll.append(title,video,plansTitle,note,table);dialog.append(scroll,actions);overlay.append(dialog);overlay.onclick=event=>{if(event.target===overlay)close();};overlay.addEventListener('keydown',event=>{if(event.key==='Escape')close();});document.body.append(overlay);save.focus();
 }
 async function launch(mode,{startup=false}={}){
  const state=workspace().state;await workspace().flushCredentials();
  const accounts=allAccounts(),known=new Set(accounts.map(item=>item.uid));let ids;
  if(startup){const plan=await state.bridge.takeStartupLaunchPlan();ids=plan.filter(item=>item.mode===mode).map(item=>item.uid);}
  else ids=accounts.filter(item=>state.prefs.launchPlans?.[item.uid]?.[mode==='browser'?'bulkBrowser':'bulkStar']).map(item=>item.uid);
  if(!ids.length){if(!startup)workspace().notify('尚未选择一键启动账号，请先打开右侧“设置”。');return;}
  let ok=0,skipped=0,unsupported=0;const failed=[];
  for(const uid of ids){if(!known.has(uid))continue;if(mode==='xingchan'&&!workspace().canStartStar(uid)){unsupported++;continue;}try{const p=state.native.f.from(uid),star=workspace().isStarActive(uid);if(mode==='browser'&&star||mode==='xingchan'&&p&&p.status!=='closed'){skipped++;continue;}if(mode==='browser'){if(p&&p.status!=='closed'){ok++;continue;}await state.native.B.from(uid)?.launch();}else await workspace().start(uid);ok++;}catch{failed.push(uid);}}
  workspace().notify((startup?'自动启动':'一键启动')+'：'+ok+' 个账号已启动'+(skipped?'，'+skipped+' 个账号因另一模式正在运行而跳过':'')+(unsupported?'，'+unsupported+' 个账号不符合星蝉登录要求，已跳过':'')+(failed.length?'，'+failed.length+' 个账号启动失败，请查看日志':'')+'。');
 }
 function mount(host){
  const bar=el('div','fusion-bulk-launch-row'),label=el('strong','','一键启动'),buttons=el('div','fusion-bulk-launch-buttons');
  const make=(text,mode)=>{const button=el('button','fusion-launch-button',text);button.type='button';button.onclick=async()=>{button.disabled=true;try{await launch(mode);}catch(error){workspace().notifyError(error);}finally{button.disabled=false;}};return button;};
  buttons.append(make('启动浏览器','browser'),make('启动星蝉','xingchan'));const guide=el('button','fusion-more-button fusion-guide-button','使用引导');guide.type='button';guide.onclick=()=>window.FusionGettingStarted?.open();const setup=el('button','fusion-more-button','设置');setup.type='button';setup.onclick=settings;const aux=el('div','fusion-bulk-launch-aux');aux.append(guide,setup);bar.append(label,buttons,aux);host.append(bar);const welcome=window.FusionGettingStarted?.mount(host);return{dispose(){welcome?.dispose();bar.remove();}};
 }
 async function autoStart(){
  const state=workspace().state,plan=await state.bridge.takeStartupLaunchPlan();
  if(!plan.length)return;
  await workspace().flushCredentials();let unsupported=0;for(const item of plan){const account=state.native.B.from(item.uid);if(!account)continue;if(item.mode==='xingchan'&&!workspace().canStartStar(item.uid)){unsupported++;continue;}try{if(item.mode==='browser')await account.launch();else await workspace().start(item.uid);}catch(error){workspace().notifyError(error);}}if(unsupported)workspace().notify('自动启动：'+unsupported+' 个账号不符合星蝉登录要求，已跳过。');
 }
 window.FusionLaunchPlans={mount,settings,launch,autoStart};
})();
