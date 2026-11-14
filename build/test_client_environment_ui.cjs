'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('../src/fusion/ocs-ui/renderer.js').model,environment=require('../src/fusion/client-environment.js'),automation=require('../src/fusion/automation-config.js'),profiles=require('../src/fusion/login-profiles.js'),credentialSync=require('../src/fusion/credential-sync.js');
const frontend=fs.readFileSync(path.join(__dirname,'../src/ocs-app/public/assets/index.c87a5b08.js'),'utf8');
const nativeWrite=frontend.slice(frontend.indexOf('function writeFusionNativeCredentials(value){'),frontend.indexOf('function watchFusionCredentials('));
function snapshot(){return model.normalizeSettings('fixture-account',{uid:'fixture-account',revision:7,clientEnvironment:environment.defaults(),clientEnvironmentDeviceId:'00112233445566778899aabbccddeeff',searchMethods:[{id:'xingchan-ai',enabled:false},{id:'xingchan-bank',enabled:false}]});}
test('account model retains editable environment and actual automatic ID separately',()=>{
 const s=snapshot();assert.deepEqual(s.clientEnvironment,environment.defaults());assert.equal(s.clientEnvironment.deviceId,'');assert.equal(s.clientEnvironmentDeviceId,'00112233445566778899aabbccddeeff');
 const draft={...s.clientEnvironment,model:'Fixture Device'},request=model.buildSaveRequest(s.uid,s,{aiBaseUrl:'',aiType:'openai',aiModel:'',clientEnvironment:draft});
 assert.deepEqual(request.settings.clientEnvironment,draft);assert.notEqual(request.settings.clientEnvironment,draft);assert.equal(request.expectedRevision,7);assert.equal('clientEnvironmentDeviceId' in request.settings,false);
 assert.equal('clientEnvironment' in model.buildSaveRequest(s.uid,s,{aiBaseUrl:'',aiType:'openai',aiModel:''}).settings,false,'unrelated changes must not reset environment');
});
test('all supported platform login cards clear native credentials and derived backend values without touching other account data',async()=>{
 for(const kind of ['cx-phone','cx-unit','zhs-phone','zhs-unit','zjy','icve','icourse']){
  const spec=profiles.kinds[kind],script=automation.normalize(automation.catalog.find(item=>item.name===spec.name));
  if(script.configs.loginType)script.configs.loginType.value=kind.endsWith('-unit')?'unit':'phone';
  for(const [key,cfg]of Object.entries(script.configs))if(key!=='loginType')cfg.value='fixture-'+key;
  const account={uid:'fixture-account',name:'Fixture account',playwrightScripts:[script,{name:'通用-新建页面',configs:{url:{value:'https://example.invalid/'}}}],questionBanks:['kept'],courses:['kept']},before=JSON.parse(JSON.stringify(account)),other={uid:'other',name:'Other',playwrightScripts:[]},updates=[];
  const context=vm.createContext({Browser:{from:uid=>uid===account.uid?account:other},window:{FusionLoginProfiles:profiles},JSON});vm.runInContext(nativeWrite,context);
  const sync=credentialSync.create({bridge:{getSettings:async()=>({nativeLoginConfigured:true}),syncNativeLogin:async value=>{updates.push(value);return value;}},readNative:()=>[{uid:account.uid,...profiles.parse(account.playwrightScripts)}],writeNative:context.writeFusionNativeCredentials});
  await sync.initialize();assert.equal(profiles.complete(profiles.parse(account.playwrightScripts)),true);
  assert.equal(context.writeFusionNativeCredentials({uid:account.uid,script,clear:true}),true);await sync.flush();sync.dispose();
  const current=profiles.parse(account.playwrightScripts),last=updates.at(-1);assert.equal(current.kind,kind);assert.equal(current.username,'');assert.equal(current.password,'');assert.equal(current.unit,'');assert.equal(last.login.username,'');assert.equal(last.login.password,'');assert.equal(last.login.unit,'');
  for(const [key,cfg]of Object.entries(account.playwrightScripts[0].configs))if(key!=='loginType')assert.equal(cfg.value,'','hidden identity fields must also clear');
  assert.deepEqual(account.playwrightScripts[1],before.playwrightScripts[1]);assert.deepEqual(account.questionBanks,before.questionBanks);assert.deepEqual(account.courses,before.courses);assert.equal(account.name,before.name);assert.deepEqual(other,{uid:'other',name:'Other',playwrightScripts:[]});
  assert.equal(context.writeFusionNativeCredentials({uid:account.uid,script,clear:true}),false,'stale card must not clear a replacement config');
 }
});
