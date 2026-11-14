'use strict';
const path=require('node:path');

// A dismissed login dialog alone is not evidence of a successful login.
// Require an authenticated account link in the loaded navigation instead.
async function state(page){
 let address;try{address=new URL(page.url());}catch{return {authenticated:false};}
 if(address.protocol!=='https:'||address.hostname!=='www.icourse163.org')return {authenticated:false};
 return page.evaluate(()=>{
  const visible=el=>!!el?.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
  const navigation=document.querySelector('.web-nav-container');
  const login=[...document.querySelectorAll('.navLoginBtn')].some(visible);
  const account=navigation&&[...navigation.querySelectorAll('a[href]')].find(el=>visible(el)&&(/\/(?:u|user)\/\d+(?:[/?#]|$)/.test(el.getAttribute('href')||'')||/\/home\.htm\?[^#]*userId=\d+/.test(el.getAttribute('href')||'')));
  // MOOC navigation displays a nickname, not a verified real name.
  return {authenticated:visible(navigation)&&!login&&!!account,name:''};
 });
}
async function verify({chromium,executablePath,login,signal,ocrApiUrl,ocrEnabled=true,onBrowser,timeoutMs=180000,manualTimeoutMs=300000,environment,automation}){
 const runner=automation||require(path.join(__dirname,'../ocs-lab/resources/app/lib/src/scripts/automation/wk/icourse')).ICourseLoginScript;
 const errors=[];let browser,context,page;
 const error=value=>errors.push(String(value?.message||value));
 runner.on('script-error',error);
 const cancelled=()=>signal?.aborted;
 const close=()=>{void browser?.close().catch(()=>{});};
 signal?.addEventListener('abort',close,{once:true});
 const launch=async(headless,storageState)=>{
  browser=await chromium.launch({executablePath,headless,args:['--no-proxy-server','--no-first-run','--disable-component-update'],env:environment,timeout:15000});onBrowser?.(browser);
  context=await browser.newContext({acceptDownloads:false,locale:'zh-CN',viewport:{width:1280,height:800},...(storageState?{storageState}:{})});
  page=await context.newPage();page.setDefaultTimeout(6000);
 };
 try{
  if(cancelled())return {state:'unverified',message:'登录验证已取消。'};
  await launch(true);
  let timer;try{
   await Promise.race([runner.run(page,{username:login.username,password:login.password},{...(ocrEnabled&&ocrApiUrl?{ocrApiUrl,detTargetKey:'det_target',detBackgroundKey:'det_bg'}:{})}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('验证超时')),timeoutMs);})]);
  }finally{clearTimeout(timer);}
  if(cancelled())return {state:'unverified',message:'登录验证已取消。'};
  const checked=await state(page);
  if(checked.authenticated)return {state:'success',message:'账号密码验证成功；平台暂未返回姓名。',name:checked.name,info:{name:checked.name}};
  if(errors.some(text=>/密码(?:错误|不正确)|帐号或密码错误|账号或密码错误|账号不存在|账号未及时激活/.test(text)))return {state:'invalid',message:'平台提示账号、密码或账号激活状态有误，请检查后重试。'};
  // Only expose a manual window when an actual interactive verification is present.
  const challenge=(await Promise.all(page.frames().map(frame=>frame.locator('.yidun_slider,.cap-box iframe,.yidun_popup').count().catch(()=>0)))).some(Boolean);
  if(!challenge)return {state:'unverified',message:'未能取得中国大学 MOOC 的已登录资料，请启动浏览器检查平台提示后重试。'};
  const saved=await context.storageState();await browser.close();await launch(false,saved);
  const job=runner.run(page,{username:login.username,password:login.password},{ocrManual:true,onManualCaptcha:()=>{}}).catch(()=>{});
  const end=Date.now()+manualTimeoutMs;
  while(!cancelled()&&Date.now()<end&&browser.isConnected()){
   const current=await state(page).catch(()=>({authenticated:false}));
   if(current.authenticated)return {state:'success',message:'人工验证完成，账号密码验证成功。',name:current.name,info:{name:current.name}};
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  await browser.close().catch(()=>{});await job;
  return {state:'unverified',message:'人工验证尚未完成，请重新点击“验证登录”。'};
 }finally{runner.removeListener('script-error',error);signal?.removeEventListener('abort',close);await browser?.close().catch(()=>{});}
}
module.exports={verify,state};
