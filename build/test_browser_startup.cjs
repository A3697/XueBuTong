'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{EventEmitter}=require('events');
const source=path.join(__dirname,'../src/ocs-app/lib/src');
const local=require(path.join(source,'local-userscripts.js'));
(async()=>{
 const directory=fs.mkdtempSync(path.join(__dirname,'.startup-test-'));
 const file=path.join(directory,'fixture local script.user.js');try{fs.writeFileSync(file,'// ==UserScript==\n// @name Local proof\n// ==/UserScript==');
 const options={serverPort:18539,authToken:'test-auth-not-a-credential'};
 const url=local.installationURL('file://'+file,options);assert(url.startsWith('http://127.0.0.1:18539/fusion-userscripts/'));assert(!url.includes('fixture'));
 assert.equal(url,local.installationURL(require('url').pathToFileURL(file).href,options));
 assert.equal(local.installationURL('https://example.test/script.user.js',options),'https://example.test/script.user.js');
 assert.notEqual(url,local.installationURL(file,{...options,authToken:'changed-test-key'}));
 let route,code,body;local.installRoute({get(_path,handler){route=handler}},()=>({scripts:[{enable:true,isLocalScript:true,url:file}],authToken:options.authToken}));
 const response={setHeader(){},sendStatus(c){code=c},type(){return this},send(value){body=value},status(c){code=c;return this}};
 route({params:{key:new URL(url).pathname.split('/')[2]}},response);assert.equal(body.toString(),fs.readFileSync(file,'utf8'));
 body=undefined;route({params:{key:'0'.repeat(64)}},response);assert.equal(code,404);assert.equal(body,undefined);
 route({params:{key:'../config.json'}},response);assert.equal(code,404);
 const text=fs.readFileSync(path.join(source,'scripts/automation/wk/cx.js'),'utf8');
 const helper=text.slice(text.indexOf('var __awaiter'),text.indexOf('Object.defineProperty'));
 const loginText=text.slice(text.indexOf('function login('),text.indexOf('function isNotLogin('));
 for(const scenario of ['no-redirect','success','closed']){
  let alarm,cleared=false;const context={setTimeout:run=>(alarm=run,1),clearTimeout:()=>{cleared=true},console};
  vm.createContext(context);vm.runInContext(helper+loginText+';this.login=login;',context);
  class Page extends EventEmitter{async $(){return null}async evaluate(){return []}url(){return this.address||'https://passport2.chaoxing.com/login'}}
  const page=new Page(),promise=context.login(page);const observed=promise.then(()=>({resolved:true}),e=>({error:e.message}));
  for(let i=0;i<20;i++)await Promise.resolve();assert.equal(cleared,false,'login deadline must remain active before authentication');
  if(scenario==='success'){page.address='https://i.chaoxing.com/base';page.emit('load',page);assert((await observed).resolved)}
  else if(scenario==='closed'){page.emit('close');assert.match((await observed).error,/关闭/)}
  else {alarm();assert.match((await observed).error,/超时/)}
  assert(cleared);assert.equal(page.listenerCount('load'),0);assert.equal(page.listenerCount('close'),0);
 }
 console.log('PASS: local script delivery, token isolation, path rejection; login deadline, success, close and listener cleanup');
}finally{if(!path.resolve(directory).startsWith(path.resolve(__dirname)+path.sep))throw Error('Invalid temporary scope');fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
