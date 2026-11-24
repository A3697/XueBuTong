'use strict';
const {setTimeout:delay}=require('node:timers/promises');

// Queue restoration may take minutes. It is a background phase of this runtime,
// not a second login and not a reason to leave the launch button pending.
function applyStarStartup({uid,controller,starMonitor,preferences,getPreferences=()=>preferences,
 sleep=(ms,signal)=>delay(ms,undefined,{signal,ref:false}),clock=Date.now}){
 const runtime=controller.runtimes.get(uid);
 if(!runtime?.loggedIn)return Promise.resolve();
 if(runtime.startupSetupPromise)return runtime.startupSetupPromise;
 const abort=new AbortController();
 const signal=runtime.abort?AbortSignal.any([abort.signal,runtime.abort.signal]):abort.signal;
 const setup=runtime.startupSetup={state:'waiting',cancel(){this.state='cancelled';abort.abort();}};
 const current=()=>controller.runtimes.get(uid)===runtime&&runtime.loggedIn&&!runtime.stopping&&!runtime.exited&&!signal.aborted;
 const log=(level,message)=>{if(current())controller.appendLog(uid,level,message);};
 runtime.startupSetupPromise=(async()=>{
  const started=clock();let count,errors=0,speedApplied=false,waitingLogged=false;
  while(current()){
   try{
    const prefs=getPreferences();
    if(!speedApplied&&runtime.enhanced!==false&&prefs.speeds?.[uid]!==undefined)
     await controller.request(runtime,'PUT','/api/integration/playback',{beisu:prefs.speeds[uid]});
    speedApplied=true;
    if(!current())return;
    if(runtime.enhanced===false){
     const result=await controller.request(runtime,'GET','/api/queue');
     const items=Array.isArray(result)?result:result?.items;
     if(!Array.isArray(items))throw Error('invalid_queue');
     count=items.length;
    }else{
     const progress=await controller.request(runtime,'GET','/api/integration/monitor-progress');
     if(typeof progress?.queue?.restore_ready!=='boolean'||!Number.isInteger(progress.queue.course_total)||progress.queue.course_total<0)
      throw Error('invalid_queue');
     if(progress.queue.restore_ready)count=progress.queue.course_total;
    }
    errors=0;
   }catch{
    if(!current())return;
    if(++errors>=6){setup.state='failed';log('WARN','课程队列连续读取失败，未自动开始；请检查控制面板后手动开始或重启星蝉。');return;}
   }
   if(!current())return;
   if(count!==undefined)break;
   if(!waitingLogged&&clock()-started>=30000){
    waitingLogged=true;log('INFO','仍在恢复课程队列，完成后将按账号设置自动开始；手动开始、暂停或停止会取消此次自动开始。');
   }
   await sleep(clock()-started<30000?1000:5000,signal);
  }
  if(!current())return;
  if(count===0){
   setup.state='empty';
   try{await controller.openHtml({uid});log('INFO','课程队列为空，已打开控制面板，请添加课程。');}
   catch{log('WARN','课程队列为空，控制面板未能自动打开，请点击“打开控制面板”。');}
   return;
  }
  if(!getPreferences().launchPlans?.[uid]?.autoRunStar){setup.state='disabled';return;}
  if(runtime.enhanced===false){setup.state='native';log('INFO','原生模式请在控制面板中开始任务。');return;}
  if(runtime.autoRunApplied){setup.state='done';return;}
  // A user or the course-open watcher may already have started/paused a run.
  // Never restart that run, including after an uncertain response to a request.
  const run=await controller.request(runtime,'GET','/api/run');
  if(!current())return;
  if(typeof run?.running!=='boolean')throw Error('invalid_run_state');
  if(run.running||run.paused||run.stopping){setup.state='already-running';return;}
  setup.state='starting';
  const result=await starMonitor.action({uid,action:'start'},{startup:setup,current});
  if(!current()||result?.cancelled)return;
  runtime.autoRunApplied=true;setup.state='done';
  log('INFO','已按账号设置自动开始保存的课程队列。');
 })().catch(()=>{
  if(current()){setup.state='failed';log('WARN','自动开始未能确认成功，请查看控制面板状态；为避免重复执行，本次不重复发送开始命令。');}
 }).finally(()=>{if(!current()&&setup.state==='waiting')setup.state='cancelled';});
 return runtime.startupSetupPromise;
}
module.exports={applyStarStartup};
