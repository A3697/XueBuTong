'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),http=require('http'),crypto=require('crypto'),assert=require('assert/strict');
const {createRequire}=require('module');
const root=process.env.XBT_RUNTIME_ROOT;if(!root)throw Error('Set XBT_RUNTIME_ROOT to an installed XueBuTong directory.');
const w=path.resolve(__dirname,'..'),record=fs.mkdtempSync(path.join(process.env.XBT_QA_ROOT||require('os').tmpdir(),'xbt-script-install-'));fs.mkdirSync(path.join(record,'test-temp'));console.log('Test artifacts:',record);
const {chromium}=require(root+'/ocs-lab/resources/app/node_modules/playwright-core');
const worker=path.join(w,'src/ocs-app/lib/src/worker/index.js'),text=fs.readFileSync(worker,'utf8');
const box={require:createRequire(worker),console,setTimeout,clearTimeout,URL};vm.createContext(box);
vm.runInContext(text.slice(text.indexOf('async function initScripts('),text.indexOf('\nfunction send('))+';this.install=initScripts;',box);
const local=require(path.join(w,'src/ocs-app/lib/src/local-userscripts.js'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let body=Buffer.concat([fs.readFileSync(w+'/assets/defaults/ocs.user.js'),Buffer.from('\n// prior same-version regression fixture\n')]);
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/javascript');res.end(body)});
const results=[];
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port+'/script.user.js';
 const profile=fs.mkdtempSync(path.join(record,'test-temp/scriptcat-'));
 const ctx=await chromium.launchPersistentContext(profile,{executablePath:root+'/ocs-lab/resources/bin/chrome/chrome/chrome.exe',headless:false,viewport:null,ignoreDefaultArgs:['--disable-extensions','--enable-automation'],args:['--load-extension='+root+'/ocs-profile/downloads/extensions/scriptcat','--no-proxy-server','--no-first-run','--no-default-browser-check']});
 try{
  await ctx.waitForEvent('serviceworker',{timeout:15000}).catch(()=>{});
  const chromeId='ndcooeababalnlpkfedmmbbbgkljhpjf',receipt=path.join(profile,'test-receipt.json');
  const config={scriptManagers:[{id:'scriptcat',chromeId}],bundledUpdate:{url,hash:hash(body),receipt,force:true}};
  const run=async(name)=>{
   const began=Date.now(),warnings=await box.install([url],ctx,config,{timeoutMs:40000,itemTimeoutMs:18000});
   const stored=await local.installedBundledDigest(ctx,chromeId);
   const row={name,milliseconds:Date.now()-began,warnings,hash:stored?.sha256,expected:config.bundledUpdate.hash,pass:!warnings.length&&stored?.sha256===config.bundledUpdate.hash};
   results.push(row);console.log(JSON.stringify(row));assert(row.pass);
  };
  await run('fresh profile, real ScriptCat');
  // Upstream version is deliberately unchanged; a stale success receipt must
  // not cause the actual old manager content to be trusted.
  body=fs.readFileSync(w+'/assets/defaults/ocs.user.js');config.bundledUpdate.hash=hash(body);config.bundledUpdate.force=false;
  fs.writeFileSync(receipt,JSON.stringify({schema:1,sha256:hash(body)}));
  await run('same 5.4.0 version, stale receipt, new fusion bytes');
  const pages=ctx.pages().length;await run('already installed content verified without installer tab');assert.equal(ctx.pages().length,pages);
  // A transient manager error is shown only for the first fresh install page.
  // No storage or installation responses are fabricated; the retry installs
  // and verifies real bytes through ScriptCat.
  body=Buffer.from(body.toString()+'\n// installer retry regression fixture\n');config.bundledUpdate.hash=hash(body);
  let first=true;ctx.on('page',async p=>{
   if(!first)return;
   await p.waitForURL('chrome-extension://'+chromeId+'/**',{timeout:4000}).catch(()=>{});
   if(!first||!p.url().includes('/install.html'))return;first=false;
   await p.waitForSelector('#install-app-container',{timeout:4000}).catch(()=>{});
   await p.evaluate(()=>{const n=document.createElement('div');n.className='arco-alert-error';n.textContent='安装失败：暂时不可用（回归测试）';document.body.append(n)}).catch(()=>{});
  });
  await run('transient manager error, one bounded retry, actual content verified');
  body=Buffer.from(body.toString()+'// hash mismatch fixture\n');config.bundledUpdate.hash='f'.repeat(64);config.force_update_script=true;
  const saved=fs.readFileSync(receipt,'utf8'),warnings=await box.install([url],ctx,config,{timeoutMs:4500,itemTimeoutMs:1500,pollMs:100,fallbackMs:1000});
  assert(warnings.length);assert.equal(fs.readFileSync(receipt,'utf8'),saved);results.push({name:'mismatched installed content never writes success receipt',pass:true,warnings});
 }finally{await ctx.close();server.close();fs.writeFileSync(path.join(record,'real-installer-results.json'),JSON.stringify(results,null,2));}
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1});
