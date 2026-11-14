'use strict';
const https=require('node:https'),crypto=require('node:crypto'),zlib=require('node:zlib');
const Profiles=require('./login-profiles.js');
const clean=value=>typeof value==='string'?value.replace(/[\x00-\x1f]/g,'').trim().slice(0,160):typeof value==='number'?String(value):'';
function information(value={},login={}){
 const source=value.userInfo||value.user||value,certificate=Array.isArray(source.certifyList)?source.certifyList.find(item=>!login.unit||item.schoolName===login.unit)||source.certifyList[0]:{};
 const name=clean(source.realName||source.realname||source.displayName||source.fullName||source.name||source.userName);
 return{name:name===login.username?'':name,school:clean(source.school||source.schoolName||source.schoolname||certificate?.schoolName||login.unit),studentId:clean(source.studentId||source.studentNo||certificate?.code||(/-unit$/.test(login.kind||'')?login.username:'')),userId:clean(source.userId||source.uid||source.uuid)};
}
function identity(profile){return crypto.createHash('sha256').update(Profiles.signature(profile)).digest('hex');}
function authenticated(login,value){
 if(login.platform==='chaoxing')return value?.status===true&&!value.containTwoFactorLogin&&!value.weakpwd&&(!Object.hasOwn(value,'type')||Number(value.type)===0);
 if(login.platform==='zhihuishu')return value?.status===1&&!!(value.rt?.uuid||value.rt?.cacheId);
 return value?.code===200&&!!value.data?.token&&!value.data.isWeakPwd&&!value.data.isGTOne;
}
function failure(message){
 const text=String(message||'');
 if(/验证码|滑块|人机|安全验证|本人(?:确认|验证)|二次验证|双因子|实名|绑定手机|修改密码|重置密码|captcha|validate.*(?:empty|required|invalid)/i.test(text))return{state:'challenge',message:'网站要求验证码或其他本人确认，正在打开人工验证窗口。'};
 if(/密码(?:错误|不正确|有误)|(?:账号|帐号|用户名|账户)(?:或密码)?(?:错误|不存在|不正确|不匹配)|账号或密码不正确|用户名或密码不匹配|学号.*不存在|wrong password|invalid credentials/i.test(text))return{state:'invalid',message:'网站提示账号或密码不正确，请检查后重试。'};
 if(/频繁|锁定|冻结|禁用|封禁|限制|次数|稍后/.test(text))return{state:'unverified',message:'网站暂时限制登录，请稍后再试或在浏览器检查。'};
 return{state:'unverified',message:'登录接口未完成验证，暂时无法判断账号密码。'};
}
function allowedUrl(platform,value){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Object.assign(Error('登录地址无效'),{code:'LOGIN_PROTOCOL'});
 const host=url.hostname.toLowerCase(),valid=platform==='chaoxing'?/(?:^|\.)chaoxing\.com$/.test(host):platform==='zhihuishu'?/(?:^|\.)zhihuishu\.com$/.test(host):['sso.icve.com.cn','zjy2.icve.com.cn','mooc.icve.com.cn','user.icve.com.cn'].includes(host);
 if(!valid)throw Object.assign(Error('登录地址不属于当前平台'),{code:'LOGIN_PROTOCOL'});return url;
}
function createHttpSession({platform,signal,timeoutMs=18000}={}){
 const cookies=new Map();
 function adopt(values){for(const item of values||[]){if(!item||typeof item.name!=='string'||typeof item.value!=='string')continue;const domain=String(item.domain||'').replace(/^\./,'').toLowerCase();try{allowedUrl(platform,'https://'+domain);}catch{continue;}cookies.set(domain+'\n'+(item.path||'/')+'\n'+item.name,{...item,domain,path:item.path||'/',hostOnly:!String(item.domain).startsWith('.')});}}
 function absorb(url,headers){
  for(const line of headers||[]){const [pair,...fields]=line.split(';'),index=pair.indexOf('=');if(index<1)continue;const cookie={name:pair.slice(0,index).trim(),value:pair.slice(index+1).trim(),domain:url.hostname,path:'/',hostOnly:true,secure:false};let remove=false;
   for(const field of fields){const index=field.indexOf('='),key=(index<0?field:field.slice(0,index)).trim().toLowerCase(),value=index<0?'':field.slice(index+1).trim();if(key==='domain'){cookie.domain=value.replace(/^\./,'').toLowerCase();cookie.hostOnly=false;}else if(key==='path')cookie.path=value.startsWith('/')?value:'/';else if(key==='secure')cookie.secure=true;else if(key==='max-age'&&Number(value)<=0)remove=true;else if(key==='expires'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<Date.now())remove=true;}
   if(url.hostname!==cookie.domain&&!url.hostname.endsWith('.'+cookie.domain))continue;try{allowedUrl(platform,'https://'+cookie.domain);}catch{continue;}
   const key=cookie.domain+'\n'+cookie.path+'\n'+cookie.name;if(remove)cookies.delete(key);else cookies.set(key,cookie);
  }
 }
 async function request(value,options={},redirects=0){
  const url=allowedUrl(platform,value),method=options.method||'GET';let body;
  const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36','Accept-Encoding':'identity',Accept:'application/json,text/html;q=0.9,*/*;q=0.8',...options.headers};
  if(options.form){body=new URLSearchParams(options.form).toString();headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';}else if(Object.hasOwn(options,'json')){body=JSON.stringify(options.json);headers['Content-Type']='application/json;charset=UTF-8';}
  const jar=[...cookies.values()].filter(cookie=>(cookie.hostOnly?url.hostname===cookie.domain:url.hostname===cookie.domain||url.hostname.endsWith('.'+cookie.domain))&&(url.pathname===cookie.path||url.pathname.startsWith(cookie.path.endsWith('/')?cookie.path:cookie.path+'/'))).map(cookie=>cookie.name+'='+cookie.value).join('; ');if(jar)headers.Cookie=jar;
  if(body!==undefined)headers['Content-Length']=Buffer.byteLength(body);
  const response=await new Promise((resolve,reject)=>{
   const req=https.request(url,{method,headers,agent:false,signal},res=>{
    absorb(url,res.headers['set-cookie']);let size=0;const chunks=[];
    res.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){req.destroy();reject(Object.assign(Error('登录响应格式异常'),{code:'LOGIN_PROTOCOL'}));}else chunks.push(chunk);});
    res.on('end',()=>{try{let bytes=Buffer.concat(chunks),encoding=res.headers['content-encoding'];if(encoding==='gzip')bytes=zlib.gunzipSync(bytes,{maxOutputLength:8*1024*1024});else if(encoding==='deflate')bytes=zlib.inflateSync(bytes,{maxOutputLength:8*1024*1024});else if(encoding==='br')bytes=zlib.brotliDecompressSync(bytes,{maxOutputLength:8*1024*1024});resolve({status:res.statusCode,headers:res.headers,text:bytes.toString('utf8'),url:url.href});}catch{reject(Object.assign(Error('登录响应格式异常'),{code:'LOGIN_PROTOCOL'}));}});res.on('error',reject);res.on('aborted',()=>reject(Object.assign(Error('登录连接中断'),{code:'ECONNRESET'})));
   });req.setTimeout(timeoutMs,()=>req.destroy(Object.assign(Error('登录请求超时'),{code:'ETIMEDOUT'})));req.on('error',reject);if(body!==undefined)req.write(body);req.end();
  });
  if(response.status>=300&&response.status<400&&response.headers.location){if(method!=='GET'||redirects>=5)throw Object.assign(Error('登录接口重定向未确认'),{code:'LOGIN_PROTOCOL'});const next=new URL(response.headers.location,url);if(next.protocol==='http:')next.protocol='https:';return request(next.href,options,redirects+1);}
  if(response.status===429||response.status>=500)throw Object.assign(Error('登录服务暂不可用'),{code:'LOGIN_NETWORK'});
  return response;
 }
 return{request,adopt,cookies:()=>[...cookies.values()].map(item=>({name:item.name,value:item.value,domain:(item.hostOnly?'':'.')+item.domain,path:item.path,secure:!!item.secure,httpOnly:true,expires:-1})),dispose(){cookies.clear();}};
}
const json=response=>{try{return JSON.parse(response.text.replace(/^\uFEFF/,''));}catch{throw Object.assign(Error('登录接口响应格式已变化'),{code:'LOGIN_PROTOCOL'});}};
const aes=(text,key,iv=key)=>{const cipher=crypto.createCipheriv('aes-128-cbc',Buffer.from(key),Buffer.from(iv));return Buffer.concat([cipher.update(text,'utf8'),cipher.final()]).toString('base64');};
const decode=value=>String(value||'').replace(/&(?:amp|lt|gt|quot|apos|#39|#x[\da-f]+|#\d+);/gi,item=>{const key=item.slice(1,-1);return{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'"}[key]||(key.startsWith('#x')?String.fromCodePoint(parseInt(key.slice(2),16)):key.startsWith('#')?String.fromCodePoint(Number(key.slice(1))):item);});
function hidden(html,id){for(const input of String(html).match(/<input\b[^>]*>/gi)||[]){const attrs={};for(const match of input.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[match[1].toLowerCase()]=decode(match[2]??match[3]??match[4]);if(attrs.id===id||attrs.name===id)return attrs.value||'';}return '';}
function htmlName(html){for(const pattern of [/<[^>]+id=["']userName["'][^>]*>([\s\S]*?)<\//i,/<[^>]+class=["'][^"']*personalName[^"']*["'][^>]*>([\s\S]*?)<\//i]){const value=clean(decode(String(html).match(pattern)?.[1]?.replace(/<[^>]+>/g,'')));if(value&&value.length<=80)return value;}return '';}
function exactSchool(items,unit,idKey){const key=String(unit).replace(/\s+/g,'');const matches=(Array.isArray(items)?items:[]).filter(item=>String(item.name||item.schoolName||'').replace(/\s+/g,'')===key&&/^\d{1,16}$/.test(String(item[idKey])));if(matches.length>1)throw Object.assign(Error('存在同名学校，请本人选择'),{code:'SCHOOL_AMBIGUOUS',schoolIds:matches.map(item=>String(item[idKey]))});if(matches.length!==1)throw Object.assign(Error('未找到唯一匹配的学校'),{code:'SCHOOL_NOT_FOUND'});return String(matches[0][idKey]);}
async function resolveSchool(login,session){
 if(login.kind==='cx-unit'){
  if(/^\d{1,16}$/.test(login.unit)&&Number(login.unit)>0)return login.unit;
  const value=json(await session.request('https://passport2.chaoxing.com/org/searchUnis?'+new URLSearchParams({filter:login.unit,product:'44',type:''})));return exactSchool(value.froms,login.unit,'schoolid');
 }
 if(login.kind==='zhs-unit'){
  if(/^\d{1,16}$/.test(login.unit)&&Number(login.unit)>0)return login.unit;
  const value=json(await session.request('https://user.zhihuishu.com/zhsuser/certify/getAllSchool',{method:'POST',headers:{Origin:'https://login.zhihuishu.com','Content-Type':'application/x-www-form-urlencoded'}}));return exactSchool(value.listSchool,login.unit,'schoolId');
 }return '';
}
async function enrich(login,auth,session){
 let info=information(auth.rt||auth.data||auth,login);
 try{
  if(login.platform==='chaoxing'){
   if(auth.url){let target;try{target=new URL(decodeURIComponent(auth.url),'https://passport2.chaoxing.com');}catch{}if(target){if(target.protocol==='http:')target.protocol='https:';await session.request(allowedUrl(login.platform,target.href).href);}}
   const page=await session.request('https://i.chaoxing.com/base');const name=htmlName(page.text);if(name)info.name=name;
  }else if(login.platform==='zhihuishu'){
   const id=auth.rt?.cacheId||auth.rt?.uuid;if(id&&/^[A-Za-z0-9_-]{1,160}$/.test(String(id))){const endpoint=auth.rt?.cacheId?'user/cache/':'accountV2/getUserInfo/';const body=json(await session.request('https://user.zhihuishu.com/zhsuser/'+endpoint+encodeURIComponent(id)));if(body.status===200&&body.rt)info={...info,...Object.fromEntries(Object.entries(information(body.rt,login)).filter(([,value])=>value))};}
  }else if(auth.data?.token){
   const body=json(await session.request('https://sso.icve.com.cn/prod-api/user/userInfo?token='+encodeURIComponent(auth.data.token),{method:'POST'}));if(body.code===200&&body.data)info={...info,...Object.fromEntries(Object.entries(information(body.data,login)).filter(([,value])=>value))};
  }
 }catch{ /* A successful password check remains valid if optional profile retrieval fails. */ }
 return info;
}
async function verify(login,session){
 if(login.platform==='chaoxing'){
  const response=await session.request('https://passport2.chaoxing.com/login'),html=response.text;
  if(login.kind==='cx-phone'&&hidden(html,'needVcode')==='1')return failure('需要验证码');
  const schoolId=await resolveSchool(login,session),transfer=hidden(html,'t')==='true',key='u2oh6Vu^HWe4_AES';session.schoolId=schoolId;
  const payload=Object.fromEntries(['pid','refer','t','hidecompletephone','doubleFactorLogin','forbidotherlogin','independentId','independentNameId'].map(id=>[id,hidden(html,id)]));
  Object.assign(payload,{fid:schoolId||hidden(html,'fid')||'-1',uname:transfer?aes(login.username,key):login.username,password:transfer?aes(login.password,key):login.password,validate:''});
  const body=json(await session.request('https://passport2.chaoxing.com/'+(login.kind==='cx-unit'?'unitlogin':'fanyalogin'),{method:'POST',form:payload,headers:{Origin:'https://passport2.chaoxing.com',Referer:response.url}}));
  if(body.containTwoFactorLogin||body.weakpwd||body.status===true&&!authenticated(login,body))return failure('需要本人修改密码或验证');
  if(body.status!==true)return failure(body.msg2||body.mes||body.msg);
  const info=await enrich(login,body,session);return{state:'success',message:info.name?'账号密码验证成功，已取得登录资料。':'账号密码验证成功；平台暂未返回姓名。',name:info.name,info,...(schoolId?{schoolId}:{})};
 }
 if(login.platform==='zhihuishu'){
  const schoolId=await resolveSchool(login,session),payload=login.kind==='zhs-unit'?{code:login.username,password:login.password,schoolId,validate:''}:{account:login.username,password:login.password,validate:''};session.schoolId=schoolId;
  const encrypted=aes(JSON.stringify(payload),'bdas85990328dfpl','563216db1e1744c7');
  const body=json(await session.request('https://user.zhihuishu.com/zhsuser/login/'+(login.kind==='zhs-unit'?'code':'account'),{method:'POST',json:encrypted,headers:{Origin:'https://login.zhihuishu.com',Referer:'https://login.zhihuishu.com/'}}));
  if(body.status!==1){if(/验证码|安全验证|captcha/i.test(body.msg||''))return failure('需要验证码');if(body.status===-2)return failure('账号或密码错误');if([-4,-7,-10,-11,-12,-13,-100].includes(body.status))return failure('需要本人验证');return failure(body.msg);}
  if(!body.rt||!body.rt.uuid&&!body.rt.cacheId)return{state:'unverified',message:'平台未返回可确认的登录状态，请稍后重试。'};
  const info=await enrich(login,body,session);return{state:'success',message:info.name?'账号密码验证成功，已取得登录资料。':'账号密码验证成功；平台暂未返回姓名。',name:info.name,info,...(schoolId?{schoolId}:{})};
 }
 const source=login.kind==='zjy'?'15':'2',redirect=login.kind==='zjy'?'https://zjy2.icve.com.cn/admin/pedding':'https://mooc.icve.com.cn/cms/';
 await session.request('https://sso.icve.com.cn/sso/auth?'+new URLSearchParams({mode:'simple',source,redirect}));
 const body=json(await session.request('https://sso.icve.com.cn/prod-api/data/userLoginV2',{method:'POST',json:{type:1,userName:login.username,password:login.password,webPageSource:1},headers:{Origin:'https://sso.icve.com.cn',Referer:'https://sso.icve.com.cn/sso/auth',Language:'cn',browserId:crypto.randomUUID()}}));
 if(body.code!==200||!body.data?.token)return failure(body.msg||body.message);
 if(body.data.isWeakPwd||body.data.isGTOne)return failure('需要本人验证或修改密码');
 const info=await enrich(login,body,session);return{state:'success',message:info.name?'账号密码验证成功，已取得登录资料。':'账号密码验证成功；平台暂未返回姓名。',name:info.name,info};
}
function readSubmission(login,url,body){
 try{
  const address=allowedUrl(login.platform,url);let data,username,password;
  if(login.platform==='chaoxing'&&address.hostname==='passport2.chaoxing.com'&&['/fanyalogin','/unitlogin'].includes(address.pathname)){
   if(address.pathname!==(login.kind==='cx-unit'?'/unitlogin':'/fanyalogin'))return null;
   data=Object.fromEntries(new URLSearchParams(body));username=data.uname;password=data.password;
   if(data.t==='true'){const decrypt=value=>{const cipher=crypto.createDecipheriv('aes-128-cbc',Buffer.from('u2oh6Vu^HWe4_AES'),Buffer.from('u2oh6Vu^HWe4_AES'));return Buffer.concat([cipher.update(value,'base64'),cipher.final()]).toString('utf8');};username=decrypt(username);password=decrypt(password);}
  }else if(login.platform==='zhihuishu'&&address.hostname==='user.zhihuishu.com'&&['/zhsuser/login/account','/zhsuser/login/code'].includes(address.pathname)){
   if(address.pathname!==(login.kind==='zhs-unit'?'/zhsuser/login/code':'/zhsuser/login/account'))return null;
   const encrypted=JSON.parse(body),cipher=crypto.createDecipheriv('aes-128-cbc',Buffer.from('bdas85990328dfpl'),Buffer.from('563216db1e1744c7'));data=JSON.parse(Buffer.concat([cipher.update(encrypted,'base64'),cipher.final()]).toString('utf8'));username=data.account||data.code;password=data.password;
  }else if(['icve','zjy'].includes(login.platform)&&address.hostname==='sso.icve.com.cn'&&['/prod-api/data/userLogin','/prod-api/data/userLoginV2','/prod-api/v2/user/userLogin'].includes(address.pathname)){
   data=JSON.parse(body);username=data.userName||data.username;password=data.password;
  }else return null;
  return {username:String(username||'').trim(),password,schoolId:String(data.fid||data.schoolId||'')};
 }catch{return null;}
}
function manualSubmission(login,url,body,schoolIds=''){
 const submitted=readSubmission(login,url,body);if(!submitted)return null;
 if(submitted.username!==login.username||submitted.password!==login.password)return false;
 if(login.kind.endsWith('-unit'))return(Array.isArray(schoolIds)?schoolIds:[schoolIds]).filter(Boolean).map(String).includes(submitted.schoolId);
 return true;
}
module.exports={verify,enrich,resolveSchool,createHttpSession,information,identity,authenticated,failure,allowedUrl,hidden,htmlName,aes,readSubmission,manualSubmission};
