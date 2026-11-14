'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const Shared=require('../src/fusion/browser-answer-settings.cjs');
const LocalPort=require('../src/ocs-app/lib/src/fusion-local-port.js');
const Answers=require('../src/fusion/answer-settings.js');
const script=fs.readFileSync(path.join(__dirname,'../assets/defaults/ocs.user.js'),'utf8');
const secret='isolated-fixture-capability-secret';
const clone=value=>JSON.parse(JSON.stringify(value));

function controller(){
 const profiles={a:{secrets:{questionBankConfig:'fixture-present'},answerSettings:{thread:3,upload:80}},b:{secrets:{},answerSettings:{thread:1,upload:'save'}},empty:{secrets:{}}};
 const wrappers={a:[{id:'bank-a',wrapper:{name:'Account A bank',url:'https://example.test/query',data:{token:'fixture-bank-key'},handler:'return r=>[r.question,r.answer]'}}],b:[],empty:[]};
 return {data:{profiles},plainSecret:()=>'',answerSettings:uid=>Answers.normalize(profiles[uid].answerSettings||{}),bankConfig:uid=>({banks:wrappers[uid]}),getSettings:({uid})=>({searchMethods:(wrappers[uid]||[]).map(bank=>({id:bank.id,enabled:true}))})};
}

// Execute the shipped userscript's real request adapter and appConfigSync hook.
// Only GM transport, the DOM shell and the userscript store are fixtures here.
function consumer({read,closeSync=false,environment='playwright',accountSync=true,authorized=true}={}){
 const values=new Map(),requests=[],errors=[],writes=[],timers=new Map(),listeners=new Map(),events=new Map();let nextTimer=1;
 const context={console:{log(){},error(){errors.push('request_failed');}},URLSearchParams,Reflect,Object,JSON,Promise,
  setTimeout:(run,delay)=>{const id=nextTimer++;timers.set(id,{run,delay});return id;},clearTimeout:id=>timers.delete(id),window:{addEventListener:(name,run)=>events.set(name,run)},
  $:{isInBrowser:()=>true},$console:{log(){}},state$7:{app:{listenerIds:{}}},RenderScript:{namespace:'render'},
  fetch:async address=>{requests.push(address);return {json:async()=>({environment,accountConfigSync:accountSync})};},
  GM_xmlhttpRequest:options=>{
   requests.push(options.url);
   Promise.resolve().then(()=>read(new URL(options.url).pathname)).then(value=>{
    const json=options.responseType==='json';
    options.onload({status:200,response:json?clone(value):String(value),responseText:json?JSON.stringify(value):String(value),responseHeaders:authorized?'Content-Type: application/json\r\nX-XueBuTong-Account-Sync: 1\r\n':''});
   },()=>options.onerror({error:'fixture_transport_failure'}));
  }
 };
 context.lib={Script:class {constructor(options){Object.assign(this,options);this.cfg={...Object.fromEntries(Object.entries(options.configs).map(([key,value])=>[key,value.defaultValue])),closeSync};this.hidePanel=()=>{};this.onConfigChange=(key,run)=>listeners.set(key,run);}},
  $:{isInTopWindow:()=>true,namespaceKey:(ns,key)=>ns+'.'+key},$gm:{getInfos:()=>({})},$ui:{notes:()=>({outerHTML:''})},h:()=>({}),$store:{get:key=>values.get(key),set:(key,value)=>{writes.push(key);values.set(key,clone(value));}}};
 const begin=script.indexOf('appConfigSync: new lib.Script({');
 const end=script.indexOf('      update: new lib.Script({',begin);
 assert(begin>=0&&end>begin,'Shipped appConfigSync hook must be present');
 const expression=script.slice(begin+'appConfigSync: '.length,end).trim().replace(/,$/,'');
 vm.createContext(context);
 vm.runInContext(script.slice(script.indexOf('  function request(url, opts) {'),script.indexOf('  var lib = {};'))+'\nthis.sync='+expression+';',context);
 context.BackgroundProject={name:'background',scripts:{appConfigSync:context.sync}};
 context.definedProjects=()=>[context.BackgroundProject,{name:'common',scripts:{settings:{namespace:'common.settings',configs:{answererWrappers:{},thread:{},upload:{}}}}}];
 return {values,requests,errors,writes,timers,sync:context.sync,run:()=>context.sync.onactive(),
  tick:async()=>{const first=timers.entries().next().value;assert(first,'Account polling must be scheduled');const [id,timer]=first;assert.equal(timer.delay,10000);timers.delete(id);await timer.run();},
  close:value=>{context.sync.cfg.closeSync=value;return listeners.get('closeSync')?.(value);},event:(name,value={})=>events.get(name)?.(value)};
}

test('shipped OCS consumer writes authenticated account banks even when legacy global sync is off',async()=>{
 Shared.install(controller());
 const query={uid:'a',configKey:Shared.capability(secret,'a')};
 const browser=consumer({read:route=>{const shared=Shared.read(query,secret,{});return route==='/browser'?shared.store:String(shared.enabled);}});
 await browser.run();
 assert.equal(browser.sync.cfg.sync_status,'synced');
 assert.equal(browser.values.get('common.settings.thread'),3);
 assert.equal(browser.values.get('common.settings.answererWrappers').length,1);
 assert.equal(browser.values.get('common.settings.answererWrappers')[0].fusionManaged,true);
 assert(!JSON.stringify(browser.values.get('common.settings.answererWrappers')).includes('fixture-bank-key'));
 assert.deepEqual(browser.requests,['/ocs-environment','http://localhost:15319/browser','http://localhost:15319/is-browser-config-sync']);
});

test('main-window changes reach an already active page and unchanged polls perform no writes',async()=>{
 const owner=controller();Shared.install(owner);
 const query={uid:'a',configKey:Shared.capability(secret,'a')};
 const browser=consumer({read:route=>{const shared=Shared.read(query,secret,{});return route==='/browser'?shared.store:String(shared.enabled);}});
 await browser.run();
 const writes=browser.writes.length;
 await browser.tick();assert.equal(browser.writes.length,writes);
 owner.data.profiles.a.answerSettings.thread=2;
 owner.bankConfig=()=>({banks:[{id:'bank-a',wrapper:{name:'Updated fixture bank'}}]});
 await browser.tick();
 assert.equal(browser.values.get('common.settings.thread'),2);
 assert.equal(browser.values.get('common.settings.answererWrappers')[0].name,'学不通 · Updated fixture bank');
 assert.equal(browser.writes.length,writes+2);
});

test('account mode retries after initial transport failure and rejects unauthenticated legacy data',async()=>{
 let offline=true;
 const browser=consumer({read:route=>{if(offline)throw Error('offline fixture');return route==='/browser'?Answers.ocsStore({thread:2},[]):'true';}});
 await browser.run();assert.equal(browser.sync.cfg.sync_status,'unconnect');assert.equal(browser.values.size,0);
 offline=false;await browser.tick();assert.equal(browser.sync.cfg.sync_status,'synced');assert.equal(browser.values.get('common.settings.thread'),2);
 const unscoped=consumer({authorized:false,read:()=>Answers.ocsStore({},[{name:'legacy'}])});
 await unscoped.run();assert.equal(unscoped.values.size,0);assert.equal(unscoped.sync.cfg.sync_status,'unconnect');assert.equal(unscoped.timers.size,1);
});

test('managed account cannot opt out of app-owned answer settings',async()=>{
 const browser=consumer({read:route=>route==='/browser'?Answers.ocsStore({},[]):'true'});
 await browser.run();browser.close(true);assert.equal(browser.timers.size,1);assert.equal(browser.sync.cfg.closeSync,false);
 let release;
 const pending=consumer({read:route=>route==='/browser'?new Promise(resolve=>{release=resolve;}):'true'});
 const run=pending.run();for(let n=0;n<20&&!release;n++)await Promise.resolve();assert(release);
 pending.close(true);release(Answers.ocsStore({},[{name:'not-applied'}]));await run;
 assert(pending.values.size>0);assert.equal(pending.timers.size,1);assert.equal(pending.sync.cfg.sync_status,'synced');
 assert.equal(pending.requests.filter(value=>value.includes('is-browser-config-sync')).length,1);
});

test('page close stops polling while normal legacy OCS synchronization stays one-shot',async()=>{
 const browser=consumer({read:route=>route==='/browser'?Answers.ocsStore({},[]):'true'});await browser.run();browser.event('pagehide');assert.equal(browser.timers.size,0);
 const legacy=consumer({accountSync:false,authorized:false,read:route=>route==='/browser'?Answers.ocsStore({},[{name:'Legacy global bank'}]):'true'});
 await legacy.run();assert.equal(legacy.sync.cfg.sync_status,'synced');assert.equal(legacy.timers.size,0);assert.equal(legacy.values.get('common.settings.answererWrappers')[0].name,'Legacy global bank');
});

test('account settings apply explicit empty banks without inheriting unrelated legacy wrappers',()=>{
 Shared.install(controller());
 const legacy={'common.settings.answererWrappers':[{name:'legacy bank'}],'common.settings.thread':2};
 for(const uid of ['b','empty']){
  const result=Shared.read({uid,configKey:Shared.capability(secret,uid)},secret,legacy);
  assert.equal(result?.enabled,true);
  assert.deepEqual(result.store['common.settings.answererWrappers'],[]);
  assert.equal(result.store['common.settings.thread'],1);
 }
});

test('shared configuration rejects another account capability and keeps unknown accounts empty',()=>{
 Shared.install(controller());
 assert.throws(()=>Shared.read({uid:'b',configKey:Shared.capability(secret,'a')},secret,{}),/授权无效/);
 assert.throws(()=>Shared.read({uid:'a',configKey:['bad']},secret,{}),/授权无效/);
 assert.deepEqual(Shared.read({uid:'missing',configKey:Shared.capability(secret,'missing')},secret,{}),{enabled:false,store:{}});
 assert.equal(Shared.read({},secret,{}),null);
});

test('the real HTTP handlers expose the account marker only after capability verification',async()=>{
 const routes=new Map(),middleware=[];
 const application={use:run=>middleware.push(run),get:(route,run)=>routes.set(String(route),run),post(){},listen:()=>({address:()=>({port:18649})})};
 const express=()=>application;express.urlencoded=express.json=express.static=()=>()=>{};
 const store={store:{},set(key,value){this.store[key]=value;}};
 const source=path.join(__dirname,'../src/ocs-app/lib/src/tasks/startup.server.js'),exports={};
 const context={exports,__dirname:path.dirname(source),require:name=>{
  if(name==='express')return express;if(name==='path')return path;if(name==='axios')return {};
  if(name==='crypto')return {randomUUID:()=>secret};if(name==='../logger')return {Logger:()=>({info(){}})};
  if(name==='../store')return {store,getDecryptedRenderData:()=>({setting:{ocs:{openSync:false,store:{}}}})};
  if(name==='../utils')return {getProjectPath:()=>__dirname};if(name==='../utils/ocr')return {};
  if(name==='../local-userscripts')return {installRoute(){}};if(name.endsWith('browser-answer-settings.cjs'))return Shared;
  throw Error('Unexpected server test dependency');
 }};
 vm.createContext(context);vm.runInContext(fs.readFileSync(source,'utf8'),context);await exports.startupServer();Shared.install(controller());
 const invoke=query=>{
  const headers={},result={};const response={setHeader:(name,value)=>headers[name.toLowerCase()]=value,json:value=>{result.body=value;},status:code=>{result.status=code;return response;}};
  const request={query,headers:{origin:'chrome-extension://isolated-fixture'},method:'GET',path:'/browser'};
  middleware[0](request,response,()=>{});routes.get('/browser')(request,response);return {headers,...result};
 };
 const accepted=invoke({uid:'a',configKey:Shared.capability(store.store.server.authToken,'a')});
 assert.equal(accepted.headers['x-xuebutong-account-sync'],'1');assert.equal(accepted.headers['access-control-expose-headers'],'X-XueBuTong-Account-Sync');
 assert.equal(accepted.body['common.settings.answererWrappers'].length,1);
 const rejected=invoke({uid:'b',configKey:Shared.capability(store.store.server.authToken,'a')});assert.equal(rejected.status,403);assert.equal(rejected.headers['x-xuebutong-account-sync'],undefined);
 assert.equal(invoke({}).headers['x-xuebutong-account-sync'],undefined);
});

function extensionContext(){
 const id='ndcooeababalnlpkfedmmbbbgkljhpjf',rules=[];
 const worker={url:()=>`chrome-extension://${id}/background.js`,evaluate:async(fn,args)=>{
  const context={chrome:{runtime:{id},declarativeNetRequest:{getSessionRules:done=>done(clone(rules)),updateSessionRules:(change,done)=>{
   for(const remove of change.removeRuleIds||[]){const index=rules.findIndex(rule=>rule.id===remove);if(index>=0)rules.splice(index,1);}
   rules.push(...clone(change.addRules||[]));done();
  }}}};
  vm.createContext(context);return vm.runInContext('('+fn.toString()+')',context)(args);
 }};
 const context=new EventEmitter();context.serviceWorkers=()=>[worker];context.pages=()=>[];
 return {context,rules,manager:{id:'scriptcat-official',chromeId:id,applied:true,requestedEnabled:true,enabled:true}};
}

test('account or server capability changes replace DNR binding on a reused context',async()=>{
 const fixture=extensionContext(),{context,rules,manager}=fixture;
 let binding;
 try{
  binding=await LocalPort.attach(context,{serverPort:18649,managers:[manager],accountUid:'a',authToken:secret});
  assert.equal(binding.ready,true);assert.equal(rules.length,1);
  assert(new URL(rules[0].action.redirect.regexSubstitution).searchParams.get('uid')==='a');
  binding=await LocalPort.attach(context,{serverPort:18649,managers:[manager],accountUid:'b',authToken:secret});
  assert.equal(rules.length,1);assert.equal(new URL(rules[0].action.redirect.regexSubstitution).searchParams.get('uid'),'b');
  binding=await LocalPort.attach(context,{serverPort:18649,managers:[manager],accountUid:'b',authToken:secret+'-rotated'});
  assert.equal(new URL(rules[0].action.redirect.regexSubstitution).searchParams.get('configKey'),Shared.capability(secret+'-rotated','b'));
 }finally{await binding?.dispose();}
 assert.equal(rules.length,0);
});

test('explicit script-local sync opt-out and non-OCS environment remain respected',async()=>{
 for(const scenario of [{closeSync:true,environment:'playwright'},{closeSync:false,environment:'external'}]){
  const browser=consumer({...scenario,accountSync:false,read:route=>route==='/browser'?Answers.ocsStore({},[]):'true'});
  await browser.run();assert.equal(browser.values.size,0);
  if(scenario.closeSync)assert.equal(browser.requests.length,1);
  else assert.equal(browser.sync.cfg.sync_status,'not_playwright_environment');
 }
});

test('empty sources default chapter answers off once, without undoing a later manual choice',async()=>{
 const owner=controller();Shared.install(owner);const query={uid:'empty',configKey:Shared.capability(secret,'empty')};
 const browser=consumer({read:route=>{const shared=Shared.read(query,secret,{});return route==='/browser'?shared.store:String(shared.enabled);}});
 browser.values.set('cx.new.study.enableChapterTest',true);await browser.run();assert.equal(browser.values.get('cx.new.study.enableChapterTest'),false);
 browser.values.set('cx.new.study.enableChapterTest',true);await browser.tick();assert.equal(browser.values.get('cx.new.study.enableChapterTest'),true);
});

test('private account fixture is consumed without exposing saved credentials',{skip:!process.env.XBT_BROWSER_PRIVATE_FIXTURE},async()=>{
 const fixtures=JSON.parse(fs.readFileSync(process.env.XBT_BROWSER_PRIVATE_FIXTURE,'utf8'));
 const {IntegrationController}=require('../src/fusion/controller.cjs');
 for(const fixture of fixtures){
  const uid=fixture.item.uid,owner=Object.create(IntegrationController.prototype);
  owner.data={profiles:{[uid]:{...fixture.settings,secrets:Object.fromEntries(Object.entries(fixture.secrets).filter(([,value])=>value).map(([key])=>[key,'private-fixture-present']))}}};
  owner.plainSecret=(_uid,key)=>fixture.secrets[key]||'';
  owner.clientEnvironmentDeviceId=()=>''; // This fixture tests transport, not runtime profile storage.
  Shared.install(owner);const query={uid,configKey:Shared.capability(secret,uid)};
  const expected=Shared.read(query,secret,{}).store;
  const browser=consumer({read:route=>{const shared=Shared.read(query,secret,{});return route==='/browser'?shared.store:String(shared.enabled);}});
  await browser.run();assert.equal(browser.sync.cfg.sync_status,'synced');
  assert.ok(JSON.stringify(browser.values.get('common.settings.answererWrappers'))===JSON.stringify(expected['common.settings.answererWrappers']),'Private wrapper comparison failed');
  assert.equal(browser.values.get('common.settings.thread'),fixture.settings.answerSettings.thread);
 }
});
