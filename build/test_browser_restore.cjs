'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const source=path.resolve(process.env.XBT_SOURCE_ROOT||path.join(__dirname,'..')),record=path.resolve(process.env.XBT_QA_ROOT),native=path.resolve(process.env.XBT_NATIVE_ROOT||path.join(record,'native-build')),app=path.resolve(process.env.XBT_RUNTIME_ROOT);
const {chromium}=require(path.join(app,'ocs-lab/resources/app/node_modules/playwright-core')),exe=path.join(app,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let context,guard;const report={cases:[]};
 try{
  context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(record,'restore-profile-')),{executablePath:exe,headless:false,viewport:null,ignoreDefaultArgs:['--enable-automation','--disable-extensions','--no-sandbox'],args:['--window-size=1050,850','--window-position=100,100','--disable_direct_composition_video_overlays=1','--disable_direct_composition_sw_video_overlays=1']});
  const page=context.pages()[0];await page.setContent('<!doctype html><title>恢复窗口验收</title><style>html,body{margin:0;width:100%;height:100%;background:linear-gradient(90deg,#2764df,#24c8a1)}h1{position:fixed;right:0;top:0}canvas{display:none}video{width:85%;height:80%}</style><h1>窗口右边缘</h1><canvas width="640" height="360"></canvas><video muted autoplay></video><script>window.tick=0;window.rs=[];addEventListener("resize",()=>rs.push([innerWidth,innerHeight]));const c=document.querySelector("canvas"),x=c.getContext("2d");setInterval(()=>{x.fillStyle=++tick%2?"#246bce":"#399daa";x.fillRect(0,0,640,360);x.fillStyle="white";x.font="40px sans-serif";x.fillText(tick,40,100)},100);document.querySelector("video").srcObject=c.captureStream(10);</script>');
  guard=await require(path.join(source,'src/ocs-app/lib/src/browser-window-guard')).attachWindowGuard(context,{executablePath:exe,toolRoot:native});
  const cdp=await context.newCDPSession(page),{windowId}=await cdp.send('Browser.getWindowForTarget'),probe=action=>JSON.parse(execFileSync(path.join(native,'test-native-window-probe.exe'),[String(guard.pid),exe,action],{windowsHide:true,encoding:'utf8',timeout:6000}));
  const metrics=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,tick,videoTime:document.querySelector('video').currentTime,paused:document.querySelector('video').paused,resizes:rs.length}));
  for(const windowState of ['normal','maximized','normal']){
   await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState}});if(windowState==='normal')await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width:1100,height:850,left:100,top:100}});await sleep(400);
   const before=await metrics(),rect=probe('snapshot').windows[0].rect;
   for(let cycle=0;cycle<3;cycle++){
    const item={windowState,cycle,before,rect,samples:[],closeAction:process.env.XBT_NATIVE_CLOSE||'client-close'};report.cases.push(item);item.click=probe(item.closeAction);await sleep(350);item.afterClick=probe('snapshot');assert(item.afterClick.windows.every(w=>!w.visible),'Caption close did not hide: '+JSON.stringify(item.afterClick));
    const hidden=await metrics();await sleep(400);assert((await metrics()).tick>hidden.tick,'Hidden page must continue');
    await guard.show();await page.bringToFront();await sleep(250);
    for(let i=0;i<8;i++){await page.screenshot({type:'jpeg',quality:55,timeout:4000});item.samples.push(await metrics());await sleep(70);}
    assert.deepEqual(probe('snapshot').windows[0].rect,rect,'Restoration preserves native frame');
    assert(item.samples.every(m=>m.width===before.width&&m.height===before.height&&!m.paused),'Viewport remains stable and playing');
    assert(item.samples.at(-1).videoTime>item.samples[0].videoTime,'Video advances after restoration');item.passed=true;
   }
  }
  await page.screenshot({path:path.join(record,'browser-restored.png')});report.passed=true;
 }finally{await guard?.dispose();await context?.close();fs.writeFileSync(path.join(record,'browser-restore-verification.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify({passed:report.passed,cases:report.cases.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
