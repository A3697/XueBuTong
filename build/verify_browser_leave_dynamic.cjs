'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const runtime=process.env.XBT_RUNTIME_ROOT,record=process.env.XBT_QA_ROOT;if(!runtime||!record)throw Error('Set XBT_RUNTIME_ROOT / XBT_QA_ROOT');
const {chromium}=require(path.join(runtime,'ocs-lab/resources/app/node_modules/playwright-core')),behavior=require('../src/ocs-app/lib/src/browser-page-behavior.js');
(async()=>{
 const root=fs.mkdtempSync(path.join(record,'leave-dynamic-'));fs.mkdirSync(path.join(root,'bridge-data'));const file=path.join(root,'bridge-data/settings.json');
 const write=enabled=>fs.writeFileSync(file,JSON.stringify({profiles:{a:{keepPlayingOnLeave:enabled},b:{keepPlayingOnLeave:false}}}));write(false);
 const browser=await chromium.launch({headless:true,executablePath:path.join(runtime,'ocs-lab/resources/bin/chrome/chrome/chrome.exe')});
 try{
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]),pages=[];
  for(let i=0;i<contexts.length;i++){
   await behavior.install(contexts[i],{root,uid:i?'b':'a'});const page=await contexts[i].newPage();pages.push(page);
   await page.goto('data:text/html,<canvas></canvas><video muted autoplay></video><button>Pause</button>');
   await page.evaluate(async()=>{window.loads=1;const canvas=document.querySelector('canvas'),video=document.querySelector('video');window.v=video;setInterval(()=>{canvas.getContext('2d').fillRect(0,0,20,20);},50);video.srcObject=canvas.captureStream(10);await video.play();document.addEventListener('mouseout',e=>{if(e.relatedTarget==null)video.pause();});document.querySelector('button').onclick=()=>video.pause();});
  }
  const leave=page=>page.evaluate(()=>{document.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:null}));return v.paused;});
  assert.equal(await leave(pages[0]),true);await pages[0].evaluate(()=>v.play());write(true);
  const started=Date.now();let active=false;while(Date.now()-started<7000){await pages[0].waitForTimeout(500);await pages[0].evaluate(()=>v.play());if(!await leave(pages[0])){active=true;break;}}
  assert(active,'saved setting must become active without page reload');const enabledWithinMs=Date.now()-started;assert.equal(await leave(pages[1]),true,'other account remains unchanged');
  await pages[0].locator('button').click();assert.equal(await pages[0].evaluate(()=>v.paused),true,'manual pause is preserved');await pages[0].evaluate(()=>v.play());write(false);await pages[0].waitForTimeout(5500);assert.equal(await leave(pages[0]),true,'saved disabled state restores native behavior');
  assert.equal(await pages[0].evaluate(()=>loads),1);const result={passed:true,enabledWithinMs,checks:['real settings file update','no navigation or direct setter','account isolation','manual pause','dynamic disable']};fs.writeFileSync(path.join(record,'browser-leave-dynamic.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{await browser.close();assert(path.resolve(root).startsWith(path.resolve(record)+path.sep));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
