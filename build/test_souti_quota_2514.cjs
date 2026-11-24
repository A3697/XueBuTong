'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {watch,quotaResult,methodFor}=require('../src/fusion/soutijiang-browser-quota.cjs');
const {parseScreenshot,parseSolve,EXTENSION_ID}=require('../src/fusion/soutijiang.cjs');
const q={type:'judgement',title:'判断题样例',options:[{label:'A',text:'错误'},{label:'B',text:'正确'}]};
test('official labelled judgment uses truth text, independent of option order',()=>{
 for(const [answer,expected]of [['A. 正确','对'],['B. 错误','错'],['参考答案：A、正确','对'],['A．错误','错']]){
  assert.deepEqual(parseScreenshot(q,{message:{errNo:0,list:[{question:q.title,answer}]}}),{kind:'hit',answer:expected});
  assert.deepEqual(parseSolve(q,{errNo:0,result:{answer}}),{kind:'hit',answer:expected});
 }
 assert.throws(()=>parseScreenshot(q,{message:{errNo:0,list:[{question:q.title,answer:'A. 可能正确，也可能错误'}]}}),e=>e.code==='soutijiang_answer_invalid');
 assert.deepEqual(parseScreenshot(q,{message:{errNo:0,list:[{question:'另一个题目',answer:'A. 正确'}]}}),{kind:'miss',explicitMiss:true});
 assert.throws(()=>parseScreenshot(q,{message:{errNo:0,list:[{question:q.title,answer:'A. 正确'},{question:q.title,answer:'B. 错误'}]}}),e=>e.code==='soutijiang_answer_ambiguous');
});
test('only explicit official quota results qualify for browser rotation',()=>{
 assert.equal(quotaResult('solve','{"errNo":4002}').method,'solve');
 assert.equal(quotaResult('sse','event: error\ndata: {"errNo":500,"errstr":"今日搜题次数已耗尽"}\n\n').method,'screenshot');
 for(const body of [{errNo:0},{errNo:303},{errNo:410004},{errNo:15,errstr:'请求频繁，请验证'},{errNo:500,errstr:'请求失败'},{errNo:500,errstr:'会员权益不足'}])assert.equal(quotaResult('sse','data: '+JSON.stringify(body)+'\n\n'),null);
 assert.equal(quotaResult('screenshot','{"errNo":4002}'),null);
 assert.equal(methodFor('https://www.daxuesoutijiang.com/dxkits/dxai/submit/exercise/solve'),'solve');
 assert.equal(methodFor('https://www.daxuesoutijiang.com.evil.test/dxkits/dxai/submit/exercise/solve'),null);
});
test('quota observer ignores website requests and detaches after closing',async()=>{
 const context=new EventEmitter(),events=[];let identity='first';const observer=watch(context,{identity:()=>identity,onQuota:async e=>events.push(e)});
 function send(owner){const req={url:()=> 'https://www.daxuesoutijiang.com/dxkits/dxai/submit/exercise/solve',serviceWorker:()=>null,frame:()=>({url:()=>owner})};context.emit('request',req);identity='second';context.emit('response',{request:()=>req,allHeaders:async()=>({}),text:async()=>'{"errNo":4002}'});}
 send('https://course.example');await new Promise(setImmediate);assert.equal(events.length,0);
 identity='first';send('chrome-extension://'+EXTENSION_ID+'/options.html');await new Promise(setImmediate);assert.equal(events.length,1);assert.equal(events[0].identity,'first');
 observer.dispose();send('chrome-extension://'+EXTENSION_ID+'/options.html');await new Promise(setImmediate);assert.equal(events.length,1);assert.equal(context.listenerCount('response'),0);
});
