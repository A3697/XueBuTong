'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),project=path.dirname(root),runtime=path.join(project,'XueBuTong_构建依赖/runtime');
const {chromium}=require(path.join(runtime,'ocs-lab/resources/app/node_modules/playwright-core'));
const Adapter=require('../src/fusion/ocs-enhancement.cjs');
(async()=>{const checks=[],browser=await chromium.launch({executablePath:path.join(runtime,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),headless:true,args:['--disable-background-networking']});try{
 const ctx=await browser.newContext();await ctx.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 const page=await ctx.newPage();await page.goto('https://mooc1.chaoxing.com/mycourse/studentstudy');
 await page.setContent('<iframe module="insertbbs" src="/ananas/modules/insertbbs/index.html"></iframe>');await page.locator('iframe').evaluate(e=>new Promise(r=>{if(e.contentDocument?.readyState==='complete')r();else e.addEventListener('load',r,{once:true});}));
 await page.evaluate(()=>{window.fixture={calls:[],values:{},logs:[],mode:'confirmed',reads:0};window.GM_getValue=(key,fallback)=>fixture.values[key]??fallback;window.GM_setValue=(key,value)=>fixture.values[key]=value;window.setTimeout=(fn)=>{queueMicrotask(fn);return 1;};window.GM_xmlhttpRequest=opts=>{
  fixture.calls.push({url:opts.url,method:opts.method,data:opts.data,headers:opts.headers});const u=new URL(opts.url);let text='';
  if(fixture.mode==='network'){opts.onerror();return;}
  if(u.pathname==='/mooc-ans/bbscircle/chapter'){fixture.reads++;text=(fixture.reads>1&&fixture.mode==='confirmed'||fixture.reads>3&&fixture.mode==='delayed')?'<input id="isFinished" value="true">':'<input id="isFinished" value="false"><div id="topicMainDiv" data="https://groupweb.chaoxing.com/course/topic/v3/bbs/'+ 'a'.repeat(32)+'/'+ 'b'.repeat(32)+'/replysList"></div>';}
  else if(u.pathname.endsWith('/getTopic'))text=JSON.stringify({status:true,datas:{title:'我对这门课程的看法',text_content:'请说明观点',userAuth:{operationAuth:{reply:1}}}});
  else if(u.pathname==='/visit/stucoursemiddle')text='<title>示例课程</title>';
  else if(u.pathname==='/fusion/answer')text=JSON.stringify(fixture.mode==='miss'?{kind:'miss',explicitMiss:true}:{kind:'hit',answer:'这是用于接口验证的示例答案，不代表个人真实经历。'});
  else if(u.pathname.endsWith('/replysList'))text=fixture.mode==='no-token'?'<p>页面已过期</p>':'<script>window.obj = {urlToken:"fixture-page-token-261114"};<\/script>';
  else if(u.pathname.endsWith('/addReplys'))text=JSON.stringify(fixture.mode==='rejected'?{status:false,msg:'提交页面已失效'}:{status:true,datas:{reply:{id:'fixture'}}});
  else throw Error('Unexpected fixture request: '+u.pathname);
  queueMicrotask(()=>opts.onload({status:200,responseText:text}));
 };});
 await page.addScriptTag({path:path.join(root,'src/fusion/supplemental-tasks.js')});
 async function run(mode,upload=80,keep=false){return page.evaluate(async({mode,upload,keep})=>{fixture.mode=mode;fixture.reads=0;fixture.calls=[];fixture.logs=[];if(!keep)fixture.values={};const frame=document.querySelector('iframe');const result=await XBTExtraTasks.run({kind:XBTExtraTasks.kind(frame),frame,attachment:{jobid:'fixture-job',property:{mid:'fixture-mid'}},defaults:{courseid:'123',clazzId:'456',knowledgeid:'789'},workOptions:{upload,answererWrappers:[{fusionManaged:true,url:'http://127.0.0.1:18539/fusion/answer?cap=fixture'}]},log:message=>fixture.logs.push(message)});return{result,calls:fixture.calls,logs:fixture.logs};},{mode,upload,keep});}
 let r=await run('confirmed');assert.equal(r.result,true);assert.equal(r.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/addReplys')).length,1);assert.equal(JSON.parse(r.calls.find(c=>c.url.includes('/fusion/answer')).data).question.courseName,'示例课程');checks.push('Discussion uses actual course context and confirms platform completion');
 const post=r.calls.find(c=>c.url.endsWith('/addReplys')),data=new URLSearchParams(post.data);assert.equal(data.get('urlToken'),'fixture-page-token-261114');assert.equal(data.get('classId'),'456');assert.equal(data.get('bbsid'),'a'.repeat(32));assert.equal(post.headers['X-Requested-With'],'XMLHttpRequest');assert(r.calls.at(-3).url.endsWith('/replysList'));checks.push('Current v3 page token and course/class/group context follow the normal submission flow');
 r=await run('pending',80,true);assert.notEqual(r.result,true);assert(!r.calls.some(c=>c.url.endsWith('/addReplys')));checks.push('Persistent intent prevents duplicate publication');
 r=await run('pending');assert.equal(r.result,false);assert(r.logs.some(s=>s.includes('仍待平台确认')));checks.push('Accepted reply is distinct from completed task');
 assert.equal(r.calls.filter(c=>c.url.includes('/bbscircle/chapter')).length,6);r=await run('delayed');assert.equal(r.result,true);assert.equal(r.calls.filter(c=>c.url.endsWith('/addReplys')).length,1);checks.push('Delayed completion uses bounded read-only confirmation, never a second post');
 for(const mode of ['miss','network']){r=await run(mode);assert.equal(r.result,false);assert(!r.calls.some(c=>c.url.endsWith('/addReplys')));}
 for(const upload of ['save','nomove']){r=await run('pending',upload);assert.notEqual(r.result,true);assert(!r.calls.some(c=>c.url.endsWith('/addReplys')));}
 checks.push('Miss, network failure and non-publishing preferences leave discussion pending');
 r=await run('no-token');assert.equal(r.result,false);assert(!r.calls.some(c=>c.url.endsWith('/addReplys')));assert(r.logs.some(s=>s.includes('未提供有效的提交凭据')));
 r=await run('rejected');assert.equal(r.result,false);assert(r.logs.some(s=>s.includes('提交页面已失效')));r=await run('rejected',80,true);assert(!r.calls.some(c=>c.url.endsWith('/addReplys')));checks.push('Missing page token or explicit platform rejection never becomes completion or a blind retry');
 const raw=fs.readFileSync(path.join(root,'assets/defaults/ocs.upstream.user.js'));
 const on=Adapter.compose(raw,{root}),off=Adapter.compose(raw,{root,enhanced:false});assert(on.code.includes('// @connect chaoxing.com'));assert(on.code.includes('job.attachment.fusionPending'));assert(!off.code.includes('// @connect chaoxing.com'));assert(!off.code.includes('XBTExtraTasks'));checks.push('Enhanced runtime declares platform permission; disabled enhancement leaves official tasks unchanged');
 const out={passed:true,checks};const qa=process.env.XBT_QA_ROOT;if(qa)fs.writeFileSync(path.join(qa,'supplemental-browser-verification.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
