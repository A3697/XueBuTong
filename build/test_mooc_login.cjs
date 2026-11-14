'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {verify,state}=require('../src/fusion/mooc-login.cjs');
function fixture({url='https://www.icourse163.org/',navigation=true,login=false,account=true,hidden=false}={}){
 const node={getClientRects:()=>hidden?[]:[{}],getAttribute:()=>'/u/123456',textContent:'昵称不是实名'};
 const nav=navigation?{...node,querySelectorAll:()=>account?[node]:[]}:null;
 const document={querySelector:()=>nav,querySelectorAll:()=>login?[node]:[]};
 return {url:()=>url,evaluate:fn=>vm.runInNewContext('('+fn.toString()+')()',{document,getComputedStyle:()=>({visibility:'visible',display:'block'})})};
}
test('MOOC login requires positive authenticated navigation and does not treat a dismissed dialog or nickname as verified identity',async()=>{
 for(const config of [{navigation:false},{login:true},{account:false},{hidden:true},{url:'https://example.test/'}])assert.equal((await state(fixture(config))).authenticated,false);
 const found=await state(fixture());assert.equal(found.authenticated,true);assert.equal(found.name,'');
});
function environment(config={}){
 const runner=new EventEmitter();let closed=0,launches=0;
 runner.run=async()=>{if(config.error)runner.emit('script-error',config.error);if(config.stall)await new Promise(()=>{});};
 const page={...fixture(config),setDefaultTimeout(){},frames:()=>[{locator:()=>({count:async()=>0})}]};
 const browser={close:async()=>{closed++;},newContext:async()=>({newPage:async()=>page})};
 return {runner,get closed(){return closed;},get launches(){return launches;},args:{chromium:{launch:async()=>{launches++;return browser;}},executablePath:'fixture-browser',login:{username:'fixture@example.test',password:'fixture'},automation:runner,timeoutMs:10}};
}
test('MOOC verification reports authenticated, unverified and invalid separately and releases the browser/listeners',async()=>{
 for(const [config,expected]of [[{},'success'],[{account:false},'unverified'],[{account:false,error:'账号或密码错误'},'invalid']]){
  const env=environment(config),r=await verify(env.args);assert.equal(r.state,expected);assert.equal(env.closed,1);assert.equal(env.runner.listenerCount('script-error'),0);
 }
});
test('MOOC timeout and cancellation release resources and never become successful verification',async()=>{
 const env=environment({stall:true});await assert.rejects(verify(env.args),/验证超时/);assert.equal(env.closed,1);assert.equal(env.runner.listenerCount('script-error'),0);
 const cancelled=environment(),signal=AbortSignal.abort();assert.equal((await verify({...cancelled.args,signal})).state,'unverified');assert.equal(cancelled.launches,0);assert.equal(cancelled.runner.listenerCount('script-error'),0);
});
