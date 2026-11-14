'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const local=require('../src/ocs-app/lib/src/local-userscripts.js');
test('manager verification reads only matching script code and detects stale content regardless of receipt',async()=>{
 const vm=require('node:vm'),calls=[];
 let content='// old same-version script';
 const storage={getKeys:async()=>['script:ocs','script:custom','value:private'],get:async keys=>{
  calls.push(keys);
  if(Array.isArray(keys)){assert.deepEqual(Array.from(keys),['script:ocs','script:custom']);return {'script:ocs':{uuid:'ocs',name:'OCS 网课助手',namespace:'https://enncy.cn',status:1},'script:custom':{uuid:'custom',name:'Custom',namespace:'private'}};}
  assert.equal(keys,'scriptCode:ocs');return {[keys]:{code:content}};
 }};
 const worker={url:()=> 'chrome-extension://fixture/service_worker.js',evaluate:fn=>vm.runInNewContext('('+fn.toString()+')()',{chrome:{storage:{local:storage}},crypto:crypto.webcrypto,TextEncoder,Uint8Array})};
 const browser={serviceWorkers:()=>[worker],pages:()=>[]};
 const first=await local.installedBundledDigest(browser,'fixture');assert.equal(first.sha256,crypto.createHash('sha256').update(content).digest('hex'));
 content='// new same-version script';const second=await local.installedBundledDigest(browser,'fixture');assert.notEqual(first.sha256,second.sha256);
 assert.equal(await local.installedBundledDigest(browser,'not-fixture'),null);
 assert(calls.every(k=>Array.isArray(k)||k==='scriptCode:ocs'),'unrelated values and credentials are never queried');
});
test('a verified same-version bundled content change forces exactly one successful installation',t=>{
 const root=fs.mkdtempSync(path.join(__dirname,'.bundled-revision-'));t.after(()=>{assert(path.resolve(root).startsWith(path.resolve(__dirname)+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 const file=path.join(root,'assets/defaults/ocs.user.js'),manifest=path.join(root,'assets/defaults/ocs-script.json');fs.mkdirSync(path.dirname(file),{recursive:true});
 const write=body=>{fs.writeFileSync(file,body);fs.writeFileSync(manifest,JSON.stringify({sha256:crypto.createHash('sha256').update(body).digest('hex')}));};
 const args={root,userDataDir:path.join(root,'browser'),userscripts:[file],serverPort:18539,authToken:'fixture-only-key'};
 write('// @version 5.4.0\nfirst');const first=local.bundledUpdate(args);assert.equal(first.force,true);
 assert.equal(local.bundledUpdate(args).force,true,'failed or cancelled installation must not mark success');
 local.confirmBundledUpdate(first);assert.equal(local.bundledUpdate(args).force,false);
 write('// @version 5.4.0\nsecond');const revised=local.bundledUpdate(args);assert.equal(revised.force,true);local.confirmBundledUpdate(revised);assert.equal(local.bundledUpdate(args).force,false);
 assert.equal(local.bundledUpdate({...args,userscripts:['https://example.test/custom.user.js']}),null);
 assert.equal(local.bundledUpdate({...args,userscripts:[]}),null);
 fs.appendFileSync(file,'mismatch');assert.throws(()=>local.bundledUpdate(args),/发布清单/);
});
