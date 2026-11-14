'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {IntegrationController}=require('../src/fusion/controller.cjs'),A=require('../src/fusion/ai-config.js'),Banks=require('../src/fusion/question-bank-config.js');
const {query}=require('../src/fusion/browser-search.cjs'),{ConnectionChecks}=require('../src/fusion/connection-checks.cjs');
const Shared=require('../src/fusion/browser-answer-settings.cjs');
const id='ai-1234567890abcdef',uid='fixture-account',key1='sk-FIRST-fixture-LAST',key2='sk-OTHER-fixture-ENDS';
const vault={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value),decryptString:value=>value.toString('utf8')};
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'xbt-provider-257-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return new IntegrationController({labRoot:root,vault});}
function update(c,settings,secretUpdates={}){const p=c.base(uid);return c.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,searchMethods:p.searchMethods,...settings},secretUpdates});}
function models(){return[{id:'xingchan-ai',name:'主模型',model:'model-same',type:'openai',baseUrl:'https://first.example/v1',key:key1},{id,name:'备用模型',model:'model-same',type:'openai',baseUrl:'https://second.example/v1',key:key2}];}
function install(c){return update(c,{aiConfigurations:models(),searchMethods:[{id,enabled:true},{id:'xingchan-ai',enabled:true},{id:'xingchan-bank',enabled:false}]});}
const question={title:'1+1?',type:'single',options:[{label:'A',text:'1'},{label:'B',text:'2'}],blankCount:0,images:[]};
test('old single AI keeps its key and stable order; snapshots expose previews only',t=>{
 const c=fixture(t);update(c,{ai:{model:'legacy',baseUrl:'https://first.example/v1',type:'openai'}},{aiKey:{action:'set',value:key1}});
 const saved=c.getSettings({uid});assert.equal(saved.aiConfigurations.length,1);assert.equal(saved.aiConfigurations[0].id,'xingchan-ai');assert.equal(saved.aiConfigurations[0].name,'legacy');assert.equal(saved.aiConfigurations[0].keyPreview,'FIRS…LAST');assert(!JSON.stringify(saved).includes(key1));
 const reloaded=new IntegrationController({labRoot:c.labRoot,vault});assert.equal(A.read(reloaded,uid)[0].key,key1);
});
test('same model may have unique names; duplicate names and IDs rejected atomically',t=>{
 const c=fixture(t);install(c);const original=JSON.stringify(c.data),savedFile=fs.readFileSync(c.settingsFile,'utf8');
 assert.throws(()=>update(c,{aiConfigurations:models().map(m=>({...m,name:' Same '}))}),/相同名称/);assert.equal(JSON.stringify(c.data),original);assert.equal(fs.readFileSync(c.settingsFile,'utf8'),savedFile);
 assert.throws(()=>A.normalize(models().map(m=>({...m,id}))),/标识/);
 assert.equal(c.getSettings({uid}).aiConfigurations.length,2);
});
test('updates retain each own key and removal does not clear another model',t=>{
 const c=fixture(t);install(c);let saved=c.getSettings({uid});update(c,{aiConfigurations:saved.aiConfigurations.map(ai=>({...ai,name:ai.name+'改'}))});assert.deepEqual(A.read(c,uid).map(ai=>ai.key),[key1,key2]);
 saved=c.getSettings({uid});update(c,{aiConfigurations:saved.aiConfigurations.filter(ai=>ai.id===id)});assert.equal(c.plainSecret(uid,'aiKey'),'');assert.equal(c.base(uid).ai.model,'');assert.equal(A.read(c,uid)[0].key,key2);assert.equal(c.getSettings({uid}).searchMethods.find(m=>m.id==='xingchan-ai').enabled,false);
});
test('origin changes never forward old credentials, and an unsaved config cannot borrow another model key',t=>{
 const c=fixture(t);install(c);const saved=c.getSettings({uid});assert.throws(()=>update(c,{aiConfigurations:saved.aiConfigurations.map(ai=>ai.id===id?{...ai,baseUrl:'https://other.example/v1'}:ai)}),/API Key/);
 const {draftKey}=require('../src/fusion/ai-models.cjs');assert.equal(draftKey({id,baseUrl:'https://first.example/v1'},c,uid),'');assert.equal(draftKey({id,baseUrl:'https://second.example/v1'},c,uid),key2);assert.equal(draftKey({id:'ai-aaaaaaaaaaaaaaaa',baseUrl:'https://first.example/v1'},c,uid),'');
});
test('browser pipeline uses each AI key in saved order and stops at first hit',async t=>{
 const c=fixture(t);install(c);const calls=[];const provider=async(root,source,payload)=>{calls.push([payload.ai.name,payload.key]);return payload.key===key2?{kind:'miss',explicitMiss:true}:{kind:'hit',answer:'B'};};
 assert.deepEqual(await query(c,uid,question,{provider}),{kind:'hit',answer:'B'});assert.deepEqual(calls,[['备用模型',key2],['主模型',key1]]);
 Shared.install(c);const result=Shared.read({uid,configKey:Shared.capability('fixture',uid)},'fixture',{});assert.match(result.store['common.settings.answererWrappers'][0].name,/备用模型.*主模型/);assert(!JSON.stringify(result).includes(key1));assert.equal(result.store['fusion.hasUsableAnswerSource'],true);
});
test('connection results are independent and only changed models invalidate cache',async t=>{
 const c=fixture(t);install(c);const headers=[];const checks=new ConnectionChecks(c,{transport:async(url,opts)=>{headers.push(opts.headers.Authorization);return {status:200,json:{choices:[{message:{content:'OK'}}]}};}});
 await checks.check({uid});assert.deepEqual(headers,['Bearer '+key2,'Bearer '+key1]);assert(checks.snapshot({uid}).items.every(item=>item.state==='connected'));
 const saved=c.getSettings({uid});update(c,{aiConfigurations:saved.aiConfigurations.map(ai=>ai.id===id?{...ai,model:'changed'}:ai)});assert.equal(checks.snapshot({uid}).items.find(m=>m.id===id).state,'unchecked');assert.equal(checks.snapshot({uid}).items.find(m=>m.id==='xingchan-ai').state,'connected');
});
test('ordinary bank reconciliation preserves multiple AI entries and universal key',t=>{
 const c=fixture(t);install(c);const bank=Banks.parse([{name:'fixture bank',url:'https://bank.example/query',handler:'return r=>[undefined,r.answer]'}]);
 update(c,{questionBankConfig:bank.json,searchMethods:Banks.reconcile(c.base(uid).searchMethods,bank.banks,{enableImported:true})},{xingchanBankKey:{action:'set',value:'universal-fixture'}});
 const saved=c.getSettings({uid});assert(saved.searchMethods.some(m=>m.id===id&&m.enabled));assert.equal(A.read(c,uid)[1].key,key2);assert.equal(c.plainSecret(uid,'xingchanBankKey'),'universal-fixture');
});
test('unchanged incomplete legacy AI does not block unrelated bank edits',t=>{
 const c=fixture(t);update(c,{ai:{model:'legacy',baseUrl:'https://first.example/v1',type:'openai'}});
 const saved=c.getSettings({uid});assert.equal(saved.aiConfigurations[0].hasKey,false);
 assert.doesNotThrow(()=>update(c,{aiConfigurations:saved.aiConfigurations,questionBankConfig:'[]',searchMethods:Banks.reconcile(saved.searchMethods,[])}));
 assert.throws(()=>update(c,{aiConfigurations:saved.aiConfigurations.map(ai=>({...ai,model:'new'}))}),/API Key/);
});
test('auto-detected local Ollama works without a key in browser mode',async t=>{
 const c=fixture(t);update(c,{aiConfigurations:[{id,name:'local',baseUrl:'http://127.0.0.1:11434',model:'local',type:'auto',key:''}]});
 let seen;const result=await query(c,uid,question,{provider:async(root,source,payload)=>{seen=payload;return {kind:'hit',answer:'B'};}});
 assert.equal(seen.ai.type,'ollama');assert.equal(seen.key,'');assert.equal(result.answer,'B');
});
test('export/import roundtrip keeps all AI keys, names, order, answer settings and universal bank',t=>{
 const c=fixture(t);install(c);update(c,{enrollmentYear:2025,answerSettings:{...c.answerSettings(uid),upload:75}},{xingchanBankKey:{action:'set',value:'universal-fixture'}});
 const {ConfigTransfer}=require('../src/fusion/config-transfer.cjs');const transfer=new ConfigTransfer({root:c.labRoot,controller:c,vault,nativeStore:{store:{paths:{userDataDirsFolder:path.join(c.labRoot,'cache')}}},htmlPreferences:{get:()=>({})},workspacePreferences:{get:()=>({})}});
 const source={render:{browser:{root:{uid:'root',type:'root',children:{[uid]:{uid,type:'browser',name:'Fixture',automationScripts:[]}}}},setting:{},scripts:[]}};
 const exported=transfer.snapshot(source),restored=transfer.parse(JSON.stringify(exported));
 const profile=restored.data?.profiles?.[uid]||restored.profiles?.[uid]||restored.controllerData?.profiles?.[uid];
 assert(profile,'parsed fusion profile is available');assert.equal(profile.enrollmentYear,2025);const legacy=structuredClone(exported);delete legacy.fusion.profiles[uid].enrollmentYear;assert.equal(transfer.parse(JSON.stringify(legacy)).data.profiles[uid].enrollmentYear,null);assert.deepEqual(JSON.parse(vault.decryptString(Buffer.from(profile.secrets.aiConfigurations,'base64'))),A.read(c,uid));
 assert.deepEqual(profile.searchMethods,c.base(uid).searchMethods);assert.equal(profile.answerSettings.upload,75);assert.equal(vault.decryptString(Buffer.from(profile.secrets.xingchanBankKey,'base64')),'universal-fixture');
});
test('star gateway switches model config on the shared protected-provider endpoint',async t=>{
 const requests=[];const server=http.createServer(async(req,res)=>{let input='';for await(const chunk of req)input+=chunk;const body=JSON.parse(input);requests.push(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body.key===key2?{kind:'miss',explicitMiss:true}:{kind:'hit',answer:'B'}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const {createGateway}=require('../src/fusion/gateway/index.cjs');const gateway=createGateway({mode:'live',accounts:[{id:uid,searchMethods:[{id,enabled:true},{id:'xingchan-ai',enabled:true},{id:'xingchan-bank',enabled:false}],aiProviders:models().map(ai=>({...ai,apiKey:ai.key,driver:'xingchan-original-ai',endpoint:'http://127.0.0.1:'+server.address().port+'/query',timeoutMs:5000,sessionToken:'fixture'}))}]});
 t.after(()=>gateway.close());await gateway.listen();const client=gateway.clientProfiles()[0],result=await fetch(client.baseUrl+'/fusion/query',{method:'POST',headers:{Authorization:'Bearer '+client.apiKey,'Content-Type':'application/json'},body:JSON.stringify(question)}).then(r=>r.json());assert.deepEqual(result,{kind:'hit',answer:'B'});assert.deepEqual(requests.map(r=>r.key),[key2,key1]);
});
