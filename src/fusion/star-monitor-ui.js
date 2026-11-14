(()=>{
 'use strict';
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const statuses={manual:'待人工',pending:'待执行',done:'已完成',ok:'已完成',server_done:'平台已完成',skipped:'已跳过',local_done:'本地完成',unverified:'待确认',failed:'失败',running:'执行中',waiting_face:'待人脸',stopped:'已中断',partial:'未完成',empty:'无任务点'};
 const isFailed=value=>value==='failed';
 const modes={task:'任务点',homework:'作业',both:'任务点与作业'};
 const types={discussion:'讨论',survey:'问卷',read:'阅读',book:'图书',video:'视频',work:'章节测试',workid:'章节测试',homework:'作业',live:'直播',document:'文档',audio:'音频',unknown:'其他任务'};
 function mount({host,uid,bridge,onError,onSnapshot}){
  const root=el('section','fusion-star-tasks'),run=el('div','fusion-task-run'),info=el('span','fusion-task-run-info','未在执行');
  const progressGroup=el('div','fusion-monitor-progress');
  function progressRow(label,kind){const row=el('div','fusion-progress-row'),heading=el('div','fusion-progress-heading'),title=el('strong','',label),detail=el('span','fusion-progress-detail'),track=el('div','fusion-task-progress'),fill=el('span','fusion-progress-fill');heading.append(title,detail);track.setAttribute('role','progressbar');track.setAttribute('aria-label',label);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.dataset.progressKind=kind;track.append(fill);row.append(heading,track);progressGroup.append(row);return {row,detail,track,fill};}
  const videoProgress=progressRow('当前视频','video'),queueProgress=progressRow('全队列总进度','queue');
  const actions=el('div','fusion-task-run-buttons');let data=null,busy=false,onlyFailed=false,pinned=false,followed=-1,signature='',rendered='',alive=true;const expanded=new Set();
  const action=async kind=>{if(busy)return;busy=true;renderRun();try{if(kind==='start')pinned=false;await bridge.starTaskAction({uid,action:kind,queueIndex:data?.queueIndex});await refresh(true);}finally{busy=false;renderRun();}};
  const btn=(text,kind)=>{const b=el('button','fusion-button'+(kind==='start'?' fusion-primary-button':''),text);b.type='button';b.onclick=()=>action(kind).catch(onError);b.setAttribute('aria-label',text+'当前账号');return b;};
  const start=btn('开始刷课','start'),pause=btn('暂停','pause'),resume=btn('继续','resume'),stop=btn('停止','stop');actions.append(start,pause,resume,stop);run.append(info,actions);
  const course=el('select','fusion-task-course');course.setAttribute('aria-label','监控课程');course.onchange=()=>{pinned=true;refresh(true,Number(course.value)).catch(onError);};
  const taskHeading=el('div','fusion-task-heading'),followActions=el('div','fusion-log-actions'),followToggle=el('button','fusion-mini-button','跟随：开');
  followToggle.type='button';followToggle.setAttribute('aria-label','跟随当前任务');followToggle.setAttribute('aria-pressed','true');followToggle.title='翻看超过 10 条任务后关闭跟随；少量翻看时暂缓滚动，松开后恢复。';followActions.append(followToggle);
  const summary=el('p','fusion-task-summary'),scroll=el('div','fusion-task-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','账号任务列表');const table=el('table','fusion-task-table'),head=el('thead'),hr=el('tr');
  for(const name of ['章节','任务','类型','状态'])hr.append(el('th','',name));head.append(hr);const body=el('tbody');table.append(head,body);scroll.append(table);taskHeading.append(summary,followActions);root.append(progressGroup,run,course,taskHeading,scroll);host.append(root);
  const taskFollower=window.FusionScrollFollow.attach({scroll,rows:()=>body.querySelectorAll('tr'),limit:10,target:()=>body.querySelector('[data-current-task="true"]')||body.querySelector('[data-current="true"]')||body.querySelector('[data-status="running"]')||body.querySelector('[data-status="pending"]'),onChange:enabled=>{followToggle.textContent=enabled?'跟随：开':'跟随：关';followToggle.setAttribute('aria-pressed',String(enabled));}});followToggle.onclick=()=>taskFollower.set(!taskFollower.enabled);
  const currentStatus=(task,index,chapter)=>FusionTaskState.status(task,data?.live?.find(t=>String(t.chapter_id||'')===String(chapter||'')&&t.index===index));
  let expandedCurrent='';
  function badge(status){return el('span','fusion-task-badge fusion-task-'+(status==='local_done'?'done':status),statuses[status]||status||'待执行');}
  const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
  const percent=value=>number(value)?Math.min(100,value):null;
  const duration=value=>{const n=Math.floor(value),s=String(n%60).padStart(2,'0'),m=Math.floor(n/60);return m>=60?Math.floor(m/60)+':'+String(m%60).padStart(2,'0')+':'+s:m+':'+s;};
  function drawProgress(view,value,text){const known=value!==null;view.track.dataset.unknown=String(!known);view.detail.textContent=text;view.track.setAttribute('aria-valuetext',text);if(known)view.track.setAttribute('aria-valuenow',String(Math.round(value*10)/10));else view.track.removeAttribute('aria-valuenow');view.fill.style.width=known?value+'%':'0';view.fill.hidden=!known;}
  function renderProgress(){
   progressGroup.hidden=data?.enhanced===false;if(progressGroup.hidden)return;
   const video=data?.progress?.video||{},queue=data?.progress?.queue||{},videoValue=percent(video.percent);
   const time=number(video.current_seconds)&&number(video.duration_seconds)&&video.duration_seconds>0?duration(video.current_seconds)+' / '+duration(video.duration_seconds):'';
   const videoText=[video.name||'',time,videoValue===null?(video.active?'时长暂未取得':'暂无当前视频'):Math.round(videoValue*10)/10+'%'].filter(Boolean).join(' · ');
   drawProgress(videoProgress,videoValue,videoText);videoProgress.detail.title=videoText;
   let queueValue=null,queueText='队列进度暂未取得';
   if(queue.task_counts_complete===true&&number(queue.task_total)&&queue.task_total>0&&number(queue.task_done)){
    queueValue=percent(queue.task_percent)??Math.min(100,queue.task_done/queue.task_total*100);queueText='任务 '+Math.min(queue.task_done,queue.task_total)+' / '+queue.task_total;
   }else if(queue.course_counts_complete!==false&&number(queue.course_total)&&queue.course_total>0&&number(queue.course_done)){
    queueValue=percent(queue.course_percent)??Math.min(100,queue.course_done/queue.course_total*100);queueText='课程 '+Math.min(queue.course_done,queue.course_total)+' / '+queue.course_total+(queue.task_counts_complete===true?'':'（任务总数尚未取全）');
   }else if(queue.course_total===0)queueText='队列为空';
   if(queueValue!==null)queueText+=' · '+Math.round(queueValue*10)/10+'%';drawProgress(queueProgress,queueValue,queueText);queueProgress.detail.title=queueText;
  }
  function renderRun(){
   const r=data?.run||{};renderProgress();
   info.textContent=r.stopping?'正在停止…':r.running?[(r.paused?'已暂停':'执行中'),r.active_label,r.task_name].filter(Boolean).join(' · '):'未在执行';
   start.hidden=!!r.running;pause.hidden=!r.running||!!r.paused;resume.hidden=!r.running||!r.paused;stop.hidden=!r.running;
   for(const b of [start,pause,resume,stop])b.disabled=busy||!data||!!r.stopping;
  }
  function render(){const top=scroll.scrollTop;try{renderContent();}finally{scroll.scrollTop=top;taskFollower.update();}}
  function renderContent(){
   if(!data||!alive)return;renderRun();
   const current=FusionTaskState.active(data);
   expandedCurrent=FusionTaskState.fold(expanded,expandedCurrent,current,data.tree,currentStatus);
   const queue=data.queue||[],sig=JSON.stringify([queue,data.queueIndex]);if(sig!==signature){signature=sig;const options=queue.flatMap((q,i)=>{if(q.pending_removal)return [];const o=el('option','',(i+1)+'. '+(q.label||q.name||q.course_name||q.course?.name||q.course_id||'课程')+' · '+(modes[q.mode]||modes.task));o.value=String(i);return [o];});course.replaceChildren(...options);course.value=String(data.queueIndex);course.hidden=!queue.length;}
   const contentSig=JSON.stringify([data.queueIndex,data.currentChapter,data.run?.task_index,data.run?.running,data.tree,data.taskRows,data.tasks,data.homeworks,data.mode,data.live,onlyFailed,[...expanded],data.visit]);if(contentSig===rendered)return;rendered=contentSig;body.replaceChildren();let shown=0,failures=0;
   if(data.tree?.length)for(const c of data.tree)failures+=(c.tasks||[]).filter((t,i)=>isFailed(currentStatus(t,t.index??i,c.id))).length;else failures=Object.values(data.taskRows||{}).filter(t=>isFailed(currentStatus(t,t.index,t.chapter_id))).length;
   failures+=(data.homeworks||[]).filter((t,i)=>isFailed(currentStatus(t,t.index??i,'homework'))).length;
   function taskRow(task,index,chapter,label,kid=false){const status=currentStatus(task,index,chapter);if(onlyFailed&&!isFailed(status))return;const tr=el('tr',kid?'fusion-task-child':'');tr.dataset.status=status;tr.dataset.currentTask=String(current?.chapter===String(chapter)&&current.index===index);const type=task.type||task.task_type||'';tr.append(el('td','',label||''),el('td','',task.name||task.title||'任务点'),el('td','',types[type]||type));const td=el('td');td.append(badge(status));tr.append(td);body.append(tr);shown++;}
   if(data.tree?.length){
    for(const chapter of data.tree){
     const kids=chapter.tasks||[],stateSummary=FusionTaskState.chapter(chapter,currentStatus),hasFailed=stateSummary.status==='failed'||(data.live||[]).some(t=>String(t.chapter_id)===String(chapter.id)&&isFailed(t.status)),status=stateSummary.status;
     if(onlyFailed&&!hasFailed)continue;
     const tr=el('tr','fusion-task-chapter');tr.dataset.status=status;tr.dataset.current=String(current?.chapter===String(chapter.id));
     const label=el('td','',chapter.label||'—'),nameCell=el('td'),toggle=el('button','fusion-task-expand',(expanded.has(String(chapter.id))?'▾ ':'▸ ')+(chapter.name||'章节'));toggle.type='button';toggle.setAttribute('aria-expanded',String(expanded.has(String(chapter.id))));toggle.onclick=()=>{const id=String(chapter.id);expanded.has(id)?expanded.delete(id):expanded.add(id);rendered='';render();};nameCell.append(toggle);
     const count=el('td','',kids.length?kids.length+' 个':chapter.has_points?'未取到':Number(chapter.clickcount)>0?'访问 '+chapter.clickcount+' 次':'未访问'),state=el('td');const stateBadge=badge(status);if(status==='pending'&&stateSummary.remaining!=null)stateBadge.textContent='待完成 '+stateSummary.remaining;state.append(stateBadge);tr.append(label,nameCell,count,state);body.append(tr);shown++;
     if(expanded.has(String(chapter.id))||onlyFailed){if(kids.length)kids.forEach((t,i)=>taskRow(t,t.index??i,chapter.id,'',true));else if(chapter.has_points){const hint=el('tr'),td=el('td','','执行到该章时才会获取任务点');td.colSpan=4;hint.append(td);body.append(hint);}}
    }
   }else{const tasks=Object.values(data.taskRows||{});(tasks.length?tasks:data.tasks||[]).sort((a,b)=>(a._order||0)-(b._order||0)||(a.index||0)-(b.index||0)).forEach((t,i)=>taskRow(t,t.index??i,t.chapter_id,t.chapter||''));}
   (data.homeworks||[]).forEach((task,index)=>taskRow(task,task.index??index,'homework','课程作业'));
   if(!shown){const tr=el('tr'),td=el('td','fusion-task-empty',onlyFailed?'当前课程没有失败项':queue.length?(data.mode==='homework'?'当前课程没有待执行的作业。':'执行到章节后将显示任务点。'):'队列为空，请先在控制面板添加课程。');td.colSpan=4;tr.append(td);body.append(tr);}
   summary.textContent=(data.course||'任务列表')+' · '+(modes[data.mode]||modes.task)+(onlyFailed?' · 只看失败':'')+(failures?' · 失败 '+failures:'')+(data.visit?.state==='running'?' · 正在补空章节访问次数':data.visit?.state==='failed'?' · 补空未完成，请查看日志':'');
  }
  async function refresh(force=false,index){
   const wanted=index===undefined?(pinned?data?.queueIndex:undefined):index;
   const next=await bridge.getStarMonitor({uid,...(wanted===undefined?{}:{queueIndex:wanted}),force,knownRevision:data?.revision,knownIndex:data?.queueIndex});if(!alive||next.notModified)return;
   if(Number.isInteger(next.run?.active_index)&&next.run.active_index>=0&&followed!==next.run.active_index){followed=next.run.active_index;if(index===undefined&&pinned){pinned=false;data=next;return refresh(false);}}
   if(pinned&&next.queue?.[next.queueIndex]?.pending_removal){pinned=false;data=next;return refresh(false);}
   data=next;onSnapshot?.(next);render();
  }
  renderRun();
  return {root,refresh,setOnlyFailed(value){onlyFailed=value;rendered='';render();},jumpFailed(){if(!data)return false;for(const c of data.tree||[])if((c.tasks||[]).some((t,i)=>isFailed(currentStatus(t,t.index??i,c.id))))expanded.add(String(c.id));rendered='';render();const row=body.querySelector('[data-status="failed"]');if(!row)return false;scroll.scrollTop=Math.max(0,row.offsetTop-scroll.offsetTop-scroll.clientHeight/2);row.classList.remove('fusion-task-flash');void row.offsetWidth;row.classList.add('fusion-task-flash');return true;},visitEmpty:()=>action('visitEmpty'),get queueIndex(){return data?.queueIndex;},dispose(){alive=false;taskFollower.dispose();root.remove();data=null;}};
 }
 window.FusionStarMonitor={mount};
})();
