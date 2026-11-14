'use strict';
const fs=require('node:fs'),path=require('node:path');

function recordExit(runtime,code,signal){
 const file=path.join(runtime.home,'startup-state.json');
 if(!fs.existsSync(file))return;
 const state=JSON.parse(fs.readFileSync(file,'utf8'));
 if(state.pid!==runtime.child.pid||state.session!==runtime.session||state.uid!==runtime.uid)return;
 if(['stopped','failed'].includes(state.state))return;
 // Only the child may confirm a clean engine shutdown. An unfinished state
 // after exit is a failure, never a successful stop or a still-listening server.
 Object.assign(state,{state:'failed',error:runtime.forcedStop?'forced_shutdown_timeout':'process_exited_before_final_state',exit_code:code,exit_signal:signal||null,exit_observed_at:new Date().toISOString()});
 const temporary=file+'.parent-writing';
 fs.writeFileSync(temporary,JSON.stringify(state,null,2));fs.renameSync(temporary,file);
}

function stopChild(runtime,{graceMs=30000,killMs=5000}={}){
 if(runtime.exited||runtime.child.exitCode!==null&&runtime.child.exitCode!==undefined)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const child=runtime.child;let timer,settled=false;
  function finish(error){if(settled)return;settled=true;clearTimeout(timer);child.off('exit',onExit);child.off('error',onError);error?reject(error):resolve();}
  const onExit=()=>finish(),onError=()=>{if(!child.pid)finish();};
  function force(){runtime.forcedStop=true;try{child.kill();}catch{}if(!settled)timer=setTimeout(()=>finish(Error('星蝉进程尚未退出，请稍后重试停止。')),killMs);}
  child.once('exit',onExit);child.once('error',onError);
  // Uvicorn gets 15 seconds and engine cleanup 10 seconds. Do not terminate
  // the host after only 8 seconds or resolve before its exit event.
  timer=setTimeout(force,graceMs);
  try{child.stdin.end('stop\n');}catch{clearTimeout(timer);force();}
 });
}
module.exports={recordExit,stopChild};
