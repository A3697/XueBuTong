'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const source=path.resolve(__dirname,'..'),record=process.env.XBT_QA_ROOT,runtime=process.env.XBT_RUNTIME_ROOT;
if(!record||!runtime)throw Error('Set XBT_QA_ROOT and XBT_RUNTIME_ROOT');
const {chromium}=require(path.join(runtime,'ocs-lab/resources/app/node_modules/playwright-core'));
let queue=[],posts=0,deletes=0,failNext=false;const result={checks:[],errors:[]};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(u.pathname.startsWith('/api/')){
  if(u.pathname==='/api/queue'&&req.method==='POST'){
   let body='';for await(const part of req)body+=part;posts++;await new Promise(r=>setTimeout(r,350));
   if(failNext){failNext=false;res.writeHead(500).end(JSON.stringify({detail:'Fixture failure'}));return;}
   const value=JSON.parse(body);queue.push({...value,name:'合成课程',todo_chapters:[],status:'ready'});
  }else if(/^\/api\/queue\/\d+$/.test(u.pathname)&&req.method==='DELETE'){deletes++;queue.splice(Number(u.pathname.split('/').at(-1)),1);}
  res.end(JSON.stringify(u.pathname==='/api/queue'?{items:queue}:u.pathname.includes('session')?{logged_in:false}:{ok:true,items:[],chapters:[],categories:[]}));return;
 }
 const name=u.pathname==='/'?'index.html':u.pathname.slice(1),file=path.resolve(source,'src/star-panel',name);
 if(!file.startsWith(path.resolve(source,'src/star-panel')+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');
 let body=fs.readFileSync(file);if(name==='app.js')body=body.toString()+'\nglobalThis.__qa={S,renderCourses,renderSession,refreshQueue,toggleCourseQueue};';res.end(body);
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:path.join(runtime,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),headless:true});const page=await browser.newPage({viewport:{width:1500,height:1000}});page.on('pageerror',e=>result.errors.push(e.message));await page.addInitScript(()=>window.WebSocket=class{close(){}});await page.goto('http://127.0.0.1:'+server.address().port+'/#t=fixture');await page.waitForFunction(()=>!!window.__qa);
 await page.waitForTimeout(500);await page.evaluate(()=>{__qa.S.sessionKnown=true;__qa.S.session={logged_in:true,name:"合成用户"};__qa.renderSession();__qa.S.courses=[{course_id:'101',clazz_id:'201',name:'合成课程甲'},{course_id:'101',clazz_id:'202',name:'合成课程乙'}];__qa.renderCourses();});
 const button=page.locator('[data-cid="101"][data-clz="201"] .act-add'),other=page.locator('[data-cid="101"][data-clz="202"] .act-add');await button.click();await page.evaluate(()=>{__qa.toggleCourseQueue('101','201');__qa.toggleCourseQueue('101','201');});await page.waitForFunction(()=>document.querySelector('[data-clz="201"] .act-add').textContent==='移除');assert.equal(posts,1);assert.equal(deletes,0);assert(await button.isDisabled());assert.equal(await other.textContent(),'加入队列');assert.equal(await button.evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');result.checks.push('slow add and repeated press issue one request, red removal state, classes remain separate');
 await page.waitForFunction(()=>!document.querySelector('[data-clz="201"] .act-add').disabled);await button.click();await page.waitForFunction(()=>document.querySelector('[data-clz="201"] .act-add').textContent==='加入队列');assert.equal(deletes,1);result.checks.push('after cooldown removal restores add action');
 await page.waitForFunction(()=>!document.querySelector('[data-clz="201"] .act-add').disabled);failNext=true;await button.click();await page.waitForFunction(()=>!document.querySelector('[data-clz="201"] .act-add').disabled);assert.equal(await button.textContent(),'加入队列');assert.equal(queue.length,0);result.checks.push('failed add unlocks retry without false queued state');
 queue=[{course_id:'101',clazz_id:'202',name:'合成课程乙',status:'ready',todo_chapters:[]}];await page.evaluate(()=>__qa.refreshQueue());assert.equal(await other.textContent(),'移除');assert.equal(await button.textContent(),'加入队列');result.checks.push('external queue changes refresh corresponding course button');await page.screenshot({path:path.join(record,'course-queue-ui.png')});assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.error=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(record,'course-queue-ui.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}})();
