'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createGateway}=require('../src/fusion/gateway/index.cjs'),banks=require('../src/fusion/question-bank-config.js');
const filter=require('../src/star-panel/course-filter.js');
test('course filter and pending blacklist removals are retained by config transfer',()=>{
 const {normalize}=require('../src/fusion/ui-preferences.cjs'),{customKey}=require('../src/fusion/config-transfer.cjs');
 const value={start:'2025-1',end:'2026-2',blackStart:'2025-2',blackEnd:'2025-2',showEnded:false,blacklist:['course:clazz']};assert.deepEqual(normalize({courseFilter:value}).courseFilter,value);assert.equal(customKey('integration.pending_queue_removals'),true);
});
test('saving answer settings updates a running backend without claiming unrelated pending changes applied',async()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../src/fusion/electron-bootstrap.cjs'),'utf8'),start=source.indexOf('saveSettings:async input=>{')+'saveSettings:'.length,end=source.indexOf('\n verifyLogin:',start),code=source.slice(start,end).replace(/,\s*$/,'');
 let profile={revision:1,answerSettings:{upload:80},ai:{model:'one'}},requests=[];const runtime={appliedRevision:1,gatewayProfile:{baseUrl:'http://127.0.0.1:12345/v1',apiKey:'fixture'},gateway:{updateAnswerSettings:(uid,s)=>requests.push(['gateway',s])}};
 const controller={base:()=>profile,answerSettings:()=>profile.answerSettings,saveSettings:input=>(profile={...profile,...input.settings,revision:profile.revision+1}),runtimes:new Map([['fixture',runtime]]),request:async(...args)=>requests.push(['backend',args[3].settings]),appendLog(){}};
 const save=vm.runInNewContext('('+code+')',{controller,JSON});let result=await save({uid:'fixture',settings:{answerSettings:{upload:'save'}}});assert.equal(result.answerSettingsApplied,true);assert.equal(runtime.appliedRevision,2);assert.deepEqual(requests.map(x=>x[0]),['backend','gateway']);
 requests=[];result=await save({uid:'fixture',settings:{ai:{model:'two'},answerSettings:{upload:'force'}}});assert.equal(result.answerSettingsApplied,true);assert.equal(runtime.appliedRevision,2);assert.equal(profile.revision,3);
});
test('ordered search continues after failure, stops at a hit, and refuses random fallback after an error',async t=>{
 let modes=['error','hit','hit'],calls=[];
 const remote=http.createServer((req,res)=>{const i=Number(req.url.slice(1));calls.push(i);res.setHeader('Content-Type','application/json');res.statusCode=modes[i]==='error'?429:200;res.end(JSON.stringify({question:'q',answer:modes[i]==='hit'?'A':''}));});await new Promise(r=>remote.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>remote.close(r)));
 const config=banks.parse([0,1,2].map(i=>({name:'fixture '+i,url:'http://127.0.0.1:'+remote.address().port+'/'+i,method:'post',contentType:'json',data:{title:'${title}'},handler:'return r=>[r.question,r.answer]'})));
 const gateway=createGateway({mode:'live',accounts:[{id:'fixture',questionBanks:config.banks,searchMethods:banks.reconcile(config.banks.map(b=>({id:b.id,enabled:true})),config.banks)}]});
 try{await gateway.listen();const profile=gateway.clientProfiles()[0];const query=async()=>{calls=[];const res=await fetch(profile.baseUrl+'/fusion/query',{method:'POST',headers:{Authorization:'Bearer '+profile.apiKey,'Content-Type':'application/json'},body:JSON.stringify({title:'q',type:'single',options:[{label:'A',text:'a'},{label:'B',text:'b'}]})});return{status:res.status,body:await res.json()};};
  let r=await query();assert.equal(r.body.kind,'hit');assert.deepEqual(calls,[0,1]);
  modes=['miss','miss','hit'];r=await query();assert.equal(r.body.answer,'A');assert.deepEqual(calls,[0,1,2]);
  modes=['hit','hit','hit'];r=await query();assert.deepEqual(calls,[0]);
  modes=['miss','miss','miss'];r=await query();assert.deepEqual(r.body,{kind:'miss'});
  modes=['error','miss','miss'];r=await query();assert.equal(r.status,502);assert.equal(r.body.error.code,'search_incomplete_due_to_errors');assert.deepEqual(calls,[0,1,2]);
 }finally{await gateway.close();}
});
test('course half-year range, end dates, unknown dates and blacklist share bulk-add selection',()=>{
 const courses=[{course_id:1,clazz_id:1,start_date:'2025-02-01',end_date:'2025-07-01'},{course_id:2,clazz_id:2,start_date:'2025-09-01'},{course_id:3,clazz_id:3,start_date:'2026-03-01'},{course_id:4,clazz_id:4}];
 assert.deepEqual(filter.periods(courses),['2025-1','2025-2','2026-1']);
 const f=filter.normalize({start:'2025-2',end:'2025-2',blacklist:['2:2']});assert.deepEqual(filter.visible(courses,f).map(c=>c.course_id),[4]);
 assert.equal(filter.matches(courses[0],filter.normalize({showEnded:false}),false,new Date(2026,0,1)),false);
 assert.equal(filter.matches(courses[0],filter.normalize()),true);
});
test('connection results survive recreation and invalidate only changed configurations',async()=>{
 const {ConnectionChecks}=require('../src/fusion/connection-checks.cjs'),folder=fs.mkdtempSync(path.join(process.env.XBT_TEST_TMP||os.tmpdir(),'xbt244-checks-'));let key='fixture-key';
 const p={ai:{type:'openai',baseUrl:'https://example.com/v1',model:'fixture'}},controller={dataDir:folder,getSettings:()=>({searchMethods:[{id:'xingchan-ai',enabled:true}],questionBanks:[]}),base:()=>p,plainSecret:(uid,name)=>name==='aiKey'?key:''};
 try{const first=new ConnectionChecks(controller,{transport:async()=>({status:200,json:{choices:[{message:{content:'OK'}}]}})});await first.check({uid:'fixture'});const previous=first.snapshot({uid:'fixture'}).items[0];assert.equal(previous.state,'connected');const restored=new ConnectionChecks(controller);assert.deepEqual(restored.snapshot({uid:'fixture'}).items[0],previous);p.note='unrelated';assert.equal(restored.snapshot({uid:'fixture'}).items[0].state,'connected');key='different';assert.equal(restored.snapshot({uid:'fixture'}).items[0].state,'unchecked');}finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('tray and exit close behavior persist and route to the existing exit-confirmation path',async()=>{
 const {normalize}=require('../src/fusion/workspace-preferences.cjs'),{TrayLifecycle}=require('../src/fusion/tray-lifecycle.cjs');assert.equal(normalize({}).closeBehavior,'tray');assert.equal(normalize({closeBehavior:'exit'}).closeBehavior,'exit');
 let prefs={closeBehavior:'exit'},hidden=0,exits=0,prevented=0;const win={isDestroyed:()=>false,isMinimized:()=>false,show(){},focus(){},hide(){hidden++;}};
 const lifecycle=new TrayLifecycle({preferences:{get:()=>prefs},requestExit:()=>exits++});lifecycle.window=win;await lifecycle.closeWindow(win,{preventDefault(){prevented++;}});assert.equal(exits,1);assert.equal(hidden,0);prefs={closeBehavior:'tray',trayNoticeAccepted:true};await lifecycle.closeWindow(win,{preventDefault(){prevented++;}});assert.equal(hidden,1);assert.equal(exits,1);assert.equal(prevented,2);
});
