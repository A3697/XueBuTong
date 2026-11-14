'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {uidOf}=require('./controller.cjs');
const {customKey,photoName}=require('./config-transfer.cjs');
const WindowSizes=require('./window-sizes.cjs');
const ClientEnvironment=require('./client-environment.js');
class AccountSettings {
 constructor({root,controller,modes,htmlPreferences,workspacePreferences}){Object.assign(this,{root,controller,modes,htmlPreferences,workspacePreferences});}
 clone({sourceUid,targetUid}){
  uidOf(sourceUid);uidOf(targetUid);if(sourceUid===targetUid)throw Error('不能复制到同一账号');
  if(this.modes.current(targetUid)||this.controller.data.profiles[targetUid])throw Error('目标账号已有配置或正在运行');
  const source=this.controller.data.profiles[sourceUid],writes=[];
  const sourceFile=path.join(this.root,'instances',sourceUid,'data/storage/state.json');
  if(fs.existsSync(sourceFile)){
   const data=JSON.parse(fs.readFileSync(sourceFile,'utf8')),settings=Object.fromEntries(Object.entries(data).filter(([key])=>customKey(key)));
   const file=path.join(this.root,'instances',targetUid,'data/storage/state.json');writes.push({file,bytes:Buffer.from(JSON.stringify(settings,null,2))});
   const name=settings['face.photo_file'];if(photoName(name)){const image=path.join(path.dirname(sourceFile),'face',name);if(fs.existsSync(image))writes.push({file:path.join(path.dirname(file),'face',name),bytes:fs.readFileSync(image)});}
  }
  const nativeStar=require('./native-star-settings.cjs');
  for(const item of nativeStar.prepare(this.root,targetUid,nativeStar.snapshot(this.root,sourceUid)))writes.push({file:item.file,bytes:item.raw||Buffer.from(JSON.stringify(item.value,null,2))});
  for(const kind of ['browser','panel']){const value=WindowSizes.read(this.root,kind+'-'+sourceUid);if(value)writes.push({file:WindowSizes.location(this.root,kind+'-'+targetUid),bytes:Buffer.from(JSON.stringify(value))});}
  const previous=writes.map(item=>({...item,before:fs.existsSync(item.file)?fs.readFileSync(item.file):null}));
  const oldHtml={...this.htmlPreferences.accounts},oldPrefs=this.workspacePreferences.get();
  try{
   for(const item of writes){fs.mkdirSync(path.dirname(item.file),{recursive:true});fs.writeFileSync(item.file+'.copy-tmp',item.bytes);fs.renameSync(item.file+'.copy-tmp',item.file);}
   if(source){const copy=JSON.parse(JSON.stringify(source));copy.revision=1;copy.clientEnvironment=ClientEnvironment.forClone(source.clientEnvironment);this.controller.data.profiles[targetUid]=copy;this.controller.persist();}
   this.htmlPreferences.set(targetUid,this.htmlPreferences.get(sourceUid));
   const prefs=this.workspacePreferences.get(),index=prefs.cardOrder.indexOf(sourceUid);if(index>=0)prefs.cardOrder.splice(index+1,0,targetUid);
   if(prefs.speeds[sourceUid]!==undefined)prefs.speeds[targetUid]=prefs.speeds[sourceUid];
   delete prefs.launchPlans[targetUid];this.workspacePreferences.set(prefs);
  }catch(error){
   delete this.controller.data.profiles[targetUid];this.controller.persist();
   this.htmlPreferences.accounts=oldHtml;this.htmlPreferences.persist();this.workspacePreferences.set(oldPrefs);
   for(const item of previous){if(item.before)fs.writeFileSync(item.file,item.before);else if(fs.existsSync(item.file))fs.unlinkSync(item.file);if(fs.existsSync(item.file+'.copy-tmp'))fs.unlinkSync(item.file+'.copy-tmp');}
   throw error;
  }
  return {copied:true};
 }
 remove({uid}){
  uidOf(uid);if(this.modes.current(uid))throw Error('请先在学不通中停止此账号的任务；若正在验证登录，请先完成或关闭验证窗口，再删除账号。');
  const instance=path.resolve(this.root,'instances',uid),soutijiang=path.resolve(this.root,'bridge-data','soutijiang',uid),realRoot=fs.realpathSync(this.root);
  const owned=target=>{const relative=path.relative(realRoot,target);return !!relative&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
  if(fs.existsSync(instance)){
   if(!owned(fs.realpathSync(instance)))throw Error('账号实例目录不属于本软件，未删除');
  }
  if(fs.existsSync(soutijiang)&&(!owned(fs.realpathSync(soutijiang))||fs.lstatSync(soutijiang).isSymbolicLink()))throw Error('搜题酱账号目录不属于本软件，未删除');
  let soutiParent=path.resolve(this.root);for(const part of ['bridge-data','soutijiang',uid]){soutiParent=path.join(soutiParent,part);if(fs.existsSync(soutiParent)&&fs.lstatSync(soutiParent).isSymbolicLink())throw Error('搜题酱账号目录包含链接，未删除');}
  const sizeFiles=['browser','panel'].map(kind=>WindowSizes.location(this.root,kind+'-'+uid));
  const files=[this.controller.settingsFile,this.htmlPreferences.file,this.workspacePreferences.file,...sizeFiles].flatMap(file=>[file,file+'.tmp']);
  for(const file of files){let parent=path.dirname(file);while(!fs.existsSync(parent)){const ancestor=path.dirname(parent);if(ancestor===parent)throw Error('账号配置目录不可用，未删除');parent=ancestor;}const resolved=fs.realpathSync(parent);if(resolved!==realRoot&&!owned(resolved))throw Error('账号配置目录不属于本软件，未删除');if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('账号配置文件存在链接，未删除');}
  const beforeFiles=files.map(file=>({file,bytes:fs.existsSync(file)?fs.readFileSync(file):null}));
  const beforeData=JSON.parse(JSON.stringify(this.controller.data)),beforeHtml=JSON.parse(JSON.stringify(this.htmlPreferences.accounts)),beforePrefs=this.workspacePreferences.get();
  const privateDir=path.resolve(this.root,'private');fs.mkdirSync(privateDir,{recursive:true});
  if(!owned(fs.realpathSync(privateDir)))throw Error('账号恢复目录不属于本软件，未删除');
  const transactionDir=path.join(privateDir,'account-removal-'+uid+'-'+crypto.randomBytes(6).toString('hex'));
  fs.mkdirSync(transactionDir);if(!owned(fs.realpathSync(transactionDir)))throw Error('账号恢复目录不属于本软件，未删除');
  const stagedInstance=path.join(transactionDir,'instance'),stagedSoutijiang=path.join(transactionDir,'soutijiang');let staged=false,soutiStaged=false;
  try{
   for(let i=0;i<beforeFiles.length;i++)if(beforeFiles[i].bytes!==null)fs.writeFileSync(path.join(transactionDir,String(i)+'.json'),beforeFiles[i].bytes);
   fs.writeFileSync(path.join(transactionDir,'transaction.json'),JSON.stringify({schema:1,uid,files:beforeFiles.map(({file,bytes})=>({file,existed:bytes!==null}))}));
   // Rename first, then commit metadata. Failed writes can restore the whole
   // account directory, including queued courses and custom photos.
   if(fs.existsSync(instance)){fs.renameSync(instance,stagedInstance);staged=true;}
   if(fs.existsSync(soutijiang)){fs.renameSync(soutijiang,stagedSoutijiang);soutiStaged=true;}
   delete this.controller.data.profiles[uid];this.controller.persist();
   delete this.htmlPreferences.accounts[uid];this.htmlPreferences.persist();for(const file of sizeFiles)if(fs.existsSync(file))fs.unlinkSync(file);
   const prefs=this.workspacePreferences.get();prefs.cardOrder=prefs.cardOrder.filter(value=>value!==uid);delete prefs.launchPlans[uid];delete prefs.speeds[uid];this.workspacePreferences.set(prefs);
  }catch(error){
   this.controller.data=beforeData;this.htmlPreferences.accounts=beforeHtml;this.workspacePreferences.data=beforePrefs;
   const rollbackErrors=[];
   for(const {file,bytes}of beforeFiles)try{if(bytes===null){if(fs.existsSync(file))fs.unlinkSync(file);}else{const temp=file+'.account-rollback-'+crypto.randomBytes(6).toString('hex');fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);}}catch(rollbackError){rollbackErrors.push(rollbackError);}
   if(staged)try{if(fs.existsSync(instance))throw Error('账号目录已存在，保留恢复副本');fs.renameSync(stagedInstance,instance);}catch(rollbackError){rollbackErrors.push(rollbackError);}
   if(soutiStaged)try{if(fs.existsSync(soutijiang))throw Error('搜题酱账号目录已存在，保留恢复副本');fs.renameSync(stagedSoutijiang,soutijiang);}catch(rollbackError){rollbackErrors.push(rollbackError);}
   if(rollbackErrors.length){error.message+='；部分状态未能自动恢复，恢复副本位于 '+transactionDir;}
   else try{fs.rmSync(transactionDir,{recursive:true,force:false});}catch{/* Keep a recoverable copy if cleanup is unavailable. */}
   throw error;
  }
  this.controller.secretCache.delete(uid);this.controller.redactorCache.delete(uid);this.controller.bankCache?.delete(uid);
  this.controller.logBuffers.delete(uid);this.controller.logSequences?.delete(uid);this.controller.stoppedAt?.delete(uid);
  let cleanupPending=false;try{fs.rmSync(transactionDir,{recursive:true,force:false});}catch{cleanupPending=true;}
  return {removed:true,...(cleanupPending?{cleanupPending:true}:{})};
 }
}
module.exports={AccountSettings};
