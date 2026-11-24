'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {applyStarStartup}=require(process.env.XBT_STARTUP_MODULE||'../src/fusion/star-startup.cjs');
const {StarMonitor}=require('../src/fusion/star-monitor.cjs');
test('installed bootstrap resolves the startup helper from product src and starts the saved queue',async()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
 const {createRequire}=require('node:module');
 const parent=fs.realpathSync(process.env.XBT_TEST_TMP||os.tmpdir());
 const lab=fs.mkdtempSync(path.join(parent,'startup-install-layout-'));
 try{
  const app=path.join(lab,'ocs-lab/resources/app');fs.mkdirSync(app,{recursive:true});
  fs.mkdirSync(path.join(lab,'src'));
  fs.copyFileSync(path.join(__dirname,'../src/fusion/star-startup.cjs'),path.join(lab,'src/star-startup.cjs'));
  const installedRequire=createRequire(path.join(app,'xingchan-lab-bootstrap.cjs'));
  assert.throws(()=>installedRequire.resolve('./star-startup.cjs'),{code:'MODULE_NOT_FOUND'});
  const source=fs.readFileSync(path.join(__dirname,'../src/fusion/electron-bootstrap.cjs'),'utf8');
  const handler=source.match(/ start:async\(input\)=>\{([\s\S]*?)\n \},stop:input/);
  assert(handler,'Actual bootstrap start handler not found');
  const f=fixture();f.controller.getSettings=()=>({starEligible:true});
  const start=vm.runInNewContext('(async(input)=>{'+handler[1]+'})',{
   require:installedRequire,path,lab,controller:f.controller,starMonitor:f.monitor,
   modes:{start:async()=>({started:true})},workspacePreferences:{get:()=>f.preferences}
  });
  assert.equal((await start({uid:'A'})).started,true);
  await f.runtime.startupSetupPromise;
  assert.equal(f.starts(),1);assert.equal(f.runtime.startupSetup.state,'done');
 }finally{
  assert.equal(path.dirname(fs.realpathSync(lab)),parent);
  assert(path.basename(lab).startsWith('startup-install-layout-'));
  fs.rmSync(lab,{recursive:true});
 }
});
function fixture({readyAt=0,count=14}={}){
 let now=0,reads=0;const logs=[],calls=[],runtime={uid:'A',port:1234,loggedIn:true,enhanced:true,abort:new AbortController()};
 const preferences={speeds:{},launchPlans:{A:{autoRunStar:true}}};
 const controller={runtimes:new Map([['A',runtime]]),appendLog:(_uid,_level,message)=>logs.push(message),openHtml:async()=>calls.push('panel'),
  request:async(_r,method,url)=>{calls.push(method+' '+url);
   if(url==='/api/integration/monitor-progress'){reads++;return {queue:{restore_ready:now>=readyAt,course_total:count}};}
   if(url==='/api/run')return {running:runtime.executing||false,paused:false,stopping:false};
   if(url==='/api/run/start'){runtime.executing=true;return {accepted:true};}
   if(url==='/api/run/stop'||url==='/api/run/pause')runtime.executing=false;
   return {};
  }};
 const monitor=new StarMonitor(controller);
 const options={uid:'A',controller,starMonitor:monitor,preferences,getPreferences:()=>preferences,clock:()=>now,sleep:async ms=>{now+=ms;}};
 return {options,runtime,controller,monitor,preferences,logs,calls,get now(){return now;},get reads(){return reads;},starts:()=>calls.filter(x=>x==='POST /api/run/start').length};
}
test('late queue restoration still auto-starts once after 90 seconds (14 courses)',async()=>{
 const f=fixture({readyAt:90000});await Promise.all([applyStarStartup(f.options),applyStarStartup(f.options)]);
 assert.equal(f.starts(),1);assert(f.now>=90000);assert(!f.calls.includes('panel'));assert.equal(f.runtime.startupSetup.state,'done');
 assert.equal(f.logs.filter(x=>x.includes('仍在恢复')).length,1);assert(f.reads<50);
});
test('a delayed four-course queue follows the same path',async()=>{const f=fixture({readyAt:45000,count:4});await applyStarStartup(f.options);assert.equal(f.starts(),1);});
test('temporary local read errors recover without logging in again',async()=>{
 const f=fixture(),request=f.controller.request;let n=0;f.controller.request=async(...args)=>{if(args[2].includes('monitor-progress')&&n++<2)throw Error('temporary');return request(...args);};
 await applyStarStartup(f.options);assert.equal(f.starts(),1);assert(!f.calls.some(x=>x.includes('/session/login')));
});
test('persistent invalid readiness fails visibly and never treats it as an empty queue',async()=>{
 const f=fixture();f.controller.request=async()=>({});await applyStarStartup(f.options);assert.equal(f.starts(),0);assert(!f.calls.includes('panel'));assert.equal(f.runtime.startupSetup.state,'failed');
});
for(const action of ['start','pause','stop','resume'])test('manual '+action+' cancels the pending automatic start',async()=>{
 const f=fixture({readyAt:90000});let used=false;f.options.sleep=async()=>{if(!used){used=true;await f.monitor.action({uid:'A',action});}};
 await applyStarStartup(f.options);assert.equal(f.starts(),action==='start'?1:0);assert.equal(f.runtime.startupSetup.state,'cancelled');
});
for(const event of [{type:'integration.recovery-cancel'},{type:'integration.risk-blocked'},{type:'run.state',payload:{running:true,paused:false}},{type:'run.state',payload:{running:true,paused:true}}])test('panel/watcher event '+JSON.stringify(event)+' cancels pending startup',async()=>{
 const f=fixture({readyAt:90000});f.options.sleep=async()=>f.monitor.observe(f.runtime,event);await applyStarStartup(f.options);assert.equal(f.starts(),0);
});
for(const change of ['abort','replace','logout'])test('runtime '+change+' cannot start a stale account instance',async()=>{
 const f=fixture({readyAt:90000});f.options.sleep=async()=>{if(change==='abort')f.runtime.abort.abort();if(change==='replace')f.controller.runtimes.set('A',{loggedIn:true});if(change==='logout')f.runtime.loggedIn=false;};
 await applyStarStartup(f.options);assert.equal(f.starts(),0);assert(!f.calls.includes('panel'));
});
test('changed preferences are read after restoration',async()=>{
 const f=fixture({readyAt:90000}),sleep=f.options.sleep;f.options.sleep=async ms=>{await sleep(ms);f.preferences.launchPlans.A.autoRunStar=false;};
 await applyStarStartup(f.options);assert.equal(f.starts(),0);assert.equal(f.runtime.startupSetup.state,'disabled');
});
test('an already running or paused backend is not restarted',async()=>{
 for(const paused of [true,false]){const f=fixture(),request=f.controller.request;f.controller.request=(r,m,u)=>u==='/api/run'?Promise.resolve({running:true,paused}):request(r,m,u);await applyStarStartup(f.options);assert.equal(f.starts(),0);}
});
test('cancellation while loading run options wins over an automatic POST',async()=>{
 const f=fixture(),request=f.controller.request;f.controller.request=async(...args)=>{if(args[2]==='/api/integration/run-options')f.monitor.observe(f.runtime,{type:'integration.recovery-cancel'});return request(...args);};
 await applyStarStartup(f.options);assert.equal(f.starts(),0);
});
test('an ambiguous start response does not cause duplicate POSTs or claim success',async()=>{
 const f=fixture(),request=f.controller.request;f.controller.request=async(...args)=>{const result=await request(...args);if(args[2]==='/api/run/start')throw Error('response lost');return result;};
 await applyStarStartup(f.options);await applyStarStartup(f.options);assert.equal(f.starts(),1);assert(!f.runtime.autoRunApplied);assert(!f.logs.some(x=>x.startsWith('已按账号')));assert.equal(f.runtime.startupSetup.state,'failed');
});
test('two account runtimes can restore independently',async()=>{
 const first=fixture({readyAt:90000}),second=fixture({readyAt:45000,count:4});
 await Promise.all([applyStarStartup(first.options),applyStarStartup(second.options)]);assert.equal(first.starts(),1);assert.equal(second.starts(),1);
});
