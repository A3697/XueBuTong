(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.XBTExtraTasks=api;})(globalThis,()=>{
 'use strict';
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function courseId(win){try{return String(win.courseid||win.courseId||win.document.querySelector('#curCourseId')?.value||new URL(win.location.href).searchParams.get('courseid')||'').match(/^\d+$/)?.[0]||'';}catch{return '';}}
 function courseName(start=typeof unsafeWindow!=='undefined'?unsafeWindow:window){
  let current=start;for(let depth=0;depth<6;depth++){
   try{const id=courseId(current);for(const name of [current.courseName,current.course_name,current.document.querySelector('#courseName,input[name="courseName"],.course-name,.courseName')?.value,current.document.querySelector('#courseName,.course-name,.courseName')?.textContent,/\/mycourse\/stu$/.test(current.location.pathname)?current.document.title:''])if(typeof name==='string'&&name.trim()){const value=name.trim().slice(0,500);if(id&&typeof GM_setValue==='function')GM_setValue('fusion.courseName.'+id,value);return value;}const cached=id&&typeof GM_getValue==='function'&&GM_getValue('fusion.courseName.'+id,'');if(cached)return String(cached).slice(0,500);if(current.parent===current)break;current=current.parent;}catch{break;}
  }return '';
 }
 async function resolveCourseName(start,defaults){
  const known=courseName(start);if(known)return known;
  const id=String(defaults.courseid||courseId(start));if(!/^\d+$/.test(id))return '';
  // Use the normal course-entry redirect; the final portal URL requires
  // navigation parameters that are not present in a knowledge-card frame.
  const url=new URL('https://mooc1.chaoxing.com/visit/stucoursemiddle');url.searchParams.set('courseid',id);url.searchParams.set('clazzid',String(defaults.clazzId||''));url.searchParams.set('ismooc2','1');url.searchParams.set('v','2');
  if(defaults.cpi)url.searchParams.set('cpi',String(defaults.cpi));
  const doc=new DOMParser().parseFromString(await request('GET',url.href),'text/html');
  const name=doc.title.trim();if(!name||/用户登录|统一认证|访问异常|登录页面/.test(name))throw Error('未取得课程名称，请先打开课程主页');
  GM_setValue('fusion.courseName.'+id,name.slice(0,500));return name.slice(0,500);
 }
 if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>courseName(),{once:true});else courseName();}
 function kind(frame){
  try{const src=frame.getAttribute('src')||'',module=frame.getAttribute('module')||'';
   if(module==='insertbbs'||module==='inserttopic'||/\/bbscircle\/chapter|\/modules\/insertbbs\//.test(src)||frame.contentDocument?.querySelector('#topicMainDiv'))return 'discussion';
   if(module==='insertvote'||module==='questionnaire'||/\/modules\/(?:zt\/vote|questionnaire)\//.test(src))return 'survey';
  }catch{}return '';
 }
 function platformUrl(value,base){const url=new URL(value,base);if(url.protocol!=='https:'||!url.hostname.endsWith('.chaoxing.com')||url.username||url.password||url.port&&url.port!=='443')throw Error('任务页面地址不受支持');return url.href;}
 function request(method,url,data,{json=false,timeout=30000,local=false,headers={}}={}){
  if(!local)platformUrl(url);
  return new Promise((resolve,reject)=>GM_xmlhttpRequest({method,url,data:data===undefined?undefined:json?JSON.stringify(data):new URLSearchParams(data).toString(),headers:{...headers,...(data===undefined?{}:{'Content-Type':json?'application/json':'application/x-www-form-urlencoded'})},timeout,
   onload:response=>{if(response.status<200||response.status>=300)return reject(Error('请求失败（'+response.status+'）'));const body=response.responseText||'';if(body.length>4*1024*1024)return reject(Error('任务响应过大'));resolve(body);},onerror:()=>reject(Error('网络连接失败（'+new URL(url).hostname+new URL(url).pathname+'）')),ontimeout:()=>reject(Error('请求超时'))}));
 }
 function parseJSON(body,label){try{return JSON.parse(body);}catch{throw Error(label+'返回了非预期页面，尚未确认结果，请打开课程检查；不会自动重复提交');}}
 function discussionToken(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  for(const script of doc.scripts){if(!/window\.obj\s*=/.test(script.textContent))continue;const match=script.textContent.match(/["']?urlToken["']?\s*:\s*(["'])([A-Za-z0-9_-]{16,512})\1/);if(match)return match[2];}
  throw Error('讨论页面未提供有效的提交凭据，请本人打开页面检查；未发布回复');
 }
 async function query(title,options,config,course){
  const wrapper=config.answererWrappers?.find(bank=>bank.fusionManaged===true);if(!wrapper)throw Error('请在学不通为此账号配置并启用题库或 AI');
  const url=new URL(wrapper.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/fusion/answer')throw Error('学不通搜题连接配置无效');
  const result=parseJSON(await request('POST',url.href,{question:{title,type:'short',options:[],blankCount:0,images:[],courseName:course||'',normalized:true}},{json:true,local:true,timeout:(config.answerWrapperHandlerTimeout||120)*1000+5000}),'搜题服务');
  if(result.kind==='miss'&&result.explicitMiss)return null;
  if(result.kind!=='hit'||typeof result.answer!=='string'||!result.answer.trim())throw Error('未取得有效答案');
  return result.answer;
 }
 async function discussion({frame,attachment,workOptions,defaults,log}){
  const prop=attachment.property||{},parent=frame.contentWindow,ctx={courseid:String(defaults.courseid||''),clazzId:String(defaults.clazzId||''),knowledgeid:String(defaults.knowledgeid||'')};
  const source=new URL('/mooc-ans/bbscircle/chapter',parent.location.href);source.search=new URLSearchParams({...ctx,mtopicid:prop.mid||'',jobid:attachment.jobid||prop.jobid||prop._jobid||'',ut:'s',isPortal:'false',isJob:'true'});
  const page=new DOMParser().parseFromString(await request('GET',source.href),'text/html');if(page.querySelector('#isFinished')?.value==='true'){log('讨论任务已由平台确认完成');return true;}
  const link=platformUrl(page.querySelector('#topicMainDiv')?.getAttribute('data')||'',source.href),parsed=new URL(link),ids=parsed.pathname.match(/\/course\/topic\/v3\/bbs\/([a-f0-9]{32})\/([a-f0-9]{32})\/replysList/);
  if(!ids)throw Error('此讨论页面暂不支持自动填写，请本人处理');const topicId=ids[2],base=parsed.origin;
  const response=parseJSON(await request('GET',base+'/course/topic/'+topicId+'/getTopic?screenStatus=0'),'讨论接口');if(response.status!==true||!response.datas)throw Error('讨论暂不可访问');const topic=response.datas;
  if(topic.userAuth?.operationAuth?.reply!==1||![undefined,null,0,false,'0'].includes(topic.lock_reply))throw Error('讨论当前不允许回复');
  const content=new DOMParser().parseFromString(topic.rtf_content||topic.text_content||'','text/html').body.textContent;
  const title=[topic.title,content].filter(Boolean).join('\n');if(!title.trim())throw Error('未取得讨论题目');
  const course=await resolveCourseName(parent,defaults);if(!course)throw Error('未取得课程名称，请先打开课程主页');
  const answer=await query(title,[],workOptions,course);if(!answer){log('待人工处理：所有搜题方式均未找到可用答案');return false;}
  if(answer.trim().length<Number(prop.replywordnum||0))throw Error('搜到的答案未达到讨论要求的最少字数');
  if(['save','nomove'].includes(workOptions.upload)){log('待人工处理：已找到答案；讨论不支持草稿保存，当前设置不允许发布');return;}
  const key='fusion.discussion.replyIntent.'+topicId;if(GM_getValue(key,null)){log('此前已尝试回复此讨论，请本人核对；未重复发布');return;}
  await sleep(Math.max(3,Number(workOptions.stopSecondWhenFinish)||3)*1000);
  // The normal v3 reply page issues a per-page submission token. Read it
  // immediately before posting, without evaluating any remote page scripts.
  const urlToken=discussionToken(await request('GET',link));
  GM_setValue(key,{state:'pending'});
  const body=parseJSON(await request('POST',base+'/pc/invitation/'+topicId+'/addReplys',{courseId:ctx.courseid,classId:ctx.clazzId,bbsid:ids[1],urlToken,replyId:'-1',uuid:crypto.randomUUID(),topic_content:encodeURIComponent(answer),files_url:'',files_attr:'',anonymous:''},{headers:{Accept:'application/json, text/javascript, */*; q=0.01','X-Requested-With':'XMLHttpRequest',Origin:base,Referer:link}}),'讨论提交接口');
  if(body.status!==true||!body.datas?.reply)throw Error((body.status===false&&typeof body.msg==='string'?body.msg.slice(0,200)+'；':'')+'回复未获平台确认，请本人核对；未自动重复发布');GM_setValue(key,{state:'accepted'});
  let confirmed=false;for(let attempt=0;attempt<5;attempt++){
   if(attempt)await sleep(1000);
   const check=new DOMParser().parseFromString(await request('GET',source.href),'text/html');
   if(check.querySelector('#isFinished')?.value==='true'){confirmed=true;break;}
  }log(confirmed?'已回复讨论，平台已确认完成':'已回复讨论，任务点仍待平台确认');
  // Re-read the platform page instead of simulating a completion callback.
  if(frame.isConnected)parent.location.reload();
  return confirmed;
 }
 async function survey({frame,workOptions,chapter,log}){
  const doc=frame.contentDocument;if(!doc)throw Error('问卷页面尚未加载');
  if(!/\/modules\/zt\/vote\//.test(frame.getAttribute('src')||''))throw Error('此问卷使用独立问卷系统，请本人打开填写');
  const open=doc.getElementById('render');if(!open)throw Error('未找到问卷入口');open.click();
  let target;const start=Date.now();while(Date.now()-start<20000){
   try{let win=frame.contentWindow;for(let i=0;i<5;i++){const candidate=win.document.querySelector('#voteIframe');if(candidate?.contentDocument?.querySelector('.TiMu')){target=candidate;break;}if(win.parent===win)break;win=win.parent;}}catch{}
   if(target)break;await sleep(300);
  }
  if(!target)throw Error('问卷题目未加载或页面暂不支持，请本人打开处理');
  log('正在使用学不通的搜题顺序处理问卷');await chapter(target,{...workOptions,fusionTask:true});
  for(let attempt=0;attempt<10;attempt++){
   try{if(frame.contentWindow.checkJobFinish?.()===true){log('问卷已由平台确认完成');return true;}}catch{}
   await sleep(500);
  }
  log('问卷任务仍待平台确认，请检查是否已提交');return false;
 }
 async function run(info){try{return info.kind==='discussion'?await discussion(info):await survey(info);}catch(error){info.log('待人工处理：'+error.message);return false;}}
 return {kind,courseName,platformUrl,run};
});
