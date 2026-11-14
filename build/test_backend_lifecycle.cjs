'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {stopChild,recordExit}=require('../src/fusion/backend-lifecycle.cjs');
function fixture(){const child=new EventEmitter();child.pid=1234;child.exitCode=null;child.stdin={end(){}};child.kill=()=>true;return {child,uid:'QA_stop',session:'one',exited:false};}
test('graceful stop waits for exit; repeated idle time does not invent completion',async()=>{const r=fixture();let done=false;const wait=stopChild(r,{graceMs:200}).then(()=>done=true);await new Promise(r=>setTimeout(r,15));assert.equal(done,false);r.child.emit('exit',0);await wait;assert.equal(r.forcedStop,undefined);});
test('forced timeout waits for actual process exit before completing',async()=>{const r=fixture();let killed=false,done=false;r.child.kill=()=>{killed=true;return true;};const wait=stopChild(r,{graceMs:10,killMs:100}).then(()=>done=true);await new Promise(r=>setTimeout(r,25));assert(killed);assert(!done);r.child.emit('exit',1);await wait;assert(r.forcedStop);});
test('failed kill cannot falsely report a stopped runtime',async()=>{const r=fixture();await assert.rejects(stopChild(r,{graceMs:5,killMs:10}),/尚未退出/);});

test('controller retries a failed stop instead of keeping a rejected promise',async()=>{
 const lifecycle=require('../src/fusion/backend-lifecycle.cjs'),original=lifecycle.stopChild;
 const {IntegrationController}=require('../src/fusion/live-controller.cjs');
 const controller=Object.create(IntegrationController.prototype),uid='QA_retry',runtime={abort:new AbortController()};
 Object.assign(controller,{automaticRelogin:{cancel(){}},runtimes:new Map([[uid,runtime]]),stoppedAt:new Map()});
 let attempts=0;lifecycle.stopChild=async()=>{if(++attempts===1)throw Error('still alive');runtime.exited=true;};
 try{await assert.rejects(controller.stopRuntime(uid),/still alive/);assert(controller.runtimes.has(uid));assert.equal(runtime.stopPromise,null);await controller.stopRuntime(uid);assert.equal(attempts,2);assert(!controller.runtimes.has(uid));assert(controller.stoppedAt.has(uid));}
 finally{lifecycle.stopChild=original;}
});
test('an exit state is repaired only for the same child session, after exit',()=>{const home=fs.mkdtempSync(path.join(process.cwd(),'xbt-exit-'));try{const r={...fixture(),home},file=path.join(home,'startup-state.json');const state={state:'listening',pid:1234,session:'one',uid:'QA_stop'};fs.writeFileSync(file,JSON.stringify(state));recordExit(r,1,null);assert.equal(JSON.parse(fs.readFileSync(file)).state,'failed');assert.equal(JSON.parse(fs.readFileSync(file)).error,'process_exited_before_final_state');for(const finished of ['stopped','failed']){fs.writeFileSync(file,JSON.stringify({...state,state:finished}));const before=fs.readFileSync(file);recordExit(r,0,null);assert.deepEqual(fs.readFileSync(file),before);}fs.writeFileSync(file,JSON.stringify({...state,session:'newer'}));recordExit(r,1,null);assert.equal(JSON.parse(fs.readFileSync(file)).state,'listening');}finally{fs.rmSync(home,{recursive:true,force:true});}});
