'use strict';
const path=require('node:path'),API=require('./login-api.cjs');

// Use the existing platform login flow with the ported OCS captcha module.
// Only a matching server login response can confirm the supplied credentials.
async function verify({chromium,executablePath,login,http,signal,ocrApiUrl,onBrowser,environment,timeoutMs=180000,automation}){
 const scripts=automation||require(path.join(__dirname,'../ocs-lab/resources/app/lib/src/scripts/automation/wk/zhs'));
 const runner=login.kind==='zhs-unit'?scripts.ZHSUnitLoginScript:scripts.ZHSPhoneLoginScript;
 let browser,context,auth,invalid,wrongIdentity=false,timer,resolveAuth;
 const authenticatedResponse=new Promise(resolve=>{resolveAuth=resolve;});
 const pending=new Set(),close=()=>{void browser?.close().catch(()=>{});};
 signal?.addEventListener('abort',close,{once:true});
 try{
  if(signal?.aborted)return null;
  browser=await chromium.launch({executablePath,headless:true,args:['--no-proxy-server','--no-first-run','--disable-component-update'],env:environment,timeout:15000});onBrowser?.(browser);
  context=await browser.newContext({acceptDownloads:false,locale:'zh-CN',viewport:{width:1280,height:800}});
  await context.addCookies(http.cookies?.()||[]);
  context.on('response',response=>{
   const operation=(async()=>{
    try{
     const url=new URL(response.url()),request=response.request();
     if(url.protocol!=='https:'||url.hostname!=='user.zhihuishu.com'||request.method()!=='POST'||!['/zhsuser/login/account','/zhsuser/login/code'].includes(url.pathname))return;
     const value=await response.json(),body=request.postData()||'';
     if(API.manualSubmission(login,url.href,body,http.schoolId||http.schoolCandidates||'')!==true){wrongIdentity=true;return;}
     if(API.authenticated(login,value)){auth=value;resolveAuth();}
     else{const result=API.failure(value?.msg||value?.message);if(result.state==='invalid')invalid=result;}
    }catch{}
   })();pending.add(operation);void operation.finally(()=>pending.delete(operation));
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const configs=login.kind==='zhs-unit'?{schoolname:login.unit,id:login.username,password:login.password}:{phone:login.username,password:login.password};
  await Promise.race([authenticatedResponse,runner.run(page,configs,{ocrApiUrl,detTargetKey:'det_target',detBackgroundKey:'det_bg'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('验证码处理超时')),timeoutMs);})]);
  await Promise.allSettled([...pending]);
  if(signal?.aborted||wrongIdentity)return null;
  if(auth){http.adopt?.(await context.cookies());const info=await API.enrich(login,auth,http);return {state:'success',message:info.name?'账号密码验证成功，已取得登录资料。':'账号密码验证成功；平台暂未返回姓名。',name:info.name,info,...(http.schoolId?{schoolId:http.schoolId}:{})};}
  return invalid||null;
 }catch{return null;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',close);await browser?.close().catch(()=>{});}
}
module.exports={verify};
