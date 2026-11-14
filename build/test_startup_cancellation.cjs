'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../src/ocs-app/public/assets/index.c87a5b08.js'),'utf8');
const code=source.slice(source.indexOf('class Process extends '),source.indexOf('const processes = reactive([]);'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise};};
function fixture(prepare=async()=>{}){
 const shells=[],sent=[],messages=[],released=[],processes=[],killed=[];
 const context={events:{exports:EventEmitter},__publicField:(o,k,v)=>o[k]=v,processes,process:{env:{}},console,AbortController,setTimeout,clearTimeout,
  child_process:{fork(){const s=new EventEmitter();s.connected=true;s.pid=999999;shells.push(s);return s;},execFile(...args){killed.push(args.slice(0,2));shells[0].emit('exit',0);args.at(-1)(null);}},
  createRemoteScriptWorker:s=>(event,args)=>{sent.push(event);messages.push({event,args});if(event==='close')queueMicrotask(()=>s.emit('message',{event:'browser-closed',args:[]}));},
  remote:{path:{call:async()=> 'fixture'},app:{call:async()=> 'root'},fs:{call:async()=>true}},
  store:{paths:{},render:{scripts:[],setting:{browser:{}}}},window:{FusionOcsPlugins:{prepare},xingchanBridge:{releaseBrowser:async x=>released.push(x)}},notify(){}};
 vm.createContext(context);vm.runInContext(code+';this.Process=Process;',context);
 const p=new context.Process({uid:'fixture',cachePath:'fixture',playwrightScripts:[]},{executablePath:'fixture.exe'});p.fusionLease={id:'fixture'};p.status='launching';processes.push(p);
 return {p,shells,sent,messages,released,processes,killed,context};
}
test('browser launch uses only this account runtime, never the global plugin row',async()=>{
 for(const withoutAutomation of [false,true]){
  let requestedUid;const runtime={file:'account-official.user.js',hash:'fixture-hash',enhanced:false,upstreamSha256:'fixture-upstream'},f=fixture(async uid=>{requestedUid=uid;return {uid,enhanced:false,runtime,scripts:[{enable:true,isLocalScript:true,url:runtime.file,info:{code_url:runtime.file}}]};});
  f.context.store.render.scripts=[{enable:true,url:'global-enhanced.user.js'}];f.p.launchOptions.withoutAutomation=withoutAutomation;await f.p.init();const start=f.p.launch();await new Promise(r=>setImmediate(r));const launch=f.messages.find(item=>item.event==='launch').args;
  assert.equal(requestedUid,'fixture');assert.deepEqual(Array.from(launch.userscripts),withoutAutomation?[]:['file://account-official.user.js']);assert.equal(launch.ocsAccountRuntime.uid,'fixture');assert.equal(launch.ocsAccountRuntime.enhanced,false);assert.equal(launch.ocsAccountRuntime.runtime,withoutAutomation?null:runtime);assert.equal(f.context.store.render.scripts[0].url,'global-enhanced.user.js');
  f.shells[0].emit('message',{event:'launched',args:[]});await start;await f.p.close();
 }
});
test('another account runtime is rejected before a browser can launch',async()=>{
 const f=fixture(async()=>({uid:'other-account',enhanced:true,scripts:[]}));await f.p.init();await assert.rejects(f.p.launch(),/账号运行配置不匹配/);assert(!f.sent.includes('launch'));await f.p.close();
});
test('preparation rejection propagates and cleanup returns the account to stopped',async()=>{
 const f=fixture(async()=>{throw Error('prepare failed')});await f.p.init();await assert.rejects(f.p.waitForStartup(()=>f.p.launch()),/prepare failed/);await f.p.close();assert.equal(f.processes.length,0);assert.equal(f.released.length,1);
});
test('cancel during pending plugin preparation never launches a late browser',async()=>{
 const gate=deferred(),f=fixture(()=>gate.promise);await f.p.init();const start=f.p.waitForStartup(()=>f.p.launch());const rejected=assert.rejects(start,/启动已取消/);await new Promise(r=>setImmediate(r));await f.p.close();await rejected;gate.resolve();await new Promise(r=>setImmediate(r));assert(!f.sent.includes('launch'));assert.equal(f.processes.length,0);
});
test('cancel before worker path lookup completes never forks a worker',async()=>{
 const gate=deferred(),f=fixture();f.context.remote.app.call=()=>gate.promise;const start=f.p.waitForStartup(()=>f.p.init());const rejected=assert.rejects(start,/启动已取消/);await new Promise(r=>setImmediate(r));await f.p.close();await rejected;gate.resolve('root');await new Promise(r=>setImmediate(r));assert.equal(f.shells.length,0);
});
test('worker exit and initialization failure settle startup instead of hanging',async()=>{
 for(const event of ['exit','startup-failed']){const f=fixture();await f.p.init();const start=f.p.waitForStartup(()=>f.p.launch());const rejected=assert.rejects(start,/启动|退出/);await new Promise(r=>setImmediate(r));if(event==='exit')f.shells[0].emit('exit',1);else f.shells[0].emit('message',{event,args:[]});await rejected;await f.p.close();assert.equal(f.processes.length,0);}
});
test('startup has a bounded deadline and cannot revive after cancellation',async()=>{
 const f=fixture();await f.p.init();await assert.rejects(f.p.waitForStartup(()=>new Promise(()=>{}),20),/启动超时/);await f.p.close();f.shells[0].emit('message',{event:'launched',args:[]});assert.equal(f.p.status,'closed');assert.equal(f.processes.length,0);
});
test('star stop interrupts an in-flight start and late status cannot overwrite stopped',async()=>{
 const text=fs.readFileSync(path.join(__dirname,'../src/fusion/workspace-ui.js'),'utf8'),start=text.slice(text.indexOf(' async function starAction('),text.indexOf(' function start(uid)'));
 const gate=deferred(),calls=[],statuses=[],state={operations:new Map(),statuses:new Map(),seen:new Map(),native:{setFusionBrowserStatus:(...x)=>statuses.push(x)},bridge:{start:()=>{calls.push('start');return gate.promise;},stop:async()=>calls.push('stop'),listStatus:async()=>({items:[{uid:'x',state:'stopped'}]})}};
 const ctx={state,nativeProcess:()=>null,canStartStar:()=>true,flushCredentials:async()=>{},window:{},emit(){},updateStatus:s=>state.statuses.set(s.uid,s)};vm.createContext(ctx);vm.runInContext(start+';this.run=starAction;',ctx);
 const pending=ctx.run('x','start');await new Promise(r=>setImmediate(r));await ctx.run('x','stop');assert.deepEqual(calls,['start','stop']);gate.resolve({uid:'x',state:'running'});await pending;assert.equal(state.statuses.get('x').state,'stopped');assert.equal(state.operations.size,0);
});
test('star cancellation before school lookup resolves does not start a backend',async()=>{
 const {IntegrationController}=require('../src/fusion/live-controller.cjs'),c=Object.create(IntegrationController.prototype),gate=deferred();
 Object.assign(c,{pendingStarts:new Map(),startCancellations:new Map(),runtimes:new Map(),automaticRelogin:{cancel(){}},base:()=>({loginKind:'cx-unit',username:'synthetic',loginUnit:'synthetic',revision:0}),plainSecret:()=> 'synthetic',resolveSchool:()=>gate.promise,status:uid=>({uid,state:'stopped'})});
 const uid='a'.repeat(32),start=c.start({uid});const rejected=assert.rejects(start,/启动已取消/);await c.stop({uid});await rejected;gate.resolve('123');await new Promise(r=>setImmediate(r));assert.equal(c.runtimes.size,0);assert.equal(c.pendingStarts.size,0);
});
