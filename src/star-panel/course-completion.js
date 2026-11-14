(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionCourseCompletion=api;})(globalThis,()=>{
 'use strict';
 function task(course,progress){const total=Number(progress?.job_count),done=Number(progress?.job_finish_count);if(progress&&progress.job_count!=null&&progress.job_finish_count!=null&&Number.isFinite(total)&&Number.isFinite(done)&&total>=0&&done>=0)return {known:true,total,done:Math.min(done,total),complete:done>=total};return course.finished===true?{known:true,complete:true}:{known:false,complete:null};}
 function decision(mode,states){const parts=(mode==='both'?['task','homework']:[mode]).map(key=>states[key]||{});return parts.some(s=>s.known&&s.complete===false)?'add':parts.every(s=>s.known&&s.complete===true)?'complete':'unknown';}
 function label(kind,state){const name=kind==='task'?'任务点':'作业';if(!state?.known)return name+'进度未确认';if(state.total===0)return '无'+name;if(state.total!=null)return name+(state.complete?'已完成 ':' ')+state.done+'/'+state.total;return name+(state.complete?'已完成':'未完成')+(!state.complete&&Number.isFinite(state.remaining)?' · 剩余 '+state.remaining:'');}
 return {task,decision,label};
});
