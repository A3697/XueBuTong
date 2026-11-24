'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {applyStarStartup}=require('../src/fusion/star-startup.cjs');
const {model}=require('../src/fusion/ocs-ui/renderer.js');
function fixture({native=false,queue=[0],auto=false}={}){
 const calls=[],r={loggedIn:true,enhanced:!native,abort:new AbortController()},runtimes=new Map([['A',r]]);
 const controller={runtimes,request:async(_r,method,url,body)=>{calls.push(url);return url==='/api/queue'?{items:queue}:url==='/api/run'?{running:false}:{queue:{restore_ready:true,course_total:queue.length}};},openHtml:async()=>calls.push('panel'),appendLog(){}};
 const options={uid:'A',controller,starMonitor:{action:async()=>calls.push('run')},preferences:{speeds:{},launchPlans:{A:{autoRunStar:auto}}},sleep:async()=>{}};
 return {calls,r,options};
}
for(const native of [false,true])test('confirmed empty '+(native?'native':'enhanced')+' queue opens panel only once',async()=>{const f=fixture({native,queue:[]});await Promise.all([applyStarStartup(f.options),applyStarStartup(f.options)]);assert.equal(f.calls.filter(x=>x==='panel').length,1);assert(!f.calls.includes('run'));});
test('nonempty queues retain background and optional auto-run behavior',async()=>{for(const auto of [false,true]){const f=fixture({auto});await applyStarStartup(f.options);assert(!f.calls.includes('panel'));assert.equal(f.calls.includes('run'),auto);}});
test('restore must finish before the queue is considered empty',async()=>{const f=fixture({queue:[]}),responses=[{queue:{restore_ready:false,course_total:0}},{queue:{restore_ready:true,course_total:2}}];f.options.controller.request=async()=>responses.shift();f.options.sleep=async()=>{};await applyStarStartup(f.options);assert(!f.calls.includes('panel'));});
test('malformed, failed and cancelled reads never start tasks or open a panel',async()=>{for(const kind of ['malformed','error','cancel']){const f=fixture({queue:[],auto:true});f.options.controller.request=async()=>{if(kind==='error')throw Error('offline');if(kind==='cancel')f.r.abort.abort();return kind==='malformed'?{queue:{restore_ready:true}}:{queue:{restore_ready:true,course_total:0}};};await applyStarStartup(f.options);assert(!f.calls.includes('panel'));assert(!f.calls.includes('run'));}});
test('settings account order follows home order, including groups and new entries',()=>{
 const a=uid=>({type:'browser',uid,name:uid}),folder={type:'folder',uid:'g',children:{x:a('x'),y:a('y')}};
 const store={render:{browser:{root:{type:'root',uid:'root',children:{a:a('a'),b:a('b'),folder,new:a('new')}},accountOrders:{root:['b','missing','a'],g:['y','x']}}}};
 assert.deepEqual(model.listBrowsers(store).map(x=>x.uid),['y','x','b','a','new']);
 store.render.browser.accountOrders.root=['new','a','b'];assert.deepEqual(model.listBrowsers(store).map(x=>x.uid),['y','x','new','a','b']);
});
