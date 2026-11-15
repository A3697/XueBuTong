'use strict';
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),crypto=require('node:crypto');
const {archiveName}=require('./application-settings.cjs');
const ITEMS={scriptcat:{name:'脚本猫',url:'https://cdn.ocsjs.com/extensions/scriptcat-1.1.2_0.zip',group:'extensions'},ocr:{name:'OCR 识别组件',url:'https://cdn.ocsjs.com/app/download/ocr.zip',group:'apps'},ocs:{name:'OCS 网课助手脚本',url:'https://cdn.ocsjs.com/ocs.user.js'}};
function download(url,limit,{signal,onProgress=()=>{}}={},redirects=0){return new Promise((resolve,reject)=>{
 let address;try{address=new URL(url);if(address.protocol!=='https:'||address.hostname!=='cdn.ocsjs.com'||address.username||address.password||address.port)throw Error('默认组件下载地址无效');}catch(error){reject(error);return;}
 const request=https.get(address,{agent:false,signal,headers:{'User-Agent':'XueBuTong/2.5.11','Accept-Encoding':'identity'}},response=>{
  if([301,302,303,307,308].includes(response.statusCode)){response.resume();if(redirects>=3||!response.headers.location){reject(Error('默认组件重定向异常'));return;}download(new URL(response.headers.location,address).href,limit,{signal,onProgress},redirects+1).then(resolve,reject);return;}
  if(response.statusCode!==200){response.resume();reject(Error('组件下载失败（HTTP '+response.statusCode+'）'));return;}
  const total=Number(response.headers['content-length'])||0;if(total>limit){response.destroy();reject(Error('组件包超过大小限制'));return;}
  const parts=[];let received=0;
  response.on('data',part=>{received+=part.length;if(received>limit){request.destroy();reject(Error('组件包超过大小限制'));return;}parts.push(part);onProgress(received,total);});
  response.on('end',()=>resolve(Buffer.concat(parts)));response.on('aborted',()=>reject(Error('组件下载中断，请重试')));response.on('error',()=>reject(Error('组件下载中断，请重试')));
 });request.setTimeout(45000,()=>request.destroy(Error('组件下载超时，请重试')));request.on('error',()=>reject(Error(signal?.aborted?'组件准备已取消':'无法下载默认组件，请检查网络后重试')));
});}
function metadata(text){
 const header=String(text).match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)?.[1];if(!header)throw Error('下载的 OCS 脚本格式无效');
 const values=key=>[...header.matchAll(new RegExp('^//\\s*@'+key+'\\s+(.+?)\\s*$','gm'))].map(item=>item[1]);
 const info=Object.fromEntries(['name','version','description','license'].map(key=>[key,values(key)[0]||'']));info.authors=values('author').map(name=>({name,url:''}));
 if(!/^OCS\s*网课助手$/i.test(info.name)||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(info.version)||info.license!=='MIT')throw Error('下载内容不是预期的官方 OCS 脚本');return info;
}
class DefaultComponents{
 constructor({root,downloadRoot,applications,fetchBytes=download,zipFactory}){Object.assign(this,{root:path.resolve(root),downloadRoot,applications,fetchBytes,zipFactory});this.state={running:false,items:{}};}
 folder(){return path.resolve(typeof this.downloadRoot==='function'?this.downloadRoot():this.downloadRoot);}
 owned(file,base=this.folder()){
  const absolute=path.resolve(file),relative=path.relative(base,absolute);if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('默认组件路径越界');
  let current=base;for(const part of ['',...relative.split(path.sep)]){if(part)current=path.join(current,part);try{if(fs.lstatSync(current).isSymbolicLink())throw Error('默认组件目录包含链接');}catch(error){if(error.code!=='ENOENT')throw error;}}return absolute;
 }
 snapshot(){return structuredClone(this.state);}
 installed(id){
  const file=this.owned(path.join(this.folder(),ITEMS[id]?.group||'userjs',id,id==='scriptcat'?'manifest.json':'ocr.exe'));
  try{if(id==='scriptcat'){const info=JSON.parse(fs.readFileSync(file,'utf8'));return info.manifest_version===3&&!!info.version;}const fd=fs.openSync(file,'r');try{const head=Buffer.alloc(2);return fs.readSync(fd,head,0,2,0)===2&&head.toString()==='MZ';}finally{fs.closeSync(fd);}}catch{return false;}
 }
 publishZip(id,bytes){
  const base=this.folder(),spec=ITEMS[id],zip=this.zipFactory?this.zipFactory(bytes):new(require(path.join(this.root,'ocs-lab/resources/app/node_modules/adm-zip')))(bytes);
  const entries=zip.getEntries();if(!entries.length||entries.length>15000)throw Error('组件包文件数量异常');let expanded=0;const seen=new Set();
  const files=entries.map(entry=>{const name=archiveName(entry.entryName),size=Number(entry.header.size),key=name.replace(/\/$/,'').toLowerCase();if(seen.has(key)||!Number.isSafeInteger(size)||size<0||size>192*1024*1024||(expanded+=size)>512*1024*1024||((entry.header.attr>>>16)&0xf000)===0xa000)throw Error('组件包文件或大小无效');seen.add(key);return{entry,name};});
  const marker=id==='scriptcat'?'manifest.json':'ocr.exe',markers=files.filter(item=>!item.entry.isDirectory&&(item.name===marker||item.name.endsWith('/'+marker)));
  if(markers.length!==1)throw Error('组件包入口缺失或不明确');const prefix=markers[0].name.slice(0,-marker.length);
  if(id==='scriptcat'){const manifest=JSON.parse(markers[0].entry.getData().toString('utf8'));if(manifest.manifest_version!==3||!manifest.version||!/scriptcat|脚本猫/i.test(manifest.name||''))throw Error('下载的脚本猫组件无效');}
  else if(markers[0].entry.getData().subarray(0,2).toString()!=='MZ')throw Error('下载的 OCR 组件无效');
  const target=this.owned(path.join(base,spec.group,id)),stage=this.owned(path.join(base,'.default-'+id+'-'+crypto.randomBytes(8).toString('hex'))),previous=this.owned(stage+'-previous');
  fs.mkdirSync(stage,{recursive:true});let moved=false,published=false;
  try{
   for(const {entry,name}of files){if(!name.startsWith(prefix))continue;const relative=name.slice(prefix.length);if(!relative)continue;const file=this.owned(path.join(stage,relative),stage);if(entry.isDirectory)fs.mkdirSync(file,{recursive:true});else{const content=entry.getData();if(content.length!==entry.header.size)throw Error('组件包校验失败');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content,{flag:'wx'});}}
   fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){fs.renameSync(target,previous);moved=true;}fs.renameSync(stage,target);published=true;
   if(moved){this.owned(previous);fs.rmSync(previous,{recursive:true});}return target;
  }catch(error){if(published&&moved&&fs.existsSync(previous)){this.owned(target);fs.rmSync(target,{recursive:true});fs.renameSync(previous,target);}throw error;}
  finally{if(fs.existsSync(stage)){this.owned(stage);fs.rmSync(stage,{recursive:true});}}
 }
 async install(){
  if(this.pending)return this.pending;this.abort=new AbortController();this.state={running:true,items:{}};
  this.pending=(async()=>{const result={items:[],script:null};
   for(const id of ['scriptcat','ocr','ocs']){
    const spec=ITEMS[id];this.state.items[id]={name:spec.name,state:'downloading',received:0,total:0};
    try{
     if(id==='ocs'){
      result.script=require('./bundled-script.cjs').bundledScript(this.root);
      this.state.items[id]={name:spec.name,state:'ready',message:'随软件提供的脚本已就绪'};
      result.items.push({id,installed:true,existing:true});continue;
     }
     if(id!=='ocs'&&this.installed(id)){this.state.items[id]={name:spec.name,state:'ready',message:'已安装，保留现有组件'};result.items.push({id,installed:true,existing:true});continue;}
     const bytes=await this.fetchBytes(spec.url,192*1024*1024,{signal:this.abort.signal,onProgress:(received,total)=>{Object.assign(this.state.items[id],{received,total});}});
     if(this.abort.signal.aborted)throw Error('组件准备已取消');
     const hash=crypto.createHash('sha256').update(bytes).digest('hex');
     this.state.items[id].state='installing';this.publishZip(id,bytes);
     const key=spec.group+':'+id;if(this.applications.data.items[key]===undefined){const enabled=id!=='scriptcat'||!this.applications.conflicts('scriptcat').length;this.applications.set({group:spec.group,id,enabled});}
     this.state.items[id]={name:spec.name,state:'ready',message:'准备完成',sha256:hash};result.items.push({id,installed:true,sha256:hash});
    }catch(error){this.state.items[id]={name:spec.name,state:'failed',message:String(error?.message||'准备失败，请重试').slice(0,240)};result.items.push({id,installed:false});if(this.abort.signal.aborted)break;}
   }
   result.complete=result.items.length===3&&result.items.every(item=>item.installed);return result;
  })().finally(()=>{this.state.running=false;this.pending=null;});return this.pending;
 }
 async dispose(){this.abort?.abort();await this.pending?.catch(()=>{});}
}
module.exports={DefaultComponents,download,metadata,ITEMS};
