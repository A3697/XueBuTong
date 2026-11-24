'use strict';
const http=require('node:http'),Auth=require('./soutijiang-auth.cjs');
function exchange(port,token,input){return new Promise((resolve,reject)=>{
 const data=JSON.stringify(input);const req=http.request({hostname:'127.0.0.1',port,path:'/fusion/soutijiang-session',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),'X-XueBuTong-Soutijiang':token}},res=>{
  let size=0,parts=[];res.on('data',part=>{size+=part.length;if(size>524288)req.destroy(Error('login_share_response_too_large'));else parts.push(part);});
  res.on('error',()=>reject(Error('login_share_unavailable')));
  res.on('end',()=>{if(res.statusCode!==200)return reject(Error('login_share_unavailable'));try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{reject(Error('login_share_response_invalid'));}});
 });req.setTimeout(20000,()=>req.destroy(Error('login_share_timeout')));req.on('error',()=>reject(Error('login_share_unavailable')));req.end(data);
});}
async function attach(context,{port,token,onError=()=>{}}={}){
 if(!Number.isInteger(port)||port<1||port>65535||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('搜题酱登录共享参数无效');
 let stopped=false,busy=null,revision=0,timer,warned=false,identity='',quotaWatch,lastNotice='';
 const synchronize=async()=>{
  const snapshot=await Auth.read(context),result=await exchange(port,token,{snapshot,revision});if(stopped)return;
  if(!Number.isSafeInteger(result?.revision)||result.revision<=revision||result.snapshot!==null&&!result.snapshot)throw Error('login_share_response_invalid');
  identity=Auth.identity(snapshot);
  if(result.snapshot){
   Auth.normalize(result.snapshot);
   // A scan/logout may finish while the local broker is responding.
   const current=await Auth.read(context);if(stopped)return;
   identity=Auth.identity(current);
   if(Auth.loginDigest(current)===Auth.loginDigest(snapshot)){await Auth.apply(context,result.snapshot);identity=Auth.identity(result.snapshot);}
  }
  revision=result.revision;warned=false;
 };
 const sync=()=>{
  if(stopped)return Promise.resolve();if(busy)return busy;
  busy=synchronize().finally(()=>{busy=null;});return busy;
 };
 const onQuota=async quota=>{
  while(busy&&!stopped)await busy.catch(()=>{});
  if(stopped||identity!==quota.identity)return;
  busy=(async()=>{
   const snapshot=await Auth.read(context);if(stopped||Auth.identity(snapshot)!==quota.identity)return;
   const result=await exchange(port,token,{action:'quota',quota,revision});if(stopped)return;
   if(result.rotated){await synchronize();lastNotice='';}
   if(result.message&&result.message!==lastNotice){lastNotice=result.message;onError(result.message);}
  })().finally(()=>{busy=null;});return busy;
 };
 const poll=()=>{if(stopped)return;void sync().catch(()=>{if(!warned){warned=true;onError('搜题酱登录同步暂时不可用，请在题库配置中检查登录状态。');}}).finally(()=>{if(!stopped){timer=setTimeout(poll,4000);timer.unref?.();}});};
 const closed=()=>{stopped=true;clearTimeout(timer);quotaWatch?.dispose();};context.once('close',closed);
 try{await sync();}catch(error){closed();context.off('close',closed);throw Error('搜题酱登录共享未完成，请检查题库配置后重试；已保留原登录。');}
 timer=setTimeout(poll,4000);timer.unref?.();
 quotaWatch=require('./soutijiang-browser-quota.cjs').watch(context,{identity:()=>identity,onQuota});
 return {sync,async dispose(){clearTimeout(timer);if(!stopped)await sync().catch(()=>{});closed();context.off('close',closed);}};
}
module.exports={attach,exchange};
