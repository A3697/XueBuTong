'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {IntegrationController}=require('../src/fusion/controller.cjs');
const Native=require('../src/fusion/native-star-settings.cjs'),{StarMonitor}=require('../src/fusion/star-monitor.cjs');
const {ConfigTransfer}=require('../src/fusion/config-transfer.cjs'),{AccountSettings}=require('../src/fusion/account-settings.cjs');
const {HtmlPreferences}=require('../src/fusion/ui-preferences.cjs'),{WorkspacePreferences}=require('../src/fusion/workspace-preferences.cjs');
const model=require('../src/fusion/ocs-ui/renderer.js').model;
const vault={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v),decryptString:v=>v.toString('utf8')};
function fixture(t){
 const parent=path.resolve(process.env.XBT_TEST_TMP||os.tmpdir());fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'xbt-modes-'));
 t.after(()=>{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(parent));assert(path.basename(root).startsWith('xbt-modes-'));fs.rmSync(root,{recursive:true,force:true});});
 const controller=new IntegrationController({labRoot:root,vault}),htmlPreferences=new HtmlPreferences(root),workspacePreferences=new WorkspacePreferences(root),modes={anyActive:()=>false,current:()=>null};
 const nativeStore={store:{app:{data_encryption:true},paths:{userDataDirsFolder:path.join(root,'cache')}}};
 return {root,controller,transfer:new ConfigTransfer({root,controller,vault,nativeStore,htmlPreferences,workspacePreferences,modes}),accounts:new AccountSettings({root,controller,modes,htmlPreferences,workspacePreferences})};
}
function save(c,uid,settings){const p=c.base(uid);return c.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,searchMethods:p.searchMethods,...settings}});}
function document(){return {render:{browser:{root:{uid:'root',type:'root',name:'根目录',children:{A:{uid:'A',type:'browser',name:'合成账号',playwrightScripts:[],tags:[]}}}},setting:{},scripts:[]}};}
test('two enhancement switches are independent, persistent and reject nonboolean values',t=>{
 const {root,controller:c}=fixture(t);assert(c.getSettings({uid:'A'}).starEnhancementsEnabled);assert(c.getSettings({uid:'A'}).ocsEnhancementsEnabled);
 save(c,'A',{starEnhancementsEnabled:false});assert(c.getSettings({uid:'A'}).ocsEnhancementsEnabled);assert(c.getSettings({uid:'B'}).starEnhancementsEnabled);
 save(c,'A',{ocsEnhancementsEnabled:false});save(c,'A',{enrollmentYear:2025});
 const reloaded=new IntegrationController({labRoot:root,vault});assert.equal(reloaded.getSettings({uid:'A'}).starEnhancementsEnabled,false);assert.equal(reloaded.getSettings({uid:'A'}).ocsEnhancementsEnabled,false);
 for(const name of ['starEnhancementsEnabled','ocsEnhancementsEnabled'])for(const value of ['false',null,0,{}])assert.throws(()=>save(c,'A',{[name]:value}),/开关/);
 delete c.base('legacy').ocsEnhancementsEnabled;c.defaultOcsEnhancementsEnabled=()=>false;assert.equal(c.getSettings({uid:'legacy'}).ocsEnhancementsEnabled,false);assert.equal(c.getSettings({uid:'new'}).ocsEnhancementsEnabled,true);
 const snapshot=model.normalizeSettings('A',c.getSettings({uid:'A'}));assert.equal(snapshot.starEnhancementsEnabled,false);assert.equal(snapshot.ocsEnhancementsEnabled,false);
 const request=model.buildSaveRequest('A',snapshot,{aiType:'openai',aiBaseUrl:'',aiModel:'',starEnhancementsEnabled:true,ocsEnhancementsEnabled:false});assert.equal(request.settings.starEnhancementsEnabled,true);assert.equal(request.settings.ocsEnhancementsEnabled,false);
});
test('native and enhanced settings export, import and clone independently without copying sessions',t=>{
 const source=fixture(t),target=fixture(t),uid='A';save(source.controller,uid,{starEnhancementsEnabled:false,ocsEnhancementsEnabled:false,enrollmentYear:2025});
 const file=path.join(source.root,'instances',uid,'data-native/storage/state.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({'config.ai_api_key':'synthetic-native-key','config.auto_submit':false,'login.cookie':'synthetic-private-cookie','config.token':'synthetic-http-token'}));
 Native.write(source.root,uid,{'xxtsk.runParams':JSON.stringify({...Native.DEFAULT_RUN,beisu:2,vgqtlv:65}),'xxtsk.theme':'dark'});
 const exportValue=source.transfer.snapshot(document());assert(!JSON.stringify(exportValue).includes('synthetic-private-cookie'));assert(!JSON.stringify(exportValue).includes('synthetic-http-token'));
 const plan=target.transfer.parse(JSON.stringify(exportValue));target.transfer.apply(plan);assert.equal(target.controller.getSettings({uid}).starEnhancementsEnabled,false);assert.equal(target.controller.getSettings({uid}).ocsEnhancementsEnabled,false);
 assert.deepEqual(Native.snapshot(target.root,uid),exportValue.fusion.nativeStar.A);target.accounts.clone({sourceUid:uid,targetUid:'copy'});assert.deepEqual(Native.snapshot(target.root,'copy'),Native.snapshot(target.root,uid));assert.equal(target.controller.getSettings({uid:'copy'}).starEnhancementsEnabled,false);
 target.accounts.remove({uid:'copy'});assert(!fs.existsSync(path.join(target.root,'instances','copy')));assert(fs.existsSync(Native.location(target.root,uid)));
 const legacy=structuredClone(exportValue);delete legacy.fusion.profiles.A.starEnhancementsEnabled;delete legacy.fusion.profiles.A.ocsEnhancementsEnabled;delete legacy.fusion.nativeStar;legacy.render.setting.fusionOcsPlugins={enhanced:false};const old=target.transfer.parse(JSON.stringify(legacy));assert.equal(old.data.profiles.A.starEnhancementsEnabled,true);assert.equal(old.data.profiles.A.ocsEnhancementsEnabled,false);assert(!old.writes.some(w=>w.file.includes('data-native')));
});
test('native monitor uses upstream routes and original execution preferences',async()=>{
 const r={port:12345,loggedIn:true,enhanced:false},calls=[];
 const controller={runtimes:new Map([['A',r]]),getNativeRunOptions:async()=>({...Native.DEFAULT_RUN,beisu:2,vgqtlv:75}),request:async(runtime,method,url,body)=>{assert.equal(runtime,r);assert(!url.includes('/integration/'));calls.push({method,url,body});if(url==='/api/queue')return {items:[]};if(url==='/api/run')return {running:false};return {};}};
 const monitor=new StarMonitor(controller),snapshot=await monitor.snapshot({uid:'A'});assert.equal(snapshot.enhanced,false);assert.deepEqual(snapshot.queue,[]);await monitor.action({uid:'A',action:'start'});await monitor.action({uid:'A',action:'pause'});await monitor.action({uid:'A',action:'stop'});assert.deepEqual(calls.find(c=>c.url==='/api/run/start').body,{beisu:2,vgqtlv:75,auto_submit:true,ignore_progress:false});
});
test('native panel restore rejects invalid execution settings and excludes other storage',t=>{
 const {root}=fixture(t);assert.deepEqual(Native.runOptions(),Native.DEFAULT_RUN);assert.throws(()=>Native.runOptions('{"beisu":0}'),/执行设置/);assert.throws(()=>Native.runOptions('{"auto_submit":"false"}'),/执行设置/);
 Native.write(root,'A',{'xxtsk.theme':'dark',token:'not-exported'});assert.deepEqual(Native.read(root,'A'),{'xxtsk.theme':'dark'});assert.deepEqual(Native.read(root,'B'),{});assert.throws(()=>Native.location(root,'../escape'));
});
