'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {OcsPluginManager,accountEnhancement}=require('../src/fusion/ocs-plugin-manager.cjs'),Adapter=require('../src/fusion/ocs-enhancement.cjs'),Shared=require('../src/fusion/browser-answer-settings.cjs'),LocalScripts=require('../src/ocs-app/lib/src/local-userscripts.js');
const source=path.resolve(__dirname,'..'),original=fs.readFileSync(path.join(source,'assets/defaults/ocs.upstream.user.js'));
const candidate=(version,conflict=false)=>Buffer.from(original.toString().replace(/^\/\/\s*@version\s+5\.4\.0\s*$/m,'// @version '+version).replace(conflict?'headers: Object.keys(headers).length ? headers : void 0,':'__nonexistent__',conflict?'headers: headers,':'__nonexistent__'));
function fixture(t,fetchBytes){
 const root=fs.mkdtempSync(path.join(__dirname,'.ocs-plugins-'));t.after(()=>{assert(path.resolve(root).startsWith(__dirname+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 fs.mkdirSync(path.join(root,'assets/defaults'),{recursive:true});for(const file of ['ocs.upstream.user.js','ocs-script.json','ocs-adapter.json'])fs.copyFileSync(path.join(source,'assets/defaults',file),path.join(root,'assets/defaults',file));
 const render={setting:{},scripts:[{id:1,enable:true,fusionBundled:true,info:{code_url:path.join(root,'assets/defaults/ocs.user.js')}}]};
 const manager=new OcsPluginManager(root,{fetchBytes,now:()=>1890000000000});manager.reconcile(render);return {root,render,manager};
}
test('official bytes stay intact and independently controlled runtime preserves every adaptation',t=>{
 const {root,render,manager}=fixture(t);const originalHash=Adapter.hash(original);assert.equal(originalHash,'3aa9cf73a557647302ba04ac4715969c464cba83d9f85294e1e1421e6bcbf810');
 const selected=manager.forAccount(render,{uid:'enhanced_a',enhanced:true});const enhanced=fs.readFileSync(selected.runtime.file,'utf8');assert(enhanced.includes('fusionExplicitMiss'));assert(enhanced.includes('fusionOptions'));assert(enhanced.includes('fusion-managed-note'));assert(enhanced.includes('withHeaders'));assert(enhanced.includes('fusion.chapterDefaultApplied'));
 const plain=manager.forAccount(render,{uid:'official_b',enhanced:false}),rawRuntime=fs.readFileSync(plain.runtime.file,'utf8');assert(!rawRuntime.includes('const managedAnswers='));assert(!rawRuntime.includes('fusion-managed-note'));assert.equal(plain.runtime.enhanced,false);assert.notEqual(plain.runtime.file,selected.runtime.file);
 assert.equal(render.scripts.length,1);assert.equal(Adapter.hash(fs.readFileSync(path.join(root,'assets/defaults/ocs.upstream.user.js'))),originalHash);assert.equal(selected.scripts[0].fusionRuntime.enhanced,true);assert.equal(render.scripts[0].fusionRuntime.enhanced,false);
});
test('compatible official update is accepted and an incompatible latest is kept without replacing compatible runtime',async t=>{
 let bytes=candidate('5.4.1');assert.equal(Adapter.metadata(bytes).version,'5.4.1');const {root,render,manager}=fixture(t,async()=>bytes);
 await manager.check(render);assert.equal(manager.status(render).compatible.version,'5.4.1');assert.equal(manager.status(render).previous.version,'5.4.0');
 bytes=candidate('5.5.0',true);await manager.check(render);const state=manager.status(render);assert.equal(state.latest.version,'5.5.0');assert.equal(state.compatible.version,'5.4.1');assert.equal(state.locked,true);assert.equal(state.runtime.version,'5.4.1');assert(fs.existsSync(path.join(root,'bridge-data/ocs-scripts',state.latest.sha256+'.upstream.user.js')));
 const restored=new OcsPluginManager(root,{fetchBytes:()=>{throw Error('Locked updater must not access network');},now:()=>1990000000000});await restored.check(render,{automatic:true});assert.equal(restored.status(render).locked,true);
 manager.change(render,{selected:'latest'});assert.equal(render.setting.fusionOcsPlugins.enhanced,true,'legacy migration value must not be changed by version selection');assert.equal(manager.status(render).runtime.version,'5.5.0');assert.equal(render.scripts.length,1);
 assert.equal(manager.forAccount(render,{uid:'a',enhanced:true}).runtime.version,'5.4.1');assert.equal(manager.forAccount(render,{uid:'b',enhanced:false}).runtime.version,'5.5.0');assert.equal(render.setting.fusionOcsPlugins.selected,'latest');
});
test('network failure does not count as plugin conflict, concurrent checks share one download',async t=>{
 let calls=0;const {render,manager}=fixture(t,async()=>{calls++;throw Error('fixture offline');});await Promise.all([manager.check(render),manager.check(render)]);assert.equal(calls,1);assert.equal(manager.status(render).locked,false);assert.equal(manager.status(render).runtime.version,'5.4.0');assert.equal(manager.status(render).history[0].kind,'network');
});
test('runtime contract failure rolls back only the affected version and survives restart',async t=>{
 const {root,render,manager}=fixture(t,async()=>candidate('5.4.1'));await manager.check(render);const id=manager.status(render).compatible.sha256;
 manager.reportConflict(render,{upstreamSha256:'0'.repeat(64)});assert.equal(manager.status(render).locked,false);
 manager.reportConflict(render,{upstreamSha256:id,reason:'fixture missing API'});assert.equal(manager.status(render).runtime.version,'5.4.0');assert.equal(manager.status(render).locked,true);
 const next=new OcsPluginManager(root);next.reconcile(render);assert.equal(next.status(render).runtime.version,'5.4.0');assert.equal(next.status(render).latest.version,'5.4.1');
});
test('disabled automatic checks and removed or custom scripts are respected',async t=>{
 const {render,manager}=fixture(t,()=>{throw Error('No automatic fetch expected');});manager.change(render,{autoUpdate:false});await manager.check(render,{automatic:true});assert.equal(manager.status(render).lastCheck,0);
 const custom={id:2,url:'custom.user.js',enable:false};render.scripts=[custom];manager.reconcile(render);assert.deepEqual(render.scripts,[custom]);assert.equal(manager.status(render).installed,false);
});

test('automatic-install off pauses updates, and selecting a plugin reenables only one OCS runtime',async t=>{
 const {render,manager}=fixture(t,()=>{throw Error('Disabled installer must not fetch');});
 manager.change(render,{autoInstall:false});await manager.check(render,{automatic:true});assert.equal(manager.status(render).lastCheck,0);
 render.scripts.push({...render.scripts[0],id:2,enable:true},{id:3,enable:true,info:{name:'OCS 网课助手',code_url:'custom.user.js'}});
 manager.change(render,{selected:'compatible'});assert.equal(render.scripts.filter(s=>s.fusionOcsManaged).length,1);assert.equal(render.scripts.filter(s=>s.enable!==false).length,1);assert.equal(manager.status(render).autoInstall,true);
 const exported=JSON.parse(JSON.stringify(render));assert.throws(()=>manager.change(exported,{enhanced:false}),/账号设置/);manager.forAccount(exported,{uid:'a',enhanced:false});assert.equal(exported.setting.fusionOcsPlugins.enhanced,true);assert.equal(exported.scripts.filter(s=>s.enable!==false).length,1);
});
test('disabling enhancement restores original per-browser settings; reenabling takes a new snapshot',()=>{
 const values=new Map([['common.settings.upload',60],['common.settings.answererWrappers',[{name:'own bank'}]],['common.settings.work-when-no-job',false],['cx.new.study.enableChapterTest',true]]);
 const context={GM_getValue:(k,d)=>values.has(k)?values.get(k):d,GM_setValue:(k,v)=>values.set(k,v),GM_deleteValue:k=>values.delete(k),GM_listValues:()=>[...values.keys()],console};vm.createContext(context);
 const run=enabled=>vm.runInContext(Adapter.settingsLifecycle(enabled),context);
 run(true);values.set('common.settings.upload',80);values.set('common.settings.answererWrappers',[{fusionManaged:true}]);values.set('common.settings.work-when-no-job',true);values.set('cx.new.study.enableChapterTest',false);values.set('fusion.chapterDefaultApplied',true);values.set('fusion.managedAnswers',true);run(true);run(false);
 assert.equal(values.get('common.settings.upload'),60);assert.deepEqual(values.get('common.settings.answererWrappers'),[{name:'own bank'}]);assert.equal(values.get('common.settings.work-when-no-job'),false);assert.equal(values.get('cx.new.study.enableChapterTest'),true);assert(!values.has('fusion.managedAnswers'));assert(!values.has('fusion.chapterDefaultApplied'));assert(!values.has('fusion.enhancement.originalSettings.v1'));
 values.set('common.settings.upload',70);run(true);values.set('common.settings.upload',90);run(false);assert.equal(values.get('common.settings.upload'),70);
});
test('AI-only counts as a usable source; incomplete and disabled providers do not',()=>{
 const profile={ai:{type:'openai',baseUrl:'https://example.test/v1',model:'test-model'},secrets:{aiKey:'fixture-present'}};const methods=[{id:'xingchan-ai',enabled:true}];
 Shared.install({plainSecret:(uid,key)=>key==='aiKey'?profile.secrets.aiKey||'':'',data:{profiles:{a:profile}},bankConfig:()=>({banks:[]}),getSettings:()=>({searchMethods:methods})});const secret='fixture',query={uid:'a',configKey:Shared.capability(secret,'a')};
 assert.equal(Shared.read(query,secret,{}).store['fusion.hasUsableAnswerSource'],true);
 delete profile.secrets.aiKey;assert.equal(Shared.read(query,secret,{}).store['fusion.hasUsableAnswerSource'],false);
 profile.ai.type='ollama';assert.equal(Shared.read(query,secret,{}).store['fusion.hasUsableAnswerSource'],true);
 methods[0].enabled=false;assert.equal(Shared.read(query,secret,{}).store['common.settings.answererWrappers'].length,0);
 assert.deepEqual(Shared.read({...query,ocsMode:'official'},secret,{}),{enabled:false,store:{}});
});
test('account overrides preserve legacy migration defaults without changing another account',t=>{
 const {render,manager}=fixture(t);render.setting.fusionOcsPlugins.enhanced=false;
 assert.equal(accountEnhancement({},render.setting.fusionOcsPlugins),false);assert.equal(accountEnhancement({ocsEnhancementsEnabled:true},render.setting.fusionOcsPlugins),true);assert.equal(accountEnhancement({ocsEnhancementsEnabled:false},{enhanced:true}),false);
 const before=JSON.stringify(render),a=manager.forAccount(render,{uid:'account_a',profile:{ocsEnhancementsEnabled:true}}),b=manager.forAccount(render,{uid:'account_b',profile:{}});
 assert.equal(a.enhanced,true);assert.equal(b.enhanced,false);assert.notEqual(a.runtime.hash,b.runtime.hash);assert.equal(JSON.stringify(render),before);
 assert.throws(()=>manager.forAccount(render,{uid:'../other',enhanced:true}),/账号标识/);assert.throws(()=>manager.forAccount(render,{uid:'a',enhanced:'false'}),/开关格式/);
});
test('worker validates per-account runtime identity and keeps independent update receipts',t=>{
 const {root,render,manager}=fixture(t),a=manager.forAccount(render,{uid:'a',enhanced:true}),b=manager.forAccount(render,{uid:'b',enhanced:false});
 const args=selection=>({root,userDataDir:path.join(root,'profiles',selection.uid),userscripts:selection.scripts.filter(s=>s.enable).map(s=>s.info.code_url),serverPort:18539,authToken:'fixture-token',uid:selection.uid,accountRuntime:selection});
 const updateA=LocalScripts.bundledUpdate(args(a)),updateB=LocalScripts.bundledUpdate(args(b));assert.equal(updateA.enhanced,true);assert.equal(updateB.enhanced,false);assert.notEqual(updateA.receipt,updateB.receipt);assert.equal(updateA.force,true);assert.equal(updateB.force,true);
 LocalScripts.confirmBundledUpdate(updateA);assert.equal(LocalScripts.bundledUpdate(args(a)).force,false);assert.equal(LocalScripts.bundledUpdate(args(b)).force,true);
 assert.throws(()=>LocalScripts.bundledUpdate({...args(a),uid:'b'}),/账号运行配置/);assert.throws(()=>LocalScripts.bundledUpdate({...args(a),accountRuntime:{...a,enhanced:false}}),/身份校验/);assert.throws(()=>LocalScripts.bundledUpdate({...args(a),accountRuntime:{...a,runtime:b.runtime}}),/脚本选择/);
 manager.change(render,{autoInstall:false});const disabled=manager.forAccount(render,{uid:'a',enhanced:true});assert.equal(disabled.runtime,null);assert.equal(LocalScripts.bundledUpdate(args(disabled)),null);
});
test('runtime conflict leaves official account version selection unchanged',async t=>{
 const {render,manager}=fixture(t,async()=>candidate('5.4.1'));await manager.check(render);manager.change(render,{selected:'latest'});
 const first=manager.forAccount(render,{uid:'enhanced',enhanced:true});manager.reportConflict(render,{upstreamSha256:first.runtime.upstreamSha256,reason:'fixture'});
 assert.equal(manager.forAccount(render,{uid:'enhanced',enhanced:true}).runtime.version,'5.4.0');assert.equal(manager.forAccount(render,{uid:'official',enhanced:false}).runtime.version,'5.4.1');assert.equal(render.setting.fusionOcsPlugins.selected,'latest');assert.equal(manager.status(render).locked,true);
});
test('disabled account cannot receive managed answers even from an older enhanced page',async()=>{
 const profile={};Shared.install({data:{profiles:{a:profile}},ocsEnhancementsEnabled:()=>false,bankConfig:()=>{throw Error('Disabled mode must not read providers');}});const secret='fixture',query={uid:'a',configKey:Shared.capability(secret,'a')};
 assert.deepEqual(Shared.read(query,secret,{'common.settings.upload':80}),{enabled:false,store:{}});await assert.rejects(()=>Shared.answer(query,secret,{question:{title:'fixture'}}),/已关闭 OCS 增强/);
});
