'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {IntegrationController}=require('../src/fusion/controller.cjs'),{query}=require('../src/fusion/browser-search.cjs'),Shared=require('../src/fusion/browser-answer-settings.cjs'),{ConnectionChecks}=require('../src/fusion/connection-checks.cjs'),{ConfigTransfer}=require('../src/fusion/config-transfer.cjs'),{AccountSettings}=require('../src/fusion/account-settings.cjs'),{HtmlPreferences}=require('../src/fusion/ui-preferences.cjs'),{WorkspacePreferences}=require('../src/fusion/workspace-preferences.cjs');
const vault={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v),decryptString:v=>v.toString('utf8')},uid='sample-A',question={title:'1+1等于多少？',type:'single',options:[{label:'A',text:'1'},{label:'B',text:'2'}],images:[]};
function fixture(t){const parent=path.resolve(process.env.XBT_TEST_TMP||os.tmpdir());fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'souti-wiring-'));t.after(()=>{assert.equal(path.dirname(root),parent);fs.rmSync(root,{recursive:true,force:true});});const c=new IntegrationController({labRoot:root,vault}),htmlPreferences=new HtmlPreferences(root),workspacePreferences=new WorkspacePreferences(root),modes={current:()=>null,anyActive:()=>false};return {c,root,accounts:new AccountSettings({root,controller:c,modes,htmlPreferences,workspacePreferences}),transfer:new ConfigTransfer({root,controller:c,vault,modes,htmlPreferences,workspacePreferences,nativeStore:{store:{paths:{userDataDirsFolder:path.join(root,'cache')}}}})};}
function save(c,settings){const p=c.base(uid);if(settings.searchMethods)settings={...settings,searchMethods:[...settings.searchMethods,...['xingchan-ai','xingchan-bank'].filter(id=>!settings.searchMethods.some(m=>m.id===id)).map(id=>({id,enabled:false}))]};return c.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,searchMethods:p.searchMethods,...settings}});}
test('provider master switch is per account, defaults off and preserves independent search-order switches',t=>{
 const {c}=fixture(t);assert.equal(c.getSettings({uid}).soutijiangEnabled,false);assert(!c.base(uid).searchMethods.some(m=>m.id==='soutijiang'));
 save(c,{soutijiangEnabled:true});assert(c.getSettings({uid}).searchMethods.some(m=>m.id==='soutijiang'&&m.enabled));assert.equal(c.getSettings({uid:'other'}).soutijiangEnabled,false);
 save(c,{searchMethods:[{id:'soutijiang',enabled:false}],soutijiangEnabled:true});assert.equal(c.base(uid).searchMethods.find(m=>m.id==='soutijiang').enabled,false);
 save(c,{soutijiangEnabled:false});save(c,{soutijiangEnabled:true});assert(c.base(uid).searchMethods.find(m=>m.id==='soutijiang').enabled);assert.throws(()=>save(c,{soutijiangEnabled:'true'}),/开关/);
});
test('browser answer-source presence and ordered query use the same account provider',async t=>{
 const {c}=fixture(t);save(c,{soutijiangEnabled:true,searchMethods:[{id:'soutijiang',enabled:true}]});let called=0;c.soutijiang={configured:id=>id===uid,query:async(id,q)=>{assert.equal(id,uid);assert.equal(q.title,question.title);called++;return {kind:'hit',answer:'B'};}};
 assert.deepEqual(await query(c,uid,question),{kind:'hit',answer:'B'});assert.equal(called,1);Shared.install(c);const configKey=Shared.capability('fixture',uid),result=Shared.read({uid,configKey},'fixture',{});assert.equal(result.store['fusion.hasUsableAnswerSource'],true);assert.match(result.store['common.settings.answererWrappers'][0].name,/大学搜题酱/);
 save(c,{ocsEnhancementsEnabled:false});assert.equal(Shared.read({uid,configKey},'fixture',{}).enabled,false);
});
test('enabling an unbound provider does not claim a usable answer source after import or logout',t=>{
 const {c}=fixture(t);save(c,{soutijiangEnabled:true,searchMethods:[{id:'soutijiang',enabled:true}]});Shared.install(c);const configKey=Shared.capability('fixture',uid),read=()=>Shared.read({uid,configKey},'fixture',{}).store;
 assert.equal(read()['fusion.hasUsableAnswerSource'],false);assert.deepEqual(read()['common.settings.answererWrappers'],[]);
 let bound=true;c.soutijiang={configured:id=>id===uid&&bound};assert.equal(read()['fusion.hasUsableAnswerSource'],true);bound=false;assert.equal(read()['fusion.hasUsableAnswerSource'],false);
});
test('provider errors are not misses; explicit misses continue to the next configured method',async t=>{
 const {c}=fixture(t);save(c,{soutijiangEnabled:true,aiConfigurations:[{id:'xingchan-ai',name:'fixture',type:'openai',baseUrl:'https://example.com/v1',model:'fixture',key:'test-key'}],searchMethods:[{id:'soutijiang',enabled:true},{id:'xingchan-ai',enabled:true}]});let calls=[];
 c.soutijiang={query:async()=>{calls.push('souti');return {kind:'miss',explicitMiss:true};}};assert.deepEqual(await query(c,uid,question,{provider:async()=>{calls.push('ai');return {kind:'hit',answer:'B'};}}),{kind:'hit',answer:'B'});assert.deepEqual(calls,['souti','ai']);
 c.soutijiang.query=async()=>{throw Error('network_error');};await assert.rejects(query(c,uid,question,{provider:async()=>({kind:'miss',explicitMiss:true})}),e=>e.code==='search_incomplete_due_to_errors');
 c.soutijiang.query=async()=>({kind:'miss'});await assert.rejects(query(c,uid,question,{provider:async()=>({kind:'miss',explicitMiss:true})}),e=>e.code==='search_incomplete_due_to_errors');
});
test('connection probe never searches and retains unchanged results, invalidating on logout',async t=>{
 const {c}=fixture(t);save(c,{soutijiangEnabled:true,searchMethods:[{id:'soutijiang',enabled:true}]});let state={installed:true,compatible:true,version:'fixture',loggedIn:false,name:''},probes=0;
 c.soutijiang={view:()=>state,state:async(id,options)=>{assert(options.connect&&options.refresh);probes++;return state={...state,loggedIn:true,name:'fixture user'};},query:()=>assert.fail('connection check must not spend quota')};
 const checks=new ConnectionChecks(c),result=await checks.check({uid});assert.equal(result.items[0].state,'connected');assert.equal(probes,1);assert.equal(checks.snapshot({uid}).items[0].checkedAt,result.items[0].checkedAt);state={...state,loggedIn:false,name:''};const reloaded=new ConnectionChecks(c);assert.equal(reloaded.snapshot({uid}).items[0].checkedAt,result.items[0].checkedAt);checks.invalidate(uid,'soutijiang');assert.equal(checks.snapshot({uid}).items[0].state,'unchecked');
});
test('export and clone preserve switch without browser credentials; remove cleans only selected provider profile',t=>{
 const {c,root,transfer,accounts}=fixture(t);save(c,{soutijiangEnabled:true});c.base(uid).soutijiangAccounts={items:[{id:'b'.repeat(24),remark:'首选',enabled:true},{id:'default',remark:'备用',enabled:false}],selectedId:'default'};const privateFile=path.join(root,'bridge-data/soutijiang',uid,'profile/Cookies');fs.mkdirSync(path.dirname(privateFile),{recursive:true});fs.writeFileSync(privateFile,'synthetic-cookie-not-exported');
 const source={render:{browser:{root:{uid:'root',type:'root',children:{[uid]:{uid,type:'browser',name:'Fixture',playwrightScripts:[]}}}},setting:{},scripts:[]}},data=transfer.snapshot(source);assert.equal(data.fusion.profiles[uid].soutijiangEnabled,true);assert(!JSON.stringify(data).includes('synthetic-cookie-not-exported'));assert.equal(transfer.parse(JSON.stringify(data)).data.profiles[uid].soutijiangEnabled,true);assert.deepEqual(transfer.parse(JSON.stringify(data)).data.profiles[uid].soutijiangAccounts,c.base(uid).soutijiangAccounts);
 accounts.clone({sourceUid:uid,targetUid:'copy'});assert.equal(c.base('copy').soutijiangEnabled,true);assert.deepEqual(c.base('copy').soutijiangAccounts,c.base(uid).soutijiangAccounts);assert(!fs.existsSync(path.join(root,'bridge-data/soutijiang/copy')));accounts.remove({uid:'copy'});assert(fs.existsSync(privateFile));accounts.remove({uid});assert(!fs.existsSync(path.dirname(path.dirname(privateFile))));
});

test('a disabled pool does not probe a plugin-only login during bank connection checks',async t=>{
 const {c}=fixture(t);save(c,{soutijiangEnabled:true,searchMethods:[{id:'soutijiang',enabled:true}]});let probes=0;
 c.soutijiang={view:()=>({installed:true,compatible:true,loggedIn:true,accounts:[{id:'default',enabled:false}],connectionKey:'all-disabled'}),state:async()=>{probes++;throw Error('disabled bank must not probe');}};
 const result=await new ConnectionChecks(c).check({uid});assert.equal(result.items[0].state,'unconfigured');assert.match(result.items[0].message,/启用至少一个/);assert.equal(probes,0);
});
