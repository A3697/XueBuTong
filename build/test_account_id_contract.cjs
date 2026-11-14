'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events');
const {IntegrationController,uidOf}=require('../src/fusion/controller.cjs');
const {ConfigTransfer}=require('../src/fusion/config-transfer.cjs');
const {AccountSettings}=require('../src/fusion/account-settings.cjs');
const {HtmlPreferences}=require('../src/fusion/ui-preferences.cjs');
const {WorkspacePreferences}=require('../src/fusion/workspace-preferences.cjs');
const WindowSizes=require('../src/fusion/window-sizes.cjs');
const valid=['qa_lifecycle_b','QA_lifecycle-b','a','_','-','A'.repeat(80),'a'.repeat(32)];
const invalid=['','a'.repeat(81),'../account','..\\account','a/b','a\\b','a:b','a.json','中文','a\n','__proto__','constructor','prototype'];
const vault={encryptString:value=>Buffer.from(value),decryptString:value=>Buffer.from(value),isEncryptionAvailable:()=>true};

function fixture(t){
 const parent=path.resolve(process.env.XBT_TEST_TMP||os.tmpdir());
 fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'xbt-account-id-'));
 t.after(()=>{assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(parent));assert(path.basename(root).startsWith('xbt-account-id-'));fs.rmSync(root,{recursive:true,force:true});});
 const controller=new IntegrationController({labRoot:root,vault}),htmlPreferences=new HtmlPreferences(root),workspacePreferences=new WorkspacePreferences(root),modes={anyActive:()=>false,current:()=>null};
 const nativeStore={store:{app:{data_encryption:true},paths:{userDataDirsFolder:path.join(root,'cache')}}};
 const transfer=new ConfigTransfer({root,controller,vault,nativeStore,htmlPreferences,workspacePreferences,modes});
 const accounts=new AccountSettings({root,controller,modes,htmlPreferences,workspacePreferences});
 return {root,controller,htmlPreferences,workspacePreferences,transfer,accounts};
}
function document(uid){return {render:{browser:{root:{uid:'root',type:'root',name:'根目录',children:{[uid]:{uid,type:'browser',name:'合成账号',playwrightScripts:[],tags:[]}}}},setting:{},scripts:[]}};}

test('window-size keys share the desktop account ID contract and retain path boundaries',t=>{
 const f=fixture(t),size={width:1200,height:800};
 WindowSizes.write(f.root,'main',size);
 for(const uid of valid){
  assert.equal(uidOf(uid),uid);
  for(const kind of ['browser','panel']){
   const key=kind+'-'+uid,file=WindowSizes.location(f.root,key);
   assert.equal(path.dirname(file),path.join(f.root,'bridge-data/window-sizes'));
   WindowSizes.write(f.root,key,size);assert.deepEqual(WindowSizes.read(f.root,key),size);
   assert.deepEqual(WindowSizes.normalize({[key]:size}),{[key]:size});
  }
 }
 assert.equal(Object.keys(WindowSizes.snapshot(f.root)).length,1+2*valid.length);
 for(const uid of invalid){
  assert.throws(()=>uidOf(uid));
  for(const kind of ['browser','panel']){
   const key=kind+'-'+uid;assert.throws(()=>WindowSizes.location(f.root,key),/窗口标识无效/);
   assert.deepEqual(WindowSizes.normalize({[key]:size}),{});
  }
 }
 for(const key of [null,42,{},'other-qa_lifecycle_b','browser-qa_lifecycle_b.json'])assert.throws(()=>WindowSizes.location(f.root,key),/窗口标识无效/);
});

test('non-hex imported accounts preserve layout through export, import, clone and removal',t=>{
 const source=fixture(t),target=fixture(t),uid='qa_lifecycle_b',copy='QA_lifecycle-copy';
 const profile=source.controller.base(uid);profile.enrollmentYear=2025;source.controller.persist();
 const sizes={['browser-'+uid]:{width:1200,height:800},['panel-'+uid]:{width:1100,height:760,content:true}};
 for(const [key,value]of Object.entries(sizes))WindowSizes.write(source.root,key,value);
 source.workspacePreferences.set({cardOrder:[uid],speeds:{[uid]:2},launchPlans:{[uid]:{autoMode:'off'}}});
 const exported=source.transfer.snapshot(document(uid));assert.deepEqual(exported.fusion.windowSizes,sizes);
 const plan=target.transfer.parse(JSON.stringify(exported));target.transfer.apply(plan);
 assert.equal(target.controller.data.profiles[uid].enrollmentYear,2025);
 assert.deepEqual(WindowSizes.snapshot(target.root),sizes);
 assert.deepEqual(target.accounts.clone({sourceUid:uid,targetUid:copy}),{copied:true});
 for(const kind of ['browser','panel'])assert.deepEqual(WindowSizes.read(target.root,kind+'-'+copy),sizes[kind+'-'+uid]);
 assert.equal(target.controller.data.profiles[copy].enrollmentYear,2025);
 const before=structuredClone(target.controller.data.profiles[uid]);
 assert.deepEqual(target.accounts.remove({uid:copy}),{removed:true});
 assert.deepEqual(target.controller.data.profiles[uid],before);
 for(const kind of ['browser','panel'])assert(!fs.existsSync(WindowSizes.location(target.root,kind+'-'+copy)));
 assert.deepEqual(target.accounts.remove({uid}),{removed:true});
 assert.equal(target.controller.data.profiles[uid],undefined);
 assert.deepEqual(WindowSizes.snapshot(target.root),{});
 assert.deepEqual(target.workspacePreferences.get().cardOrder,[]);
 assert.deepEqual(target.workspacePreferences.get().speeds,{});
});

test('browser window size restore accepts an imported non-hex account',async t=>{
 const f=fixture(t),uid='qa_lifecycle_b';
 f.workspacePreferences.set({rememberWindowSizes:true});WindowSizes.write(f.root,'browser-'+uid,{width:1200,height:800});
 const calls=[],session={async send(method,params){calls.push([method,params]);if(method==='Target.getTargets')return {targetInfos:[{type:'page',targetId:'fixture'}]};if(method==='Browser.getWindowForTarget')return {windowId:1,bounds:{windowState:'normal',width:1200,height:800}};return {};},async detach(){calls.push(['detach']);}};
 const context=new EventEmitter();context.browser=()=>({newBrowserCDPSession:async()=>session});context.pages=()=>[{evaluate:async()=>({width:1920,height:1080})}];
 const handle=await WindowSizes.attachBrowser(context,{root:f.root,uid});await handle.dispose();
 assert(calls.some(([method,params])=>method==='Browser.setWindowBounds'&&params.bounds.width===1200));
 assert(calls.some(([method])=>method==='detach'));
});

test('invalid account removal fails before any state mutation',t=>{
 const f=fixture(t);f.controller.base('kept-account');f.controller.persist();const before=fs.readFileSync(f.controller.settingsFile);
 for(const uid of invalid)assert.throws(()=>f.accounts.remove({uid}),/账号标识不合法/);
 assert.deepEqual(fs.readFileSync(f.controller.settingsFile),before);assert(!fs.existsSync(path.join(f.root,'private')));
});
