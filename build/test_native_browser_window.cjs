'use strict';
// Uses a fresh synthetic profile only. No installed app, account or real course is opened.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const source=path.resolve(process.env.XBT_SOURCE_ROOT||path.join(__dirname,'..'));
const record=path.resolve(process.env.XBT_QA_ROOT||path.join(source,'..'));
const native=path.resolve(process.env.XBT_NATIVE_ROOT||path.join(record,'native-build'));
const app=path.resolve(process.env.XBT_RUNTIME_ROOT||path.join(record,'隔离应用'));
const executablePath=path.join(app,'ocs-lab/resources/bin/chrome/chrome/chrome.exe');
for(const dependency of [executablePath,path.join(native,'test-native-window-probe.exe')]){
 if(!fs.existsSync(dependency))throw Error('Missing isolated QA dependency: '+dependency+'. Set XBT_RUNTIME_ROOT and XBT_NATIVE_ROOT.');
}
const {chromium}=require(path.join(app,'ocs-lab/resources/app/node_modules/playwright-core'));
const mode=process.argv[2]||'fixed',toolRoot=['baseline','mismatch'].includes(mode)?path.join(native,'baseline'):native;
const {attachWindowGuard}=require(mode==='baseline'?path.join(toolRoot,'browser-window-guard.js'):path.join(source,'src/ocs-app/lib/src/browser-window-guard'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deadline=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error(label+' timeout')),6000);timer.unref();})]);
async function until(check,label){for(let i=0;i<40;i++){if(await check())return;await sleep(150);}throw Error(label+' timeout');}
(async()=>{
 const profile=fs.mkdtempSync(path.join(native,'synthetic-profile-'));
 let context,guard,phase='launch';const evidence={mode,profile,executablePath,events:[]};
 try{
  context=await chromium.launchPersistentContext(profile,{executablePath,headless:false,viewport:null,ignoreDefaultArgs:['--disable-extensions','--enable-automation',...(process.env.XBT_NATIVE_SANDBOX!=='0'?['--no-sandbox']:[])],args:['--window-size='+(process.env.XBT_NATIVE_WINDOW_SIZE||'1050,1000'),'--window-position=0,0','--no-first-run','--no-default-browser-check','--disable-background-networking']});
  console.log('Synthetic context launched');
  context.once('close',()=>evidence.events.push({event:'context-close',phase}));
  const page=context.pages()[0];await page.setContent('<!doctype html><title>Native guard fixture</title><h1>Synthetic browser fixture</h1><script>window.ticks=0;setInterval(()=>ticks++,100)</script>');
  const cdp=await context.browser().newBrowserCDPSession();
  const pid=(await cdp.send('SystemInfo.getProcessInfo')).processInfo.find(item=>item.type==='browser').id;
  const probe=action=>JSON.parse(execFileSync(path.join(native,'test-native-window-probe.exe'),[String(pid),executablePath,action],{windowsHide:true,encoding:'utf8',timeout:6000}));
  evidence.nativeBefore=probe('snapshot');
  if(mode==='mismatch'){
   await assert.rejects(attachWindowGuard(context,{executablePath,toolRoot}),/版本不匹配/);
   evidence.passed=true;return;
  }
  guard=await attachWindowGuard(context,{executablePath,toolRoot});
  console.log('Fixture guard ready for PID '+guard.pid);
  if(mode!=='baseline'){
   await context.route('**/*',route=>{
    const url=new URL(route.request().url()),fixture=url.searchParams.get('fixture');
    const identity=['one','space-one'].includes(fixture)?'合成测试甲':fixture==='two'?'合成测试乙':'';
    const account=fixture==='space-one'?'<div class="con-left"><div class="user-block"><p class="user-name">'+identity+'</p></div></div>':identity?'<span id="userName">'+identity+'</span>':'<span class="userName">课程教师甲</span><span class="user-name">课程教师乙</span>';
    return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><title>Fixture document title</title>'+account+(url.hostname.startsWith('passport')?'<input type="password">':'')+'<script>window.ticks=0;setInterval(()=>ticks++,100)</script>'});
   });
   evidence.identities=[];
   require(path.join(source,'src/ocs-app/lib/src/browser-identity')).observe(context,{login:{platform:mode==='manual'?'none':'chaoxing'},signature:'synthetic-only',onName:info=>{evidence.identities.push(info.name);guard.setIdentity(info.name);}});
   await page.goto('https://untrusted.invalid/base?fixture=one');await sleep(400);
   assert.equal(evidence.identities.length,0,'An untrusted page is not an account identity');
   await page.goto('https://i.chaoxing.com/base?fixture=noise');await sleep(400);
   assert.equal(evidence.identities.length,0,'A course username is not an account identity');
   await page.goto('https://i.chaoxing.com/course?fixture=space-one');await sleep(400);
   assert.equal(evidence.identities.length,0,'The personal-space selector must not apply to a course path');
   await page.goto('https://mooc1.chaoxing.com/base?fixture=space-one');await sleep(400);
   assert.equal(evidence.identities.length,0,'The personal-space selector must not apply to a course host');
   await page.goto('https://i.chaoxing.com/base?fixture=space-one');
   await until(()=>probe('snapshot').windows.every(w=>w.title==='学不通 · 合成测试甲'),'Personal-space verified title');
   evidence.personalSpace=probe('snapshot');
   await page.goto('https://i.chaoxing.com/base?fixture=one');
   await until(()=>probe('snapshot').windows.every(w=>w.title==='学不通 · 合成测试甲'),'First verified title');
   await page.goto('https://i.chaoxing.com/base?fixture=two');
   await until(()=>probe('snapshot').windows.every(w=>w.title==='学不通 · 合成测试乙'),'Changed verified title');
   await page.evaluate(()=>document.title='The page keeps its own title');await sleep(200);
   assert.equal(await page.title(),'The page keeps its own title');
  }
  await sleep(400);evidence.before=probe('snapshot');
  assert.deepEqual(evidence.before.windows[0].rect,evidence.nativeBefore.windows[0].rect);
  assert.equal(evidence.before.windows[0].style,evidence.nativeBefore.windows[0].style);
  if(mode==='identity'){evidence.passed=true;return;}
  phase='x-click';
  evidence.beforeTicks=await page.evaluate(()=>ticks);
  evidence.clicked=probe('click-close');await sleep(700);
  try{evidence.after=probe('snapshot');}catch(error){if([3,4].includes(error.status))evidence.after={windows:[],processExited:true};else throw error;}
  evidence.afterTicks=await deadline(page.evaluate(()=>ticks),'Heartbeat').catch(()=>null);
  evidence.pageAlive=!page.isClosed();
  evidence.hidden=evidence.after.windows.length>0&&evidence.after.windows.every(w=>!w.visible);
  if(mode==='baseline'){
   assert.equal(evidence.after.processExited,true,'Baseline must reproduce the real X exit');
   assert.equal(evidence.pageAlive,false);
  }else{
   assert(evidence.pageAlive&&evidence.hidden&&evidence.afterTicks>evidence.beforeTicks,'X must hide while the page keeps running');
   assert(evidence.after.windows.every(w=>w.appId==='XueBuTong.Desktop'&&w.title==='学不通 · 合成测试乙'));
   assert.deepEqual(evidence.after.windows[0].rect,evidence.before.windows[0].rect);
   guard.show();await until(()=>probe('snapshot').windows.every(w=>w.visible),'Show after X');
   probe('client-body-click');await sleep(150);
   assert(probe('snapshot').windows.every(w=>w.visible),'A normal client click must not hide the window');
   const clientTicks=await page.evaluate(()=>ticks);
   probe('client-close');await until(()=>probe('snapshot').windows.every(w=>!w.visible),'Translated client X hide');
   await sleep(150);assert(await page.evaluate(()=>ticks)>clientTicks,'Translated client X must preserve the running page');
   evidence.clientClose=probe('snapshot');
   guard.show();await until(()=>probe('snapshot').windows.every(w=>w.visible),'Show after client X');
   probe('close');await until(()=>probe('snapshot').windows.every(w=>!w.visible),'WM_CLOSE hide');
   guard.show();await until(()=>probe('snapshot').windows.every(w=>w.visible),'Show after WM_CLOSE');
   probe('system-close');await until(()=>probe('snapshot').windows.every(w=>!w.visible),'SC_CLOSE hide');
   guard.show();await until(()=>probe('snapshot').windows.every(w=>w.visible),'Show after SC_CLOSE');
   await cdp.send('Target.createTarget',{url:'about:blank',newWindow:true});
   await until(()=>{const windows=probe('snapshot').windows;return windows.length===2&&windows.every(w=>w.guarded&&w.appId==='XueBuTong.Desktop'&&w.title==='学不通 · 合成测试乙');},'New window protection');
   evidence.newWindows=probe('snapshot');
   const second=context.pages().find(item=>item!==page);await second.goto('https://i.chaoxing.com/base?fixture=one');
   await until(()=>probe('snapshot').windows.every(w=>w.title==='学不通 · 待确认登录姓名'),'Conflicting identities');
   evidence.conflictingNames=probe('snapshot');await second.close();
   await until(()=>probe('snapshot').windows.every(w=>w.title==='学不通 · 合成测试乙'),'Resolve conflicting identities');
   await page.goto('https://passport2.chaoxing.com/login');
   await until(()=>probe('snapshot').windows.every(w=>w.title==='学不通 · 待确认登录姓名'),'Clear logged-out name');
   evidence.loggedOut=probe('snapshot');
   phase='main-stop';await guard.dispose();evidence.released=probe('snapshot');
   assert(evidence.released.windows.every(w=>!w.guarded&&w.appId!=='XueBuTong.Desktop'));
  }
  evidence.passed=true;
 }finally{
  phase='cleanup';
  if(guard)await guard.dispose();
  if(context)await deadline(context.close(),'Fixture close').catch(()=>{if(guard)try{process.kill(guard.pid)}catch{}});
  const report=JSON.stringify(evidence,null,2)+'\n';fs.writeFileSync(path.join(native,'fixture-'+mode+'-'+Date.now()+'.json'),report);
  if(evidence.passed)fs.writeFileSync(path.join(native,'fixture-'+mode+'.json'),report);
  console.log(JSON.stringify(evidence,null,2));
 }
})().catch(error=>{console.error(error);process.exitCode=1});
