'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const Bundled=require('../src/fusion/bundled-script.cjs');
const root=path.resolve(__dirname,'..');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(t){
 const directory=fs.mkdtempSync(path.join(__dirname,'.script-upgrade-'));
 t.after(()=>{const resolved=path.resolve(directory);assert(resolved.startsWith(path.resolve(__dirname)+path.sep));assert(path.basename(resolved).startsWith('.script-upgrade-'));fs.rmSync(resolved,{recursive:true,force:true});});
 fs.mkdirSync(path.join(directory,'assets/defaults'),{recursive:true});
 for(const file of ['ocs.user.js','ocs-script.json'])fs.copyFileSync(path.join(root,'assets/defaults',file),path.join(directory,'assets/defaults',file));
 const imported=path.join(directory,'imported.user.js');fs.copyFileSync(path.join(root,'assets/defaults/ocs.user.js'),imported);
 return {directory,imported};
}
const local=(id,file,enable=true)=>({id,enable,isLocalScript:true,info:{id,name:'OCS 网课助手',version:'5.2.3',url:Bundled.SOURCE,code_url:file}});
const remote=(id,enable=true)=>({id,enable,isLocalScript:false,info:{id,name:'OCS 网课助手',version:'4.11.19',code_url:Bundled.SOURCE}});

test('seeded imported defaults upgrade and deduplicate the official remote source without editing files',t=>{
 const {directory,imported}=fixture(t),render={scripts:[local(10,imported),remote(20)]},app={fusionBundledScriptSeeded:true};
 const hash=crypto.createHash('sha256').update(fs.readFileSync(imported)).digest('hex');
 assert.equal(Bundled.seedBundledScript(render,app,directory),true);
 assert.equal(render.scripts.length,1);assert.equal(render.scripts[0].id,10);assert.equal(render.scripts[0].info.version,'5.4.0');
 assert.equal(render.scripts[0].info.code_url,path.join(directory,'assets/defaults/ocs.user.js'));assert.equal(render.scripts[0].enable,true);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(imported)).digest('hex'),hash);
 assert.equal(Bundled.seedBundledScript(render,app,directory),false);
});

test('migration retains explicit disablement and selects an already enabled duplicate',t=>{
 const {directory,imported}=fixture(t);
 for(const active of [false,true]){
  const render={scripts:[local(10,imported,false),remote(20,active)]};
  Bundled.seedBundledScript(render,{fusionBundledScriptSeeded:true},directory);
  assert.equal(render.scripts.length,1);assert.equal(render.scripts[0].enable,active);assert.equal(render.scripts[0].id,active?20:10);
 }
});

test('official-looking metadata and a known hash filename do not overwrite custom script bytes',t=>{
 const {directory}=fixture(t),file=path.join(directory,'254802aec93a17ba6b4092eee8074ab9a8fe9a76fa86522a1469f2d729ee94de.user.js');
 fs.writeFileSync(file,'// user-owned customized script');
 const custom={...local(10,file),fusionBundled:true},before=clone(custom),render={scripts:[custom,remote(20)]};
 Bundled.seedBundledScript(render,{fusionBundledScriptSeeded:true},directory);
 assert.deepEqual(render.scripts[0],before);assert.equal(render.scripts.length,2);assert.equal(fs.readFileSync(file,'utf8'),'// user-owned customized script');
});

test('removing the bundled script stays respected while a new installation still seeds once',t=>{
 const {directory}=fixture(t),removed={scripts:[]};
 assert.equal(Bundled.seedBundledScript(removed,{fusionBundledScriptSeeded:true},directory),false);assert.equal(removed.scripts.length,0);
 const fresh={scripts:[]},app={};assert.equal(Bundled.seedBundledScript(fresh,app,directory),true);assert.equal(fresh.scripts.length,1);assert.equal(app.fusionBundledScriptSeeded,true);
});

test('default-component setup retains the patched bundle instead of fetching an overriding OCS copy',async t=>{
 const {directory}=fixture(t),{DefaultComponents}=require('../src/fusion/default-components.cjs');let fetched=false;
 const setup=new DefaultComponents({root:directory,downloadRoot:directory,applications:{},fetchBytes:async()=>{fetched=true;throw Error('Unexpected download');}});setup.installed=()=>true;
 const result=await setup.install();assert.equal(result.complete,true);assert.equal(fetched,false);assert.equal(result.script.info.version,'5.4.0');assert.equal(result.script.info.code_url,path.join(directory,'assets/defaults/ocs.user.js'));
});

test('default-setup renderer preserves custom local OCS scripts and disabled official entries',()=>{
 const text=fs.readFileSync(path.join(root,'src/fusion/first-use-setup.js'),'utf8');
 for(const scripts of [[{...local(10,'C:/custom.user.js'),fusionBundled:true}],[remote(10,false),remote(20,false)]]){
  const initial=clone(scripts),context={window:{FusionWorkspace:{state:{native:{s:{render:{scripts}}}}}}};vm.createContext(context);vm.runInContext(text,context);
  const incoming=local(30,'C:/bundle/ocs.user.js');incoming.fusionBundled=true;context.window.FusionDefaultSetup.applyScript(incoming);
  if(initial.length===1)assert.deepEqual(scripts,initial);
  else{assert.equal(scripts.length,1);assert.equal(scripts[0].enable,false);assert.equal(scripts[0].id,10);}
 }
});

test('private snapshot original bundled bytes and official duplicate both migrate safely',{skip:!process.env.XBT_BROWSER_PRIVATE_RENDER||!process.env.XBT_BROWSER_PRIVATE_SNAPSHOT},t=>{
 const {directory}=fixture(t),snapshot=path.resolve(process.env.XBT_BROWSER_PRIVATE_SNAPSHOT);
 const data=JSON.parse(fs.readFileSync(process.env.XBT_BROWSER_PRIVATE_RENDER,'utf8')),render=clone(data.render||data);
 const scripts=render.scripts.filter(script=>/OCS\s*网课助手/.test(script.info?.name||''));
 for(const script of scripts){
  const old=script.info?.code_url||'';
  if(path.isAbsolute(old)){
   const marker='ocs-profile'+path.sep,index=old.indexOf(marker);assert(index>=0,'Fixture path must identify the snapshot profile');
   const file=path.resolve(snapshot,old.slice(index));assert(file.startsWith(snapshot+path.sep),'Fixture file must stay inside private snapshot');
   script.info.code_url=file;script.url=file;
  }
 }
 const selected={scripts};Bundled.seedBundledScript(selected,{fusionBundledScriptSeeded:true},directory);
 assert.equal(selected.scripts.length,1);assert.equal(selected.scripts[0].info.version,'5.4.0');assert.equal(selected.scripts[0].enable,true);
});
