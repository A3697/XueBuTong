'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {AutomaticRelogin,INTERVAL}=require('../src/fusion/automatic-relogin.cjs'),State=require('../src/star-panel/task-state.js');
test('automatic attempts retain two-minute interval across cancellation and restart',async t=>{
 assert.equal(INTERVAL,120000);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt-relogin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let now=1000000,timers=[],calls=0;
 const options={root,now:()=>now,setTimer:(fn,delay)=>{const value={fn,delay};timers.push(value);return value;},clearTimer:timer=>{if(timer)timer.cancelled=true;}};
 const scheduler=new AutomaticRelogin(options),work={valid:()=>true,attempt:async()=>{calls++;throw Error('offline');}};
 scheduler.schedule('a',work);assert.equal(timers[0].delay,0);await timers[0].fn();assert.equal(calls,1);assert.equal(timers[1].delay,INTERVAL);
 scheduler.schedule('a',work);assert.equal(timers.length,2);scheduler.cancel('a');assert.equal(timers[1].cancelled,true);await timers[1].fn();assert.equal(calls,1);
 now+=1000;const next=new AutomaticRelogin(options);next.schedule('a',work);assert.equal(timers.at(-1).delay,INTERVAL-1000);next.dispose();
 const source=fs.readFileSync(path.join(__dirname,'../src/fusion/live-controller.cjs'),'utf8');const start=source.slice(source.indexOf(' async start('),source.indexOf(' async startRuntime('));assert.ok(!start.includes('automaticRelogin.schedule'));
});
test('late automatic login cannot resume after manual cancellation',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt-relogin-cancel-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let run,release,resumed=false;
 const scheduler=new AutomaticRelogin({root,now:()=>1000000,setTimer:fn=>(run=fn,1),clearTimer:()=>{}});
 scheduler.schedule('a',{valid:()=>true,attempt:async current=>{await new Promise(r=>release=r);if(current())resumed=true;}});const pending=run();scheduler.cancel('a');release();await pending;assert.equal(resumed,false);
});
test('a fresh block during automatic login is retained without parallel retries',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt-relogin-inflight-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let now=1000000,timers=[],calls=0;
 const scheduler=new AutomaticRelogin({root,now:()=>now,setTimer:(fn,delay)=>{const timer={fn,delay};timers.push(timer);return timer;},clearTimer:()=>{}});
 const work={valid:()=>true,attempt:async()=>{calls++;if(calls===1){scheduler.schedule('a',work);scheduler.schedule('a',work);}}};
 scheduler.schedule('a',work);await timers[0].fn();assert.equal(calls,1);assert.equal(timers.length,2);assert.equal(timers[1].delay,120000);
 now+=120000;await timers[1].fn();assert.equal(calls,2);assert.equal(scheduler.jobs.size,0);
});
test('recovery resumes only a previously running task and respects cancellation during login',async()=>{
 const {IntegrationController}=require('../src/fusion/live-controller.cjs');
 for(const scenario of [{resume:true,cancel:false,starts:1},{resume:false,cancel:false,starts:0},{resume:true,cancel:true,starts:0}]){
  const runtime={uid:'a',state:'running',login:{},monitor:{run:{running:true,paused:true}}},requests=[];let active=true,job;
  const controller={runtimes:new Map([['a',runtime]]),automaticRelogin:{schedule:(_uid,work)=>job=work},appendLog:()=>{},syncSession:async r=>{r.loggedIn=true;},request:async(_r,method,route)=>{requests.push(route);if(route==='/api/session/login'&&scenario.cancel)active=false;return route==='/api/run'?{running:false}:{};}};
  IntegrationController.prototype.scheduleRelogin.call(controller,runtime,{resume:scenario.resume});await job.attempt(()=>active&&job.valid());
  assert.equal(requests.filter(r=>r==='/api/run/start').length,scenario.starts);assert.equal(runtime.state,'running');
 }
});
test('stopping a queued start cancels it before a child can be created',async()=>{
 const {ModeCoordinator}=require('../src/fusion/mode-coordinator.cjs'),uid='c'.repeat(32);let starts=0;
 const controller={runtimes:new Map(),pendingStarts:new Map(),data:{profiles:{}},start:async()=>{starts++;return {state:'running'};},stop:async()=>({state:'stopped'}),status:()=>({state:'stopped'})};
 const modes=new ModeCoordinator(controller),started=modes.start({uid}),rejected=assert.rejects(started,/已取消/),stopped=modes.stop({uid});await Promise.all([rejected,stopped]);assert.equal(starts,0);assert.equal(modes.anyActive(),false);
});
test('notification-only queue changes and invalid responses do not erase the queue',()=>{
 assert.deepEqual(State.queue([]),[]);assert.deepEqual(State.queue({items:[]}),[]);assert.equal(State.queue({changed:true}),null);assert.equal(State.queue({error:'offline'}),null);
 const {StarMonitor}=require('../src/fusion/star-monitor.cjs'),monitor=new StarMonitor({}),runtime={};
 monitor.observe(runtime,{type:'snapshot',payload:{queue:{items:[{label:'course'}]},run:{}}});monitor.observe(runtime,{type:'queue.changed',payload:{}});assert.equal(monitor.state(runtime).queue.length,1);assert.equal(monitor.state(runtime).received,false);
 monitor.observe(runtime,{type:'queue.changed',payload:[]});assert.equal(monitor.state(runtime).queue.length,0);
});
test('current subsection replaces previous expansion and completion collapses it',()=>{
 const expanded=new Set(['1','other']);let previous='1';previous=State.fold(expanded,previous,{chapter:'2'},[],undefined);assert.deepEqual([...expanded],['2']);assert.equal(previous,'2');
 previous=State.fold(expanded,previous,null,[{id:'2',has_points:true,tasks:[{done:true}]}]);assert.equal(expanded.size,0);assert.equal(previous,'');
 expanded.add('3');State.fold(expanded,'3',null,[{id:'3',has_points:true,tasks:[{status:'pending'}]}]);assert.equal(expanded.has('3'),true);
});
test('window dimensions are isolated per account, validated and clamped',t=>{
 const Sizes=require('../src/fusion/window-sizes.cjs'),uid='a'.repeat(32),root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt-size-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert.equal(Sizes.enabled(root),false);Sizes.write(root,'main',{width:1280,height:860});Sizes.write(root,'browser-'+uid,{width:1000,height:700});assert.equal(Sizes.read(root,'panel-'+uid),null);assert.equal(Object.keys(Sizes.snapshot(root)).length,2);assert.throws(()=>Sizes.write(root,'../escape',{width:1280,height:860}));
 assert.deepEqual(Sizes.fit({width:1900,height:1200},{width:1366,height:768}),{width:1366,height:768});assert.equal(Sizes.size({width:NaN,height:800}),null);
 assert.deepEqual(Sizes.normalize({'main':{width:1280,height:860},'oops':{width:1000,height:700}}),{main:{width:1280,height:860}});
 assert.equal(require('../src/fusion/workspace-preferences.cjs').normalize({rememberWindowSizes:true}).rememberWindowSizes,true);
});
