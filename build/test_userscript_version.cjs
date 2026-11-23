'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../assets/defaults/ocs.user.js'),'utf8');
const manifest=require('../assets/defaults/ocs-script.json');
const {metadata}=require('../src/fusion/default-components.cjs');
const Bundled=require('../src/fusion/bundled-script.cjs');

// Run the shipped update module and its own bundled SemVer implementation.
// This covers the real error-message path missed by installation-only tests.
function updateModule(version){
 const errors=[],timers=[],notices=[];
 const context={console,Date,setTimeout:run=>timers.push(run),lib:{
  Script:class{constructor(options){Object.assign(this,options);this.cfg=Object.fromEntries(Object.entries(options.configs).map(([key,item])=>[key,structuredClone(item.defaultValue)]));this.methods={getLastVersion:async()=>({'last-version':'5.4.2'})};}},
  $:{isInTopWindow:()=>true},$gm:{getInfos:()=>({script:{version}})},$message:{error:value=>errors.push(value)},$modal:{confirm:()=>notices.push('new-version')},$ui:{notes:value=>value},h:()=>({})
 }};
 const begin=source.indexOf('  const debug$1 ='),end=source.indexOf('  const RenderScript =',begin);
 const updateStart=source.indexOf('      update: new lib.Script({'),updateEnd=source.indexOf('      dev: new lib.Script({',updateStart);
 assert(begin>0&&end>begin&&updateStart>0&&updateEnd>updateStart,'Actual semver and update modules must remain testable');
 const expression=source.slice(updateStart+'      update: '.length,updateEnd).trim().replace(/,$/,'');
 vm.createContext(context);vm.runInContext(source.slice(begin,end)+'\nthis.module='+expression+';this.validVersion=valid_1;',context);
 return {context,errors,timers,notices};
}

test('reproduces the reported four-component version failure in the real update hook',()=>{
 const run=updateModule('5.2.3.1');run.context.module.oncomplete();
 assert.equal(run.context.validVersion('5.2.3.1'),null);assert.equal(run.errors.length,1);assert.match(run.errors[0],/semver/);assert.equal(run.timers.length,0);
});
test('official 5.4.2 passes the same hook without disabling update notifications',async()=>{
 const actual=metadata(source),run=updateModule(actual.version);run.context.module.oncomplete();
 assert.equal(actual.version,'5.4.2');assert.equal(manifest.metadata.version,actual.version);assert.equal(run.context.module.cfg.autoNotify,true);
 assert.equal(run.context.validVersion(actual.version),actual.version);assert.deepEqual(run.errors,[]);assert.equal(run.timers.length,1);
 await run.timers[0]();assert.deepEqual(run.notices,[]);
 assert.equal(crypto.createHash('sha256').update(Buffer.from(source)).digest('hex'),manifest.sha256);
});
test('release metadata rejects invalid versions and header/manifest disagreement before installation',t=>{
 for(const bad of ['5.2.3.1','05.4.0','5.4','not-a-version'])assert.throws(()=>metadata(source.replace(/^\/\/ @version[^\r\n]+/m,'// @version '+bad)),/官方 OCS/);
 const directory=fs.mkdtempSync(path.join(__dirname,'.version-contract-'));t.after(()=>{assert(path.resolve(directory).startsWith(path.resolve(__dirname)+path.sep));fs.rmSync(directory,{recursive:true,force:true});});
 fs.mkdirSync(path.join(directory,'assets/defaults'),{recursive:true});fs.writeFileSync(path.join(directory,'assets/defaults/ocs.user.js'),source);
 fs.writeFileSync(path.join(directory,'assets/defaults/ocs-script.json'),JSON.stringify({...manifest,metadata:{...manifest.metadata,version:'5.4.1'}}));
 assert.throws(()=>Bundled.bundledScript(directory),/版本与清单不一致/);
});
test('previous invalid bundled bytes upgrade while preserving disabled state and script data identity',{skip:!process.env.XBT_PREVIOUS_SCRIPT},t=>{
 const previous=process.env.XBT_PREVIOUS_SCRIPT;
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(previous)).digest('hex'),'69421d8a5396e9801bbfcddeb8be9ebc05a57557d9f5c92c093f643baf09afa4');
 const render={scripts:[{id:271,enable:false,isLocalScript:true,info:{id:271,name:'OCS 网课助手',version:'5.2.3.1',code_url:previous}}]};
 assert.equal(Bundled.seedBundledScript(render,{fusionBundledScriptSeeded:true},path.resolve(__dirname,'..')),true);
 assert.equal(render.scripts.length,1);assert.equal(render.scripts[0].id,271);assert.equal(render.scripts[0].enable,false);assert.equal(render.scripts[0].info.version,'5.4.2');
});
