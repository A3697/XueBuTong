'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {normalizeSearchMethods:normalize}=require('../src/fusion/search-methods.cjs'),ui=require('../src/fusion/ocs-ui/renderer.js').model;
const {ConnectionChecks}=require('../src/fusion/connection-checks.cjs'),{IntegrationController}=require('../src/fusion/controller.cjs');
const uid='fixture-account',aiId='ai-1234567890abcdef';
const vault={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value),decryptString:value=>value.toString('utf8')};
function fixture(t){const root=fs.mkdtempSync(path.join(process.env.XBT_TEST_TMP||os.tmpdir(),'xbt-order-checks-'));t.after(()=>{assert(path.basename(root).startsWith('xbt-order-checks-'));fs.rmSync(root,{recursive:true,force:true});});return new IntegrationController({labRoot:root,vault});}
function save(c,settings,secretUpdates={}){const p=c.base(uid);return c.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,searchMethods:p.searchMethods,...settings},secretUpdates});}
const ai=(id='xingchan-ai')=>({id,name:id,model:'fixture-model',type:'openai',baseUrl:'https://fixture.example/v1',key:'synthetic-key-'+id});
function install(c){save(c,{searchMethods:[{id:'xingchan-ai',enabled:false},{id:'xingchan-bank',enabled:false}],aiConfigurations:[ai(),ai(aiId)],questionBankConfig:JSON.stringify([{name:'Fixture bank',url:'https://bank.example/query',handler:'return r => [r.question,r.answer]'}])});const bank=c.getSettings({uid}).questionBanks[0].id;save(c,{searchMethods:[{id:bank,enabled:true},{id:'xingchan-ai',enabled:false},{id:aiId,enabled:false},{id:'xingchan-bank',enabled:false}]});return bank;}
test('shared and UI normalize keep enabled first and preserve relative order within each group',()=>{
 const input=[{id:'xingchan-ai',enabled:false},{id:'ocs-12345678',enabled:true},{id:'xingchan-bank',enabled:false},{id:aiId,enabled:true},{id:'soutijiang',enabled:false}],before=structuredClone(input);
 const expected=['ocs-12345678',aiId,'xingchan-ai','xingchan-bank','soutijiang'];for(const normalizer of [normalize,ui.normalizeSearchMethods]){const out=normalizer(input);assert.deepEqual(out.map(x=>x.id),expected);assert.deepEqual(normalizer(out),out);assert.deepEqual(input,before);}
});
test('reorder is allowed within a group and cannot move disabled methods above enabled ones',()=>{
 const input=normalize([{id:'xingchan-ai',enabled:true},{id:aiId,enabled:true},{id:'xingchan-bank',enabled:false},{id:'yanxi',enabled:false}]);
 assert.deepEqual(ui.reorderSearchMethods(input,'xingchan-bank','xingchan-ai'),input);assert.deepEqual(ui.reorderSearchMethods(input,'xingchan-ai','yanxi'),input);
 assert.deepEqual(ui.reorderSearchMethods(input,aiId,'xingchan-ai').map(x=>x.id),[aiId,'xingchan-ai','xingchan-bank','yanxi']);assert.deepEqual(ui.reorderSearchMethods(input,'yanxi','xingchan-bank').map(x=>x.id),['xingchan-ai',aiId,'yanxi','xingchan-bank']);
});
test('new enabled AI reconciliation is sorted before persisted disabled entries',t=>{
 const c=fixture(t);save(c,{aiConfigurations:[ai(aiId)]});const methods=c.base(uid).searchMethods;assert.equal(methods[0].id,aiId);assert.equal(methods[0].enabled,true);assert(methods.slice(1).every(x=>!x.enabled));assert.deepEqual(JSON.parse(fs.readFileSync(c.settingsFile,'utf8')).profiles[uid].searchMethods,methods);
});
test('explicit disabled AI validation touches only its API and does not enable or save the provider',async t=>{
 const c=fixture(t);install(c);const before=fs.readFileSync(c.settingsFile,'utf8'),calls=[];const checks=new ConnectionChecks(c,{transport:async(url,opts)=>{calls.push({url:String(url),body:opts.body,key:opts.headers.Authorization});return{status:200,json:{choices:[{message:{content:'OK'}}]}}},wrapper:()=>{throw Error('Other provider must not be called');}});
 const result=await checks.check({uid,only:[aiId]});assert.deepEqual(result.items.map(x=>x.id),[aiId]);assert.equal(result.items[0].state,'connected');assert.equal(calls.length,1);assert.equal(calls[0].body.max_tokens,1);assert.equal(calls[0].key,'Bearer '+ai(aiId).key);assert.equal(fs.readFileSync(c.settingsFile,'utf8'),before);assert.equal(c.getSettings({uid}).searchMethods.find(x=>x.id===aiId).enabled,false);
});
test('full validation checks enabled methods only; unknown explicit IDs fail before any request',async t=>{
 const c=fixture(t),bank=install(c);let banks=0,aiCalls=0;const checks=new ConnectionChecks(c,{transport:async()=>{aiCalls++;throw Error('Disabled API called');},wrapper:()=>async()=>{banks++;return{kind:'miss'};}});
 assert.deepEqual((await checks.check({uid})).items.map(x=>x.id),[bank]);assert.equal(banks,1);assert.equal(aiCalls,0);
 for(const only of [['ai-aaaaaaaaaaaaaaaa'],['__proto__'],[bank,{}],null])await assert.rejects(checks.check({uid,only}),/已有的搜题方式/);assert.equal(banks,1);assert.equal(aiCalls,0);
 assert.deepEqual((await checks.check({uid,only:[]})).items,[]);
});
test('disabled ordinary and universal banks are individually verifiable without changing enable flags',async t=>{
 const c=fixture(t),bank=install(c);save(c,{searchMethods:c.getSettings({uid}).searchMethods.map(x=>({...x,enabled:false}))},{xingchanBankKey:{action:'set',value:'synthetic-universal-key'}});let wrappers=0,originals=0;c.runtimes.set(uid,{loggedIn:true,enhanced:true});c.request=async(runtime,verb,route,payload)=>{originals++;assert.equal(route,'/api/integration/original-bank');assert.equal(payload.key,'synthetic-universal-key');return{kind:'miss'};};
 const checks=new ConnectionChecks(c,{wrapper:()=>async()=>{wrappers++;return{kind:'miss'};}});assert.deepEqual((await checks.check({uid})).items,[]);assert.equal((await checks.check({uid,only:[bank]})).items[0].state,'connected');assert.equal(wrappers,1);assert.equal(originals,0);assert.equal((await checks.check({uid,only:['xingchan-bank']})).items[0].state,'connected');assert.equal(originals,1);assert(c.getSettings({uid}).searchMethods.every(x=>!x.enabled));
});
test('disabled cache remains visible after restart and invalidates only the edited provider',async t=>{
 const c=fixture(t);install(c);const checks=new ConnectionChecks(c,{transport:async()=>({status:200,json:{choices:[{}]}})});await checks.check({uid,only:['xingchan-ai',aiId]});const previous=checks.snapshot({uid}).items;assert.equal(previous.find(x=>x.id===aiId).state,'connected');
 const restored=new ConnectionChecks(c);assert.deepEqual(restored.snapshot({uid}).items,previous);save(c,{aiConfigurations:[ai(),{...ai(aiId),key:'synthetic-changed-key'}]});const current=restored.snapshot({uid}).items;assert.equal(current.find(x=>x.id===aiId).state,'unchecked');assert.equal(current.find(x=>x.id==='xingchan-ai').state,'connected');
});
test('AI editor may still validate an unsaved draft without entering row whitelist or persistent cache',async t=>{
 const c=fixture(t);const checks=new ConnectionChecks(c,{transport:async()=>({status:200,json:{choices:[{}]}})});assert.equal((await checks.check({uid,only:aiId,draftAI:ai(aiId)})).items[0].state,'connected');assert.equal(checks.results.size,0);await assert.rejects(checks.check({uid,only:[aiId],draftAI:ai(aiId)}));assert.equal(c.getSettings({uid}).aiConfigurations.length,0);
});
test('disabled SouTiJiang validation only refreshes official login state and never spends a search quota',async t=>{
 const c=fixture(t);let states=0;const state={installed:true,compatible:true,loggedIn:true,version:'fixture',connectionKey:'synthetic-login',accounts:[{enabled:true}]};c.soutijiang={configured:()=>true,view:()=>state,state:async(account,options)=>{states++;assert.equal(account,uid);assert.deepEqual(options,{refresh:true,connect:true,forBank:true});return state;},query:()=>{throw Error('Connection check must not search');}};
 save(c,{soutijiangEnabled:true});save(c,{searchMethods:c.getSettings({uid}).searchMethods.map(x=>({...x,enabled:false}))});const checks=new ConnectionChecks(c);assert.deepEqual((await checks.check({uid})).items,[]);const result=await checks.check({uid,only:['soutijiang']});assert.equal(result.items[0].state,'connected');assert.match(result.items[0].message,/不消耗/);assert.equal(states,1);assert.equal(c.getSettings({uid}).searchMethods.find(x=>x.id==='soutijiang').enabled,false);assert.equal(checks.snapshot({uid}).items.find(x=>x.id==='soutijiang').state,'connected');
});
test('export and import preserve enabled grouping and order after applying legacy mixed ordering',t=>{
 const c=fixture(t);const bank=install(c);c.base(uid).searchMethods=[{id:'xingchan-ai',enabled:false},{id:bank,enabled:true},{id:'xingchan-bank',enabled:false},{id:aiId,enabled:true}];
 const {ConfigTransfer}=require('../src/fusion/config-transfer.cjs'),transfer=new ConfigTransfer({root:c.labRoot,controller:c,vault,nativeStore:{store:{paths:{userDataDirsFolder:path.join(c.labRoot,'cache')}}},htmlPreferences:{get:()=>({})},workspacePreferences:{get:()=>({})}});
 const exported=transfer.snapshot({render:{browser:{root:{uid:'root',type:'root',children:{[uid]:{uid,type:'browser',name:'Fixture',automationScripts:[]}}}},setting:{},scripts:[]}}),parsed=transfer.parse(JSON.stringify(exported));
 assert.deepEqual(exported.fusion.profiles[uid].searchMethods.map(x=>x.id),[bank,aiId,'xingchan-ai','xingchan-bank']);assert.deepEqual(parsed.data.profiles[uid].searchMethods,exported.fusion.profiles[uid].searchMethods);
});
