'use strict';
const {uidOf}=require('./controller.cjs');
const queueItems=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:null;
const queueKey=item=>[item?.course_id,item?.clazz_id,item?.chapter_id,item?.mode||'task'].join(':');
class StarMonitor {
 constructor(controller){this.controller=controller;controller.onMonitorEvent=(r,event)=>this.observe(r,event);}
 state(r){return r.monitor??={queue:[],run:{},live:new Map(),details:new Map(),revision:0,received:false,lastLocalRead:0,visit:{state:'idle'},pending:null};}
 observe(r,event){
  const s=this.state(r),p=event.payload||{};let changed=true;
  if(event.type==='snapshot'){const items=queueItems(p.queue);if(items!==null){s.queue=items;s.received=true;}else s.received=false;s.run=p.run||{};}
  else if(event.type==='queue.changed'){const items=queueItems(p);if(items!==null)s.queue=items;else s.received=false;s.details.clear();s.live.clear();}
  else if(event.type==='queue.item'){if(Number.isInteger(p.index)){
   const previous=s.queue[p.index],next={...previous,...(p.item||p)};s.queue[p.index]=next;
   if(queueKey(previous)!==queueKey(next)){s.details.delete(p.index);for(const key of s.live.keys())if(key.startsWith(p.index+':'))s.live.delete(key);}
   else{const entry=s.details.get(p.index);if(entry)entry.stale=true;}
  }}
  else if(event.type==='run.state')s.run=p;
  else if(event.type==='integration.progress')s.progress=p;
  else if(event.type==='task.event'){s.currentChapter=String(p.chapter_id||'');s.live.set(p.queue_index+':'+String(p.chapter_id||'')+':'+p.index,p);if(s.live.size>4000)s.live.delete(s.live.keys().next().value);}
  else changed=false;
  if(changed){s.revision++;s.lastEventAt=Date.now();}
 }
 runtime(uid){uidOf(uid);const r=this.controller.runtimes.get(uid);if(!r?.port||!r.loggedIn||r.stopping||r.exited)throw Error('星蝉尚未登录或已停止。');return r;}
 async snapshot({uid,queueIndex,force=false,knownRevision,knownIndex},attempt=0){
  const r=this.runtime(uid),s=this.state(r);
  const retry=()=>{if(attempt>=2)throw Error('任务状态正在变化，请稍后重试。');return this.snapshot({uid,queueIndex},attempt+1);};
  // Queue/run reads are local. Chapters/tasks are fetched only after a chapter/queue change.
  if(!s.received||(!r.socket||r.socket.readyState!==1)&&Date.now()-s.lastLocalRead>5000){
   if(!s.pending){const revision=s.revision;s.pending=Promise.all([this.controller.request(r,'GET','/api/queue'),this.controller.request(r,'GET','/api/run')]).then(([queue,run])=>{if(s.revision!==revision)return;const items=queueItems(queue);if(items===null)throw Error('队列返回格式无效，已保留现有列表。');s.queue=items;s.run=run;s.received=true;s.lastLocalRead=Date.now();s.revision++;}).finally(()=>s.pending=null);}
   await s.pending;
  }
  if(r.enhanced!==false&&(!s.progress||Date.now()-(s.lastProgressRead||0)>5000)){try{const progress=await this.controller.request(r,'GET','/api/integration/monitor-progress');if(s.progress?.revision!==progress.revision)s.revision++;s.progress=progress;s.lastProgressRead=Date.now();}catch{}}
  const active=Number.isInteger(s.run.active_index)&&s.run.active_index>=0?s.run.active_index:0;
  const index=Number.isInteger(queueIndex)&&queueIndex>=0&&queueIndex<s.queue.length?queueIndex:active<s.queue.length?active:s.queue.length?0:-1;
  let detail={tasks:[],homeworks:[],chapters:[],tree:[],course:'',currentChapter:'',mode:'task'};
  if(index>=0){
   const item=s.queue[index],key=queueKey(item),signature=key+':'+(index===active?[s.run.task_total,s.currentChapter].join(':'):'');
   let entry=s.details.get(index);
   if(!force&&knownRevision===s.revision&&knownIndex===index&&entry&&!entry.stale&&!entry.promise&&entry.signature===signature&&entry.key===key)return {uid,revision:s.revision,queueIndex:index,notModified:true};
   if(!entry||entry.stale||entry.signature!==signature||force){
    entry={key,signature,stale:false,promise:null,value:entry?.key===key?entry.value:undefined};s.details.set(index,entry);while(s.details.size>4){const oldest=s.details.keys().next().value;if(oldest===index)break;s.details.delete(oldest);}
    entry.promise=Promise.all([this.controller.request(r,'GET','/api/queue/'+index+'/tasks'),this.controller.request(r,'GET','/api/queue/'+index+'/chapters'),r.enhanced!==false&&item?.mode==='both'?this.controller.request(r,'GET','/api/integration/queue/'+index+'/homeworks'):Promise.resolve({tasks:[]})]).then(([tasks,tree,homeworks])=>{
     if(item?.mode==='homework')tasks={...tasks,tasks:(tasks.tasks||[]).map(t=>({...t,chapter_id:'homework'}))};
     const old=entry.value?.taskRows||{},order=new Map((tasks.chapters||[]).map((c,i)=>[String(c.id),i]));
     for(const t of tasks.tasks||[])old[String(t.chapter_id||'')+':'+t.index]={...t,_order:order.get(String(t.chapter_id))??999};
     entry.value={tasks:tasks.tasks||[],homeworks:homeworks.tasks||[],mode:item?.mode||'task',chapters:tasks.chapters||[],tree:tree.chapters||[],course:tree.course||tasks.course||item?.label||item?.name||'',unfinishCount:tree.unfinish_count,currentChapter:String(tasks.current_chapter||''),taskRows:old};return entry.value;
    }).finally(()=>entry.promise=null);
   }
   if(entry.promise)try{await entry.promise;}catch(error){if(s.details.get(index)!==entry)return retry();s.details.delete(index);throw error;}
   if(s.details.get(index)!==entry||queueKey(s.queue[index])!==key||entry.stale)return retry();
   detail=entry.value||detail;
  }
  return {uid,enhanced:r.enhanced!==false,revision:s.revision,queue:s.queue,run:s.run,queueIndex:index,...detail,progress:s.progress||null,live:[...s.live.values()].filter(t=>t.queue_index===index),visit:s.visit};
 }
 async action({uid,action,queueIndex}){
  const r=this.runtime(uid),s=this.state(r);
  if(action==='visitEmpty'){
   if(s.visit.state==='running')return {accepted:true,alreadyRunning:true};
   const snapshot=await this.snapshot({uid,queueIndex});if(snapshot.queueIndex<0)throw Error('此账号队列为空，请先在控制面板添加课程。');
   if(snapshot.mode==='homework')return {accepted:true,skipped:true,reason:'homework_only'};
   s.visit={state:'running',queueIndex:snapshot.queueIndex};s.revision++;
   this.controller.request(r,'POST','/api/queue/'+snapshot.queueIndex+'/visit-chapters',undefined,3600000).then(result=>{s.visit={state:'done',...result};this.controller.appendLog(uid,'INFO','补空章节完成：'+JSON.stringify(result));}).catch(()=>{s.visit={state:'failed'};this.controller.appendLog(uid,'ERROR','补空章节操作未完成，请查看控制面板日志。');}).finally(()=>{s.details.delete(snapshot.queueIndex);s.revision++;});
   return {accepted:true};
  }
  if(['pause','stop'].includes(action))this.controller.cancelAutomaticRelogin?.(uid);
  if(!['start','pause','resume','stop'].includes(action))throw Error('任务操作无效。');
  if(s.command)throw Error('上一个任务操作仍在处理，请稍候。');
  s.command=true;
  try{
   if(r.enhanced!==false&&['pause','stop'].includes(action))await this.controller.request(r,'POST','/api/integration/recovery/cancel');
   let body;if(action==='start'){
    body=r.enhanced===false?await this.controller.getNativeRunOptions(uid):await this.controller.request(r,'GET','/api/integration/run-options');
   }
   await this.controller.request(r,'POST','/api/run/'+action,body,30000);
   s.run=await this.controller.request(r,'GET','/api/run');s.revision++;return {accepted:true,run:s.run};
  }finally{s.command=false;}
 }
}
module.exports={StarMonitor};
