'use strict';
// Loopback HTTP fixtures exercise the shipped adapters and both search entries.
// No third-party account, quota or course submission is used by this matrix.
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createGateway}=require('../src/fusion/gateway/index.cjs');
const {parseScreenshot,parseSolve}=require('../src/fusion/soutijiang.cjs');
const {createYanxiV2Adapter}=require('../src/fusion/yanxi/adapter.cjs');
const {query:browserQuery}=require('../src/fusion/browser-search.cjs');
const Answer=require('../src/fusion/answer-settings.js');
const uid='matrix',bankId='ocs-11111111';
const options=[{label:'A',text:'乙'},{label:'B',text:'甲'},{label:'C',text:'丙'}];
const cases=[
 {type:'single',options,answer:'B',raw:'甲'},
 {type:'multiple',options,answer:'AC',raw:['乙','丙']},
 {type:'judgement',options:[{label:'A',text:'错误'},{label:'B',text:'正确'}],answer:'对',raw:'正确'},
 {type:'completion',options:[],blankCount:2,answer:['北京','上海'],raw:['北京','上海']},
 {type:'short',options:[],answer:'结合课程概念说明依据。',raw:'结合课程概念说明依据。'},
].map(x=>({...x,title:'测试 '+x.type,images:[],courseName:'离线验收课程'}));
const methods=ids=>[...ids.map(id=>({id,enabled:true})),...['xingchan-ai','xingchan-bank'].filter(id=>!ids.includes(id)).map(id=>({id,enabled:false}))];
async function endpoint(t,handler){const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}

for(const q of cases)for(const source of ['ordinary','universal','ai','souti'])test(source+' '+q.type+' answers through the browser and authenticated Star gateway',async t=>{
 const calls=[];const url=await endpoint(t,async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;calls.push(req.url);const payload=JSON.parse(body);assert.equal(payload.title,q.title);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/ordinary'?{answer:q.raw}:{kind:'hit',answer:q.answer}));});
 const id={ordinary:bankId,universal:'xingchan-bank',ai:'xingchan-ai',souti:'soutijiang'}[source];
 const account={id:uid,searchMethods:methods([id]),answerSettings:{period:1},questionBanks:[{id:bankId,wrapper:{name:'普通题库',url:url+'/ordinary',method:'post',data:{title:'${title}'},handler:'return r=>[undefined,r.answer]'}}],ai:{driver:'xingchan-original-ai',endpoint:url+'/ai',apiKey:'fixture',model:'fixture',baseUrl:url,type:'openai'},xingchanBank:{driver:'xingchan-original',endpoint:url+'/universal',token:'fixture',sessionToken:'local-fixture'}};
 account.ai.sessionToken='local-fixture';
 const gateway=createGateway({mode:'live',accounts:[account],soutijiangSearch:async()=>({kind:'hit',answer:q.answer})});t.after(()=>gateway.close());await gateway.listen();const client=gateway.clientProfiles()[0];
 const result=await fetch(client.baseUrl+'/fusion/query',{method:'POST',headers:{Authorization:'Bearer '+client.apiKey,'Content-Type':'application/json'},body:JSON.stringify(q)}).then(r=>r.json());assert.deepEqual(result,{kind:'hit',answer:q.answer});
 const owner={labRoot:'fixture',data:{profiles:{[uid]:{ai:{baseUrl:url,model:'fixture',type:'openai'}}}},answerSettings:()=>Answer.normalize({period:1}),plainSecret:(_,key)=>key==='aiConfigurations'?'':'fixture',bankConfig:()=>({banks:account.questionBanks}),getSettings:()=>({searchMethods:methods([id])}),soutijiang:{query:async()=>({kind:'hit',answer:q.answer})}};
 const browser=await browserQuery(owner,uid,q,{provider:async()=>({kind:'hit',answer:q.answer})});assert.equal(browser.kind,'hit');assert.deepEqual(browser.answer,source==='ordinary'?q.raw:q.answer);
});

for(const q of cases)test('Soutijiang screenshot and solve parse '+q.type+' with explicit miss and malformed-result boundaries',()=>{
 const raw=Array.isArray(q.raw)?JSON.stringify(q.raw):q.raw;
 // Screenshot choice letters are resolved through its own returned option text.
 const screenshot=q.type==='multiple'?{stem:q.title+'\nA. 丙\nB. 甲\nC. 乙',answer:'AC'}:{stem:q.title,answer:raw};
 assert.deepEqual(parseScreenshot(q,{message:{errNo:0,list:[{question:screenshot.stem,answer:screenshot.answer}]}}),{kind:'hit',answer:q.answer});
 assert.deepEqual(parseSolve(q,{errNo:0,result:{answer:q.answer}}),{kind:'hit',answer:q.answer});
 assert.deepEqual(parseScreenshot(q,{message:{errNo:0,list:[]}}),{kind:'miss',explicitMiss:true});assert.deepEqual(parseSolve(q,{errNo:0,result:{answer:''}}),{kind:'miss',explicitMiss:true});
 assert.throws(()=>parseScreenshot(q,{message:{errNo:0}}));assert.throws(()=>parseSolve(q,{errNo:0}));
});

for(const q of cases)test('Yanxi observed HTTP protocol handles '+q.type+' without changing universal-bank routing',async t=>{
 const url=await endpoint(t,async(req,res)=>{let body='';for await(const x of req)body+=x;const input=JSON.parse(body);assert.equal(input.title,q.title);assert.equal(input.type,q.type==='short'?'completion':q.type);res.end(JSON.stringify({code:1,message:'请求成功',data:{question:q.title,answer:Array.isArray(q.raw)?q.raw.join('==='):q.raw,times:1,ai:false,tags:[]}}));});
 const adapter=createYanxiV2Adapter({endpoint:url+'/query',allowLoopbackTestEndpoint:true,token:'fixture'});assert.equal((await adapter(q)).kind,'hit');
});

for(const reason of ['soutijiang_login_required','soutijiang_verification_required','soutijiang_accounts_unavailable','soutijiang_daily_exhausted','soutijiang_request_failed'])test(reason+' immediately falls through to the next configured method, never random-fills an error',async t=>{
 const events=[],q=cases[0];let hit=true;
 const gateway=createGateway({mode:'live',accounts:[{id:uid,searchMethods:methods(['soutijiang','xingchan-ai'])}],soutijiangSearch:async()=>{events.push('souti');throw Object.assign(Error('fixture'),{code:reason});},originalSearch:async()=>{events.push('ai');return hit?{kind:'hit',answer:q.answer}:{kind:'miss',explicitMiss:true};}});t.after(()=>gateway.close());
 assert.deepEqual(await gateway.queryBrowser(uid,q),{kind:'hit',answer:q.answer});assert.deepEqual(events,['souti','ai']);events.length=0;hit=false;
 await assert.rejects(gateway.queryBrowser(uid,q),e=>e.code==='search_incomplete_due_to_errors');assert.deepEqual(events,['souti','ai']);
});

test('ordinary handler faults, HTTP limits and bad JSON continue to the next method, but all explicit misses remain a miss',async t=>{
 let scenario='http';const url=await endpoint(t,(req,res)=>{if(scenario==='http'){res.writeHead(429);res.end('{}');}else res.end(scenario==='json'?'broken':JSON.stringify({answer:null}));});
 const gate=createGateway({mode:'live',accounts:[{id:uid,searchMethods:methods([bankId,'xingchan-ai']),questionBanks:[{id:bankId,wrapper:{name:'fixture',url,handler:'return r=>[undefined,r.answer]'}}]}],originalSearch:async()=>({kind:'hit',answer:'B'})});t.after(()=>gate.close());
 for(scenario of ['http','json','miss'])assert.equal((await gate.queryBrowser(uid,cases[0])).answer,'B');
 const misses=createGateway({mode:'live',accounts:[{id:uid,searchMethods:methods(['soutijiang','xingchan-ai'])}],soutijiangSearch:async()=>({kind:'miss',explicitMiss:true}),originalSearch:async()=>({kind:'miss',explicitMiss:true})});t.after(()=>misses.close());assert.deepEqual(await misses.queryBrowser(uid,cases[0]),{kind:'miss'});
});
