'use strict';
const fs=require('node:fs'),path=require('node:path');
const INTERVAL=2*60*1000;
// Only automatic logins pass through this scheduler. Manual restart never does.
class AutomaticRelogin {
 constructor({root,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){this.file=path.join(root,'bridge-data/automatic-relogin.json');this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;this.jobs=new Map();try{this.last=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{this.last={};}}
 cancel(uid){const job=this.jobs.get(uid);if(job){job.cancelled=true;this.clearTimer(job.timer);this.jobs.delete(uid);}}
 schedule(uid,work){
  if(!work.valid())return;
  const existing=this.jobs.get(uid);if(existing){if(existing.running){existing.again=true;existing.work=work;}return;}
  const job={cancelled:false,timer:null,running:false,again:false,work};this.jobs.set(uid,job);
  const current=()=>!job.cancelled&&this.jobs.get(uid)===job&&job.work.valid();
  const queue=()=>{if(!current()){this.cancel(uid);return;}const delay=Math.max(0,(Number(this.last[uid])||0)+INTERVAL-this.now());job.work.onWait?.(delay);job.timer=this.setTimer(run,delay);job.timer.unref?.();};
  const run=async()=>{
   if(!current())return;
   job.running=true;job.again=false;
   // Reserve the attempt before any network request; process restart cannot reset the interval.
   this.last[uid]=this.now();
   try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.last));fs.renameSync(this.file+'.tmp',this.file);await job.work.attempt(current);job.running=false;if(current()){if(job.again)queue();else this.jobs.delete(uid);}}
   catch(error){job.running=false;if(current()){job.work.onError?.(error);queue();}}
  };
  queue();
 }
 dispose(){for(const uid of this.jobs.keys())this.cancel(uid);}
}
module.exports={AutomaticRelogin,INTERVAL};
