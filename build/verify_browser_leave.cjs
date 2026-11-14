'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const runtime=process.env.XBT_RUNTIME_ROOT,record=process.env.XBT_QA_ROOT;
if(!runtime||!record)throw Error('Set XBT_RUNTIME_ROOT / XBT_QA_ROOT');
const {chromium}=require(path.join(runtime,'ocs-lab/resources/app/node_modules/playwright-core'));
const behavior=require('../src/ocs-app/lib/src/browser-page-behavior.js');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:path.join(runtime,'ocs-lab/resources/bin/chrome/chrome/chrome.exe')});
 try{
  const context=await browser.newContext();await context.exposeBinding('__xuebutongLeavePlaybackSetting',()=>false);await context.addInitScript(behavior.pageController);
  const page=await context.newPage();await page.goto('data:text/html;charset=utf-8,'+encodeURIComponent('<canvas width="160" height="90"></canvas><video muted autoplay></video><button id="pause">暂停</button>'));
  await page.evaluate(async()=>{
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),video=document.querySelector('video');window.v=video;
   setInterval(()=>{ctx.fillStyle='rgb('+Math.round(performance.now()%255)+',40,80)';ctx.fillRect(0,0,160,90);},30);
   video.srcObject=canvas.captureStream(30);await video.play();
   document.addEventListener('mouseout',e=>{if(e.relatedTarget==null)video.pause();});
   document.querySelector('#pause').onclick=()=>video.pause();
  });
  const leave=()=>page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:null})));
  await leave();assert.equal(await page.evaluate(()=>v.paused),true,'default-off preserves site behavior');
  await page.evaluate(async()=>{await v.play();__xuebutongSetLeavePlayback(true);});await leave();assert.equal(await page.evaluate(()=>v.paused),false,'on prevents boundary pause');
  await page.locator('#pause').click();assert.equal(await page.evaluate(()=>v.paused),true,'manual click still pauses');
  await page.evaluate(()=>v.play());await page.waitForTimeout(800);await leave();assert.equal(await page.evaluate(()=>v.paused),false);
  await page.waitForTimeout(300);await page.evaluate(()=>v.pause());assert.equal(await page.evaluate(()=>v.paused),true,'ordinary program pause outside boundary remains effective');
  await page.evaluate(async()=>{await v.play();__xuebutongSetLeavePlayback(false);});await leave();assert.equal(await page.evaluate(()=>v.paused),true,'turning off immediately restores boundary pause');
  const result={passed:true,checks:['default off','leave continues with switch on','manual click pauses','normal task pause preserved','off restores behavior'],realCourse:false};
  fs.writeFileSync(path.join(record,'browser-leave-verification.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
