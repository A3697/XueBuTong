'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),{EventEmitter}=require('node:events');
const Auth=require('../src/fusion/soutijiang-auth.cjs'),Broker=require('../src/fusion/soutijiang-broker.cjs');
const token='ab'.repeat(32),login=id=>({schema:1,storage:{college_ai_userInfo:JSON.stringify({uid:id}),college_ai_dxuss:JSON.stringify('private-'+id)},cookies:[]});
function browserModule(){const module={exports:{}};const auth={...Auth,read:async context=>structuredClone(context.snapshot),apply:async(context,value)=>{context.applied++;context.snapshot=structuredClone(value);}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/fusion/soutijiang-browser.cjs'),'utf8'),{module,exports:module.exports,require:name=>name==='./soutijiang-auth.cjs'?auth:require(name),Buffer,setTimeout,clearTimeout});return module.exports;}
async function serverFor(t,handler){const requests=[],server=http.createServer((req,res)=>{let parts=[];req.on('data',part=>parts.push(part));req.on('end',()=>{const data=JSON.parse(Buffer.concat(parts));requests.push({data,headers:req.headers,path:req.url});Promise.resolve(handler(data,res,requests.length)).catch(()=>{res.statusCode=500;res.end();});});});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return {requests,port:server.address().port};}
function respond(res,value){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}

test('broker rejects browser origins and non-loopback requests before forwarding credentials',async()=>{
 const calls=[];Broker.install({exchange:async(key,input)=>{calls.push({key,input});if(key!==token)throw Error('private failure');return {revision:1,snapshot:null};}});
 async function invoke({origin,remote='127.0.0.1',key=token}={}){const response={statusCode:200,headers:{},setHeader(name,value){this.headers[name]=value;},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};await Broker.handle({socket:{remoteAddress:remote},body:{private:'value'},get:name=>name.toLowerCase()==='origin'?origin:key},response);return response;}
 for(const scenario of [{origin:'https://untrusted.example'},{origin:'null'},{remote:'192.168.1.10'},{remote:'127.0.0.2'}])assert.equal((await invoke(scenario)).statusCode,403);
 assert.equal(calls.length,0);for(const remote of ['127.0.0.1','::1','::ffff:127.0.0.1'])assert.equal((await invoke({remote})).statusCode,200);
 const rejected=await invoke({key:'wrong'});assert.equal(rejected.statusCode,409);assert.deepEqual(rejected.body,{error:'login_share_unavailable'});assert.equal(rejected.headers['Cache-Control'],'no-store');Broker.install(null);
});

test('a login completed while sync waits is preserved and sent on the next exchange',async t=>{
 let observed,release;const seen=new Promise(resolve=>{observed=resolve;}),held=new Promise(resolve=>{release=resolve;});const server=await serverFor(t,async(_data,res,count)=>{if(count===2){observed();await held;respond(res,{revision:count,snapshot:login('one')});}else respond(res,{revision:count,snapshot:null});});
 const context=new EventEmitter();context.snapshot=login('one');context.applied=0;const client=await browserModule().attach(context,{port:server.port,token});
 try{const sync=client.sync();await seen;context.snapshot=login('two');release();await sync;assert.equal(Auth.user(context.snapshot).providerUid,'two');assert.equal(context.applied,0);await client.sync();assert.equal(Auth.user(server.requests[2].data.snapshot).providerUid,'two');assert.equal(server.requests[2].data.revision,2);assert.equal(server.requests[2].headers['x-xuebutong-soutijiang'],token);assert.equal(server.requests[2].path,'/fusion/soutijiang-session');}
 finally{release();await client.dispose();}
});

test('a closed browser never receives a pending sync response',async t=>{
 let observed,release;const seen=new Promise(resolve=>{observed=resolve;}),held=new Promise(resolve=>{release=resolve;});const server=await serverFor(t,async(_data,res,count)=>{if(count===2){observed();await held;}respond(res,{revision:count,snapshot:count===2?login('two'):null});});
 const context=new EventEmitter();context.snapshot=login('one');context.applied=0;const client=await browserModule().attach(context,{port:server.port,token});const sync=client.sync();await seen;context.emit('close');release();await sync;await client.dispose();assert.equal(context.applied,0);assert.equal(server.requests.length,2);
});

test('malformed or denied broker responses reject without silently resetting the revision',async t=>{
 const server=await serverFor(t,(_data,res)=>respond(res,{revision:'wrong',snapshot:null}));const context=new EventEmitter();context.snapshot=login('one');context.applied=0;
 await assert.rejects(browserModule().attach(context,{port:server.port,token}),/共享未完成/);assert.equal(context.applied,0);context.emit('close');
});

test('transport truncation and access denial are explicit sync failures',async t=>{
 const Browser=browserModule(),server=await serverFor(t,(_data,res,count)=>{if(count===1){res.statusCode=409;res.end('{}');}else{res.writeHead(200,{'Content-Length':1000});res.write('{');res.destroy();}});
 await assert.rejects(Browser.exchange(server.port,token,{snapshot:login('one'),revision:0}));await assert.rejects(Browser.exchange(server.port,token,{snapshot:login('one'),revision:0}));
});

test('login version ignores display metadata and device expiry but detects credentials and logout',()=>{
 const first=login('one'),other=structuredClone(first);other.storage.college_ai_isVp='true';other.storage.college_ai_pcuid='device';other.cookies.push({name:'pcuid',value:'device',domain:'daxuesoutijiang.com',path:'/',expirationDate:2000000000});assert.equal(Auth.loginDigest(first),Auth.loginDigest(other));other.storage.college_ai_dxuss='"new-token"';assert.notEqual(Auth.loginDigest(first),Auth.loginDigest(other));assert.notEqual(Auth.loginDigest(first),Auth.loginDigest({schema:1,storage:{},cookies:[]}));
});

test('the actual application cleanup includes owners having only parked login windows exactly once',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/fusion/electron-bootstrap.cjs'),'utf8'),match=source.match(/^const stopSoutijiangHelpers=(.+);\r?$/m);assert(match,'Real application helper must remain inspectable');
 const stopped=[],finished=[],soutijiang={sessions:new Map([['A',{}],['B',{}]]),pending:new Map([['B',{}],['C',{}]]),parked:new Map([['D\0default',{}],['B\0second',{}],['D\0second',{}]]),async stop(uid){stopped.push(uid);await Promise.resolve();finished.push(uid);}};
 const cleanup=vm.runInNewContext('('+match[1]+')',{soutijiang});await cleanup();assert.deepEqual(stopped,['A','B','C','D']);assert.deepEqual(finished,stopped);
});
