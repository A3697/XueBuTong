'use strict';

// The official extension owns authentication and requests. The account-scoped
// sharing adapter transfers its login state without changing extension files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const EXTENSION_ID='egfkhocobmgeafdbjbphhfdfbmlobgdc';
const SUPPORTED_VERSION='1.17.6';
const TYPE_NAMES={single:'单选题',multiple:'多选题',completion:'填空题',judgement:'判断题',short:'简答题'};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class SoutijiangError extends Error{
 constructor(code,message,status=502){super(message||code);this.name='SoutijiangError';this.code=code;this.status=status;}
}
function uidOf(uid){if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(uid)||['__proto__','constructor','prototype'].includes(uid)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(uid))throw new SoutijiangError('invalid_account','账号标识无效',400);return uid;}
function confined(root,target){
 const base=path.resolve(root),absolute=path.resolve(target),relative=path.relative(base,absolute);
 if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new SoutijiangError('soutijiang_path_invalid','搜题酱数据路径无效',500);
 let current=base;
 for(const part of ['',...relative.split(path.sep).filter(Boolean)]){if(part)current=path.join(current,part);try{if(fs.lstatSync(current).isSymbolicLink())throw new SoutijiangError('soutijiang_path_invalid','搜题酱数据路径包含链接',500);}catch(error){if(error.code!=='ENOENT')throw error;}}
 return absolute;
}
function dayKey(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
function plain(value){
 if(typeof value!=='string')return '';
 return value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?\s*>|<p\b[^>]*>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const p=parseInt(n[0].toLowerCase()==='x'?n.slice(1):n,n[0].toLowerCase()==='x'?16:10);return p<=0x10ffff?String.fromCodePoint(p):'';}).replace(/&(nbsp|amp|lt|gt|quot|apos);/g,(_,n)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[n])).normalize('NFKC').trim();
}
function comparable(value){return plain(value).replace(/^(?:第?\d+[.、．)）]|[（(]?(?:单选题|多选题|判断题|填空题|简答题)[)）]?)+/u,'').replace(/[\s\p{P}\p{S}]/gu,'');}
function questionMatches(expected,returned){const key=value=>comparable(value).replace(/^(?:下列|下面|以下)/,'');const a=key(expected),b=key(returned),stem=key(plain(returned).split(/(?:\n|\s)A[.、．:]\s*/)[0]);return !!a&&(a===b||a===stem);}
function alignScreenshotOptions(question,stem,answer){
 if(!['single','multiple'].includes(question.type)||typeof answer!=='string')return answer;
 const labeled=plain(answer).match(/^[A-Z][.、．:]\s*(.+)$/);
 if(labeled){const matched=question.options.filter(x=>comparable(x.text)===comparable(labeled[1]));if(matched.length===1)return matched[0].label;}
 const letters=plain(answer).replace(/^(?:(?:正确|参考)?答案|选项)\s*[:：]\s*/u,'').replace(/[\s,，、]/g,'');
 if(!/^[A-Z]+$/.test(letters))return answer;
 const parts=[...plain(stem).matchAll(/(?:^|\n|\s)([A-Z])[.、．:]\s*([\s\S]*?)(?=(?:\n|\s)[A-Z][.、．:]|$)/g)];
 const mapped=[];
 for(const label of letters){const row=parts.find(x=>x[1]===label);if(!row)throw new SoutijiangError('soutijiang_option_mapping_unknown','搜题酱仅返回选项编号，无法确认选项顺序');const options=question.options.filter(x=>comparable(x.text)===comparable(row[2]));if(options.length!==1)throw new SoutijiangError('soutijiang_option_mapping_unknown','搜题酱选项无法与当前题目可靠对应');mapped.push(options[0].label);}
 return mapped.join('');
}
function normalizedAnswer(question,value){
 if(typeof value==='string'){
  value=plain(value).replace(/^(?:(?:正确|参考)?答案|选项)\s*[:：]\s*/u,'').trim();
  if(question.type==='completion'&&/^\[/.test(value)){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))value=parsed;}catch{}}
 }
 if(Array.isArray(value))value=value.map(item=>typeof item==='string'?plain(item):item);
 if(question.type==='judgement'&&typeof value==='string'&&/^[A-Z]$/.test(value))value=question.options?.find(x=>x.label===value)?.text||value;
 try{return require('./gateway/index.cjs').normalizeBankAnswer(question,value);}
 catch{throw new SoutijiangError('soutijiang_answer_invalid','搜题酱答案格式无法可靠匹配当前题目');}
}
function parseScreenshot(question,response){
 const data=response?.message;
 if(!data||typeof data.errNo!=='number')throw new SoutijiangError('soutijiang_response_invalid','搜题酱截图响应格式已变化');
 if(data.errNo!==0)return {error:data.errNo,message:response.transport?.errstr||data.errstr||'',method:'screenshot',...(response.protocol?{protocol:response.protocol}:{})};
 if(response.transport?.showVipMask||data.info?.showVipMask)throw new SoutijiangError('soutijiang_answer_restricted','搜题酱未开放本次答案，请在官方界面检查权益');
 if(!Array.isArray(data.list))throw new SoutijiangError('soutijiang_response_invalid','搜题酱未返回有效题目列表');
 if(!data.list.length)return {kind:'miss',explicitMiss:true};
 const answers=[];let invalid=false;
 for(const item of data.list){
  if(!item||typeof item!=='object')throw new SoutijiangError('soutijiang_response_invalid','搜题酱题目列表格式异常');
  // The official renderer treats the final AI entry as a separate placeholder.
  const stem=typeof item.question==='string'?item.question:item.question?.content;
  if(!stem)continue;
  if(!questionMatches(question.title,stem))continue;
  if(item.answerHide||item.showVipMask)throw new SoutijiangError('soutijiang_answer_restricted','搜题酱返回的答案需要官方权益');
  const answer=typeof item.answer==='string'?item.answer:Array.isArray(item.answer)?item.answer[0]?.content:undefined;
  if(!plain(answer)){if(item.isLastAi===1)continue;invalid=true;continue;}
  try{answers.push(normalizedAnswer(question,alignScreenshotOptions(question,stem,answer)));}catch{invalid=true;}
 }
 const unique=[...new Map(answers.map(a=>[JSON.stringify(a),a])).values()];
 if(unique.length>1)throw new SoutijiangError('soutijiang_answer_ambiguous','搜题酱返回了相互冲突的答案');
 if(unique.length===1)return {kind:'hit',answer:unique[0]};
 if(invalid)throw new SoutijiangError('soutijiang_answer_invalid','搜题酱找到了题目，但答案无法解析');
 return {kind:'miss',explicitMiss:true};
}
function parseSolve(question,response){
 if(!response||typeof response.errNo!=='number')throw new SoutijiangError('soutijiang_response_invalid','搜题酱答题响应格式已变化');
 if(response.errNo!==0)return {error:response.errNo,message:response.transport?.errstr||response.errstr||'',method:'solve'};
 const result=response.result;
 if(!result||typeof result!=='object')throw new SoutijiangError('soutijiang_response_invalid','搜题酱未返回有效答案');
 const candidates=['single','multiple'].includes(question.type)?[result.option,result.answer]:[result.answer,result.option];
 const answer=candidates.find(value=>value!==undefined&&value!==null&&value!=='');
 if(answer===undefined||answer===null||answer==='')return {kind:'miss',explicitMiss:true};
 return {kind:'hit',answer:normalizedAnswer(question,answer)};
}
function classifyError(result){
 if(result.protocol==='sse'){
  if([12,303].includes(result.error))return 'login';
  if([15,304,410004].includes(result.error)||/验证|风控|频繁|风险|会员|权限|付费|订阅|vip|captcha|too.?many|rate.?limit/i.test(result.message))return 'blocked';
  return /(?:今日|今天|当天|每日).*(?:次数|额度|配额).*(?:用尽|耗尽|上限|不足|已满)|(?:daily|today).*(?:quota|limit).*(?:exhaust|reach|exceed)/i.test(result.message)?'quota':'failed';
 }
 if([3,303].includes(result.error))return 'login';
 if(result.error===410004||/验证|风控|频繁|风险|captcha|too.?many|rate.?limit/i.test(result.message))return 'blocked';
 // 4002 is proved by the official solve handler. Screenshot codes are not
 // assumed identical; use the service's explicit quota statement when present.
 if(result.method==='solve'&&result.error===4002||/(?:次数|额度|权益|配额).*(?:用尽|耗尽|上限|不足|已满)|(?:quota|limit).*(?:exhaust|reach|exceed)/i.test(result.message))return 'quota';
 return 'failed';
}
function directEnvironment(){return Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(?:^|_)(?:https?|all|no)_proxy$/i.test(key)));}
function timeout(promise,ms,code='soutijiang_timeout'){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new SoutijiangError(code,'搜题酱请求超时，请稍后检查；不会自动重试')),ms);})]).finally(()=>clearTimeout(timer));
}
async function readOfficialQr(page){
   await page.bringToFront();
   const deadline=Date.now()+25000;let previous='',stableSince=0,qrImage='',loginMethod='official-app-qr';
   // Honor the official login experiment rather than switching accounts. Its
   // WeChat QR lives in the provider's iframe; the App variant uses a canvas.
   while(Date.now()<deadline){
    for(const frame of page.frames()){
     if(!frame.url().startsWith('https://open.weixin.qq.com/'))continue;
     // Snapshot and pixels are read atomically. The official A/B flow can
     // replace the canvas/iframe; locator auto-waits used to hang on old nodes.
     const snapshot=await frame.evaluate(()=>{
      const text=document.body?.innerText||'';
      if(/微信登录暂时不可用/.test(text))return {error:'unavailable'};
      if(/二维码(?:已)?(?:失效|过期)/.test(text))return {error:'expired'};
      for(const img of document.images){
       let url;try{url=new URL(img.src);}catch{continue;}
       const box=img.getBoundingClientRect();
       if(!box.width||!box.height||getComputedStyle(img).visibility==='hidden'||url.hostname!=='open.weixin.qq.com'||!/^\/connect\/qrcode(?:\/|$)/.test(url.pathname)||!img.complete||img.naturalWidth<100||img.naturalHeight<100)continue;
       try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);return {image:canvas.toDataURL('image/png')};}catch{}
      }
      return {};
     }).catch(()=>null);
     if(snapshot?.error==='unavailable')throw new SoutijiangError('soutijiang_wechat_unavailable','官方页面提示微信登录暂时不可用，请打开官方登录窗口查看或稍后重试',503);
     if(snapshot?.error==='expired')throw new SoutijiangError('soutijiang_qr_expired','官方登录二维码已过期，请重新获取二维码',409);
     if(snapshot?.image){qrImage=snapshot.image;loginMethod='wechat-qr';}
     if(qrImage)break;
    }
    if(qrImage)break;
    const current=await page.evaluate(()=>{
     const canvas=document.querySelector('[class*="login"] canvas');if(!canvas||!canvas.getBoundingClientRect().width)return '';
     if(canvas.width<50||canvas.height<50)return false;const pixels=canvas.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;if(!pixels)return false;
     let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>128&&pixels[i]<96&&pixels[i+1]<96&&pixels[i+2]<96)dark++;
     return dark>canvas.width*canvas.height*.05?canvas.toDataURL('image/png'):'';
    }).catch(()=>'');
    if(current){
     if(current&&current===previous){if(stableSince&&Date.now()-stableSince>=1500){qrImage=current;break;}}
     else{previous=current;stableSince=Date.now();}
    }else{previous='';stableSince=0;}
    await wait(150);
   }
   if(!qrImage)throw new SoutijiangError('soutijiang_qr_unavailable','官方登录二维码未能生成，请稍后重试或在官方扩展中检查登录状态',503);
   return {qrImage,loginMethod,message:loginMethod==='wechat-qr'?'请使用微信扫码；二维码由搜题酱官方扩展提供，微信与 App 账号权益独立。':'请使用大学搜题酱 App 扫码；二维码由官方扩展生成。'};
  }

async function createChromeSession({root,profile,extension,chromium,visible=false,timeoutMs=20000}){
 const browserApi=chromium||require(path.join(root,'ocs-lab/resources/app/node_modules/playwright-core')).chromium;
 const context=await browserApi.launchPersistentContext(profile,{
  executablePath:path.join(root,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),
  headless:false,ignoreDefaultArgs:['--disable-extensions'],timeout:timeoutMs,
  args:[...visible?[]:['--headless=new'],'--no-proxy-server','--no-first-run','--disable-component-update',`--disable-extensions-except=${extension.directory}`,`--load-extension=${extension.directory}`],
  env:directEnvironment(),viewport:{width:900,height:700},acceptDownloads:false
 });
 try{
  let worker=context.serviceWorkers().find(w=>w.url().startsWith(`chrome-extension://${EXTENSION_ID}/`));
  if(!worker)worker=await context.waitForEvent('serviceworker',{predicate:w=>w.url().startsWith(`chrome-extension://${EXTENSION_ID}/`),timeout:timeoutMs});
  const prefix=`chrome-extension://${EXTENSION_ID}/`,page=context.pages().find(p=>p.url().startsWith(prefix))||await context.newPage();
  await page.goto(prefix+'options.html#/installed',{waitUntil:'domcontentloaded',timeout:timeoutMs});
  await page.waitForFunction(()=>!!globalThis.chrome?.runtime?.sendMessage,{},{timeout:timeoutMs});
  for(const other of context.pages())if(other!==page)await other.close().catch(()=>{});
  async function message(messageType,data,ms=45000){
    return timeout(page.evaluate(({messageType,data,ms})=>new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('extension_response_timeout')),ms);
     chrome.runtime.sendMessage({messageType,...(data===undefined?{}:{data})},result=>{clearTimeout(timer);const error=chrome.runtime.lastError;if(error)reject(Error(error.message));else resolve(result);});
    }),{messageType,data,ms}),ms+500);
  }
  async function user(){return page.evaluate(async()=>{
   const values=await chrome.storage.local.get(null);
   for(const [key,raw] of Object.entries(values)){
    if(!/(?:^|_)userInfo$/.test(key))continue;let value=raw;
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{continue;}}
    if(value&&value.uid){const name=String(value.nickname||value.nickName||value.uname||value.name||'').slice(0,80);return {loggedIn:true,providerUid:String(value.uid),name:name.replace(/[\s\u3164\u200b-\u200d\ufeff]/g,'')?name:'大学搜题酱账号'};}
   }
   return {loggedIn:false,providerUid:'',name:''};
  });}
  async function showLogin(){await page.bringToFront();if(!(await user()).loggedIn)await message('getUserInfo',undefined,15000);}
  async function loginQr(){if((await user()).loggedIn)return {};await showLogin();return readOfficialQr(page);}
  async function screenshot(image,ms){
   // Reuse the installed extension's own session/VC helpers and native SSE
   // router. Its current screenshot UI is ImageMessenger/category 257; the
   // legacy FetchPicSearch handler returned HTML during live acceptance.
   return timeout(page.evaluate(async({image,ms})=>{
    const vendor=globalThis.parcelRequire4416;
    if(typeof vendor!=='function')throw Error('official_screenshot_modules_unavailable');
    const session=await vendor('785n3').fetchSessionId();
    if(session?.errNo!==0)return {protocol:'sse',message:{errNo:typeof session?.errNo==='number'?session.errNo:-1,errstr:session?.errstr||'官方截图会话未能建立'}};
    const sessionId=session.data?.sessionId;if(!sessionId)throw Error('official_screenshot_session_invalid');
    const kinds=vendor('8YU2f').MessageType,vc=vendor('6YnMs').default();
    return new Promise((resolve,reject)=>{
     const port=chrome.runtime.connect({name:'aiChat'});let finished=false,list=null,showVipMask=false,contentType=0;
     const close=()=>{clearTimeout(timer);try{port.postMessage({body:{type:kinds.CloseSSE}});port.disconnect();}catch{}};
     const done=(value,error)=>{if(finished)return;finished=true;close();error?reject(Error(error)):resolve(value);};
     const failure=body=>done({protocol:'sse',message:{errNo:body.errNo,errstr:String(body.errstr||body.data?.errstr||'').slice(0,500)}});
     const timer=setTimeout(()=>done(null,'official_screenshot_timeout'),ms);
     port.onDisconnect.addListener(()=>{if(!finished)done(null,'official_screenshot_disconnected');});
     port.onMessage.addListener(event=>{
      if(event.type===kinds.SSEError){done(null,'official_screenshot_transport_error');return;}
      if(event.type===kinds.SSEClose){if(!finished)done(null,'official_screenshot_incomplete');return;}
      if(event.type!==kinds.SSEData)return;
      let body;try{body=JSON.parse(event.data?.data||'{}');}catch{done(null,'official_screenshot_invalid_json');return;}
      const name=String(event.data?.event||'message').toLowerCase();
      if(typeof body.errNo==='number'&&body.errNo!==0){failure(body);return;}
      if(name==='recognition'){contentType=body.data?.contentType||0;return;}
      if(name==='notification'){
       if(contentType!==28){done(null,'official_screenshot_response_type_changed');return;}
       let content=body.data?.content;try{if(typeof content==='string')content=JSON.parse(content);}catch{done(null,'official_screenshot_invalid_content');return;}
       if(!Array.isArray(content?.questionList)){done(null,'official_screenshot_missing_questions');return;}
       list=content.questionList.slice(0,4);showVipMask=content.showVipMask===true;
      }
      if(name==='finish'){
       if(!list){done(null,'official_screenshot_missing_result');return;}
       done({protocol:'sse',message:{errNo:0,list,info:{showVipMask}}});
      }
     });
     port.postMessage({body:{type:kinds.CreateSSE,url:'https://www.daxuesoutijiang.com/dxkits/aisearch/pc/askstream',params:{appId:'collegepcpi',sessionId,vc,ext:JSON.stringify({editFlag:'0',questionId:''}),localMsgId:Date.now()+'-0',scene:1,questionType:1,chatPageFrom:'collegepcpi',messageCategory:257,questionData:JSON.stringify({text:'pc截图搜题'}),image:image.replace('data:image/jpeg;base64,','')}}});
    });
   },{image,ms}),ms+16000);
  }
  async function image(question){
   const Images=require('./question-images.cjs'),html=question.title+'\n'+question.options.map(o=>o.text).join('\n'),urls=Images.imageUrls(html),attachments=Array.isArray(question.images)?question.images:[],loaded={};let size=0;
   const all=[...new Set([...urls,...attachments.filter(x=>typeof x==='string')])];
   if(all.length>16)throw new SoutijiangError('soutijiang_image_too_large','题目图片过多，已跳过本次搜题');
   const deadline=Date.now()+15000;
   for(const url of all){
    if(/^data:image\/(?:png|jpe?g|webp);base64,/.test(url)){loaded[url]=url;size+=url.length;}
    else{
     if(Date.now()>=deadline)throw new SoutijiangError('soutijiang_image_required','题目图片加载超时，已跳过本次搜题');
     try{const bytes=await Images.download(url,Math.max(1,deadline-Date.now())),png=Images.toPng(bytes);loaded[url]='data:image/png;base64,'+png.toString('base64');size+=loaded[url].length;}
     catch{throw new SoutijiangError('soutijiang_image_required','题目图片未能完整加载，已跳过本次搜题');}
    }
    if(size>12*1024*1024)throw new SoutijiangError('soutijiang_image_too_large','题目图片超过允许大小');
   }
   const render=await context.newPage();
   try{
    await render.route('**/*',route=>route.abort());
    await render.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:white;color:black;font:22px/1.6 "Microsoft YaHei",sans-serif}main{box-sizing:border-box;width:800px;padding:26px;white-space:pre-wrap;overflow-wrap:anywhere}p{margin:12px 0}img{display:block;max-width:740px;max-height:1500px}</style><main></main>');
    await render.evaluate(input=>{
     const root=document.querySelector('main'),used=new Set();
     const rich=(parent,value)=>{
      if(!/<(?:img|br|p|div|span|sup|sub|b|i|table|math)\b/i.test(value)){parent.textContent=value;return;}
      const doc=new DOMParser().parseFromString(value,'text/html');
      const copy=(from,to)=>{for(const child of from.childNodes){
       if(child.nodeType===Node.TEXT_NODE){to.append(document.createTextNode(child.textContent));continue;}
       if(child.nodeType!==Node.ELEMENT_NODE)continue;
       const tag=child.tagName.toLowerCase();if(['script','style','iframe','object','embed','link'].includes(tag))continue;
       if(tag==='img'){const source=child.getAttribute('src')||'',data=input.loaded[source];if(!data)throw Error('question_image_unavailable');const img=document.createElement('img');img.src=data;to.append(img);used.add(source);continue;}
       if(['p','div','span','br','sup','sub','b','i','em','strong','table','tr','td','th','tbody','ul','ol','li'].includes(tag)){const target=document.createElement(tag);to.append(target);copy(child,target);}else copy(child,to);
      }};copy(doc.body,parent);
     };
     for(const text of [input.type,input.title,...input.options]){const p=document.createElement('p');rich(p,text);root.append(p);}
     for(const url of input.attachments)if(input.loaded[url]&&!used.has(url)){const img=document.createElement('img');img.src=input.loaded[url];root.append(img);}
    },{type:TYPE_NAMES[question.type],title:question.title,options:question.options.map(o=>o.label+'. '+o.text),attachments,loaded});
    await render.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    await render.bringToFront();
    const target=render.locator('main'),box=await target.boundingBox();
    if(!box||box.height>10000)throw new SoutijiangError('soutijiang_image_too_large','题目过长，无法生成可靠截图');
    const bytes=await target.screenshot({type:'jpeg',quality:90});
    if(bytes.length>4*1024*1024)throw new SoutijiangError('soutijiang_image_too_large','题目截图超过允许大小');
    return 'data:image/jpeg;base64,'+bytes.toString('base64');
   }finally{await render.close().catch(()=>{});}
  }
  const auth=require('./soutijiang-auth.cjs');
  return {user,message,image,screenshot,loginQr,readAuth:()=>auth.read(context),applyAuth:input=>auth.apply(context,input),show:showLogin,close:()=>context.close(),closed:()=>page.isClosed()};
 }catch(error){await context.close().catch(()=>{});throw error;}
}

class SoutijiangManager{
 constructor({root,runtimeRoot=root,controller,chromium,clock=Date.now,sessionFactory=createChromeSession,minimumIntervalMs=3000}={}){
  if(!root)throw Error('root required');this.root=path.resolve(root);this.runtimeRoot=path.resolve(runtimeRoot);this.controller=controller;this.chromium=chromium;this.clock=clock;this.sessionFactory=sessionFactory;this.interval=Math.max(0,minimumIntervalMs);this.sessions=new Map();this.pending=new Map();this.states=new Map();this.generations=new Map();this.inFlight=new Map();this.tail=Promise.resolve();this.lastRequest=0;this.closed=false;
  this.home=confined(this.root,path.join(this.root,'bridge-data/soutijiang'));this.quotaFile=confined(this.root,path.join(this.home,'quota.json'));
  this.quotas={};if(fs.existsSync(this.quotaFile)){try{this.quotas=JSON.parse(fs.readFileSync(this.quotaFile,'utf8'));if(!this.quotas||typeof this.quotas!=='object'||Array.isArray(this.quotas))throw Error();}catch{throw new SoutijiangError('soutijiang_state_invalid','搜题酱额度状态无法读取，请保留文件后检查',500);}}
  this.bindingFile=confined(this.root,path.join(this.home,'bindings.json'));this.bindings={};
  if(fs.existsSync(this.bindingFile))try{const value=JSON.parse(fs.readFileSync(this.bindingFile,'utf8'));if(value&&typeof value==='object'&&!Array.isArray(value))this.bindings=value;}catch{}
 }
 enabled(uid){uidOf(uid);return this.controller?.data?.profiles?.[uid]?.soutijiangEnabled===true;}
 profilePath(uid){return confined(this.root,this.profileFor?this.profileFor(uid):path.join(this.home,uid,'profile'));}
 bindingKey(uid){return this.bindingKeyFor?this.bindingKeyFor(uid):uid;}
 configured(uid){uidOf(uid);return this.bindings[this.bindingKey(uid)]?.configured===true&&fs.existsSync(this.profilePath(uid));}
 setConfigured(uid,configured){
  uidOf(uid);const key=this.bindingKey(uid);if(this.bindings[key]?.configured===configured||!configured&&!Object.hasOwn(this.bindings,key))return;
  if(configured)this.bindings[key]={configured:true,verifiedAt:new Date(this.clock()).toISOString()};else delete this.bindings[key];
  fs.mkdirSync(this.home,{recursive:true});const temporary=confined(this.root,this.bindingFile+'.tmp-'+crypto.randomBytes(6).toString('hex'));
  try{fs.writeFileSync(temporary,JSON.stringify(this.bindings),{flag:'wx'});fs.renameSync(temporary,this.bindingFile);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 }
 extension(){
  const directory=confined(this.runtimeRoot,path.join(this.runtimeRoot,'ocs-profile/downloads/extensions/daxuesoutijiang'));
  let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));}catch{return {installed:false,directory,version:'',compatible:false};}
  const publicKey=typeof manifest.key==='string'?Buffer.from(manifest.key,'base64'):Buffer.alloc(0);
  const id=crypto.createHash('sha256').update(publicKey).digest('hex').slice(0,32).replace(/[0-9a-f]/g,n=>String.fromCharCode(97+parseInt(n,16)));
  const compatible=manifest.manifest_version===3&&manifest.version===SUPPORTED_VERSION&&id===EXTENSION_ID&&manifest.background?.service_worker==='static/background/index.js';
  return {installed:true,directory,version:String(manifest.version||''),compatible};
 }
 view(uid){
  uidOf(uid);const ext=this.extension(),state=this.states.get(uid)||{},day=dayKey(this.clock()),quota=this.quotas[state.providerUid]||{};
  const exhausted=quota.day===day&&quota.screenshot===true&&quota.solve===true;
  return {uid,enabled:this.enabled(uid),configured:this.configured(uid),installed:ext.installed,version:ext.version,compatible:ext.compatible,loggedIn:state.loggedIn===true,name:state.name||'',status:state.status||'idle',phase:state.status||'idle',error:state.error||'',message:state.message||'',qrImage:state.qrImage||'',qrDataUrl:state.qrImage||'',loginMethod:state.loginMethod||'',screenshotExhausted:quota.day===day&&quota.screenshot===true,solveExhausted:quota.day===day&&quota.solve===true,screenshotRemaining:null,solveRemaining:null,disabledUntil:exhausted?new Date(Date.parse(day+'T00:00:00+08:00')+86400000).toISOString():null,blocked:state.blocked===true};
 }
 async state(uid,{refresh=false,connect=false}={}){
  uidOf(uid);if(connect){try{return await this.probe(uid);}catch(error){if(!['soutijiang_extension_missing','soutijiang_extension_incompatible'].includes(error.code))throw error;this.states.set(uid,{...this.states.get(uid),status:'attention',error:error.code,message:error.message});return this.view(uid);}}const session=this.sessions.get(uid);
  if(session&&(refresh||this.clock()-(this.states.get(uid)?.checkedAt||0)>=3000)){
   try{const user=await session.user(),old=this.states.get(uid)||{};this.setConfigured(uid,user.loggedIn===true);this.states.set(uid,{...old,...user,checkedAt:this.clock(),...(user.loggedIn?{qrImage:'',...(old.blocked||old.status==='attention'?{}:{status:'ready',error:'',message:''})}:old.status==='ready'?{status:'login-required',message:'请先扫码登录该账号的搜题酱'}:{})});}
   catch{this.states.set(uid,{...this.states.get(uid),loggedIn:false,status:'unavailable',error:'soutijiang_session_unavailable',message:'搜题酱辅助窗口已关闭，可通过连接检查恢复已保存的登录。'});}
  }
  return this.view(uid);
 }
 async probe(uid){
  const session=await this.ensure(uid);
  await session.message('updateUserInfo',undefined,15000);
  return this.state(uid,{refresh:true});
 }
 async ensure(uid,{visible=false}={}){
  uidOf(uid);if(this.closed)throw new SoutijiangError('soutijiang_closed','搜题酱服务已关闭',503);
  const existing=this.sessions.get(uid);if(existing&&!existing.closed?.())return existing;
  if(this.pending.has(uid))return this.pending.get(uid);
  const ext=this.extension();if(!ext.installed)throw new SoutijiangError('soutijiang_extension_missing','请先在应用中心安装大学搜题酱官方扩展',409);
  if(!ext.compatible)throw new SoutijiangError('soutijiang_extension_incompatible','当前搜题酱扩展版本尚未验证，已停止接管以避免错误请求',409);
  const generation=this.generations.get(uid)||0;
  const profile=this.profilePath(uid);fs.mkdirSync(profile,{recursive:true});
  const pending=(async()=>{
   const session=await this.sessionFactory({root:this.runtimeRoot,profile,extension:ext,chromium:this.chromium,visible});
   if(this.closed||(this.generations.get(uid)||0)!==generation){await session.close();throw new SoutijiangError('soutijiang_cancelled','搜题酱启动已取消',409);}
   this.sessions.set(uid,session);return session;
  })();this.pending.set(uid,pending);
  try{return await pending;}finally{if(this.pending.get(uid)===pending)this.pending.delete(uid);}
 }
 async login(uid,{visible=false}={}){
  uidOf(uid);if(visible)await this.stop(uid);let session=await this.ensure(uid,{visible});
  await session.message('updateUserInfo',undefined,15000);
  const user=await session.user();this.setConfigured(uid,user.loggedIn===true);
  if(user.loggedIn){this.states.set(uid,{...user,status:'ready',checkedAt:this.clock(),blocked:false});return this.view(uid);}
  if(visible){await session.show?.();this.states.set(uid,{...user,status:'awaiting-login',loginMethod:'official-window',message:'已打开大学搜题酱官方登录窗口，请按窗口提示登录。',checkedAt:this.clock(),blocked:false});return this.view(uid);}
  // A second explicit Login click requests a fresh official QR. Polling state
  // never renews it or restarts the user's pending scan.
  if(this.states.get(uid)?.qrImage){await this.stop(uid);session=await this.ensure(uid);}
  try{const qr=await session.loginQr();this.states.set(uid,{...user,...qr,status:'awaiting-login',checkedAt:this.clock(),blocked:false});return this.view(uid);}
  catch(error){await this.stop(uid);this.states.set(uid,{...user,status:'attention',error:error.code||'soutijiang_qr_unavailable',message:error.message||'官方二维码未能生成，请重新获取',checkedAt:this.clock()});throw error;}
 }
 markQuota(uid,method){
  const identity=this.states.get(uid)?.providerUid;if(!identity)return;
  const day=dayKey(this.clock()),old=this.quotas[identity];this.quotas[identity]={...(old?.day===day?old:{}),day,[method]:true};
  this.saveQuota();
 }
 markUsage(uid,method){
  const identity=this.states.get(uid)?.providerUid;if(!identity)return;
  const day=dayKey(this.clock()),old=this.quotas[identity],quota=old?.day===day?old:{day};
  quota[method+'Successful']=Math.max(0,Number(quota[method+'Successful'])||0)+1;this.quotas[identity]=quota;this.saveQuota();
 }
 saveQuota(){
  const day=dayKey(this.clock());for(const [key,value]of Object.entries(this.quotas))if(value.day!==day)delete this.quotas[key];
  fs.mkdirSync(this.home,{recursive:true});const temporary=confined(this.root,this.quotaFile+'.tmp-'+crypto.randomBytes(6).toString('hex'));
  try{fs.writeFileSync(temporary,JSON.stringify(this.quotas),{flag:'wx'});fs.renameSync(temporary,this.quotaFile);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 }
 async request(uid,session,type,data,ms){
  if(!this.enabled(uid))throw new SoutijiangError('soutijiang_disabled','该账号未启用搜题酱接管',409);
  const gap=this.interval-(this.clock()-this.lastRequest);if(gap>0)await wait(gap);
  if(!this.enabled(uid)||this.closed||this.sessions.get(uid)!==session)throw new SoutijiangError('soutijiang_cancelled','搜题酱请求已取消',409);
  this.lastRequest=this.clock();
  try{return type==='ScreenshotSearch'?await session.screenshot(data.image,ms):await session.message(type,data,ms);}
  catch(error){await this.stop(uid);throw error instanceof SoutijiangError?error:new SoutijiangError('soutijiang_request_failed','搜题酱请求未完成；不会自动重试');}
 }
 async doQuery(uid,question){
  if(!this.enabled(uid))throw new SoutijiangError('soutijiang_disabled','该账号未启用搜题酱接管',409);
  if(!question||!TYPE_NAMES[question.type]||typeof question.title!=='string'||!question.title.trim()||question.title.length>16000||!Array.isArray(question.options)||question.options.length>100||question.options.some(o=>!o||typeof o.label!=='string'||typeof o.text!=='string'||o.text.length>16000))throw new SoutijiangError('soutijiang_question_invalid','搜题酱题目格式无效',400);
  if(this.states.get(uid)?.blocked)throw new SoutijiangError('soutijiang_verification_required','搜题酱要求本人处理验证，已停止自动请求',409);
  const session=await this.ensure(uid),user=await session.user();this.setConfigured(uid,user.loggedIn===true);this.states.set(uid,{...this.states.get(uid),...user,checkedAt:this.clock()});
  if(!user.loggedIn)throw new SoutijiangError('soutijiang_login_required','请先扫码登录该账号的搜题酱',409);
  const status=this.view(uid);if(status.screenshotExhausted&&status.solveExhausted)throw new SoutijiangError('soutijiang_daily_exhausted','搜题酱今日额度已耗尽，今日跳过此方式',429);
  const image=await session.image(question),ms=Math.min(120000,Math.max(1000,Number(question.timeoutMs)||60000));
  if(!status.screenshotExhausted){
   const response=await this.request(uid,session,'ScreenshotSearch',{image},ms);let result;
   try{result=parseScreenshot(question,response);}catch(error){if(error.code==='soutijiang_answer_restricted')this.states.set(uid,{...this.states.get(uid),blocked:true,status:'attention',error:error.code,message:error.message});throw error;}
   if(result.kind){this.markUsage(uid,'screenshot');this.states.set(uid,{...this.states.get(uid),status:'ready',error:'',message:''});return result;}
   const action=classifyError(result);
   if(action==='quota')this.markQuota(uid,'screenshot');else throw this.providerError(uid,result,action);
  }
  if(this.view(uid).solveExhausted)throw new SoutijiangError('soutijiang_daily_exhausted','搜题酱今日额度已耗尽，今日跳过此方式',429);
  const data={base64:image,historyResult:'',questionText:plain(question.title),options:question.options.map(o=>o.label+'. '+plain(o.text)),questionType:TYPE_NAMES[question.type],blankNum:question.blankCount||0,llmType:(question.images||[]).length?'img':'',courseName:String(question.courseName||''),questionFrom:'',index:0};
  const result=parseSolve(question,await this.request(uid,session,'SolveExercise',data,ms));
  if(result.kind){this.markUsage(uid,'solve');this.states.set(uid,{...this.states.get(uid),status:'ready',error:'',message:''});return result;}
  const action=classifyError(result);if(action==='quota'){this.markQuota(uid,'solve');throw new SoutijiangError('soutijiang_daily_exhausted','搜题酱今日额度已耗尽，今日跳过此方式',429);}throw this.providerError(uid,result,action);
 }
 providerError(uid,result,action){
  let code='soutijiang_provider_error',message='搜题酱服务返回异常（'+result.error+'），已跳过本次请求';
  if(action==='login'){code='soutijiang_login_required';message='搜题酱登录已失效，请重新扫码';this.setConfigured(uid,false);this.states.set(uid,{...this.states.get(uid),loggedIn:false});}
  if(action==='blocked'){code='soutijiang_verification_required';message='搜题酱要求本人处理验证或稍后重试，已停止自动请求';this.states.set(uid,{...this.states.get(uid),blocked:true});}
  this.states.set(uid,{...this.states.get(uid),error:code,message,status:'attention'});return new SoutijiangError(code,message,409);
 }
 query(uid,question){
  uidOf(uid);const key=uid+'\0'+crypto.createHash('sha256').update(JSON.stringify(question)).digest('hex');
  if(this.inFlight.has(key))return this.inFlight.get(key);
  if(this.inFlight.size>=32)return Promise.reject(new SoutijiangError('soutijiang_busy','搜题酱等待队列已满，请稍后重试',429));
  const generation=this.generations.get(uid)||0;
  const result=this.tail.catch(()=>{}).then(()=>{if((this.generations.get(uid)||0)!==generation)throw new SoutijiangError('soutijiang_cancelled','搜题酱请求已取消',409);return this.doQuery(uid,question);});this.tail=result.catch(()=>{});this.inFlight.set(key,result);
  result.finally(()=>{if(this.inFlight.get(key)===result)this.inFlight.delete(key);}).catch(()=>{});return result;
 }
 async stop(uid){uidOf(uid);this.generations.set(uid,(this.generations.get(uid)||0)+1);const session=this.sessions.get(uid),pending=this.pending.get(uid);this.sessions.delete(uid);if(session)await session.close().catch(()=>{});if(pending)await pending.catch(()=>{});this.states.set(uid,{...this.states.get(uid),status:'idle',qrImage:''});}
 async logout(uid){const session=await this.ensure(uid);const response=await session.message('LogOut',undefined,15000);if(response?.success!==true)throw new SoutijiangError('soutijiang_logout_failed','搜题酱退出未成功，请稍后重试');this.setConfigured(uid,false);this.states.set(uid,{loggedIn:false,status:'idle'});await this.stop(uid);return this.view(uid);}
 async dispose(){this.closed=true;await Promise.all([...new Set([...this.sessions.keys(),...this.pending.keys()])].map(uid=>this.stop(uid)));await Promise.allSettled([...this.pending.values()]);}
}
module.exports={createManager:options=>new SoutijiangManager(options),SoutijiangManager,SoutijiangError,createChromeSession,readOfficialQr,parseScreenshot,parseSolve,classifyError,normalizedAnswer,dayKey,EXTENSION_ID,SUPPORTED_VERSION};
