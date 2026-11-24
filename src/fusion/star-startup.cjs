'use strict';
// Run once for a newly started backend, after login and before reporting ready.
async function applyStarStartup({uid,controller,starMonitor,preferences,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),clock=Date.now}){
 const runtime=controller.runtimes.get(uid);
 if(!runtime?.loggedIn)return;
 if(runtime.startupSetupPromise)return runtime.startupSetupPromise;
 const current=()=>controller.runtimes.get(uid)===runtime&&!runtime.stopping&&!runtime.exited&&!runtime.abort?.signal.aborted;
 runtime.startupSetupPromise=(async()=>{
  if(runtime.enhanced!==false&&preferences.speeds[uid]!==undefined)await controller.request(runtime,'PUT','/api/integration/playback',{beisu:preferences.speeds[uid]});
  let count;
  try{
   if(runtime.enhanced===false){
    const result=await controller.request(runtime,'GET','/api/queue');
    const items=Array.isArray(result)?result:result?.items;
    if(!Array.isArray(items))throw Error('invalid_queue');count=items.length;
   }else{
    const deadline=clock()+30000;let progress;
    do{if(!current())return;progress=await controller.request(runtime,'GET','/api/integration/monitor-progress');if(progress?.queue?.restore_ready)break;await sleep(250);}while(clock()<deadline);
    if(!progress?.queue?.restore_ready||!Number.isInteger(progress.queue.course_total)||progress.queue.course_total<0)throw Error('queue_not_ready');
    count=progress.queue.course_total;
   }
  }catch(error){if(current())controller.appendLog(uid,'WARN','课程队列尚未确认，未自动开始任务；可打开控制面板查看。');return;}
  if(!current())return;
  if(count===0){
   try{await controller.openHtml({uid});controller.appendLog(uid,'INFO','课程队列为空，已打开控制面板，请添加课程。');}
   catch{if(current())controller.appendLog(uid,'WARN','课程队列为空，控制面板未能自动打开，请点击“打开控制面板”。');}
   return;
  }
  if(preferences.launchPlans[uid]?.autoRunStar&&!runtime.autoRunApplied){
   runtime.autoRunApplied=true;
   if(runtime.enhanced===false){controller.appendLog(uid,'INFO','原生模式请在控制面板中开始任务。');return;}
   await starMonitor.action({uid,action:'start'});controller.appendLog(uid,'INFO','已按账号设置自动开始保存的课程队列。');
  }
 })();
 return runtime.startupSetupPromise;
}
module.exports={applyStarStartup};
