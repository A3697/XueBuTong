'use strict';
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
const Adapter=require('./ocs-enhancement.cjs');
const SOURCE='https://cdn.ocsjs.com/ocs.user.js';
const managers=new Map();
const copy=value=>JSON.parse(JSON.stringify(value));
function prefs(value={}){return {enhanced:value.enhanced!==false,selected:value.selected==='latest'?'latest':'compatible',autoUpdate:value.autoUpdate!==false};}
function accountEnhancement(profile,legacy){return typeof profile?.ocsEnhancementsEnabled==='boolean'?profile.ocsEnhancementsEnabled:prefs(legacy).enhanced;}
function compare(a,b){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2));fs.renameSync(file+'.tmp',file);}
function download(url=SOURCE+'?t='+Date.now(),redirects=0){return new Promise((resolve,reject)=>{
 const address=new URL(url);if(address.protocol!=='https:'||!['cdn.ocsjs.com','ocsjs.com'].includes(address.hostname))return reject(Error('更新源不是 OCS 官方地址'));
 const request=https.get(address,{headers:{'User-Agent':'XueBuTong/2.5.12','Cache-Control':'no-cache'}},response=>{
  if(response.statusCode>=300&&response.statusCode<400){response.resume();if(redirects>=3)return reject(Error('更新重定向次数过多'));return download(new URL(response.headers.location,address).href,redirects+1).then(resolve,reject);}
  if(response.statusCode!==200){response.resume();return reject(Error('官方更新服务返回 HTTP '+response.statusCode));}
  const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024)request.destroy(Error('官方脚本超过大小限制'));else chunks.push(chunk);});response.on('end',()=>resolve(Buffer.concat(chunks)));response.on('error',reject);
 });request.setTimeout(12000,()=>request.destroy(Error('连接官方更新服务超时')));request.on('error',reject);
});}
class OcsPluginManager{
 constructor(root,{fetchBytes=download,now=Date.now}={}){this.root=path.resolve(root);this.fetchBytes=fetchBytes;this.now=now;this.dir=path.join(this.root,'bridge-data/ocs-scripts');this.file=path.join(this.dir,'state.json');this.pending=null;}
 load(){
  const bytes=fs.readFileSync(path.join(this.root,'assets/defaults/ocs.upstream.user.js')),base=Adapter.metadata(bytes);
  const manifest=JSON.parse(fs.readFileSync(path.join(this.root,'assets/defaults/ocs-script.json'),'utf8'));
  if(base.sha256!==manifest.upstreamSha256)throw Error('OCS 官方原始文件校验失败，请修复安装');
  this.saveRaw(bytes,base);
  let data;try{data=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('OCS 插件版本记录无法读取，请从备份恢复');}
  this.data=data?.schema===1?data:{schema:1,latest:base,compatible:base,previous:null,locked:false,lastCheck:0,history:[]};
  for(const field of ['latest','compatible','previous'])if(this.data[field])this.raw(this.data[field]);
  // A new application build may include a newer, verified offline baseline.
  if(compare(base.version,this.data.compatible.version)>0){this.data.previous=this.data.compatible;this.data.compatible=base;if(compare(base.version,this.data.latest.version)>0)this.data.latest=base;}
  return this.data;
 }
 save(){atomic(this.file,this.data);}
 raw(info){if(!/^[a-f0-9]{64}$/.test(info?.sha256||''))throw Error('OCS 版本记录无效');const bytes=fs.readFileSync(path.join(this.dir,info.sha256+'.upstream.user.js'));if(Adapter.hash(bytes)!==info.sha256)throw Error('OCS 版本文件校验失败');return bytes;}
 saveRaw(bytes,info){const file=path.join(this.dir,info.sha256+'.upstream.user.js');if(!fs.existsSync(file)||Adapter.hash(fs.readFileSync(file))!==info.sha256)atomic(file,bytes);}
 record(kind,message,version){this.data.history=[{time:new Date(this.now()).toISOString(),kind,message,version},...(this.data.history||[])].slice(0,80);}
 runtime(info,enhanced){const result=Adapter.compose(this.raw(info),{root:this.root,enhanced});const file=path.join(this.dir,result.runtimeSha256+'.user.js');if(!fs.existsSync(file)||Adapter.hash(fs.readFileSync(file))!==result.runtimeSha256)atomic(file,result.code);return {file,hash:result.runtimeSha256,version:info.version,enhanced,upstreamSha256:info.sha256};}
 reconcile(render){
  if(!this.data)this.load();render.setting??={};const p=prefs(render.setting.fusionOcsPlugins);render.setting.fusionOcsPlugins=p;
  const scripts=render.scripts||[],managed=scripts.find(s=>s.fusionOcsManaged)||scripts.find(s=>s.fusionBundled&&path.resolve(s.info?.code_url||s.url||'')===path.resolve(this.root,'assets/defaults/ocs.user.js'));
  if(!managed)return this.status(render);
  const selected=p.selected==='latest'?this.data.latest:this.data.compatible;
  // The global row describes the independently selected official runtime.
  // Each account gets its own immutable selection in forAccount().
  const runtime=this.runtime(selected,false);
  Object.assign(managed,{fusionOcsManaged:true,fusionBundled:true,url:runtime.file,isLocalScript:true,isInternetLinkScript:false,info:{...managed.info,name:'OCS 网课助手',version:runtime.version,code_url:runtime.file,url:SOURCE},fusionRuntime:runtime});
  if(managed.enable!==false)for(const other of scripts)if(other!==managed&&other.info?.name==='OCS 网课助手'){other.enable=false;other.fusionOcsMutuallyExcluded=true;}
  // Known managed duplicates can arise after import; custom scripts are left alone.
  render.scripts=scripts.filter(s=>s===managed||!s.fusionOcsManaged);this.save();return this.status(render);
 }
 forAccount(render,{uid,enhanced,profile}={}){
  if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(uid))throw Error('账号标识无效');
  if(enhanced!==undefined&&typeof enhanced!=='boolean')throw Error('账号增强开关格式无效');
  this.reconcile(render);const p=prefs(render.setting.fusionOcsPlugins);
  enhanced=enhanced??accountEnhancement(profile,render.setting.fusionOcsPlugins);
  const scripts=copy(render.scripts||[]),managed=scripts.find(s=>s.fusionOcsManaged);
  if(!managed||managed.enable===false)return {uid,enhanced,runtime:null,scripts};
  const selected=enhanced?this.data.compatible:p.selected==='latest'?this.data.latest:this.data.compatible;
  let runtime;
  try{runtime=this.runtime(selected,enhanced);}catch(error){
   if(!enhanced||error.code!=='OCS_ADAPTER_CONFLICT')throw error;
   const fallback=this.data.previous;if(!fallback)throw error;
   runtime=this.runtime(fallback,true);this.data.compatible=fallback;this.data.locked=true;this.data.lockReason=error.message;this.record('conflict',error.message,fallback.version);this.save();
  }
  Object.assign(managed,{url:runtime.file,info:{...managed.info,version:runtime.version,code_url:runtime.file},fusionRuntime:runtime});
  return {uid,enhanced,runtime,scripts};
 }
 status(render){if(!this.data)this.load();const p=prefs(render?.setting?.fusionOcsPlugins),script=render?.scripts?.find(s=>s.fusionOcsManaged);return {...copy(this.data),preferences:p,installed:!!script,autoInstall:script?.enable!==false,runtime:script?.fusionRuntime||null,upstreamSource:SOURCE};}
 change(render,change={}){
  if(!this.data)this.load();render.setting??={};const p=prefs(render.setting.fusionOcsPlugins);
  if(Object.hasOwn(change,'enhanced'))throw Error('请在账号设置中修改 OCS 增强开关');
  if(Object.hasOwn(change,'autoUpdate')){if(typeof change.autoUpdate!=='boolean')throw Error('插件开关格式无效');p.autoUpdate=change.autoUpdate;}
  if(Object.hasOwn(change,'selected')){if(!['latest','compatible'].includes(change.selected))throw Error('OCS 版本选择无效');p.selected=change.selected;const script=render.scripts?.find(s=>s.fusionOcsManaged);if(script)script.enable=true;}
  if(Object.hasOwn(change,'autoInstall')){if(typeof change.autoInstall!=='boolean')throw Error('自动安装开关无效');const script=render.scripts?.find(s=>s.fusionOcsManaged);if(script)script.enable=change.autoInstall;}
  if(change.resumeUpdates===true){this.data.locked=false;delete this.data.lockReason;this.data.lastCheck=0;p.autoUpdate=true;this.record('resume','用户重新允许检查官方更新',this.data.latest.version);}
  render.setting.fusionOcsPlugins=p;return this.reconcile(render);
 }
 async check(render,{automatic=false}={}){
  if(this.pending)return this.pending;
  if(!this.data)this.load();const p=prefs(render?.setting?.fusionOcsPlugins);
  if(automatic&&(!p.autoUpdate||this.data.locked||!render?.scripts?.some(s=>s.fusionOcsManaged&&s.enable!==false)||this.now()-this.data.lastCheck<24*60*60*1000))return this.status(render);
  this.pending=(async()=>{
   try{
    const bytes=await this.fetchBytes(),latest=Adapter.metadata(bytes);this.data.lastCheck=this.now();
    if(compare(latest.version,this.data.latest.version)<0){this.record('stale','官方分发节点返回较旧版本，保留现有版本',latest.version);return;}
    this.saveRaw(bytes,latest);this.data.latest=latest;
    try{
     this.runtime(latest,true);
     if(!this.data.locked&&latest.sha256!==this.data.compatible.sha256){this.data.previous=this.data.compatible;this.data.compatible=latest;this.record('updated','官方脚本更新通过增强模块校验；下次启动浏览器时应用',latest.version);}
     else this.record('checked',this.data.locked?'已保留官方版本；自动更新仍暂停':'已是官方最新可兼容版本',latest.version);
    }catch(error){
     if(error.code!=='OCS_ADAPTER_CONFLICT')throw error;
     this.data.locked=true;this.data.lockReason=error.message;this.record('conflict','保留官方新版并回退到兼容版本；已停止自动更新。'+error.message,latest.version);
    }
   }catch(error){this.data.lastCheck=this.now();this.record('network',String(error.message).slice(0,240),this.data.latest.version);}
   finally{this.save();}
  })().finally(()=>{this.pending=null;});
  await this.pending;return this.reconcile(render);
 }
 reportConflict(render,{upstreamSha256,reason}={}){
  if(!this.data)this.load();
  if(this.data.compatible.sha256!==upstreamSha256)return this.status(render);
  const fallback=this.data.previous;
  this.data.locked=true;this.data.lockReason='浏览器增强接口验证失败';
  if(fallback){this.runtime(fallback,true);this.data.compatible=fallback;}
  this.record('runtime-conflict',(fallback?'已回退兼容版本；':'当前没有更早的已验证版本；')+'自动更新已暂停。'+String(reason||'接口不兼容').slice(0,120),this.data.latest.version);
  // Roll back enhanced accounts only; an official-mode account keeps its
  // independent version choice even when another account reports a conflict.
  this.save();return this.reconcile(render);
 }
}
function manager(root){root=path.resolve(root);if(!managers.has(root))managers.set(root,new OcsPluginManager(root));return managers.get(root);}
module.exports={OcsPluginManager,manager,prefs,accountEnhancement,compare,download};
