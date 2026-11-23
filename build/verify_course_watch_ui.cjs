'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const source = path.resolve(__dirname, '..'), record = process.env.XBT_QA_ROOT, runtime = process.env.XBT_RUNTIME_ROOT;
if (!record || !runtime) throw Error('Set XBT_QA_ROOT and XBT_RUNTIME_ROOT');
const { chromium } = require(path.join(runtime, 'ocs-lab/resources/app/node_modules/playwright-core'));
const courses = [{ course_id:'11', clazz_id:'12', name:'合成课程甲' },
  { course_id:'21', clazz_id:'22', name:'合成黑名单课程' },
  { course_id:'31', clazz_id:'32', name:'名字很长的合成课程：用于检查窄窗口中的课程标题、开关和按钮是否完整显示' },
  ...Array.from({length:15},(_,i)=>({course_id:String(100+i),clazz_id:'999',name:'课程 '+(i+1)}))];
let saved = {config:{enabled:false,interval_seconds:300,courses:[]},state:{status:'disabled',suspended:false}};
let writes = [], reads = 0, failNext = false, delay = 0;
const result = {checks:[],errors:[],screenshots:[]};
const server = http.createServer(async(req,res)=>{
  const u = new URL(req.url,'http://localhost');
  if (u.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(req.method==='GET')reads++;
    if (req.method !== 'GET') {
      let raw=''; for await (const part of req) raw+=part;
      writes.push({method:req.method,body:raw?JSON.parse(raw):null});
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      if(failNext){failNext=false;res.writeHead(500).end(JSON.stringify({error:'合成保存失败'}));return;}
      if(req.method==='PUT')saved={config:JSON.parse(raw),state:{status:'waiting',suspended:false}};
      else saved.state={status:'waiting',suspended:false};
    }
    res.end(JSON.stringify(saved));return;
  }
  if (u.pathname === '/') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"></head><body><button id="open">监控课程</button><script src="/course-watch.js"></script><script>window.changes=[];window.fixture='+JSON.stringify(courses)+';document.querySelector("#open").onclick=()=>FusionCourseWatch.open({courses:fixture,blacklist:["21:22"],onChange:v=>changes.push(v),api:async(method,url,body)=>{const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw Error(value.error);return value;}});</script></body></html>');return;
  }
  if(!['/styles.css','/course-watch.js'].includes(u.pathname)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',u.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css');
  res.end(fs.readFileSync(path.join(source,'src/star-panel',u.pathname.slice(1))));
});
(async()=>{let browser;try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:path.join(runtime,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),headless:true,args:['--no-proxy-server']});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>result.errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);
  const open=async()=>{await page.locator('#open').click();await page.locator('dialog[open]').waitFor();};
  const enabled=()=>page.getByRole('switch',{name:'启用课程开放监控'}), interval=()=>page.getByRole('spinbutton',{name:'扫描间隔（分钟）'});
  const save=()=>page.getByRole('button',{name:'保存',exact:true}), cancel=()=>page.getByRole('button',{name:'取消',exact:true});
  await page.evaluate(()=>{document.querySelector('#open').click();document.querySelector('#open').click();});await page.locator('dialog[open]').waitFor();
  assert.equal(await page.getByRole('dialog',{name:'监控课程开放'}).count(),1);assert.equal(reads,1);result.checks.push('repeated open uses one named modal and one read');
  assert(!(await enabled().isChecked()));assert.equal(await interval().inputValue(),'5');
  await enabled().check();await save().click();await page.getByRole('status').filter({hasText:'请至少选择'}).waitFor();assert.equal(writes.length,0);
  await page.getByRole('switch',{name:'监控 合成课程甲',exact:true}).check();
  for(const value of ['0','1441','1.5']){await interval().fill(value);await save().click();assert.match(await page.getByRole('status').textContent(),/整数分钟/);assert.equal(writes.length,0);}
  await interval().fill('7');await save().click();await page.locator('dialog').waitFor({state:'detached'});
  assert.deepEqual(saved.config,{enabled:true,interval_seconds:420,courses:[{course_id:'11',clazz_id:'12'}]});result.checks.push('default off, selection required, interval bounds, save payload');
  await open();await enabled().uncheck();await interval().fill('9');await cancel().click();assert.equal(writes.length,1);assert.equal(saved.config.interval_seconds,420);
  await open();assert(await enabled().isChecked());await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.equal(writes.length,1);result.checks.push('Cancel and Escape discard draft changes');
  saved.config.courses.push({course_id:'21',clazz_id:'22'},{course_id:'88',clazz_id:'89'});saved.state={status:'suspended',suspended:true};
  await open();assert(await page.getByRole('switch',{name:'监控 合成黑名单课程',exact:true}).isDisabled());
  assert(await page.getByRole('switch',{name:'监控 课程 88',exact:true}).isChecked());
  await page.getByRole('searchbox',{name:'筛选监控课程'}).fill('很长');assert.equal(await page.locator('.course-filter-row').count(),1);
  await page.getByRole('switch',{name:/监控 名字很长/}).check();await page.getByRole('searchbox').fill('');
  assert(await page.getByRole('switch',{name:/监控 名字很长/}).isChecked());
  await page.getByRole('button',{name:'恢复监控',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.course-watch-footer button').hidden);
  assert.equal(writes.at(-1).method,'POST');assert.equal(saved.config.courses.length,3);result.checks.push('blacklist switch locked, unavailable saved selection retained, search preserves draft, resume uses saved configuration');
  failNext=true;await save().click();await page.getByRole('status').filter({hasText:'保存未完成'}).waitFor();assert(!(await save().isDisabled()));
  delay=350;const before=writes.length;await save().click();assert(await save().isDisabled());await page.keyboard.press('Escape');assert(await page.locator('dialog').isVisible());
  await page.locator('dialog').waitFor({state:'detached'});assert.equal(writes.length,before+1);assert.equal(saved.config.courses.length,4);delay=0;result.checks.push('failure keeps draft, retry disables controls and Escape until completed');
  for(const theme of ['light','dark'])for(const width of [360,1280]){
    await page.setViewportSize({width,height:720});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await open();
    const geometry=await page.locator('dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect();const controls=[...dialog.querySelectorAll('footer button')].filter(e=>!e.hidden).map(e=>{const b=e.getBoundingClientRect();return{x:b.x,right:b.right,bottom:b.bottom};});return{x:r.x,right:r.right,bottom:r.bottom,scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth,controls,viewport:innerWidth,height:innerHeight};});
    assert(geometry.x>=0&&geometry.right<=width+.5&&geometry.bottom<=720+.5,JSON.stringify(geometry));assert(geometry.scrollWidth<=geometry.clientWidth+1,JSON.stringify(geometry));
    for(const b of geometry.controls)assert(b.x>=geometry.x&&b.right<=geometry.right&&b.bottom<=geometry.bottom,JSON.stringify(geometry));
    assert.notEqual(await save().evaluate(e=>getComputedStyle(e).backgroundColor),await cancel().evaluate(e=>getComputedStyle(e).backgroundColor));
    assert.equal(await page.getByRole('switch',{name:'监控 合成黑名单课程',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(100, 116, 139)');
    const filename='course-watch-'+theme+'-'+width+'.png';await page.screenshot({path:path.join(record,filename)});result.screenshots.push(filename);await cancel().click();
  }
  result.checks.push('360px and desktop layouts fit viewport in light/dark themes');assert.deepEqual(result.errors,[]);result.passed=true;
}catch(error){result.error=error.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(record,'course-watch-ui.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));}})();
