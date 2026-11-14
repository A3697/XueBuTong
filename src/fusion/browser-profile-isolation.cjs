'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='.xuebutong-browser-profile.json';
const same=(a,b)=>{a=path.resolve(a);b=path.resolve(b);return process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;};
const within=(value,root)=>same(value,root)||(()=>{const relative=path.relative(root,value);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);})();
function fail(message,file){
 const error=Error(message+' 已停止启动，原浏览器缓存未删除或迁移。请检查账号配置和缓存根目录，或恢复正确配置。'+(file?' 位置：'+file:''));
 error.code='FUSION_BROWSER_PROFILE';return error;
}
function absolute(value,label){
 if(typeof value!=='string'||!value||value.includes('\0')||!path.isAbsolute(value))throw fail(label+'无效。');
 return path.resolve(value);
}
function inspectDirectory(folder,allowMissing=false){
 for(let current=folder;;current=path.dirname(current)){
  let stat;try{stat=fs.lstatSync(current);}catch(error){if(allowMissing&&error.code==='ENOENT'){if(path.dirname(current)===current)break;continue;}throw fail('无法确认浏览器缓存目录。',current);}
  if(stat.isSymbolicLink()||!stat.isDirectory())throw fail('浏览器缓存路径包含目录联接、符号链接或非目录对象。',current);
  if(path.dirname(current)===current)break;
 }
}
function inspectTree(folder){
 const pending=[folder];
 while(pending.length){
  const current=pending.pop();
  let entries;try{entries=fs.readdirSync(current,{withFileTypes:true});}catch{throw fail('无法检查已有浏览器缓存。',current);}
  for(const entry of entries){
   const file=path.join(current,entry.name);
   if(entry.isSymbolicLink())throw fail('浏览器缓存中包含目录联接或符号链接，无法确认账号归属。',file);
   if(entry.isDirectory())pending.push(file);
   else if(!entry.isFile())throw fail('浏览器缓存中存在无法确认归属的对象。',file);
  }
 }
}
function readOwner(file){
 let stat;try{stat=fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')return null;throw fail('无法读取浏览器缓存归属标记。',file);}
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)throw fail('浏览器缓存归属标记无效。',file);
 try{const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.schema===1&&value.product==='XueBuTong'&&typeof value.uid==='string'&&typeof value.owner==='string'&&path.isAbsolute(value.owner))return value;}catch{}
 throw fail('浏览器缓存归属标记损坏或格式不受支持。',file);
}
function prepareBrowserProfile({uid,cacheRoot,profilePath,userDataRoot,protectedRoots}={}){
 if(typeof uid!=='string'||!/^[-A-Za-z0-9_]{1,80}$/.test(uid)||['__proto__','constructor','prototype'].includes(uid)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(uid))throw fail('账号标识无效。');
 const root=absolute(cacheRoot,'浏览器缓存根目录'),owner=absolute(userDataRoot,'学不通数据目录'),requested=absolute(profilePath,'账号浏览器缓存目录'),expected=path.join(root,uid);
 if(!same(requested,expected))throw fail('浏览器缓存目录与当前账号不匹配，不能复用其他账号的目录。',requested);
 const excluded=protectedRoots??(process.env.APPDATA?['OCS Desktop','ocs-desktop'].map(name=>path.join(process.env.APPDATA,name)):[]);
 if(excluded.some(value=>within(root,path.resolve(value))||within(requested,path.resolve(value))))throw fail('浏览器缓存指向原 OCS 的用户数据目录，不能共用该目录。',requested);
 inspectDirectory(root,true);inspectDirectory(owner,true);inspectDirectory(requested,true);
 // Existing normal UID directories are the pre-2.5.3 compatibility path. Do
 // not move, copy or read browser cookies while establishing their ownership.
 if(fs.existsSync(requested))inspectTree(requested);
 const marker=path.join(requested,MARKER),previous=readOwner(marker);
 const verify=value=>{if(value.uid!==uid||!same(value.owner,owner))throw fail('浏览器缓存已属于另一个账号或另一处学不通数据目录。',requested);};
 if(previous)verify(previous);
 else{
  try{fs.mkdirSync(requested,{recursive:true});}catch{throw fail('无法创建账号独立浏览器目录。',requested);}
  inspectDirectory(requested);
  const record={schema:1,product:'XueBuTong',uid,owner};
  try{fs.writeFileSync(marker,JSON.stringify(record)+'\n',{encoding:'utf8',flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw fail('无法保存浏览器缓存归属标记。',marker);verify(readOwner(marker));}
 }
 return expected;
}
module.exports={prepareBrowserProfile,MARKER};
