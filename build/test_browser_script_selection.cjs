'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Selection=require('../src/fusion/browser-script-selection.cjs'),{IntegrationController}=require('../src/fusion/controller.cjs'),{ConfigTransfer}=require('../src/fusion/config-transfer.cjs'),{AccountSettings}=require('../src/fusion/account-settings.cjs'),{HtmlPreferences}=require('../src/fusion/ui-preferences.cjs'),{WorkspacePreferences}=require('../src/fusion/workspace-preferences.cjs'),Runtime=require('../src/ocs-app/lib/src/extension-runtime');
const scripts=[{info:{name:'OCS 网课助手'},fusionOcsManaged:true}],extensions=[{id:'scriptcat'},{id:'daxuesoutijiang'}],vault={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString('utf8')};
function fixture(t){const parent=path.resolve(process.env.XBT_TEST_TMP||os.tmpdir());fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'script-choice-'));t.after(()=>{assert.equal(path.dirname(root),parent);fs.rmSync(root,{recursive:true,force:true});});const controller=new IntegrationController({labRoot:root,vault}),modes={current:()=>null,anyActive:()=>false},htmlPreferences=new HtmlPreferences(root),workspacePreferences=new WorkspacePreferences(root),options={root,controller,vault,modes,htmlPreferences,workspacePreferences,nativeStore:{store:{paths:{userDataDirsFolder:path.join(root,'cache')}}}};return{root,controller,transfer:new ConfigTransfer(options),accounts:new AccountSettings(options)};}
test('existing accounts choose OCS; incomplete installation cannot select an unavailable engine',()=>{
 assert.equal(Selection.state({scripts,extensions}).selected,'ocs');assert(Selection.state({scripts,extensions}).canChoose);
 const onlySouti=Selection.state({selected:'ocs',scripts,extensions:[extensions[1]]});assert.equal(onlySouti.selected,'soutijiang');assert.equal(onlySouti.requested,'ocs');assert(!onlySouti.canChoose);
 const onlyOcs=Selection.state({selected:'soutijiang',scripts,extensions:[extensions[0]]});assert.equal(onlyOcs.selected,'ocs');assert(!onlyOcs.canChoose);assert(!Selection.state({scripts:[],extensions}).canChoose);
 assert.throws(()=>Selection.normalize('both'),/无效/);
});
test('script selection persists per account, export/import/clone keep it, question-bank switch is independent',t=>{
 const {controller:c,transfer,accounts}=fixture(t),uid='test-a';const p=c.base(uid);c.saveSettings({uid,expectedRevision:p.revision,settings:{ai:p.ai,searchMethods:p.searchMethods,browserScript:'soutijiang',soutijiangEnabled:false}});
 assert.equal(c.getSettings({uid}).browserScript,'soutijiang');assert.equal(c.getSettings({uid:'test-b'}).browserScript,'ocs');assert.equal(c.getSettings({uid}).soutijiangEnabled,false);
 const source={render:{browser:{root:{uid:'root',type:'root',children:{[uid]:{uid,type:'browser',name:'Fixture',playwrightScripts:[]}}}},setting:{},scripts}};
 const data=transfer.snapshot(source);assert.equal(data.fusion.profiles[uid].browserScript,'soutijiang');assert.equal(transfer.parse(JSON.stringify(data)).data.profiles[uid].browserScript,'soutijiang');
 accounts.clone({sourceUid:uid,targetUid:'copy'});assert.equal(c.getSettings({uid:'copy'}).browserScript,'soutijiang');
 delete data.fusion.profiles[uid].browserScript;assert.equal(transfer.parse(JSON.stringify(data)).data.profiles[uid].browserScript,'ocs');data.fusion.profiles[uid].browserScript='both';assert.throws(()=>transfer.parse(JSON.stringify(data)),/脚本选择/);
});
test('application-center toggles cannot hot-enable the conflicting engine',async()=>{
 let calls=0;const context={newPage:()=>{calls++;throw Error('should not reach browser')}};
 const result=await Runtime.setEnabled(context,{id:'daxuesoutijiang',enabled:true,selectedScript:'ocs'});assert.equal(result.reason,'account_uses_ocs');assert.equal(calls,0);
 const manager=await Runtime.setEnabled(context,{id:'scriptcat',enabled:true,selectedScript:'soutijiang'});assert.equal(manager.applied,false);assert.equal(manager.restartRequired,true);assert.equal(calls,0);
});
