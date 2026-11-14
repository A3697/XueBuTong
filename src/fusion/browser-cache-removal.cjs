'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const uidOf=value=>{if(typeof value!=='string'||!/^[-A-Za-z0-9_]{1,80}$/.test(value)||['__proto__','constructor','prototype'].includes(value))throw Error('账号标识不合法');return value;};
class BrowserCacheRemoval{
 constructor({userData}){this.userData=path.resolve(userData);this.cacheRoot=path.join(this.userData,'userDataDirs');this.leases=new Map();}
 same(a,b){const normalize=value=>{const result=path.resolve(value);return process.platform==='win32'?result.toLowerCase():result;};return normalize(a)===normalize(b);}
 async plainParents(folder){for(let current=folder;;){const stat=await fs.promises.lstat(current);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('UNSAFE_CACHE');const parent=path.dirname(current);if(parent===current)break;current=parent;}}
 async plainTree(folder){const pending=[folder];let count=0;while(pending.length){const current=pending.pop(),stat=await fs.promises.lstat(current);if(stat.isSymbolicLink()||!stat.isDirectory()&&!stat.isFile())throw Error('UNSAFE_CACHE');if(stat.isDirectory())for(const name of await fs.promises.readdir(current))pending.push(path.join(current,name));if(++count%500===0)await new Promise(resolve=>setImmediate(resolve));}}
 async exists(file){try{await fs.promises.lstat(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
 async prepare({uid,cachePath}){
  uidOf(uid);const source=path.join(this.cacheRoot,uid);
  if(typeof cachePath!=='string'||!cachePath||!path.isAbsolute(cachePath)||cachePath.length>32767||!this.same(cachePath,source))return{state:'skipped',warning:'原缓存位置不属于本软件账号目录，已保留该缓存。'};
  try{if(!await this.exists(source))return{state:'absent'};await this.plainParents(this.cacheRoot);await this.plainTree(source);}
  catch{return{state:'skipped',warning:'缓存目录包含链接或无法确认归属，已保留该缓存。'};}
  const id=crypto.randomBytes(16).toString('hex'),staged=path.join(this.cacheRoot,'.fusion-delete-'+uid+'-'+id);
  try{await fs.promises.rename(source,staged);}catch{throw Error('浏览器缓存暂时无法隔离，账号仍保留，请稍后重试。');}
  this.leases.set(id,{uid,source,staged});return{id,state:'staged'};
 }
 lease({uid,id}){uidOf(uid);const lease=this.leases.get(id);if(!lease||lease.uid!==uid)throw Error('浏览器缓存操作已失效，请重新读取账号状态。');return lease;}
 async restore(input){const lease=this.lease(input);try{await this.plainParents(this.cacheRoot);await this.plainTree(lease.staged);if(await this.exists(lease.source))throw Error('CACHE_TARGET_EXISTS');await fs.promises.rename(lease.staged,lease.source);}catch{throw Error('账号仍保留，缓存隔离副本尚未恢复，请查看日志后重试。');}this.leases.delete(input.id);return{restored:true};}
 async finish(input){const lease=this.lease(input);try{await this.plainParents(this.cacheRoot);await this.plainTree(lease.staged);await fs.promises.rm(lease.staged,{recursive:true,force:false});this.leases.delete(input.id);return{cleaned:true};}catch{return{cleaned:false,warning:'账号已删除，部分隔离缓存尚未清理，已保留以便检查。'};}}
}
module.exports={BrowserCacheRemoval};
