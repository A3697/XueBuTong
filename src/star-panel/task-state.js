(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionTaskState=api;})(globalThis,()=>{
 'use strict';
 const done=new Set(['done','ok','server_done','local_done']);
 const quiz=new Set(['work','workid','quiz','homework','discussion','survey']);
 const incomplete=new Set(['running','partial','failed','cancelled','stopped','waiting_face','face_required','unsupported','course_ended','unverified','manual']);
 function status(task={},live){
  const raw=live?.status||task.status||'',observed=['pending','ready','loading'].includes(raw)?'':raw;
  if(incomplete.has(observed))return observed;
  if(observed==='server_done'||live?.status==='ok')return observed;
  const isQuiz=quiz.has(task.task_type||task.type);
  if(task.server_done)return 'server_done';
  if(task.finished||task.isPassed||task.extra?.isPassed)return 'done';
  const local=task.local_done||['skipped','local_done'].includes(observed);
  if(task.completion_verified===true||task.extra?.completion_verified===true)return local?'local_done':'done';
  if(task.done||local||['done','ok'].includes(observed))return isQuiz?'unverified':local?'local_done':observed||'done';
  return observed||'pending';
 }
 // Loaded task results are newer than the catalogue snapshot fetched on enqueue.
 function chapter(item,getStatus=task=>status(task)){
  const kids=item.tasks||[],states=kids.map((task,i)=>getStatus(task,task.index??i,item.id));
  if(states.length){
   if(states.includes('running'))return {status:'running',remaining:states.filter(s=>!done.has(s)).length};
   if(states.includes('failed'))return {status:'failed',remaining:states.filter(s=>!done.has(s)).length};
   if(states.includes('partial'))return {status:'partial',remaining:states.filter(s=>!done.has(s)).length};
   if(states.includes('unverified'))return {status:'unverified',remaining:states.filter(s=>!done.has(s)).length};
   const remaining=states.filter(s=>!done.has(s)).length;
   return {status:remaining?'pending':'done',remaining};
  }
  if(item.state==='running')return {status:'running'};
  if(item.state==='failed')return {status:'failed'};
  if(item.state==='partial')return {status:'partial'};
  if(item.catalog_state==='done'||item.finished)return {status:'done',remaining:0};
  if(item.catalog_state==='empty'||!item.has_points)return {status:'empty',remaining:0};
  const value=item.catalog_unfinished??(Number(item.jobcount)-Number(item.finishcount));
  return {status:'pending',remaining:Number.isFinite(Number(value))&&Number(value)>0?Number(value):null};
 }
 function active({run={},queueIndex,currentChapter,live=[]}){
  if(!run.running||run.active_index!==queueIndex)return null;
  const latest=live.filter(t=>t.status==='running'&&String(t.chapter_id)===String(currentChapter)).at(-1);
  const index=latest?.index??run.task_index;
  if(!currentChapter||!Number.isInteger(index)||index<0)return null;
  const event=live.find(t=>String(t.chapter_id)===String(currentChapter)&&t.index===index);
  if(event&&event.status!=='running')return null;
  return {chapter:String(currentChapter),index,key:queueIndex+':'+currentChapter+':'+index};
 }
 function course(chapters,getStatus){
  if(!chapters?.length)return null;
  const leaves=chapters.filter(item=>!item.is_container),states=leaves.map(item=>chapter(item,getStatus));
  if(!leaves.some(item=>(item.tasks||[]).length||item.has_points))return null;
  if(states.every(item=>['done','empty'].includes(item.status)))return {known:true,complete:true,remaining:0,source:'loaded_tasks'};
  const observed=leaves.map((item,i)=>({item,state:states[i]})).filter(({item,state})=>(item.tasks||[]).length||['partial','failed'].includes(state.status));
  if(observed.some(({state})=>!['done','empty','unverified'].includes(state.status))){
   const remaining=states.every(state=>Number.isFinite(state.remaining))?states.reduce((sum,state)=>sum+state.remaining,0):null;
   return {known:true,complete:false,remaining,source:'loaded_tasks'};
  }
  if(observed.some(({state})=>state.status==='unverified'))return {known:false,complete:null,source:'loaded_tasks'};
  return null;
 }
 // Expansion ownership changes only when the current subsection changes. A user
 // can still inspect another subsection until execution advances again.
 function fold(expanded,previous,current,chapters,getStatus){
  const key=current?.chapter||'';
  if(key&&key!==previous){expanded.clear();expanded.add(key);}
  else if(!key&&previous){const item=(chapters||[]).find(c=>String(c.id)===previous);if(!item||['done','empty'].includes(chapter(item,getStatus).status))expanded.delete(previous);}
  return key||previous&&expanded.has(previous)&&previous||'';
 }
 function queue(value){return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:null;}
 return {done,status,chapter,active,course,fold,queue};
});
