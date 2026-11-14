(() => {
 'use strict';
 if(window.FusionWorkspace)return;
 const state={native:null,bridge:null,statuses:new Map(),seen:new Map(),listeners:new Set(),operations:new Map(),prefs:{cardOrder:[],columns:2,previewEnabled:true,onlyFailed:false,starCardHeight:760,starTaskRatio:.6,starColumnRatio:.58,browserLogHeight:180,guideDismissed:false,launchPlans:{},speeds:{}},preferencePatch:{},preferenceWrites:Promise.resolve(),saveTimer:null,disposed:false};
 const label={stopping:'正在停止',stopped:'已停止',starting:'启动中','logging-in':'登录中',ready:'服务就绪',running:'运行中',paused:'已暂停',failed:'启动失败',unknown:'状态未知'};
 const viewVisible=()=>!document.hidden&&window.__fusionWindowVisible!==false;
 const dashboardVisible=()=>viewVisible()&&/^#\/?dashboard(?:[/?]|$)/.test(location.hash);
 const starRunning=item=>item?.mode==='live'&&['starting','logging-in','ready','running','paused'].includes(item.state);
 const emit=()=>{for(const listener of state.listeners)listener();};
 const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
 function button(text,handler,cls='fusion-button'){
  const element=node('button',cls,text);element.type='button';element.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();Promise.resolve().then(handler).catch(notifyError);});return element;
 }
 function notifyError(error){
  const raw=String(error?.message||'');
  const text=raw.includes('MODE_CONFLICT_BROWSER')?'该账号的浏览器正在运行。请先在学不通中点击该账号浏览器的“停止”，再启动星蝉。':raw.includes('MODE_CONFLICT_XINGCHAN')?'该账号的星蝉正在运行。请先在学不通中点击该账号星蝉的“停止”，再启动浏览器。':raw.includes('STAR_LOGIN_UNSUPPORTED')?'星蝉仅支持学习通账号，请在自动登录配置中选择超星登录并补全账号信息。':raw.includes('填写账号')?'请先在自动登录配置中填写账号、密码及所需学校信息。':'操作未完成，请查看对应账号日志。';
  notify(text,{role:'alert',closeLabel:'知道了'});
 }
 function profile(uid){return state.native?.B.from(uid);}
 function nativeProcess(uid){return state.native?.f.from(uid);}
 function loginProfile(uid){return state.native?.readFusionNativeCredentials?.().find(item=>item.uid===uid)||{kind:'none',platform:'none',starEligible:false,username:'',password:'',unit:''};}
 function canStartStar(uid){const login=loginProfile(uid);return login.starEligible===true&&window.FusionLoginProfiles?.complete(login)===true;}
 function updateStatus(item){
  if(!item?.uid)return;const old=state.statuses.get(item.uid);if(Number.isSafeInteger(old?.statusRevision)&&Number.isSafeInteger(item.statusRevision)&&item.statusRevision<old.statusRevision)return;state.statuses.set(item.uid,item);
  window.dispatchEvent(new CustomEvent('fusion-account-status',{detail:{uid:item.uid,displayName:item.displayName}}));
  const active=starRunning(item);
  if(active)state.seen.set(item.uid,'xingchan');
  else if(item.state==='stopped'&&!item.pending&&!state.operations.has(item.uid)&&state.seen.get(item.uid)==='xingchan')state.seen.delete(item.uid);
  if(!state.operations.has(item.uid))state.native?.setFusionBrowserStatus(item.uid,active?(['starting','logging-in'].includes(item.state)?'launching':'launched'):null);
 }
 function synchronize(items){for(const item of items||[])if(!state.operations.has(item?.uid))updateStatus(item);emit();}
 function preferenceWrite(work){const next=state.preferenceWrites.then(work);state.preferenceWrites=next.catch(()=>{});return next;}
 function savePreferences(patch={}){Object.assign(state.prefs,patch);Object.assign(state.preferencePatch,patch);clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>{void flushPreferences();},180);}
 function flushPreferences(){
  clearTimeout(state.saveTimer);const patch=state.preferencePatch;state.preferencePatch={};if(!Object.keys(patch).length||!state.bridge)return state.preferenceWrites;
  return preferenceWrite(async()=>{const latest=await state.bridge.getWorkspacePreferences();return state.bridge.saveWorkspacePreferences({...latest,...patch});}).catch(()=>{const retry=Object.fromEntries(Object.entries(patch).filter(([key,value])=>state.prefs[key]===value));state.preferencePatch={...retry,...state.preferencePatch};notify('监控设置未能保存，请重试。');});
 }
 async function setPlayback(uid,mode,speed){
  await flushPreferences();const result=await preferenceWrite(()=>state.bridge.setPlayback({uid,mode,speed}));
  state.prefs.speeds={...state.prefs.speeds,[uid]:result?.speed??speed};return result;
 }
 async function starAction(uid,kind){
  const previousOperation=state.operations.get(uid);
  if(previousOperation){if(kind!=='stop'||previousOperation.kind==='stop')return previousOperation;previousOperation.cancelled=true;}
  if(kind!=='stop'){const native=nativeProcess(uid);if(native&&native.status!=='closed')throw Error('MODE_CONFLICT_BROWSER');}
  const previous=state.statuses.get(uid);state.seen.set(uid,'xingchan');
  state.native.setFusionBrowserStatus(uid,kind==='stop'?'closing':'launching');
  updateStatus({uid,mode:'live',state:kind==='stop'?'stopped':'starting',pending:true,summary:kind==='stop'?'正在停止星蝉…':'正在启动星蝉并登录…',displayName:previous?.displayName||'',loggedIn:false});
  state.native.setFusionBrowserStatus(uid,kind==='stop'?'closing':'launching');emit();
  const pending=Promise.resolve().then(async()=>{
   if(kind!=='stop'){await window.FusionAccountForm?.flush();await flushCredentials();if(pending.cancelled)return;if(!canStartStar(uid))throw Error('STAR_LOGIN_UNSUPPORTED');}
   if(kind==='restart'||kind==='stop')await state.bridge.stop({uid});
   if(pending.cancelled)return;
   return kind==='stop'?state.bridge.listStatus({uids:[uid]}).then(result=>result.items[0]):state.bridge.start({uid});
  }).then(result=>{if(state.operations.get(uid)===pending){state.operations.delete(uid);if(result)updateStatus(result);}return result;}).catch(error=>{
   if(pending.cancelled)return;
   if(state.operations.get(uid)===pending){state.operations.delete(uid);updateStatus({uid,mode:'unconnected',state:'failed',summary:String(error?.message||'').includes('MODE_CONFLICT')?'请先在学不通中点击该账号浏览器的“停止”。':'启动未完成，请查看下方日志。',loggedIn:false});}throw error;
  }).finally(()=>{if(state.operations.get(uid)===pending)state.operations.delete(uid);emit();});
  pending.kind=kind;state.operations.set(uid,pending);return pending;
 }
 function start(uid){return starAction(uid,'start');}
 function stop(uid){return starAction(uid,'stop');}
 function restart(uid){return starAction(uid,'restart');}
 function openHtml(uid){return state.bridge.openHtml({uid});}
 function isStarActive(uid){return state.operations.has(uid)||starRunning(state.statuses.get(uid));}
 async function closeAccount(uid){const p=nativeProcess(uid);if(p)await profile(uid).close();if(isStarActive(uid))await stop(uid);}
 function nativeChanged(){
  const live=new Set();for(const p of state.native?.x||[])if(p.status!=='closed'){live.add(p.uid);state.seen.set(p.uid,'browser');}
  for(const [uid,mode]of state.seen)if(mode==='browser'&&!live.has(uid))state.seen.delete(uid);emit();
 }
 async function initialize(native,bridge){
  state.native=native;state.bridge=bridge;
  void window.FusionOcsPlugins?.initialize().catch(notifyError);
  const repairTags=()=>{if(window.store?.render?.browser)window.FusionAccountTags.repair(window.store.render.browser);};repairTags();
  native.watchFusionTags?.(repairTags);
  window.dispatchEvent(new Event('fusion-login-profiles-ready'));
  window.FusionAccountOrder.ui=window.FusionAccountOrder.createUi({store:window.store,native,notify});
  state.credentials=window.FusionCredentialSync.create({bridge,readNative:native.readFusionNativeCredentials,writeNative:native.writeFusionNativeCredentials,onUpdate:(uid,settings)=>window.dispatchEvent(new CustomEvent('fusion-account-settings',{detail:{uid,settings}})),onError:notifyError});
  state.credentialsReady=state.credentials.initialize();await state.credentialsReady;
  state.unwatchCredentials=native.watchFusionCredentials(items=>{state.credentials.nativeChanged(items);emit();window.dispatchEvent(new Event('fusion-login-profiles-changed'));});
  native.setFusionBrowserActions({start,stop,restart,openHtml});
  state.unwatch=native.watchFusionProcesses(nativeChanged);nativeChanged();
  try{state.prefs={...state.prefs,...await bridge.getWorkspacePreferences()};}catch{}
  emit();
  setTimeout(()=>{if(!state.disposed){window.FusionDefaultSetup?.maybePrompt().catch(notifyError);window.FusionLaunchPlans?.autoStart().catch(notifyError);}},0);
  return {methods:['launchBrowser','startXingchan','restart','close','openPanel'],syncStatus:synchronize,dispose(){state.disposed=true;window.FusionAccountOrder.ui?.dispose();state.unwatch?.();state.unwatchCredentials?.();state.credentials?.dispose();native.setFusionBrowserActions(null);void flushPreferences();state.listeners.clear();}};
 }
 function mountDashboard(container){
  const root=node('section','fusion-dashboard');root.dataset.columns=String(state.prefs.columns);container.append(root);
  const header=node('div','fusion-monitor-heading'),headText=node('div');headText.append(node('h2','','账号监控'),node('p','','浏览器显示画面；星蝉显示任务、进度与实时日志。离开监控页或最小化时暂停刷新。'));
  const controls=node('div','fusion-monitor-controls'),auto=node('label','fusion-auto-refresh'),toggle=node('input');toggle.type='checkbox';toggle.checked=state.prefs.previewEnabled;toggle.setAttribute('aria-label','自动刷新监控');auto.append(toggle,document.createTextNode('自动刷新'));
  toggle.addEventListener('change',()=>{savePreferences({previewEnabled:toggle.checked});if(toggle.checked)tick(true);updateVisibility();});
  const columns=node('select');columns.setAttribute('aria-label','监控列数');for(const value of [1,2,3,4]){const option=node('option','',value+' 列');option.value=String(value);columns.append(option);}columns.value=String(state.prefs.columns);
  columns.addEventListener('change',()=>{savePreferences({columns:Number(columns.value)});if(state.native?.s.render.dashboard)state.native.s.render.dashboard.num=state.prefs.columns;applyLayouts();});
  const refresh=button('刷新',()=>tick(true));controls.append(auto,columns,refresh);header.append(headText,controls);
  const notice=node('p','fusion-monitor-notice'),grid=node('div','fusion-monitor-grid'),empty=node('div','fusion-monitor-empty','暂无监控内容。请在账号列表选择“启动浏览器”或“启动星蝉”。');
  const taskControls=node('div','fusion-global-task-controls'),failedLabel=node('label','fusion-auto-refresh'),failedToggle=node('input');failedToggle.type='checkbox';failedToggle.checked=state.prefs.onlyFailed===true;failedToggle.setAttribute('aria-label','所有星蝉只看失败');failedLabel.append(failedToggle,document.createTextNode('只看失败'));
  failedToggle.addEventListener('change',()=>{savePreferences({onlyFailed:failedToggle.checked});for(const view of views.values())view.tasks?.setOnlyFailed(failedToggle.checked);});
  const jump=button('定位失败项',async()=>{let found=0;for(const view of views.values())if(view.tasks&&running(state.statuses.get(view.card.dataset.accountUid))){await view.tasks.refresh();if(view.tasks.jumpFailed())found++;}notify(found?'已在 '+found+' 个账号中定位失败项。':'当前监控课程没有失败项。');});
  const visit=button('补空章节访问次数',async()=>{visit.disabled=true;try{const targets=[...views.values()].filter(view=>view.tasks&&running(state.statuses.get(view.card.dataset.accountUid)));const results=await Promise.allSettled(targets.map(view=>view.tasks.visitEmpty()));const ok=results.filter(r=>r.status==='fulfilled').length;notify('已为 '+ok+' 个账号安排补空章节'+(ok<targets.length?'；'+(targets.length-ok)+' 个账号未能安排，请查看日志。':'，结果将显示在任务表和日志中。'));}finally{visit.disabled=false;}});
  taskControls.append(node('strong','','星蝉任务 · 全部账号'),failedLabel,jump,visit);root.append(header,notice,taskControls,empty,grid);
  const views=new Map();let active=true,alive=true,dragUid=null,lastTick=0;
  const viewportObserver=new IntersectionObserver(entries=>{for(const entry of entries){const view=views.get(entry.target.dataset.accountUid);if(view){view.inViewport=entry.isIntersecting;if(entry.isIntersecting)followLogs(view);}}},{root:container,rootMargin:'0px'});
  const layoutObserver=new ResizeObserver(()=>applyLayouts());layoutObserver.observe(grid);
  const logSizeObserver=new ResizeObserver(entries=>{for(const entry of entries){const view=views.get(entry.target.closest('.fusion-monitor-card')?.dataset.accountUid);if(view)followLogs(view);}});
  root.style.setProperty('--fusion-columns',String(state.prefs.columns));
  const allowed=()=>alive&&active&&dashboardVisible();
  const running=starRunning;
  function applyLayouts(){
   root.dataset.columns=String(state.prefs.columns);root.style.setProperty('--fusion-columns',String(state.prefs.columns));root.style.setProperty('--fusion-star-card-height',state.prefs.starCardHeight+'px');root.style.setProperty('--fusion-browser-log-height',state.prefs.browserLogHeight+'px');
   const computed=getComputedStyle(grid).gridTemplateColumns,axis=state.prefs.columns===1||computed&&computed!=='none'&&computed.trim().split(/\s+/).length===1?'x':'y';
   for(const view of views.values()){view.split?.set(axis,axis==='x'?state.prefs.starColumnRatio:state.prefs.starTaskRatio);view.heightHandle?.set(view.modeValue==='xingchan'?state.prefs.starCardHeight:state.prefs.browserLogHeight);followLogs(view);}
  }
  function changeLayout(patch){savePreferences(patch);applyLayouts();}
  function updateVisibility(){const text=!allowed()?'监控刷新已暂停':!state.prefs.previewEnabled?'自动刷新已关闭，可手动刷新':'正在自动监控';if(notice.textContent!==text)notice.textContent=text;}
  function ordered(){const accounts=window.XingchanOCSFusion.model.listBrowsers(window.store),known=new Map(accounts.map(item=>[item.uid,item]));return [...state.seen.entries()].filter(([uid])=>known.has(uid)).map(([uid,mode])=>({uid,mode,name:known.get(uid).name})).sort((a,b)=>{
   const x=state.prefs.cardOrder.indexOf(a.uid),y=state.prefs.cardOrder.indexOf(b.uid);return (x<0?1e9:x)-(y<0?1e9:y);
  });}
  function reorder(from,to){if(from===to)return;const ids=ordered().map(item=>item.uid),a=ids.indexOf(from),b=ids.indexOf(to);if(a<0||b<0)return;ids.splice(b,0,ids.splice(a,1)[0]);savePreferences({cardOrder:[...ids,...state.prefs.cardOrder.filter(uid=>!ids.includes(uid))]});reconcile();}
  function makeView(item){
   const card=node('article','fusion-monitor-card');card.dataset.accountUid=item.uid;card.dataset.mode=item.mode;
   const top=node('header','fusion-monitor-card-head'),identity=node('div','fusion-monitor-identity'),name=node('strong'),meta=node('span','fusion-monitor-meta');identity.append(name,meta);
   const handle=button('⋮⋮',()=>{},'fusion-drag-handle');handle.draggable=true;handle.title='拖动调整监控顺序';handle.setAttribute('aria-label','拖动'+item.name+'的监控卡片');
   handle.addEventListener('dragstart',event=>{dragUid=item.uid;event.dataTransfer?.setData('text/plain',item.uid);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';card.classList.add('dragging');});
   handle.addEventListener('dragend',()=>{dragUid=null;card.classList.remove('dragging');for(const view of views.values())view.card.classList.remove('drop-target');});
   card.addEventListener('dragover',event=>{if(dragUid&&dragUid!==item.uid){event.preventDefault();card.classList.add('drop-target');}});
   card.addEventListener('dragleave',event=>{if(!card.contains(event.relatedTarget))card.classList.remove('drop-target');});
   card.addEventListener('drop',event=>{if(!dragUid)return;event.preventDefault();event.stopPropagation();reorder(dragUid,item.uid);dragUid=null;card.classList.remove('drop-target');});
   const moveUp=button('↑',()=>{const all=ordered(),index=all.findIndex(a=>a.uid===item.uid);if(index>0)reorder(item.uid,all[index-1].uid);},'fusion-mini-button');moveUp.setAttribute('aria-label','前移'+item.name+'的监控卡片');
   const moveDown=button('↓',()=>{const all=ordered(),index=all.findIndex(a=>a.uid===item.uid);if(index<all.length-1)reorder(item.uid,all[index+1].uid);},'fusion-mini-button');moveDown.setAttribute('aria-label','后移'+item.name+'的监控卡片');
   const sort=node('span','fusion-card-sort');sort.append(moveUp,moveDown,handle);top.append(identity,sort);
   const badges=node('div','fusion-monitor-badges'),mode=node('span','fusion-badge'),status=node('span','fusion-badge'),login=node('span','fusion-badge');badges.append(mode,status,login);
   const isStar=item.mode==='xingchan',body=node('div','fusion-monitor-content'),message=node('p','fusion-monitor-summary'),image=node('img','fusion-browser-preview'),logs=node('pre','fusion-inline-log'),logPanel=node('section','fusion-log-panel'),logHeading=node('header','fusion-log-heading'),logActions=node('span','fusion-log-actions');image.alt=item.name+'浏览器画面';image.hidden=true;logs.tabIndex=0;logs.setAttribute('aria-label',item.name+'实时日志');
   const followButton=button('跟随：开',()=>{view.logFollower.set(!view.follow);},'fusion-mini-button');followButton.setAttribute('aria-label','跟随'+item.name+'的日志');
   const clearButton=button('清空',()=>clearLogs(item.uid,view),'fusion-mini-button');clearButton.setAttribute('aria-label','清空'+item.name+'的日志');logActions.append(followButton,clearButton);logHeading.append(node('strong','',isStar?'星蝉实时日志':'浏览器实时日志'),logActions);logPanel.append(logHeading,logs);
   const splitHost=isStar?node('div','fusion-monitor-split'):null;image.addEventListener('click',()=>profile(item.uid)?.bringToFront());body.append(message,image);if(splitHost){splitHost.append(logPanel);body.append(splitHost);}else body.append(logPanel);
   const playback=node('form','fusion-playback-controls'),speedLabel=node('label','fusion-playback-label',isStar?'手动倍速':'倍速'),speedInput=node('input','fusion-playback-input'),speedHint=node('span','fusion-playback-hint');speedInput.type='number';speedInput.min='1';speedInput.max=isStar?'1000':'16';speedInput.step='any';speedInput.required=true;speedInput.value=String(Math.min(isStar?1000:16,Math.max(1,Number(state.prefs.speeds?.[item.uid])||1)));speedInput.setAttribute('aria-label',item.name+(isStar?'星蝉':'浏览器')+'倍速');if(isStar)speedInput.title='手动值会独立保存。自动二倍速开启时，按平台许可使用 1× 或 2×；关闭后使用手动值，从下一视频生效。';speedLabel.append(speedInput);
   const applySpeed=async()=>{if(view.speedSaving)return;speedInput.setCustomValidity('');const value=Number(speedInput.value),max=isStar?1000:16;if(!speedInput.value||!Number.isFinite(value)||value<1||value>max){speedInput.setCustomValidity('请输入 1～'+max+' 之间的倍速');speedInput.reportValidity();return;}view.speedSaving=true;speedButton.disabled=true;try{const result=await setPlayback(item.uid,item.mode,value),speed=result?.speed??value,p=nativeProcess(item.uid);speedInput.value=String(speed);if(!isStar&&p?.status==='launched'&&p.worker){await p.worker('setPlayback',{speed});notify('浏览器倍速已设为 '+speed+'×。');}else notify(isStar?(state.prefs.autoVideo2x!==false?'星蝉手动倍速已保存为 '+speed+'×；当前开启自动二倍速，实际使用 1× 或 2×。关闭自动二倍速后，手动值从下一视频生效。':'星蝉手动倍速已设为 '+speed+'×，下一视频生效。'):'浏览器倍速已保存为 '+speed+'×，下次启动生效。');}finally{view.speedSaving=false;speedButton.disabled=false;}};
   const speedButton=button('应用',applySpeed,'fusion-button fusion-speed-apply');speedInput.addEventListener('input',()=>{view.speedTouched=true;speedInput.setCustomValidity('');});playback.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();applySpeed().catch(notifyError);});playback.append(speedLabel,speedButton,speedHint);
   const actions=node('footer','fusion-monitor-actions');
   const open=button('启动控制面板',()=>item.mode==='xingchan'?openHtml(item.uid):profile(item.uid)?.bringToFront(),'fusion-button fusion-primary-button');
   const restartButton=button('重启',()=>item.mode==='xingchan'?restart(item.uid):profile(item.uid)?.relaunch(),'fusion-button fusion-action-restart');restartButton.setAttribute('aria-label','重启'+item.name+(isStar?'的星蝉':'的浏览器'));
   const stopButton=button('停止',()=>item.mode==='xingchan'?stop(item.uid):profile(item.uid)?.close(),'fusion-button fusion-action-stop');stopButton.setAttribute('aria-label','停止'+item.name+(isStar?'的星蝉':'的浏览器'));
   const runningSplit=node('span','fusion-running-split');runningSplit.dataset.runningMode=item.mode;runningSplit.append(restartButton,stopButton);
   const browserStart=button('启动浏览器',()=>profile(item.uid)?.launch(),'fusion-button fusion-primary-button');
   const starStart=button('启动星蝉',()=>start(item.uid),'fusion-button fusion-primary-button');
   const edit=button('账号设置',()=>{window.store.render.browser.currentBrowserUid=item.uid;location.hash='#/browsers';});actions.append(open,runningSplit,browserStart,starStart,edit);
   const tasks=isStar?window.FusionStarMonitor.mount({host:splitHost,uid:item.uid,bridge:state.bridge,onError:notifyError,onSnapshot:snapshot=>{const speed=snapshot.progress?.playback?.beisu;if(!view.speedTouched&&!view.speedSaving&&!Object.hasOwn(state.prefs.speeds||{},item.uid)&&typeof speed==='number'&&Number.isFinite(speed)&&speed>=1&&speed<=1000)speedInput.value=String(speed);}}):null;
   if(tasks){splitHost.insertBefore(tasks.root,logPanel);tasks.setOnlyFailed(state.prefs.onlyFailed===true);}
   card.append(top,badges,playback,body,actions);
   const view={card,name,meta,mode,status,login,message,image,logs,logPanel,followButton,clearButton,tasks,open,restartButton,stopButton,browserStart,starStart,speedInput,speedButton,speedHint,modeValue:item.mode,pending:false,cursor:undefined,lines:[],generation:0,logGeneration:0,lastRequest:0,inViewport:false,follow:true,followFrame:0,logPointerActive:false,logTop:0,clearing:false,speedTouched:false,speedSaving:false,logEmpty:isStar?'等待后端日志…':'等待浏览器日志…',browserLogCursor:0,browserLogTail:'',browserLogSource:null,browserLogArray:null};
   view.split=tasks?window.FusionMonitorLayout.divider({host:splitHost,first:tasks.root,second:logPanel,onChange:(ratio,axis)=>changeLayout(axis==='x'?{starColumnRatio:ratio}:{starTaskRatio:ratio})}):null;
   view.heightHandle=window.FusionMonitorLayout.heightHandle({host:isStar?card:logPanel,getHeight:()=>isStar?state.prefs.starCardHeight:state.prefs.browserLogHeight,min:isStar?360:80,max:isStar?1800:720,label:isStar?'调整全部星蝉卡片高度':'调整全部浏览器日志高度',onChange:height=>changeLayout(isStar?{starCardHeight:height}:{browserLogHeight:height})});
   view.logFollower=window.FusionScrollFollow.attach({scroll:logs,rows:()=>logs.querySelectorAll('.fusion-log-entry'),limit:20,onChange:enabled=>{view.follow=enabled;syncFollow(view);}});
   logs.textContent=view.logEmpty;return view;
  }
  function syncFollow(view){view.followButton.textContent=view.follow?'跟随：开':'跟随：关';view.followButton.setAttribute('aria-pressed',String(view.follow));view.followButton.title='翻看超过 20 条后关闭跟随；少量翻看时暂缓滚动，松开后恢复。';}
  function followLogs(view){if(view.logFollower&&view.logFollower.enabled!==view.follow)view.logFollower.set(view.follow);view.logFollower?.update();}
  function drawLogs(view,text){const content=text||view.logEmpty;if(view.logText!==content){const top=view.logs.scrollTop;view.logText=content;const lines=view.modeValue==='xingchan'&&view.lines.length?view.lines:content.split('\n');view.logs.replaceChildren(...lines.map(line=>node('div','fusion-log-entry',line)));view.logs.scrollTop=top;}followLogs(view);}
  async function clearLogs(uid,view){
   if(view.clearing)return;view.clearing=true;view.clearButton.disabled=true;view.logGeneration++;
   try{if(view.modeValue==='xingchan'){await state.bridge.clearLogs({uid});view.cursor=undefined;view.lines=[];}else{const p=nativeProcess(uid);view.browserLogSource=p;view.browserLogArray=p?.logs;view.browserLogCursor=Array.isArray(p?.logs)?p.logs.length:0;view.browserLogTail='';}view.logEmpty='日志已清空，等待新日志…';drawLogs(view,'');notify('已清空此账号的日志。');}finally{view.clearing=false;view.clearButton.disabled=false;}
  }
  function readBrowserLogs(uid,view){
   const p=nativeProcess(uid),chunks=p?.logs;if(!Array.isArray(chunks))return;
   if(view.browserLogSource!==p||view.browserLogArray!==chunks||chunks.length<view.browserLogCursor){view.browserLogSource=p;view.browserLogArray=chunks;view.browserLogCursor=0;view.browserLogTail='';}
   if(chunks.length===view.browserLogCursor)return;
   const incoming=chunks.slice(view.browserLogCursor).map(value=>String(value??'')).join('');view.browserLogCursor=chunks.length;
   view.browserLogTail=(view.browserLogTail+incoming).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\r\n?/g,'\n').split('\n').slice(-300).join('\n').slice(-200000);drawLogs(view,view.browserLogTail);
  }
  function reconcile(){
   if(!alive||!allowed())return;const items=ordered(),wanted=new Set(items.map(item=>item.uid));empty.hidden=items.length>0;
   root.dataset.columns=String(state.prefs.columns);root.style.setProperty('--fusion-columns',String(state.prefs.columns));toggle.checked=state.prefs.previewEnabled;columns.value=String(state.prefs.columns);
   for(const [uid,view]of views)if(!wanted.has(uid))disposeView(uid,view);
   let cursor=grid.firstElementChild;
   for(const item of items){
    let view=views.get(item.uid);if(view&&view.modeValue!==item.mode){disposeView(item.uid,view);view=null;}
    if(!view){view=makeView(item);views.set(item.uid,view);viewportObserver.observe(view.card);logSizeObserver.observe(view.logs);}
    const p=nativeProcess(item.uid),s=state.statuses.get(item.uid),isStar=item.mode==='xingchan';
    const activeStar=running(s),nativeLive=p?.status==='launched',nativeBusy=p&&['launching','closing'].includes(p.status),starBusy=state.operations.has(item.uid)||['starting','logging-in'].includes(s?.state);
    const current=isStar?s?.state||'stopped':nativeLive?'running':nativeBusy?'starting':'stopped';
    const set=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
    const originalStar=isStar&&s?.starEnhancementsEnabled===false;view.speedInput.disabled=originalStar;view.speedButton.disabled=originalStar||view.speedSaving;view.speedInput.parentElement.parentElement.hidden=originalStar;
    set(view.speedHint,isStar?(state.prefs.autoVideo2x!==false?'自动 1× / 2× 已开启':'1～1000× · 下一视频生效'):'1～16× · 立即生效');
    set(view.name,item.name);set(view.meta,isStar?(s?.displayName?'登录姓名：'+s.displayName:'星蝉日志'):'浏览器画面');
    set(view.mode,isStar?(originalStar?'星蝉 1.3 原生':'星蝉'):'浏览器');view.mode.className='fusion-badge fusion-badge-kind';
    set(view.status,label[current]||current);view.status.className='fusion-badge fusion-state-'+current;
    view.login.hidden=!isStar;set(view.login,s?.loggedIn?'已登录':'未登录');view.login.className='fusion-badge '+(s?.loggedIn?'fusion-state-running':'fusion-state-stopped');
    set(view.message,isStar?s?.summary||'星蝉已停止。':nativeBusy?'浏览器正在启动或停止…':nativeLive?'':'浏览器已停止。');
    view.message.hidden=!view.message.textContent;view.image.hidden=isStar||!view.image.src;if(view.tasks)view.tasks.root.hidden=!activeStar||starBusy;
    const ready=isStar?activeStar&&!starBusy:nativeLive,busy=isStar?starBusy:nativeBusy;
    set(view.open,isStar?'启动控制面板':'置顶浏览器');view.open.hidden=!ready;view.restartButton.hidden=!ready;view.restartButton.disabled=busy||isStar&&!canStartStar(item.uid);view.stopButton.hidden=!(isStar?activeStar||starBusy:nativeLive||nativeBusy);view.stopButton.disabled=busy;view.stopButton.parentElement.hidden=view.stopButton.hidden;
    view.browserStart.hidden=ready||busy;view.starStart.hidden=ready||busy;
    view.starStart.disabled=!canStartStar(item.uid);view.starStart.title=view.starStart.disabled?'请在自动登录配置中选择超星登录并补全账号信息':'';
    if(view.card!==cursor)grid.insertBefore(view.card,cursor);cursor=view.card.nextElementSibling;
   }
   taskControls.hidden=!items.some(item=>item.mode==='xingchan'&&running(state.statuses.get(item.uid)));applyLayouts();updateVisibility();
  }
  function disposeView(uid,view){view.generation++;view.logGeneration++;if(view.followFrame)cancelAnimationFrame(view.followFrame);viewportObserver.unobserve(view.card);logSizeObserver.unobserve(view.logs);view.split?.dispose();view.heightHandle?.dispose();view.tasks?.dispose();view.logFollower?.dispose();view.image.removeAttribute('src');view.card.remove();views.delete(uid);}
  async function readLogs(uid,view){
   const generation=view.generation,logGeneration=view.logGeneration;
   const result=await state.bridge.getLogs({uid,limit:300,...(view.cursor===undefined?{}:{after:view.cursor})});
   if(!allowed()||view.generation!==generation||view.logGeneration!==logGeneration||result?.uid!==uid)return;
   const incoming=(result.lines||[]).map(line=>typeof line==='string'?line:[line.time?new Date(line.time).toLocaleTimeString():'',line.level||'',line.message||''].filter(Boolean).join(' '));
   const reset=view.cursor===undefined||result.reset!==false;view.cursor=result.cursor;
   if(!reset&&!incoming.length)return;
   view.lines=(reset?incoming:view.lines.concat(incoming)).slice(-300);
   drawLogs(view,view.lines.join('\n'));
  }
  async function readPreview(uid,view){
   const p=nativeProcess(uid);if(!p||p.status!=='launched'||!p.worker)return;
   const generation=view.generation,requestId=uid+'-'+Date.now()+'-'+Math.random().toString(36).slice(2);
   const result=await new Promise((resolve,reject)=>{
    const onResult=payload=>{if(payload?.requestId!==requestId)return;clearTimeout(timer);p.removeListener('preview',onResult);resolve(payload);};
    const timer=setTimeout(()=>{p.removeListener('preview',onResult);reject(Error('preview timeout'));},5000);
    p.on('preview',onResult);p.worker('capturePreview',{requestId,quality:55});
   });
   if(!allowed()||view.generation!==generation)return;
   if(result.image&&result.image.length<4*1024*1024){view.image.src='data:image/jpeg;base64,'+result.image;view.image.hidden=false;view.message.textContent='';view.message.hidden=true;}
   else{view.message.textContent='画面暂不可用，可点击刷新重试。';view.message.hidden=false;}
  }
  async function tick(force=false){
   if(!allowed()||(!force&&!state.prefs.previewEnabled))return;reconcile();lastTick=Date.now();
   const work=[];
   for(const [uid,view]of views){
    if(view.clearing||view.inViewport!==true)continue;
    const star=view.modeValue==='xingchan';
    if(!star&&nativeProcess(uid)?.status!=='launched')continue;
    if(!star)readBrowserLogs(uid,view);
    if(view.pending)continue;
    if(star&&!running(state.statuses.get(uid))&&view.cursor!==undefined&&!force)continue;
    view.pending=true;view.lastRequest=Date.now();
    work.push((star?Promise.allSettled([readLogs(uid,view),...(running(state.statuses.get(uid))&&state.statuses.get(uid)?.loggedIn?[view.tasks.refresh(force)]:[])]).then(results=>{const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;}):readPreview(uid,view)).catch(()=>{if(allowed()){view.message.textContent=star?'任务状态暂不可用，日志仍会继续更新，可点击刷新重试。':'暂时无法获取画面，可点击刷新重试。';view.message.hidden=false;}}).finally(()=>view.pending=false));
   }
   await Promise.allSettled(work);
  }
  function change(){if(!allowed()){updateVisibility();return;}reconcile();if(Date.now()-lastTick>300)tick();}
  const releaseLogPointer=()=>{for(const view of views.values())view.logPointerActive=false;};
  state.listeners.add(change);
  for(const type of ['fusionvisibility','hashchange'])window.addEventListener(type,change);
  for(const type of ['pointerup','pointercancel','blur'])window.addEventListener(type,releaseLogPointer);
  document.addEventListener('visibilitychange',change);
  const timer=setInterval(()=>tick(),1000);reconcile();tick();
  return {setActive(value){active=value;for(const view of views.values())view.generation++;change();},dispose(){alive=false;clearInterval(timer);viewportObserver.disconnect();layoutObserver.disconnect();logSizeObserver.disconnect();state.listeners.delete(change);for(const type of ['fusionvisibility','hashchange'])window.removeEventListener(type,change);for(const type of ['pointerup','pointercancel','blur'])window.removeEventListener(type,releaseLogPointer);document.removeEventListener('visibilitychange',change);for(const [uid,view]of views)disposeView(uid,view);root.remove();},refresh:()=>tick(true)};
 }
 async function flushCredentials(){await state.native?.flushFusionLoginFields?.();await state.credentialsReady;await state.credentials?.flush();}
 function syncCredentialsFromStar(uid,settings){state.credentials?.fromStar(uid,settings);}
 async function exportData(){
  try{await window.FusionAccountForm?.flush();await flushCredentials();await window.__fusionSaveStore?.();const result=await state.bridge.exportConfig({ocs:JSON.parse(JSON.stringify(window.store))});if(result?.saved)notify('完整配置已导出。');}catch(error){notify(String(error?.message||'导出失败。'));}
 }
 let importPending=false;
 async function importData(input){
  if(importPending||window.__fusionImportInProgress)return;
  if((state.native?.x||[]).some(p=>p.status!=='closed')){notify('请先在学不通中停止所有浏览器和星蝉任务，并结束正在进行的登录验证，再导入配置。');return;}
  let applied=false;importPending=true;try{
   await window.FusionAccountForm?.flush();await flushCredentials();await window.__fusionSaveStore?.();window.__fusionImportInProgress=true;
   const result=await state.bridge.importConfig(input&&typeof input.filePath==='string'?{filePath:input.filePath}:undefined);if(result?.applied){applied=true;sessionStorage.setItem('fusion-import-complete',String(result.accountCount));void state.native.r.webContents.call('reload');}
  }catch(error){notify(String(error?.message||'导入失败，原配置已保留。').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{importPending=false;if(!applied)window.__fusionImportInProgress=false;}
 }
 let toastTimer=null;
 function notify(text,{role='status',closeLabel='关闭'}={}){clearTimeout(toastTimer);const previous=document.querySelector('.fusion-message');previous?.remove();const box=node('section','fusion-message'),countdown=node('span','fusion-message-countdown');box.setAttribute('role',role);countdown.setAttribute('aria-hidden','true');box.append(node('span','fusion-message-text',text),button(closeLabel,()=>{clearTimeout(toastTimer);box.remove();}),countdown);document.body.append(box);toastTimer=setTimeout(()=>box.remove(),5000);}
 window.FusionWorkspace={initialize,mountDashboard,notify,notifyError,exportData,importData,state,start,stop,restart,openHtml,isStarActive,closeAccount,flushCredentials,syncCredentialsFromStar,savePreferences,flushPreferences,setPlayback,loginProfile,canStartStar};
 const fileDrag=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
 const dropHint=node('div','fusion-import-drop-hint','松开鼠标，导入 .ocsdata 配置');dropHint.hidden=true;document.body.append(dropHint);
 const hideDrop=()=>{dropHint.hidden=true;};
 window.addEventListener('dragover',event=>{if(!fileDrag(event))return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect=importPending||window.__fusionImportInProgress?'none':'copy';dropHint.hidden=!!(importPending||window.__fusionImportInProgress);},true);
 window.addEventListener('dragleave',event=>{if(!event.relatedTarget)hideDrop();});window.addEventListener('dragend',hideDrop);window.addEventListener('blur',hideDrop);
 window.addEventListener('drop',async event=>{
  if(!fileDrag(event))return;event.preventDefault();event.stopPropagation();hideDrop();if(importPending||window.__fusionImportInProgress)return;
  const files=Array.from(event.dataTransfer.files||[]);if(files.length!==1||!files[0].name.toLowerCase().endsWith('.ocsdata')){notify('请一次拖入一个 .ocsdata 配置文件。');return;}
  try{const electron=require('electron'),filePath=electron.webUtils?.getPathForFile?electron.webUtils.getPathForFile(files[0]):files[0].path;if(!filePath)throw Error('无法读取拖入文件的位置，请使用工具菜单中的导入配置。');await importData({filePath});}catch(error){notify(error.message||'无法读取拖入的配置文件。');}
 },true);
 window.dispatchEvent(new Event('fusionworkspace-ready'));
 const imported=sessionStorage.getItem('fusion-import-complete');if(imported!==null){sessionStorage.removeItem('fusion-import-complete');notify('已导入 '+imported+' 个账号及对应配置。');}
})();
