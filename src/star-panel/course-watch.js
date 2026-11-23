(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionCourseWatch=api;})(globalThis,()=>{
 'use strict';
 const key=c=>String(c.course_id)+':'+String(c.clazz_id);
 const messages={disabled:'未启用',waiting_login:'等待登录',waiting:'监控中',scanning:'检查中',switching:'正在优先切换',loading:'等待章节就绪',suspended:'已暂停',error:'检查未完成'};
 function normalize(value={}){
  const interval=Number(value.interval_seconds);
  return{enabled:value.enabled===true,interval_seconds:Number.isInteger(interval)&&interval>=60&&interval<=86400?interval:300,
   courses:Array.isArray(value.courses)?[...new Map(value.courses.filter(c=>c&&typeof c.course_id==='string'&&typeof c.clazz_id==='string'&&/^\d{1,32}$/.test(c.course_id)&&/^\d{1,32}$/.test(c.clazz_id)).map(c=>[key(c),{course_id:c.course_id,clazz_id:c.clazz_id}])).values()].slice(0,200):[]};
 }
 function describe(value){
  const config=normalize(value?.config),state=value?.state||{};
  return !config.enabled?'课程开放监控未启用':(messages[state.status]||'监控中')+' · '+config.courses.length+' 门课程'+(state.message?' · '+state.message:'');
 }
 let activeDialog=null,pendingOpen=null;
 function open(options){
  if(activeDialog?.isConnected){activeDialog.focus();return Promise.resolve(activeDialog);}
  if(pendingOpen)return pendingOpen;
  pendingOpen=showDialog(options).then(dialog=>{activeDialog=dialog;dialog.addEventListener('close',()=>{if(activeDialog===dialog)activeDialog=null;},{once:true});return dialog;}).finally(()=>{pendingOpen=null;});
  return pendingOpen;
 }
 async function showDialog({courses,blacklist=[],api,onChange=()=>{}}){
  const initial=await api('GET','/api/integration/course-watch');
  let value=normalize(initial.config),saved=initial,busy=false,closed=false;
  const selected=new Map(value.courses.map(c=>[key(c),c])),known=new Map(courses.map(c=>[key(c),c]));
  const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
  const dialog=el('dialog','course-filter-dialog course-watch-dialog'),header=el('header','course-filter-heading'),title=el('h2','','监控课程开放');
  title.id='course-watch-title';dialog.setAttribute('aria-labelledby',title.id);
  const enableLabel=el('label','course-filter-switch'),enabled=el('input');enabled.type='checkbox';enabled.setAttribute('role','switch');enabled.setAttribute('aria-label','启用课程开放监控');enabled.checked=value.enabled;
  enableLabel.append(enabled,document.createTextNode('启用监控'));header.append(title,enableLabel);
  const intervalLabel=el('label','course-watch-interval','扫描间隔（分钟）'),interval=el('input');interval.type='number';interval.min='1';interval.max='1440';interval.step='1';interval.value=String(value.interval_seconds/60);interval.setAttribute('aria-label','扫描间隔（分钟）');
  intervalLabel.title='每轮按顺序检查所选课程，间隔为 1～1440 分钟。发现新开放章节后请求停止当前执行，保存进度后优先切换；实际发现时间受扫描间隔影响。关闭面板后仍继续监控。';intervalLabel.append(interval);
  const search=el('input');search.type='search';search.placeholder='按课程名称筛选';search.setAttribute('aria-label','筛选监控课程');
  const status=el('p','note course-watch-status');status.setAttribute('role','status');status.textContent=describe(saved);
  const list=el('div','course-filter-list'),footer=el('footer','course-watch-footer'),resume=el('button','sm','恢复监控'),cancel=el('button','sm','取消'),save=el('button','sm primary','保存');
  resume.title='手动暂停或停止任务后，课程监控暂停；点击恢复后继续检查所选课程。';footer.append(resume,cancel,save);dialog.append(header,intervalLabel,search,status,list,footer);document.body.append(dialog);
  function lock(){for(const input of dialog.querySelectorAll('input,button'))input.disabled=busy;for(const input of list.querySelectorAll('[data-blocked]'))input.disabled=true;resume.hidden=!saved.config?.enabled||!saved.state?.suspended;}
  function draw(){
   list.replaceChildren();const query=search.value.trim().toLowerCase(),all=[...known.values(),...value.courses.filter(c=>!known.has(key(c)))];
   for(const course of all){const id=key(course),available=known.has(id),blocked=blacklist.includes(id),name=course.name||('课程 '+course.course_id);
    if(query&&!name.toLowerCase().includes(query))continue;
    const row=el('article','course-filter-row'+(blocked?' blocked':'')),info=el('div','course-filter-info'),label=el('label','course-filter-switch'),pick=el('input');pick.type='checkbox';pick.setAttribute('role','switch');pick.setAttribute('aria-label','监控 '+name);pick.checked=selected.has(id);
    info.append(el('strong','',name),el('small','',blocked?'已拉黑，不参与监控':!available?'暂未在课程列表找到；保留选择，登录后重新确认':'课程 ID '+course.course_id));
    if(blocked){pick.dataset.blocked='true';pick.disabled=true;pick.title='请先在课程筛选的黑名单中解除';}
    pick.onchange=()=>{if(pick.checked)selected.set(id,{course_id:String(course.course_id),clazz_id:String(course.clazz_id)});else selected.delete(id);};label.append(pick);row.append(info,label);list.append(row);
   }
   if(!list.childElementCount)list.append(el('p','empty','没有符合条件的课程'));lock();
  }
  cancel.onclick=()=>dialog.close();search.oninput=draw;
  save.onclick=async()=>{
   if(busy)return;const minutes=Number(interval.value);
   if(!Number.isInteger(minutes)||minutes<1||minutes>1440){status.textContent='扫描间隔请输入 1～1440 的整数分钟。';interval.focus();return;}
   const next={enabled:enabled.checked,interval_seconds:minutes*60,courses:[...selected.values()]};
   if(next.enabled&&!next.courses.length){status.textContent='请至少选择一门课程。';return;}
   busy=true;lock();try{saved=await api('PUT','/api/integration/course-watch',next);onChange(saved);dialog.close();}catch(error){status.textContent='保存未完成：'+String(error?.message||'请重试');}finally{busy=false;if(!closed)lock();}
  };
  resume.onclick=async()=>{if(busy)return;busy=true;lock();try{saved=await api('POST','/api/integration/course-watch/resume');status.textContent=describe(saved);onChange(saved);}catch(error){status.textContent='恢复未完成：'+String(error?.message||'请重试');}finally{busy=false;if(!closed)lock();}};
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{closed=true;dialog.remove();},{once:true});draw();dialog.showModal();return dialog;
 }
 return{key,normalize,describe,open};
});
