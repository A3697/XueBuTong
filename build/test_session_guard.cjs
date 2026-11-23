'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {classify,SessionGuard,displacementMessage}=require('../src/fusion/session-guard.cjs');
const cases=require('./session_guard_cases.json');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('explicit displacement messages only, shared JS/Python fixtures',()=>{
 for(const message of cases.accepted)assert.equal(displacementMessage(message),true,message);
 for(const message of cases.rejected)assert.equal(displacementMessage(message),false,message);
});
test('scope and response envelope exclude SouTiJiang, course content and ordinary authentication errors',()=>{
 const message=cases.accepted[0],url='https://mooc1.chaoxing.com/api/session';
 assert.deepEqual(classify({url,body:{success:false,message}}),{reason:'concurrent-login',platform:'chaoxing',source:'response'});
 for(const host of ['https://chaoxing.com.evil.example/api','https://www.daxuesoutijiang.com/api','https://ai.example/api'])assert.equal(classify({url:host,body:{success:false,message}}),null);
 for(const body of [{success:true,message},{question:message},{code:401,message:'未登录'},{code:403,message:'请完成验证'}])assert.equal(classify({url,body}),null);
 assert.equal(classify({url,status:401,body:'登录过期'}),null);
});
test('stop only current runtime, cancel recovery synchronously, aggregate one incident per run',async()=>{
 const a={uid:'a'},b={uid:'b'},stopped=[],cancelled=[],updates=[],runtimes=new Map([['a',a],['b',b]]);
 const controller={runtimes,cancelAutomaticRelogin:uid=>cancelled.push(uid),appendLog(){}};
 const modes={leases:new Map(),stop:async({uid})=>stopped.push(uid)};
 const guard=new SessionGuard({controller,modes,notify:s=>updates.push(s),nameOf:uid=>uid.toUpperCase()});
 const event={type:'integration.session-displaced',payload:{reason:'concurrent-login'}};
 assert.equal(guard.handleStar(a,event),true);assert.equal(a.sessionDisplaced,true);assert.deepEqual(cancelled,['a']);assert.deepEqual(stopped,[]);
 guard.handleStar(a,event);guard.handleStar(b,event);await tick();
 assert.deepEqual(stopped,['a','b']);assert.equal(guard.snapshot().items.length,2);assert.ok(guard.snapshot().items.every(i=>i.status==='stopped'));
 assert.equal(updates[0].items[0].name,'A');
 guard.acknowledge(guard.snapshot().revision);assert.equal(guard.snapshot().items.length,0);
 guard.handleStar(a,event);assert.equal(guard.snapshot().items.length,0);
 runtimes.set('a',{uid:'a'});guard.handleStar(a,event);await tick();assert.deepEqual(stopped,['a','b']);
 guard.handleStar(runtimes.get('a'),event);await tick();assert.deepEqual(stopped,['a','b','a']);
});
test('old browser lease cannot stop manually restarted account; other accounts continue',async()=>{
 const stops=[],modes={leases:new Map([['a',{mode:'browser',id:'new'}],['b',{mode:'browser',id:'b'}]])};
 const guard=new SessionGuard({controller:{},modes,stopBrowser:async x=>stops.push(x)});
 const report={uid:'a',leaseId:'old',reason:'concurrent-login',platform:'chaoxing'};
 assert.equal(guard.reportBrowser(report),false);assert.equal(guard.reportBrowser({...report,leaseId:'new',platform:'soutijiang'}),false);
 assert.equal(guard.reportBrowser({...report,leaseId:'new'}),true);await tick();assert.deepEqual(stops,[{uid:'a',leaseId:'new'}]);assert.equal(modes.leases.has('b'),true);
});
test('manual restart between notification and asynchronous stop is not stopped by old event',async()=>{
 const old={uid:'a'},stops=[],controller={runtimes:new Map([['a',old]])};
 const guard=new SessionGuard({controller,modes:{stop:async x=>stops.push(x)}});
 guard.handleStar(old,{type:'integration.session-displaced',payload:{reason:'concurrent-login'}});
 controller.runtimes.set('a',{uid:'a'});await tick();assert.deepEqual(stops,[]);
});
test('observer watches new/background pages, closes exactly once, disposes listeners',async()=>{
 const context=new EventEmitter(),page=new EventEmitter();context.pages=()=>[];page.frames=()=>[];page.isClosed=()=>false;page.url=()=> 'https://study.zhihuishu.com/videoStudy.html';
 const signals=[],guard=require('../src/fusion/session-guard-browser.cjs').observe(context,{onDisplaced:x=>signals.push(x)});
 context.emit('page',page);page.emit('dialog',{message:()=>cases.rejected[0]});assert.equal(guard.tripped,false);
 page.emit('dialog',{message:()=>cases.accepted[0]});assert.equal(guard.tripped,true);assert.equal(signals.length,1);
 page.emit('dialog',{message:()=>cases.accepted[0]});assert.equal(signals.length,1);guard.dispose();assert.equal(context.listenerCount('response'),0);assert.equal(page.listenerCount('dialog'),0);
});
test('observer handles explicit failed JSON but ignores generic risk and transport errors',async()=>{
 const context=new EventEmitter();context.pages=()=>[];let calls=0;
 const guard=require('../src/fusion/session-guard-browser.cjs').observe(context,{onDisplaced:()=>calls++});
 const response=body=>({url:()=> 'https://passport2.chaoxing.com/api',headers:()=>({'content-type':'application/json'}),status:()=>200,text:async()=>JSON.stringify(body)});
 context.emit('response',response({status:false,msg:'需要完成验证码'}));await tick();assert.equal(calls,0);
 context.emit('response',response({status:false,msg:cases.accepted[0]}));await tick();assert.equal(calls,1);guard.dispose();
});
test('source wiring retains background close behavior and reports before cleanup',()=>{
 const fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'../src/ocs-app/lib/src/worker/index.js'),'utf8');
 assert.ok(source.includes("try{send('session-displaced',signal);}catch{}this.closing=true;"));
 assert.ok(source.includes('browser.__fusionWindowGuard.show()'));
 const main=fs.readFileSync(path.join(__dirname,'../src/fusion/electron-bootstrap.cjs'),'utf8');assert.ok(main.includes('controller.onSessionGuardEvent='));
});
