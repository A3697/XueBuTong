'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {ConfigTransfer,customKey}=require('../src/fusion/config-transfer.cjs');
const {AccountSettings}=require('../src/fusion/account-settings.cjs');
const Environment=require('../src/fusion/client-environment.js');
const Merge=require('../src/fusion/config-merge.cjs');
const Workspace=require('../src/fusion/workspace-preferences.cjs');
const WindowSizes=require('../src/fusion/window-sizes.cjs');
const UID='a'.repeat(32),OTHER='b'.repeat(32),REMOTE='c'.repeat(32);
const copy=value=>structuredClone(value);
const explicit={deviceId:'1'.repeat(32),androidVersion:'14',model:'Pixel 7',buildNumber:'UP1A.231005.007',chromeVersion:'126.0.0.0',webviewBase:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',dalvikBase:'Dalvik/2.1.0 (Linux; U; Android 14)',schildWebview:'2'.repeat(32),schildDalvik:'3'.repeat(32),webviewFull:'FixtureWebView/2.0 (schild:22222222222222222222222222222222) (@Kalimdor)_11111111111111111111111111111111',dalvikFull:'FixtureDalvik/2.0 (device:Fixture)'};
function account(uid,username){return {uid,parent:'root',type:'browser',name:uid,notes:'',tags:[],cachePath:'$CACHE_PATH',playwrightScripts:username?[{name:'超星-手机密码登录',configs:{phone:{value:username},password:{value:'fixture-password'}}}]:[]};}
function document(items=[account(UID)]){return {render:{browser:{root:{uid:'root',type:'root',name:'根目录',children:Object.fromEntries(items.map(item=>[item.uid,item]))}},setting:{},scripts:[]}};}
function profile(environment){return {revision:5,username:'',schoolId:'',ai:{baseUrl:'',model:'',type:'openai'},questionStrategy:'yanxi-first',secrets:{},...(environment===undefined?{}:{clientEnvironment:copy(environment)})};}
function fixture(t,profiles={}){
 const tempRoot=path.resolve(__dirname),root=fs.mkdtempSync(path.join(tempRoot,'xbt-client-transfer-'));
 t.after(()=>{
  // The test owns exactly this newly created directory, never an app profile.
  assert.equal(path.dirname(path.resolve(root)),tempRoot);
  assert(path.basename(root).startsWith('xbt-client-transfer-'));
  fs.rmSync(root,{recursive:true,force:true});
 });
 const controller={data:{schema:1,profiles:copy(profiles)},settingsFile:path.join(root,'bridge-data/profiles.json'),plainSecret:()=>'',secretCache:new Map(),redactorCache:new Map(),bankCache:new Map(),persist(){write(this.settingsFile,this.data);}};
 const htmlPreferences={file:path.join(root,'bridge-data/html.json'),accounts:{},get(uid){return copy(this.accounts[uid]||{});},set(uid,value){this.accounts[uid]=copy(value);this.persist();},persist(){write(this.file,{schema:1,accounts:this.accounts});}};
 const workspacePreferences={file:path.join(root,'bridge-data/workspace.json'),data:Workspace.normalize(),get(){return copy(this.data);},set(value){this.data=Workspace.normalize(value);write(this.file,this.data);}};
 const vault={encryptString:value=>Buffer.from(value),decryptString:value=>Buffer.from(value),isEncryptionAvailable:()=>true};
 const nativeStore={store:{app:{data_encryption:true},paths:{userDataDirsFolder:path.join(root,'cache')}}};
 const modes={anyActive:()=>false,current:()=>null};
 const transfer=new ConfigTransfer({root,controller,vault,nativeStore,htmlPreferences,workspacePreferences,modes});
 return {root,controller,htmlPreferences,workspacePreferences,nativeStore,transfer,accounts:new AccountSettings({root,controller,modes,htmlPreferences,workspacePreferences})};
}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));}
function stateFile(root,uid){return path.join(root,'instances',uid,'data/storage/state.json');}
function runtimeState(){return {
 'integration.queue':{schema:1,items:[{course_id:'fixture-course',title:'合成课程'}]},
 'integration.pending_queue_removals':['fixture-course'],
 'config.video_speed':2,'face.photo_file':'photo.jpg','face.object_id':'fixture-photo',
 'integration.client_owner':UID,'integration.http_cookies':{cookies:[{value:'fixture-cookie-secret'}]},
 'integration.login_identity':'fixture-login-state','auth.session':{token:'fixture-session-secret'},
 'ua.device_id':'f'.repeat(32),'ua.schild_webview':'fixture-runtime-schild'
};}
function stateWrite(plan,root,uid){return plan.writes.find(item=>item.file===stateFile(root,uid)).value;}
function overwrite(merge){return merge.finish(Object.fromEntries(merge.conflicts.map(item=>[item.id,'overwrite'])));}

test('same-account export and import preserve all explicit client fields but exclude runtime identity and sessions',t=>{
 const f=fixture(t,{[UID]:profile(explicit)}),state=runtimeState();write(stateFile(f.root,UID),state);
 const before=copy(f.controller.data),exported=f.transfer.snapshot(document());
 assert.deepEqual(exported.fusion.profiles[UID].clientEnvironment,explicit);
 const serialized=JSON.stringify(exported);
 for(const value of ['fixture-cookie-secret','fixture-login-state','fixture-session-secret','fixture-runtime-schild','f'.repeat(32)])assert(!serialized.includes(value));
 assert.deepEqual(exported.fusion.runtimeSettings[UID],Object.fromEntries(Object.entries(state).filter(([key])=>customKey(key))));
 assert.deepEqual(f.controller.data,before);
 const plan=f.transfer.parse(serialized);
 assert.deepEqual(plan.data.profiles[UID].clientEnvironment,explicit);
 // Importing this same UID retains its local session; no session was imported.
 assert.deepEqual(stateWrite(plan,f.root,UID),state);
 let checked=false;f.controller.validateClientEnvironments=profiles=>{checked=true;assert.deepEqual(profiles[UID].clientEnvironment,explicit);};
 f.transfer.apply(plan);assert(checked);
 assert.deepEqual(f.transfer.snapshot({render:plan.render}).fusion.profiles[UID].clientEnvironment,explicit);
});

test('normalization trims explicit fields, discards unrecognized fields, and never exports generated runtime IDs',t=>{
 const input={...explicit,deviceId:' A'.padEnd(33,'A')+' ',model:' Pixel 7 ',cookie:'must-not-export'};
 const f=fixture(t,{[UID]:profile(input),[OTHER]:profile()});
 write(stateFile(f.root,OTHER),runtimeState());
 const exported=f.transfer.snapshot(document([account(UID),account(OTHER)]));
 assert.equal(exported.fusion.profiles[UID].clientEnvironment.deviceId,'a'.repeat(32));
 assert.equal(exported.fusion.profiles[UID].clientEnvironment.model,'Pixel 7');
 assert(!Object.hasOwn(exported.fusion.profiles[UID].clientEnvironment,'cookie'));
 assert.deepEqual(exported.fusion.profiles[OTHER].clientEnvironment,Environment.defaults());
 assert.equal(exported.fusion.profiles[OTHER].clientEnvironment.deviceId,'');
});

test('legacy OCS imports retain matching local client settings and initialize new accounts with defaults',t=>{
 const f=fixture(t,{[UID]:profile(explicit)}),plan=f.transfer.parse(JSON.stringify(document([account(UID),account(OTHER)])));
 assert.equal(plan.isLegacy,true);
 assert.deepEqual(plan.data.profiles[UID].clientEnvironment,explicit);
 assert.deepEqual(plan.data.profiles[OTHER].clientEnvironment,Environment.defaults());
 const legacyFusion=f.transfer.snapshot(document());delete legacyFusion.fusion.profiles[UID].clientEnvironment;
 assert.deepEqual(f.transfer.parse(JSON.stringify(legacyFusion)).data.profiles[UID].clientEnvironment,Environment.defaults());
});

test('invalid client settings reject export and import rather than silently dropping explicit values',t=>{
 const f=fixture(t,{[UID]:profile({...explicit,deviceId:'invalid-device'})});
 assert.throws(()=>f.transfer.snapshot(document()),/设备号/);
 f.controller.data.profiles[UID]=profile(explicit);
 const exported=f.transfer.snapshot(document());exported.fusion.profiles[UID].clientEnvironment.schildWebview='invalid-schild';
 assert.throws(()=>f.transfer.parse(JSON.stringify(exported)),/schild/);
 assert(!fs.existsSync(f.controller.settingsFile));
});

test('account conflict comparison includes device, UA and schild fields; skip and overwrite retain their exact selected values',t=>{
 const f=fixture(t,{[UID]:profile(explicit)}),current=f.transfer.snapshot(document()),incoming=copy(current);
 incoming.fusion.profiles[UID].clientEnvironment={...explicit,deviceId:'4'.repeat(32),androidVersion:'13',schildWebview:'5'.repeat(32)};
 for(const choice of ['skip','overwrite']){
  const merge=Merge.prepare(current,incoming),conflict=merge.conflicts.find(item=>item.id==='account:'+UID);assert(conflict);
  for(const key of ['deviceId','androidVersion','schildWebview'])assert(conflict.rows.some(row=>row.path.endsWith('clientEnvironment / '+key)&&!row.equal));
  const result=merge.finish(Object.fromEntries(merge.conflicts.map(item=>[item.id,choice])));
  assert.deepEqual(f.transfer.parse(JSON.stringify(result)).data.profiles[UID].clientEnvironment,choice==='skip'?explicit:incoming.fusion.profiles[UID].clientEnvironment);
 }
});

test('a login-identity UID remap preserves explicit imported values for final-set uniqueness validation',t=>{
 const f=fixture(t,{[UID]:profile(explicit)}),current=f.transfer.snapshot(document([account(UID,'fixture-user')]));
 f.controller.data.profiles[REMOTE]=profile({...explicit,deviceId:'4'.repeat(32)});
 const incoming=f.transfer.snapshot(document([account(REMOTE,'fixture-user')]));
 const merged=overwrite(Merge.prepare(current,incoming)),plan=f.transfer.parse(JSON.stringify(merged));
 assert.deepEqual(Object.keys(plan.data.profiles),[UID]);
 assert.equal(plan.data.profiles[UID].clientEnvironment.deviceId,'4'.repeat(32));
 let checked;f.controller.validateClientEnvironments=profiles=>{checked=copy(profiles);};
 f.transfer.apply(plan);assert.equal(checked[UID].clientEnvironment.deviceId,'4'.repeat(32));
});

test('an imported UID colliding with a folder is remapped without silently changing explicit identifiers',t=>{
 const f=fixture(t,{[REMOTE]:profile(explicit)});
 const current=f.transfer.snapshot(document([{uid:REMOTE,parent:'root',type:'folder',name:'本地分组',children:{}}]));
 const incoming=f.transfer.snapshot(document([account(REMOTE)]));
 const merged=overwrite(Merge.prepare(current,incoming)),plan=f.transfer.parse(JSON.stringify(merged));
 const [mapped]=Object.keys(plan.data.profiles);assert.notEqual(mapped,REMOTE);
 assert.deepEqual(plan.data.profiles[mapped].clientEnvironment,explicit);
});

test('uniqueness validation sees the complete merged set and rejects before backups, state writes or store mutation',t=>{
 const f=fixture(t,{[UID]:profile(explicit),[OTHER]:profile(explicit)}),current=f.transfer.snapshot(document([account(UID)])),incoming=f.transfer.snapshot(document([account(OTHER)]));
 const plan=f.transfer.parse(JSON.stringify(overwrite(Merge.prepare(current,incoming))));
 const beforeStore=copy(f.nativeStore.store),beforeData=copy(f.controller.data);let checked;
 f.controller.validateClientEnvironments=profiles=>{checked=copy(profiles);throw Error('fixture duplicate device rejected');};
 assert.throws(()=>f.transfer.apply(plan),/fixture duplicate device rejected/);
 assert.deepEqual(Object.keys(checked).sort(),[UID,OTHER].sort());
 assert.equal(checked[UID].clientEnvironment.deviceId,checked[OTHER].clientEnvironment.deviceId);
 assert.deepEqual(f.nativeStore.store,beforeStore);assert.deepEqual(f.controller.data,beforeData);
 assert(!fs.existsSync(path.join(f.root,'private')));assert(!fs.existsSync(f.controller.settingsFile));
 assert(!fs.existsSync(stateFile(f.root,UID)));assert(!fs.existsSync(stateFile(f.root,OTHER)));
});

test('runtime cookie, login and generated-device fields cannot be smuggled into an imported settings payload',t=>{
 const f=fixture(t,{[UID]:profile(explicit)}),exported=f.transfer.snapshot(document());
 for(const key of ['integration.http_cookies','integration.client_owner','integration.login_identity','auth.session','ua.device_id','ua.schild_webview']){
  const incoming=copy(exported);incoming.fusion.runtimeSettings[UID]={[key]:'fixture-secret'};
  assert.throws(()=>f.transfer.parse(JSON.stringify(incoming)),/非自定义内容/);
 }
});

test('cloning an account retains UA, courses, bank settings, photos and layout while clearing device and schild ownership',t=>{
 const source=profile(explicit);source.secrets={questionBankConfig:'fixture-bank-secret',aiKey:'fixture-ai-key'};
 const f=fixture(t,{[UID]:source}),state=runtimeState(),file=stateFile(f.root,UID);write(file,state);
 const photo=path.join(path.dirname(file),'face/photo.jpg');fs.mkdirSync(path.dirname(photo),{recursive:true});fs.writeFileSync(photo,Buffer.from('fixture-photo-content'));
 f.htmlPreferences.accounts[UID]={theme:'dark',courseFilter:{blacklist:['fixture-hidden']}};
 f.workspacePreferences.data=Workspace.normalize({cardOrder:[UID],speeds:{[UID]:2},launchPlans:{[UID]:{autoMode:'xingchan'}}});
 WindowSizes.write(f.root,'browser-'+UID,{width:1200,height:800});
 const beforeProfile=copy(f.controller.data.profiles[UID]),beforeState=fs.readFileSync(file);
 assert.deepEqual(f.accounts.clone({sourceUid:UID,targetUid:OTHER}),{copied:true});
 const cloned=f.controller.data.profiles[OTHER];
 assert.deepEqual(cloned.clientEnvironment,Environment.forClone(explicit));
 for(const key of ['deviceId','schildWebview','schildDalvik','webviewFull','dalvikFull'])assert.equal(cloned.clientEnvironment[key],'');
 assert.deepEqual(cloned.secrets,source.secrets);
 assert.deepEqual(JSON.parse(fs.readFileSync(stateFile(f.root,OTHER))),Object.fromEntries(Object.entries(state).filter(([key])=>customKey(key))));
 assert.deepEqual(fs.readFileSync(path.join(path.dirname(stateFile(f.root,OTHER)),'face/photo.jpg')),fs.readFileSync(photo));
 assert.deepEqual(f.htmlPreferences.get(OTHER),f.htmlPreferences.get(UID));
 assert.deepEqual(WindowSizes.read(f.root,'browser-'+OTHER),{width:1200,height:800});
 assert.equal(f.workspacePreferences.get().speeds[OTHER],2);
 assert.equal(f.workspacePreferences.get().launchPlans[OTHER],undefined);
 assert.deepEqual(f.controller.data.profiles[UID],beforeProfile);assert.deepEqual(fs.readFileSync(file),beforeState);
});
