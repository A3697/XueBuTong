'use strict';
const Profiles = require('./login-profiles.js');
const {directEnvironment} = require('../ocs-lab/resources/app/lib/src/network-policy.js');
const WAITING = {state:'unverified', message:'登录验证未完成，暂时无法判断账号密码。请在浏览器中检查登录状态。'};
const result = (state, message, extra) => ({state, message, ...(extra || {})});
const errorSelectors = '.err-txt,.err-tip,.switch-wrap-signin.active .form-ipt-error.is-visible,.xcConfirm .txtBox,.el-message--error,.el-form-item__error';
const challengeSelectors = '#vercode,#numVerCode,#captcha .cx_rightBtn,.yidun_slider,[alt="验证码滑块"],[alt="验证码背景"],.geetest_holder,.geetest_panel,.nc_scale,.captcha-container canvas,.tencent-captcha-dy__verify-bg-img';
const authenticatedSelectors = 'a[href*="logout"],a[href*="logoff"],[onclick*="logout"],[onclick*="logOut"],#userName,.user-name,.userName,.user-info,.userInfo';
function trustedUrl(login, value) {
 let url;try {url=new URL(value);}catch{return false;}
 if(!['http:','https:'].includes(url.protocol))return false;
 const host=url.hostname.toLowerCase(),p=url.pathname;
 if(login.platform==='chaoxing')return /(?:^|\.)chaoxing\.com$/.test(host)&&!/^passport\d?\./.test(host)&&/^\/(?:space\/index|base)(?:\/|$)/.test(p);
 if(login.platform==='zhihuishu')return /^(?:onlineweb|studyservice|online2|hike)\.zhihuishu\.com$/.test(host)&&!/(?:login|error|logout)/i.test(p);
 if(login.platform==='zjy')return host==='zjy2.icve.com.cn'&&/^\/(?:study\/(?:index|home)|admin\/(?:pedding|index))(?:\/|$)/.test(p);
 if(login.platform==='icve')return host==='mooc.icve.com.cn'&&/^\/cms\//.test(p);
 return false;
}
function classifyError(text) {
 if(/验证码|滑块|安全验证|人机|captcha|验证失败/i.test(text))return result('challenge','登录需要验证码或安全验证，请使用浏览器完成验证后重试。');
 if(/密码(?:错误|不正确|有误)|(?:账号|帐号|用户名|账户)(?:或密码)?(?:错误|不存在|不正确|不匹配)|账号或密码不正确|用户名或密码不匹配|学号.*不存在|wrong password|invalid (?:credentials|password|username)/i.test(text))return result('invalid','网站提示账号或密码不正确，请检查后重试。');
 if(/频繁|锁定|冻结|异常|限制|暂不可|次数|稍后重试/.test(text))return result('unverified','网站暂时限制登录，请稍后重试或使用浏览器检查。');
 return null;
}
async function pageState(page) {
 return page.evaluate(({errors,challenges,authenticated})=>{
  const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
  const texts=selector=>Array.from(document.querySelectorAll(selector)).filter(visible).map(el=>(el.textContent||'').trim()).filter(Boolean);
  const markers=texts(authenticated);
  return {error:texts(errors).join('\n'),challenge:Array.from(document.querySelectorAll(challenges)).some(visible),authenticated:markers.length>0,
   name:texts('#userName,.personalName,.zl_profile_info strong')[0]||'',
   hasLoginForm:Array.from(document.querySelectorAll('input[type="password"]')).some(visible)};
 },{errors:errorSelectors,challenges:challengeSelectors,authenticated:authenticatedSelectors});
}
async function schoolId(page) {
 return page.evaluate(()=>{
  for(const selector of ['#fid','#schoolid','input[name="fid"]','input[name="schoolid"]','#fidunit','#unitid']){
   const value=document.querySelector(selector)?.value;
   if(typeof value==='string'&&/^\d{1,16}$/.test(value)&&Number(value)>0)return value;
  }return '';
 });
}
async function exactSchoolChoice(page, selector, unit) {
 const target=String(unit).replace(/\s+/g,'');
 try{
  await page.waitForFunction(({selector,target})=>Array.from(document.querySelectorAll(selector)).some(el=>el.getClientRects().length&&(el.textContent||'').replace(/\s+/g,'')===target),{selector,target});
 }catch(error){if(error.name!=='TimeoutError')throw error;throw Object.assign(new Error('未找到学校'),{code:'SCHOOL_NOT_FOUND'});}
 const items=page.locator(selector),names=await items.allTextContents(),matches=names.map((name,index)=>({name,index})).filter(x=>x.name.replace(/\s+/g,'')===target);
 if(matches.length!==1)throw Object.assign(new Error('未找到唯一匹配的学校'),{code:'SCHOOL_NOT_FOUND'});
 return items.nth(matches[0].index);
}
async function selectCXSchool(page, unit) {
 await page.locator('#otherlogin').click();
 const input=page.locator('#inputunitname');
 await input.fill('');await input.type(unit,{delay:20});
 const chosen=await exactSchoolChoice(page,'.filter-list > ul > li',unit),attribute=await chosen.getAttribute('data-fid')||await chosen.getAttribute('fid')||await chosen.getAttribute('id')||'';
 await chosen.click();
 let value=await schoolId(page);
 if(!value&&await page.locator('#fid,#schoolid,input[name="fid"],input[name="schoolid"]').count()){
  await page.waitForFunction(()=>['#fid','#schoolid','input[name="fid"]','input[name="schoolid"]'].some(selector=>{const value=document.querySelector(selector)?.value;return typeof value==='string'&&/^\d{1,16}$/.test(value)&&Number(value)>0;}),undefined,{timeout:5000});
  value=await schoolId(page);
 }
 if(value&&/^\d{1,16}$/.test(attribute)&&value!==attribute)throw Object.assign(new Error('学校编号未能确认'),{code:'SCHOOL_NOT_FOUND'});
 return value||(/^\d{1,16}$/.test(attribute)&&Number(attribute)>0?attribute:'');
}
async function gotoLogin(page, login, navigationTimeoutMs) {
 const go=url=>page.goto(url,{waitUntil:'domcontentloaded',timeout:navigationTimeoutMs});
 if(login.platform==='chaoxing')return go('http://i.chaoxing.com/');
 if(login.platform==='zhihuishu'){
  await go('https://www.zhihuishu.com/');
  const entry=page.locator('#notLogin');
  if(await entry.isVisible())await entry.click();
  else if(await page.locator('#login').isVisible())await page.locator('#login').click();
  else{
   const href=await page.locator('a[href*="login.zhihuishu.com"]').first().getAttribute('href');
   const url=new URL(href,'https://www.zhihuishu.com/');
   if(url.hostname!=='login.zhihuishu.com'||url.protocol!=='https:')throw new Error('登录入口未能确认');
   await go(url.href);
  }
  await page.locator('#qSignin,#qStudentID,input[name="mobile"],[role="tab"]').first().waitFor({state:'visible'});return;
 }
 if(login.platform==='zjy')return go('https://zjy2.icve.com.cn/study/index');
 return go('https://sso.icve.com.cn/sso/auth?mode=simple&source=2&redirect=https://mooc.icve.com.cn/cms/');
}
async function fillLogin(page, login, options = {}) {
 let school='';
 if(login.kind==='cx-phone'){
  await page.locator('#phone').fill(login.username);await page.locator('#pwd').fill(login.password);
 }else if(login.kind==='cx-unit'){
  school=await selectCXSchool(page,login.unit);
  await page.locator('#uname').fill(login.username);await page.locator('#password').fill(login.password);
 }else if(login.kind==='zhs-phone'){
  if(await page.locator('#qSignin').isVisible()){
   await page.locator('#qSignin').click();
   await page.locator('#lUsername').fill(login.username);await page.locator('#lPassword').fill(login.password);
  }else{
   await page.getByRole('tab',{name:'账号登录',exact:true}).click();
   await page.locator('input[name="mobile"]').fill(login.username);
   await page.locator('input[type="password"]:visible').fill(login.password);
  }
 }else if(login.kind==='zhs-unit'){
  if(await page.locator('#qStudentID').isVisible()){
  await page.locator('#qStudentID').click();
  await page.evaluate(()=>{if(typeof window.userindex?.closeStuCodeFirstLoginTip==='function')window.userindex.closeStuCodeFirstLoginTip();});
  const input=page.locator('#quickSearch');await input.fill('');await input.type(login.unit,{delay:20});
  await page.evaluate(()=>{if(typeof window.userindex?.selectSchoolByName==='function')window.userindex.selectSchoolByName();});
  const school=await exactSchoolChoice(page,'#schoolListCode li',login.unit);
  await school.click();await page.locator('#clCode').fill(login.username);await page.locator('#clPassword').fill(login.password);
  }else{
   await page.getByRole('tab',{name:'学号登录',exact:true}).click();
   const input=page.locator('.school input[role="combobox"]');await input.fill('');await input.type(login.unit,{delay:20});
   const school=await exactSchoolChoice(page,'.el-select-dropdown__item',login.unit);
   await school.click();await page.locator('input[name="unid"]').fill(login.username);
   await page.locator('input[type="password"]:visible').fill(login.password);
  }
 }else{
  if(login.kind==='zjy'&&!(await page.locator('[placeholder="请输入账号"]').isVisible()))await page.getByText('账号密码登录',{exact:true}).click();
  await page.locator('[placeholder="请输入账号"]').fill(login.username);
  await page.locator('[placeholder="请输入密码"]').fill(login.password);
  if(options.acceptAgreements!==false){
  const agreed=page.locator('.agreement input[type="checkbox"]');
  if(await agreed.count()){if(!(await agreed.first().isChecked()))await page.locator('.agreement label.el-checkbox').first().click();}
  else await page.locator(login.kind==='zjy'?'.agreement .el-checkbox__input':'.agreement label.el-checkbox').click();
  }
 }
 if(login.platform==='zhihuishu'&&options.acceptAgreements!==false){
  const privacy=page.locator('.privacy-checkbox input[type="checkbox"]');
  if(await privacy.count()&&!(await privacy.first().isChecked())){
   const box=page.locator('.privacy-checkbox .el-checkbox__input');
   await (await box.count()?box.first():page.locator('.privacy-checkbox').first()).click();
  }
 }
 return school;
}
async function submitLogin(page, login) {
 const selector=login.platform==='chaoxing'?'#loginBtn':login.platform==='zhihuishu'?(await page.locator('.wall-sub-btn:visible').isVisible()?'.wall-sub-btn:visible':'.btn-block__grandient_login'):(await page.locator('form .login:visible').isVisible()?'form .login:visible':'.ri .login:visible');
 // Exactly one click. Captcha handling never submits a second time.
 await page.locator(selector).first().click();
}
function networkError(error) {
 return /net::|ERR_(?:CONNECTION|NAME|INTERNET|NETWORK|PROXY|TUNNEL|CERT|SSL)|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|NS_ERROR|Navigation.*timed out|page\.goto: Timeout/i.test(String(error?.message||''));
}
function safeFailure(error, cancelled=false) {
 if(cancelled||error?.code==='VERIFIER_DISPOSED')return result('unverified','登录验证已取消，未更改账号配置。');
 if(error?.code==='VERIFIER_BUSY')return result('unverified','已有登录验证正在进行，请稍后重试。');
 if(error?.code==='SCHOOL_NOT_FOUND')return result('unverified','未找到唯一匹配的学校/单位，请检查登录配置中的名称。');
 if(networkError(error))return result('network-error','无法连接登录网站，请检查网络后重试。');
 if(error?.code==='VERIFY_TIMEOUT')return result('unverified','登录验证超时，暂时无法判断账号密码。请在浏览器中检查。');
 return {...WAITING};
}
async function shown(locator){try{return await locator.isVisible();}catch{return false;}}
function createLoginVerifier({chromium,executablePath,timeoutMs=45000,navigationTimeoutMs=15000,manualTimeoutMs=300000,pollMs=250,maxConcurrent=2,sessionFactory,manualRunner,ocrEnabled,ocrApiUrl}={}) {
 const API=require('./login-api.cjs'),jobs=new Set(),schoolCache=new Map();let disposed=false,moocBusy=false;
 sessionFactory??=API.createHttpSession;
 async function manual(job,login,http){
  if(manualRunner)return manualRunner({login,session:http,signal:job.abort.signal});
  if(!chromium?.launch||!executablePath)return result('challenge','网站要求本人验证，当前缺少验证窗口组件，请修复安装后重试。');
  const browser=await chromium.launch({executablePath,headless:false,timeout:15000,args:['--no-proxy-server','--no-first-run','--disable-component-update'],env:directEnvironment()});job.browser=browser;
  if(disposed||job.abort.signal.aborted){await browser.close();return result('unverified','登录验证已取消。');}
  const context=await browser.newContext({acceptDownloads:false,locale:'zh-CN',viewport:{width:1280,height:800}});
  await context.addCookies(http.cookies?.()||[]);
  let authenticated=null,wrongIdentity=false,closed=false;
  context.on('close',()=>{closed=true;});
  context.on('response',async response=>{
   try{
    const url=response.url(),address=API.allowedUrl(login.platform,url),paths=login.platform==='chaoxing'?['/fanyalogin','/unitlogin']:login.platform==='zhihuishu'?['/zhsuser/login/account','/zhsuser/login/code']:['/prod-api/data/userLogin','/prod-api/data/userLoginV2','/prod-api/v2/user/userLogin'];
    if(!paths.includes(address.pathname)||response.request().method()!=='POST')return;
    const value=await response.json();if(!API.authenticated(login,value))return;
    const submitted=response.request().postData()||'',matches=API.manualSubmission(login,url,submitted,http.schoolId||http.schoolCandidates||'');
    if(matches!==true){wrongIdentity=true;return;}
    if(login.kind.endsWith('-unit'))http.schoolId=API.readSubmission(login,url,submitted).schoolId;
    authenticated=value;
   }catch{}
  });
  const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(navigationTimeoutMs);
  try{await gotoLogin(page,login,navigationTimeoutMs);await fillLogin(page,login,{acceptAgreements:false});}catch{/* Keep the visible page available for the user to complete. */}
  if(login.platform==='zhihuishu'&&ocrApiUrl){
   try{
    if(!ocrEnabled||ocrEnabled()){
     const endpoint=typeof ocrApiUrl==='function'?ocrApiUrl():ocrApiUrl;
     const captcha=require('../ocs-lab/resources/app/lib/src/scripts/utils/zhs-captcha');
     // Wait for the user to submit the visible form; never accept an agreement in this fallback.
     void (async()=>{while(!closed&&!disposed&&!job.abort.signal.aborted&&!authenticated&&!wrongIdentity){if(await shown(page.locator('.yidun_slider'))){await captcha.loopVerify(page,{ocrApiUrl:endpoint,detTargetKey:'det_target',detBackgroundKey:'det_bg'});return;}await new Promise(resolve=>setTimeout(resolve,500));}})().catch(()=>{});
    }
   }catch{}
  }
  const end=Date.now()+manualTimeoutMs;
  while(!closed&&!disposed&&!job.abort.signal.aborted&&Date.now()<end){
   if(wrongIdentity)return result('unverified','人工登录使用的信息与当前配置不同，未将该结果记为本账号验证成功。请先修改账号配置。');
   if(authenticated){
    http.adopt?.(await context.cookies());const info=await API.enrich(login,authenticated,http);
    return result('success',info.name?'账号密码验证成功，已取得登录资料。':'账号密码验证成功；平台暂未返回姓名。',{name:info.name,info,...(http.schoolId?{schoolId:http.schoolId}:{})});
   }
   await new Promise(resolve=>setTimeout(resolve,pollMs));
  }
  return result('unverified',closed?'人工验证窗口已关闭，本次未确认当前账号密码。':'人工验证尚未完成，请重新点击“验证登录”。');
 }
 function run(login,work){
  if(disposed)return Promise.resolve(result('unverified','登录验证已取消。'));
  if(jobs.size>=Math.max(1,maxConcurrent))return Promise.resolve(result('unverified','已有登录验证正在进行，请稍后重试。'));
  const job={abort:new AbortController(),browser:null,timedOut:false};jobs.add(job);
  const http=login.platform==='icourse'?{}:sessionFactory({platform:login.platform,signal:job.abort.signal,timeoutMs:Math.min(timeoutMs,18000)});
  const timer=setTimeout(()=>{job.timedOut=true;job.abort.abort();},timeoutMs);
  job.operation=(async()=>{
   try{return await work(job,http,()=>clearTimeout(timer));}
   catch(error){
    if(disposed||job.abort.signal.aborted&&!job.timedOut)return result('unverified','登录验证已取消，未更改账号配置。');
    if(job.timedOut)return result('unverified','登录接口验证超时，请检查网络后重试。');
    if(error?.code==='SCHOOL_NOT_FOUND')return result('unverified','未找到唯一匹配的学校/单位，请检查名称。');
    if(error?.code==='LOGIN_NETWORK'||networkError(error)||/ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/.test(error?.code||''))return result('network-error','无法连接登录接口，请检查网络后重试。');
    return result('unverified','当前登录接口未能完成验证，未将此情况判定为密码错误。');
   }finally{clearTimeout(timer);job.abort.abort();await job.browser?.close().catch(()=>{});http.dispose?.();jobs.delete(job);}
  })();return job.operation;
 }
 const verify=input=>{
  let login;try{login=Profiles.normalize(input?.login||input);}catch{return Promise.resolve(result('unverified','请选择一种受支持的账号登录方式。'));}
  if(!Profiles.complete(login))return Promise.resolve(result('unverified','请先完整填写账号、密码及所需学校信息。'));
  if(login.platform==='icourse'&&moocBusy)return Promise.resolve(result('unverified','已有中国大学 MOOC 登录验证正在进行，请稍后重试。'));
  if(login.platform==='icourse')moocBusy=true;
  return run(login,async(job,http,clearDeadline)=>{
   try{
    if(login.platform==='icourse'){
     clearDeadline();
     return await require('./mooc-login.cjs').verify({chromium,executablePath,login,signal:job.abort.signal,ocrApiUrl:typeof ocrApiUrl==='function'?ocrApiUrl():ocrApiUrl,ocrEnabled:!ocrEnabled||ocrEnabled(),onBrowser:browser=>{job.browser=browser;},environment:directEnvironment(),manualTimeoutMs});
    }
    let checked;try{
     if(login.platform==='zhihuishu'&&chromium?.launch&&executablePath){
      http.schoolId=await API.resolveSchool(login,http);clearDeadline();
      const endpoint=(!ocrEnabled||ocrEnabled())?(typeof ocrApiUrl==='function'?ocrApiUrl():ocrApiUrl):undefined;
      checked=await require('./zhs-login.cjs').verify({chromium,executablePath,login,http,signal:job.abort.signal,ocrApiUrl:endpoint,onBrowser:browser=>{job.browser=browser;},environment:directEnvironment()});
      if(job.abort.signal.aborted)return result('unverified','登录验证已取消。');
      checked??=result('challenge','后台验证未能确认账号，请在验证窗口中继续。');
     }else checked=await API.verify(login,http);
    }catch(error){if(error?.code!=='SCHOOL_AMBIGUOUS')throw error;http.schoolCandidates=error.schoolIds;checked=result('challenge','存在同名学校，请在人工验证窗口选择正确学校。');}
    if(checked.state!=='challenge')return checked;
    clearDeadline();const manualTimer=setTimeout(()=>job.abort.abort(),manualTimeoutMs+20000);
    try{return await manual(job,login,http);}finally{clearTimeout(manualTimer);}
   }finally{login.password='';}
  }).finally(()=>{if(login.platform==='icourse')moocBusy=false;});
 };
 const resolveSchool=async input=>{
  const login=Profiles.normalize(input?.login||input);if(login.kind!=='cx-unit'||!login.unit)return '';
  const cached=schoolCache.get(login.unit);if(cached&&cached.until>Date.now())return cached.value;
  const checked=await run(login,async(_job,http)=>({state:'success',value:await API.resolveSchool(login,http)}));
  if(checked.state!=='success'||!checked.value)throw Object.assign(Error(checked.message||'学校编号未能确认'),{code:'SCHOOL_LOOKUP_FAILED'});
  if(schoolCache.size>=200)schoolCache.delete(schoolCache.keys().next().value);schoolCache.set(login.unit,{value:checked.value,until:Date.now()+600000});return checked.value;
 };
 return{verify,resolveSchool,async dispose(){disposed=true;for(const job of jobs){job.abort.abort();void job.browser?.close().catch(()=>{});}await Promise.allSettled([...jobs].map(job=>job.operation));schoolCache.clear();}};
}
module.exports={createLoginVerifier,trustedUrl,classifyError};
