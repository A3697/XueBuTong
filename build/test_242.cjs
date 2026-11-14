'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {ConfigTransfer}=require('../src/fusion/config-transfer.cjs'),Answers=require('../src/fusion/answer-settings.js'),Merge=require('../src/fusion/config-merge.cjs');
const account=uid=>({uid,type:'browser',parent:'root',name:uid,notes:'',tags:[],playwrightScripts:[]});
const document=()=>({render:{browser:{root:{uid:'root',type:'root',children:Object.fromEntries(['saved','inherited','unopened'].map(uid=>[uid,account(uid)]))}},scripts:[],setting:{ocs:{store:Answers.ocsStore({upload:'save',thread:2,period:8},[])}}}});
const profile=answerSettings=>({username:'',schoolId:'',ai:{baseUrl:'',model:'',type:'openai'},...(answerSettings?{answerSettings}:{}),secrets:{}});
function transfer(profiles){return new ConfigTransfer({root:path.resolve('export-fixture'),controller:{data:{profiles},plainSecret:()=>''},vault:{encryptString:value=>Buffer.from(value)},nativeStore:{store:{paths:{userDataDirsFolder:path.resolve('export-fixture/cache')}}},workspacePreferences:{get:()=>({})},htmlPreferences:{get:()=>({})}});}
test('export includes every automatic-answer field for each account without mutating live profiles',()=>{
 const values=Answers.normalize({upload:100,'work-when-no-job':true,'randomWork-choice':true,'randomWork-complete':true,'randomWork-completeTexts-textarea':'示例一\n示例二',thread:3,imageOptimize:false,answerWrapperHandlerTimeout:70,stopSecondWhenFinish:6,period:9,answerSeparators:'|,;',redundanceWordsText:'测试词'});
 const profiles={saved:profile(values),inherited:profile()},before=structuredClone(profiles),out=transfer(profiles).snapshot(document());
 assert.deepEqual(out.fusion.profiles.saved.answerSettings,values);
 for(const uid of ['inherited','unopened'])assert.deepEqual(out.fusion.profiles[uid].answerSettings,Answers.normalize({upload:'save',thread:2,period:8}));
 assert.deepEqual(profiles,before);assert.equal(Object.keys(out.fusion.profiles.unopened.answerSettings).length,Object.keys(Answers.defaults).length);
});
test('exported answer settings retain false, zero and multiline text on import',()=>{
 const t=transfer({saved:profile(Answers.normalize({upload:0,imageOptimize:false,'randomWork-completeTexts-textarea':'A\nB',answerSeparators:';,|'}))}),exported=t.snapshot(document()),plan=t.parse(JSON.stringify(exported));
 for(const uid of ['saved','inherited','unopened'])assert.deepEqual(plan.data.profiles[uid].answerSettings,exported.fusion.profiles[uid].answerSettings);
 assert.equal(plan.data.profiles.saved.answerSettings.upload,0);assert.equal(plan.data.profiles.saved.answerSettings.imageOptimize,false);
});
test('imported accounts keep exported inherited values when local global settings are retained',()=>{
 const t=transfer({}),exported=t.snapshot(document()),local=document();local.render.browser.root.children={};local.render.setting.ocs.store=Answers.ocsStore({upload:20,thread:1,period:3},[]);
 const current=t.snapshot(local),merge=Merge.prepare(current,exported),decisions=Object.fromEntries(merge.conflicts.map(c=>[c.id,'skip'])),plan=t.parse(JSON.stringify(merge.finish(decisions)));
 assert.equal(plan.render.setting.ocs.store['common.settings.upload'],20);assert.equal(plan.data.profiles.unopened.answerSettings.upload,'save');assert.equal(plan.data.profiles.unopened.answerSettings.period,8);
});
test('invalid saved answer settings prevent a misleading partial export',()=>{
 assert.throws(()=>transfer({saved:profile({thread:4})}).snapshot(document()),/超出允许范围/);
});
