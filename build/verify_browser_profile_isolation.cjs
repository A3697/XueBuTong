'use strict';
// Real Chromium persistence against a local fixture. No account credentials,
// original OCS process or production profile is used. Test page routes are
// limited to the fixture origin; this is not an OS-level traffic capture.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {prepareBrowserProfile,MARKER}=require('../src/fusion/browser-profile-isolation.cjs');
const runtime=process.env.XBT_RUNTIME_ROOT;if(!runtime)throw Error('Set XBT_RUNTIME_ROOT to an installed runtime.');
const qa=path.resolve(process.env.XBT_QA_ROOT||path.join(__dirname,'../..'));fs.mkdirSync(qa,{recursive:true});
const record=fs.mkdtempSync(path.join(qa,'browser-profile-live-'));
const {chromium}=require(path.join(runtime,'ocs-lab/resources/app/node_modules/playwright-core'));
const executablePath=path.join(runtime,'ocs-lab/resources/bin/chrome/chrome/chrome.exe');
const cacheRoot=path.join(record,'custom-cache-root'),userDataRoot=path.join(record,'application-data');fs.mkdirSync(userDataRoot);
const requests=[];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/set'){const value=url.searchParams.get('value');if(!['A','B'].includes(value)){res.writeHead(400);res.end();return;}res.setHeader('Set-Cookie',`fixture_account=${value}; Path=/; Max-Age=3600; HttpOnly; SameSite=Lax`);}
 requests.push({path:url.pathname,cookie:req.headers.cookie||''});res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end('<!doctype html><html><title>Local account isolation fixture</title><body>Local fixture</body></html>');
});
const contexts=new Set(),result={passed:false,network:'loopback HTTP fixture; other page origins blocked',accounts:2,cookies:false,localStorage:false,indexedDB:false,reopenPersistence:false,legacyCachePreserved:false,markerOwnership:false};
async function read(page){return page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('fixture-db',1);r.onupgradeneeded=()=>r.result.createObjectStore('values');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const value=await new Promise((resolve,reject)=>{const r=db.transaction('values').objectStore('values').get('account');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});db.close();
 return{local:localStorage.getItem('account'),indexed:value};
});}
async function write(page,value){await page.evaluate(async value=>{
 localStorage.setItem('account',value);const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('fixture-db',1);r.onupgradeneeded=()=>r.result.createObjectStore('values');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction('values','readwrite');tx.objectStore('values').put(value,'account');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
},value);}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 async function open(uid){
  const profile=prepareBrowserProfile({uid,cacheRoot,profilePath:path.join(cacheRoot,uid),userDataRoot});
  const context=await chromium.launchPersistentContext(profile,{executablePath,headless:true,viewport:{width:800,height:600},args:['--no-proxy-server','--no-first-run','--no-default-browser-check','--disable-background-networking']});contexts.add(context);
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=context.pages()[0]||await context.newPage();await page.goto(origin+'/read');return{context,page,profile};
 }
 const a=await open('account-A'),b=await open('account-B');
 assert.deepEqual(await read(a.page),{local:null,indexed:null});assert.deepEqual(await read(b.page),{local:null,indexed:null});
 await a.page.goto(origin+'/set?value=A');await write(a.page,'A');
 assert.deepEqual(await read(b.page),{local:null,indexed:null});assert.deepEqual((await b.context.cookies(origin)).filter(c=>c.name==='fixture_account'),[]);
 await b.page.goto(origin+'/set?value=B');await write(b.page,'B');
 assert.deepEqual(await read(a.page),{local:'A',indexed:'A'});assert.deepEqual(await read(b.page),{local:'B',indexed:'B'});
 assert.equal((await a.context.cookies(origin)).find(c=>c.name==='fixture_account')?.value,'A');assert.equal((await b.context.cookies(origin)).find(c=>c.name==='fixture_account')?.value,'B');
 result.cookies=result.localStorage=result.indexedDB=true;
 await a.context.close();contexts.delete(a.context);await b.context.close();contexts.delete(b.context);
 // Exercise an old, unmarked browser profile without changing its stored state.
 // Only this test-created marker is moved; no browser data is copied or erased.
 fs.renameSync(path.join(a.profile,MARKER),path.join(record,'prior-marker.json'));
 const againA=await open('account-A'),againB=await open('account-B');
 assert.deepEqual(await read(againA.page),{local:'A',indexed:'A'});assert.deepEqual(await read(againB.page),{local:'B',indexed:'B'});
 assert.equal((await againA.context.cookies(origin)).find(c=>c.name==='fixture_account')?.value,'A');assert.equal((await againB.context.cookies(origin)).find(c=>c.name==='fixture_account')?.value,'B');
 assert.equal(JSON.parse(fs.readFileSync(path.join(againA.profile,MARKER))).uid,'account-A');assert.equal(JSON.parse(fs.readFileSync(path.join(againB.profile,MARKER))).uid,'account-B');
 assert(requests.some(r=>r.path==='/read'&&r.cookie==='fixture_account=A'));assert(requests.some(r=>r.path==='/read'&&r.cookie==='fixture_account=B'));
 result.reopenPersistence=result.legacyCachePreserved=result.markerOwnership=result.passed=true;
})().catch(error=>{result.error=error.stack;process.exitCode=1;}).finally(async()=>{
 for(const context of contexts)await context.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));
 fs.writeFileSync(path.join(record,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,record}));
});
