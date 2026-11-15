'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const PUBLIC_PAGE='https://cdn.daxuesoutijiang.com/pc',STORE_ID='egfkhocobmgeafdbjbphhfdfbmlobgdc';
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
const manager=id=>String(id).match(/^(scriptcat|tampermonkey)(?:[-_].*)?$/i)?.[1].toLowerCase()||'';
const clone=value=>JSON.parse(JSON.stringify(value));
function officialAddress(value){
 const address=new URL(value);
 if(address.protocol!=='https:'||address.username||address.password||(address.port&&address.port!=='443')||!/(^|\.)daxuesoutijiang\.com$/.test(address.hostname))throw Error('下载地址不属于官方来源');
 return address;
}
function getBytes(url,limit,redirects=0){return new Promise((resolve,reject)=>{
 let address;try{address=officialAddress(url);}catch(error){reject(error);return;}
 const request=https.get(address,{agent:false,headers:{'User-Agent':'XueBuTong/2.5.11','Accept-Encoding':'identity'}},response=>{
  if([301,302,303,307,308].includes(response.statusCode)){
   response.resume();if(redirects>=3||!response.headers.location){reject(Error('官方下载重定向异常'));return;}
   let next;try{next=new URL(response.headers.location,address);}catch(_){reject(Error('官方下载地址无效'));return;}
   getBytes(next,limit,redirects+1).then(resolve,reject);return;
  }
  if(response.statusCode!==200){response.resume();reject(Error('官方服务暂不可用（HTTP '+response.statusCode+'）'));return;}
  if(Number(response.headers['content-length'])>limit){response.destroy();reject(Error('下载内容超过允许大小'));return;}
  const parts=[];let size=0;
  response.on('data',part=>{size+=part.length;if(size>limit){response.destroy();request.destroy();reject(Error('下载内容超过允许大小'));}else parts.push(part);});
  response.on('end',()=>resolve(Buffer.concat(parts)));response.on('aborted',()=>reject(Error('下载连接中断')));response.on('error',()=>reject(Error('下载连接中断')));
 });request.setTimeout(30000,()=>request.destroy(Error('官方下载超时')));request.on('error',()=>reject(Error('无法连接官方下载服务')));
});}
function parseOfficialZip(html){
 const text=String(html).replace(/\\u002f/gi,'/').replace(/\\\//g,'/');
 const links=[...new Set(text.match(/https:\/\/cdn(?:-img)?\.daxuesoutijiang\.com\/attachfile\/[A-Za-z0-9_-]+\.zip(?:\?[^\s"'<>\\]*)?/g)||[])];
 if(links.length!==1)throw Error(links.length?'官方页面扩展包地址不明确，请稍后重试':'官方页面未提供可用的扩展包，请稍后重试');
 return officialAddress(links[0]).href;
}
function archiveName(value){
 const name=String(value).replace(/\\/g,'/');
 if(!name||name.startsWith('/')||/[\x00-\x1f<>:"|?*]/.test(name))throw Error('扩展包包含不安全路径');
 const parts=name.replace(/\/$/,'').split('/');
 if(parts.some(part=>!part||part==='.'||part==='..'||/[. ]$/.test(part)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)))throw Error('扩展包包含不安全路径');
 return name;
}
class ApplicationSettings{
 constructor(root,{fetchBytes=getBytes,clock=Date.now,zipFactory}={}){
  this.root=path.resolve(root);this.file=path.join(this.root,'bridge-data/application-settings.json');this.extensions=path.join(this.root,'ocs-profile/downloads/extensions');
  this.fetchBytes=fetchBytes;this.clock=clock;this.zipFactory=zipFactory;this.pendingTickets=new Map();this.assertPath(this.file);
  try{this.data=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{schema:1,items:{}};}catch(_){throw Error('应用启用配置无法读取，请保留原文件后检查');}
  if(this.data.schema!==1||!this.data.items||typeof this.data.items!=='object'||Array.isArray(this.data.items)||Object.entries(this.data.items).some(([key,value])=>!/^([A-Za-z0-9][A-Za-z0-9_-]{0,79}):([A-Za-z0-9][A-Za-z0-9_-]{0,79})$/.test(key)||typeof value!=='boolean'))throw Error('应用启用配置格式无效');
 }
 assertPath(target){
  const absolute=path.resolve(target),relative=path.relative(this.root,absolute);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('应用目录越界');
  let current=this.root;
  for(const part of ['',...relative.split(path.sep)]){
   if(part)current=path.join(current,part);
   try{if(fs.lstatSync(current).isSymbolicLink())throw Error('应用目录包含链接，请检查路径');}catch(error){if(error.code!=='ENOENT')throw error;}
  }return absolute;
 }
 assertDirectory(directory){const absolute=this.assertPath(directory),relative=path.relative(this.extensions,absolute);if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('扩展目录越界');return absolute;}
 persist(next=this.data){
  this.assertPath(this.file);fs.mkdirSync(path.dirname(this.file),{recursive:true});
  const temporary=this.file+'.tmp-'+crypto.randomBytes(8).toString('hex');this.assertPath(temporary);
  try{fs.writeFileSync(temporary,JSON.stringify(next,null,2),{flag:'wx'});fs.renameSync(temporary,this.file);this.data=next;}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 }
 state(){
  const target=path.join(this.extensions,'daxuesoutijiang');this.assertDirectory(target);
  let installed=false,version='';try{const manifest=JSON.parse(fs.readFileSync(path.join(target,'manifest.json'),'utf8'));installed=!!manifest.version;version=manifest.version||'';}catch(_){}
  return{schema:1,items:{...this.data.items},soutijiang:{installed,enabled:this.data.items['extensions:daxuesoutijiang']!==false,version,storeId:STORE_ID,homepage:PUBLIC_PAGE}};
 }
 conflicts(id){
  const type=manager(id);if(!type)return[];
  const candidates=new Set(Object.keys(this.data.items).filter(key=>key.startsWith('extensions:')&&this.data.items[key]===true).map(key=>key.slice(11)));
  this.assertPath(this.extensions);
  if(fs.existsSync(this.extensions))for(const name of fs.readdirSync(this.extensions)){
   if(!valid(name)||!manager(name))continue;const directory=this.assertDirectory(path.join(this.extensions,name));
   if(fs.existsSync(path.join(directory,'manifest.json')))candidates.add(name);
  }
  return [...candidates].filter(name=>manager(name)&&manager(name)!==type&&this.data.items['extensions:'+name]!==false).sort();
 }
 set(input={}){
  const {group,id,enabled,ticket:providedTicket,installing=false}=input;
  if(!valid(group)||!valid(id)||typeof enabled!=='boolean'||typeof installing!=='boolean')throw Error('应用开关参数无效');
  const key=group+':'+id,now=this.clock();let ticket=providedTicket;
  for(const [nonce,pending]of this.pendingTickets)if(now-pending.created>120000)this.pendingTickets.delete(nonce);
  const conflicts=enabled&&group==='extensions'&&this.data.items[key]!==true?this.conflicts(id):[];
  if(conflicts.length){
   let pending=typeof ticket==='string'&&this.pendingTickets.get(ticket);
   if(pending&&(pending.key!==key||pending.conflicts!==JSON.stringify(conflicts))){this.pendingTickets.delete(ticket);pending=null;}
   if(!pending){ticket=crypto.randomBytes(16).toString('hex');pending={key,created:now,conflicts:JSON.stringify(conflicts)};this.pendingTickets.set(ticket,pending);}
   const remaining=Math.max(0,3000-(now-pending.created));
   if(remaining||!providedTicket){
    if(installing&&this.data.items[key]!==false){const next=clone(this.data);next.items[key]=false;this.persist(next);}
    return{requiresConfirmation:true,ticket,waitMs:remaining||3000,conflicts};
   }
   this.pendingTickets.delete(ticket);
  }
  const next=clone(this.data);next.items[key]=enabled;this.persist(next);return{enabled,group,id};
 }
 safeRemove(directory){this.assertDirectory(directory);fs.rmSync(directory,{recursive:true,force:true});}
 async installSoutijiang(){
  if(this.installing)return this.installing;
  this.installing=(async()=>{
   const html=await this.fetchBytes(PUBLIC_PAGE,2*1024*1024),url=parseOfficialZip(html.toString('utf8')),bytes=await this.fetchBytes(url,48*1024*1024);
   const archive=this.zipFactory?this.zipFactory(bytes):new(require(path.join(this.root,'ocs-lab/resources/app/node_modules/adm-zip')))(bytes),entries=archive.getEntries();let declared=0;const seen=new Map();
   if(!entries.length||entries.length>10000)throw Error('扩展包文件数量异常');
   const normalized=entries.map(entry=>{
    const name=archiveName(entry.entryName),key=name.replace(/\/$/,'').toLowerCase(),size=Number(entry.header.size);
    if(!Number.isSafeInteger(size)||size<0||size>32*1024*1024||(declared+=size)>128*1024*1024||((entry.header.attr>>>16)&0xf000)===0xa000)throw Error('扩展包大小或文件类型异常');
    if(seen.has(key))throw Error('扩展包存在重名文件');seen.set(key,!!entry.isDirectory);return{entry,name,key};
   });
   for(const item of normalized){const parts=item.key.split('/');for(let i=1;i<parts.length;i++)if(seen.get(parts.slice(0,i).join('/'))===false)throw Error('扩展包文件路径冲突');}
   const manifests=normalized.filter(item=>!item.entry.isDirectory&&/(^|\/)manifest\.json$/i.test(item.name));
   if(manifests.length!==1)throw Error('扩展包 manifest.json 缺失或不明确');
   const manifest=JSON.parse(manifests[0].entry.getData().toString('utf8'));
   if(manifest.manifest_version!==3||!/^\d+(?:\.\d+){0,3}$/.test(manifest.version)||manifest.version.split('.').some(value=>Number(value)>65535))throw Error('扩展包版本格式不受支持');
   if(manifest.key){const key=Buffer.from(manifest.key,'base64'),id=crypto.createHash('sha256').update(key).digest('hex').slice(0,32).replace(/[0-9a-f]/g,value=>String.fromCharCode(97+parseInt(value,16)));if(!key.length||id!==STORE_ID)throw Error('官方扩展标识与预期不一致');}
   const prefix=manifests[0].name.slice(0,-'manifest.json'.length),temporary=path.join(this.extensions,'.install-'+crypto.randomBytes(8).toString('hex')),target=path.join(this.extensions,'daxuesoutijiang'),previous=path.join(this.extensions,'.previous-'+crypto.randomBytes(8).toString('hex'));
   this.assertPath(this.extensions);fs.mkdirSync(this.extensions,{recursive:true});for(const directory of[temporary,target,previous])this.assertDirectory(directory);fs.mkdirSync(temporary);
   let moved=false,published=false,committed=false,total=0;
   try{
    for(const {entry,name}of normalized){
     if(!name.startsWith(prefix))continue;const relative=name.slice(prefix.length);if(!relative)continue;const destination=this.assertDirectory(path.join(temporary,relative));
     if(entry.isDirectory)fs.mkdirSync(destination,{recursive:true});
     else{const content=entry.getData();total+=content.length;if(content.length!==entry.header.size||total>128*1024*1024)throw Error('扩展包解压大小异常');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,content,{flag:'wx'});}
    }
    if(fs.existsSync(target)){fs.renameSync(target,previous);moved=true;}fs.renameSync(temporary,target);published=true;
    const next=clone(this.data);next.items['extensions:daxuesoutijiang']=next.items['extensions:daxuesoutijiang']!==false;this.persist(next);committed=true;
    let cleanupPending=false;if(moved)try{this.safeRemove(previous);}catch(_){cleanupPending=true;}
    return{installed:true,enabled:this.data.items['extensions:daxuesoutijiang'],version:manifest.version,storeId:STORE_ID,source:PUBLIC_PAGE,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),restartRequired:true,cleanupPending};
   }catch(error){if(!committed){if(published&&fs.existsSync(target))this.safeRemove(target);if(moved&&fs.existsSync(previous))fs.renameSync(previous,target);}throw error;}
   finally{if(fs.existsSync(temporary))this.safeRemove(temporary);}
  })().finally(()=>this.installing=null);return this.installing;
 }
 removeSoutijiang(){
  if(this.installing)throw Error('扩展正在安装，请完成后再卸载');
  const target=path.join(this.extensions,'daxuesoutijiang'),previous=path.join(this.extensions,'.removed-'+crypto.randomBytes(8).toString('hex'));this.assertDirectory(target);this.assertDirectory(previous);
  const exists=fs.existsSync(target);if(exists)fs.renameSync(target,previous);
  try{const next=clone(this.data);delete next.items['extensions:daxuesoutijiang'];this.persist(next);}catch(error){if(exists)fs.renameSync(previous,target);throw error;}
  let cleanupPending=false;if(exists)try{this.safeRemove(previous);}catch(_){cleanupPending=true;}return{removed:true,restartRequired:true,cleanupPending};
 }
}
module.exports={ApplicationSettings,getBytes,valid,manager,parseOfficialZip,archiveName,PUBLIC_PAGE,STORE_ID};
