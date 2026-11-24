'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Core=require('./soutijiang.cjs'),Accounts=require('./soutijiang-accounts.cjs'),Auth=require('./soutijiang-auth.cjs');
const validUid=uid=>{if(typeof uid!=='string'||!(/^[A-Za-z0-9_-]{1,80}$/).test(uid)||['__proto__','constructor','prototype'].includes(uid)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(uid))throw Error('账号标识无效');return uid;};
const stateIdentity=state=>state?.providerUid?crypto.createHash('sha256').update(String(state.providerUid)).digest('hex'):/^[a-f0-9]{64}$/.test(state?.identityHash||'')?state.identityHash:'';
class SoutijiangPool{
 constructor(options){
  this.controller=options.controller;this.engine=Core.createManager(options);this.current=new Map();this.parked=new Map();this.locks=new Map();this.tickets=new Map();this.browserIds=new Map();this.pendingQueries=new Map();this.cancellations=new Map();this.closed=false;
  this.file=path.join(this.engine.home,'account-state.json');this.saved=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{};
  if(!this.saved||typeof this.saved!=='object'||Array.isArray(this.saved))throw Error('搜题酱账号状态无法读取，请保留原文件后检查');
  this.engine.profileFor=uid=>this.profile(uid,this.current.get(uid)||'default');
  this.engine.bindingKeyFor=uid=>this.binding(uid,this.current.get(uid)||'default');
  this.attention=new (require('./soutijiang-attention.cjs').SoutijiangAttention)({home:this.engine.home,clock:this.engine.clock,notify:options.onAttention});
 }
 get sessions(){return this.engine.sessions;}
 get pending(){return this.engine.pending;}
 definition(uid){
  validUid(uid);if(!Object.hasOwn(this.controller.data.profiles,uid))throw Error('学不通账号不存在');
  const value=this.controller.data.profiles[uid].soutijiangAccounts;
  // Preserve an actual pre-multi-account login, without inventing a blank
  // account for every new learning account or imported configuration.
  if(value===undefined&&fs.existsSync(this.profile(uid,'default'))&&(this.engine.bindings[uid]?.configured||stateIdentity(this.saved[uid]?.default)))return Accounts.normalize({items:[{id:'default',remark:'',enabled:true}]});
  return Accounts.normalize(value);
 }
 binding(uid,id){return id==='default'?uid:uid+'.'+id;}
 profile(uid,id){validUid(uid);Accounts.normalize({items:[{id,remark:''}]});return id==='default'?path.join(this.engine.home,uid,'profile'):path.join(this.engine.home,uid,'accounts',id,'profile');}
 saveDefinition(uid,definition){
  const p=this.controller.data.profiles[uid];if(!p)throw Error('学不通账号不存在');const old=p.soutijiangAccounts;p.soutijiangAccounts=Accounts.normalize(definition);
  try{this.controller.persist?.();}catch(error){p.soutijiangAccounts=old;throw error;}
 }
 persistState(){
  fs.mkdirSync(this.engine.home,{recursive:true});const tmp=this.file+'.tmp-'+crypto.randomBytes(6).toString('hex');
  try{fs.writeFileSync(tmp,JSON.stringify(this.saved),{flag:'wx',mode:0o600});fs.renameSync(tmp,this.file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 }
 retain(uid){
  const id=this.current.get(uid);if(!id)return;const state=this.engine.states.get(uid)||{};
  // No cookies, keys or QR images belong in the public account descriptor.
  this.saved[uid]??={};const next={name:state.name||'',providerUid:state.providerUid||'',identityHash:stateIdentity(state)||stateIdentity(this.saved[uid][id]),blocked:state.blocked===true,error:state.error||'',message:state.message||'',browserImportBlocked:state.browserImportBlocked===true};
  if(JSON.stringify(this.saved[uid][id])!==JSON.stringify(next)){this.saved[uid][id]=next;this.persistState();}
 }
 lock(uid,fn){validUid(uid);if(this.closed)return Promise.reject(Error('搜题酱服务已关闭'));const run=(this.locks.get(uid)||Promise.resolve()).catch(()=>{}).then(()=>{if(this.closed)throw Error('搜题酱服务已关闭');return fn();});this.locks.set(uid,run);run.finally(()=>{if(this.locks.get(uid)===run)this.locks.delete(uid);}).catch(()=>{});return run;}
 async use(uid,id,fn){
  if(this.closed)throw Error('搜题酱服务已关闭');
  if(!this.definition(uid).items.some(item=>item.id===id))throw Error('搜题酱账号不存在');
  if(this.current.get(uid)!==id){
   this.retain(uid);const prior=this.current.get(uid),state=this.engine.states.get(uid),session=this.engine.sessions.get(uid);
   if(session&&state?.status==='awaiting-login'&&!session.closed?.()){this.parked.set(uid+'\0'+prior,{state,session});this.engine.sessions.delete(uid);}
   else await this.engine.stop(uid);
   this.current.set(uid,id);const waiting=this.parked.get(uid+'\0'+id);this.parked.delete(uid+'\0'+id);
   if(waiting&&!waiting.session.closed?.()){this.engine.sessions.set(uid,waiting.session);this.engine.states.set(uid,waiting.state);}
   else this.engine.states.set(uid,{...(this.saved[uid]?.[id]||{})});
  }
  try{return await fn();}finally{
   this.retain(uid);
   const state=this.engine.states.get(uid);
   if(state?.loggedIn===true&&!state.blocked&&state.status==='ready')this.attention.recovered(uid,id);
  }
 }
 rows(uid){return this.definition(uid).items.map((item,index)=>{
  const live=this.current.get(uid)===item.id?this.engine.states.get(uid):null,state=live||this.saved[uid]?.[item.id]||{},quota=this.engine.quotas[state.providerUid],today=quota?.day===Core.dayKey(this.engine.clock())?quota:{};
  const configured=this.engine.bindings[this.binding(uid,item.id)]?.configured===true&&fs.existsSync(this.profile(uid,item.id));
  const attention=this.attention.find(uid,item.id);
  return {...item,order:index+1,name:state.name||'',configured,loggedIn:live?.loggedIn===true,blocked:state.blocked===true,message:state.message||'',attention:attention?{state:attention.state,deadline:attention.deadline}:null,screenshotExhausted:today.screenshot===true,solveExhausted:today.solve===true,screenshotUsed:today.screenshotSuccessful||0,solveUsed:today.solveSuccessful||0,usageSource:'local-successful-requests',officialUsed:null};
 });}
 bankPreferred(uid){const rows=this.rows(uid).filter(row=>row.enabled&&!row.attention);return rows.find(row=>!(row.screenshotExhausted&&row.solveExhausted))?.id||rows[0]?.id;}
 preferred(uid){return this.bankPreferred(uid)||this.definition(uid).items[0]?.id;}
 browserAccount(uid){const definition=this.definition(uid),current=this.browserIds.get(uid);return definition.selectedId||(definition.items.some(item=>item.id===current)?current:this.preferred(uid));}
 configured(uid){return this.rows(uid).some(row=>row.enabled&&row.configured);}
 view(uid,id){this.attention.expire();const accounts=this.rows(uid).filter(row=>row.configured||row.loggedIn||row.attention),selectedId=id||this.browserAccount(uid),row=accounts.find(item=>item.id===selectedId);const ext=this.engine.extension();
  const state=this.current.get(uid)===selectedId?this.engine.view(uid):{};
  const connectionKey=crypto.createHash('sha256').update(JSON.stringify(accounts.filter(row=>row.enabled).map(row=>[uid,row.id,row.configured,this.saved[uid]?.[row.id]?.providerUid]))).digest('hex');
  return {...state,uid,enabled:this.engine.enabled(uid),configured:this.configured(uid),installed:ext.installed,version:ext.version,compatible:ext.compatible,loggedIn:row?.loggedIn===true,name:row?.name||'',accounts,connectionKey,selectedId:selectedId||'',browserAccountId:this.browserAccount(uid)||'',browserAccountExplicit:this.definition(uid).selectedId!==undefined,usageNote:'仅统计本机经题库入口成功完成的搜题请求；不等同于官方扣减次数，不含插件自行搜题和其他设备用量。官方未提供可靠的已用／剩余额度数值。'};
 }
 async state(uid,{slotId,refresh=false,connect=false,forBank=false,summaryOnly=false}={}){return this.lock(uid,async()=>{
  if(summaryOnly)return this.view(uid);
  const id=slotId||(forBank?this.bankPreferred(uid):this.browserAccount(uid));if(!id)return this.view(uid);
  await this.use(uid,id,()=>this.engine.state(uid,{refresh,connect}));return this.view(uid,id);
 });}
 async login(uid,{slotId,visible=false}={}){return this.lock(uid,async()=>{
  const id=slotId||this.preferred(uid);if(!id)throw Error('请先添加搜题酱账号');
  await this.use(uid,id,async()=>{
   if(this.attention.find(uid,id)){
    // A cached nickname/token is not a successful re-login. Explicit recovery
    // opens the official login flow, rather than clearing a blocked flag.
    const session=await this.engine.ensure(uid);
    if((await session.user()).loggedIn)await this.engine.logout(uid);
    this.attention.beginRecovery(uid,id);
   }
   const result=await this.engine.login(uid,{visible});
   if(this.attention.find(uid,id))this.engine.states.set(uid,{...this.engine.states.get(uid),browserImportBlocked:true});
   return result;
  });this.watchRecovery();return this.view(uid,id);
 });}
 watchRecovery(){
  if(this.recoveryTimer||this.closed||!this.attention.recovering.size)return;
  this.recoveryTimer=setTimeout(()=>{this.recoveryTimer=null;void this.refreshRecoveries().catch(()=>{}).finally(()=>this.watchRecovery());},2000);this.recoveryTimer.unref?.();
 }
 async refreshRecoveries(){
  for(const key of [...this.attention.recovering]){
   if(this.closed)return;const [uid,id]=key.split('\0');
   const session=this.current.get(uid)===id?this.engine.sessions.get(uid):this.parked.get(key)?.session;
   if(!Object.hasOwn(this.controller.data.profiles,uid)||!session||session.closed?.()){this.attention.recovering.delete(key);continue;}
   // Read the official login window locally; don't switch the healthy search
   // session or make probe requests while the user is still scanning.
   try{const user=await session.user();if(!user.loggedIn)continue;
    await this.lock(uid,()=>this.use(uid,id,()=>this.engine.state(uid,{refresh:true})));
   }catch{/* A closed login window must not prevent another account recovering. */}
  }
 }
 async logout(uid,{slotId}={}){return this.lock(uid,async()=>{const id=slotId||this.preferred(uid);await this.use(uid,id,async()=>{await this.engine.logout(uid);this.engine.states.set(uid,{...this.engine.states.get(uid),browserImportBlocked:true});});return this.view(uid,id);});}
 async change(uid,{action,id,remark,order,enabled}={}){return this.lock(uid,async()=>{
  const definition=this.definition(uid),item=definition.items.find(item=>item.id===id);
  if(action==='add'){
   const pending=this.rows(uid).find(row=>row.id!=='default'&&!row.configured&&!stateIdentity(this.saved[uid]?.[row.id]));
   id=pending?.id||crypto.randomBytes(12).toString('hex');if(!pending)definition.items.push({id,remark:typeof remark==='string'?remark:''});
  }else if(action==='rename'){if(!item)throw Error('搜题酱账号不存在');item.remark=remark;}
  else if(action==='set-enabled'){
   if(!item)throw Error('搜题酱账号不存在');if(typeof enabled!=='boolean')throw Error('搜题酱账号的题库开关无效');item.enabled=enabled;
  }else if(action==='select'){
   if(id==='')delete definition.selectedId;
   else{
    if(!item)throw Error('搜题酱账号不存在');
    if(!this.rows(uid).find(row=>row.id===id)?.configured)throw Error('请先在题库配置中登录此搜题酱账号');
    definition.selectedId=id;
   }
  }
  else if(action==='reorder'){
   const visible=this.rows(uid).filter(row=>row.configured||row.loggedIn||row.attention).map(row=>row.id);
   if(!Array.isArray(order)||new Set(order).size!==order.length||order.some(id=>!definition.items.some(item=>item.id===id))||order.length!==definition.items.length&&(order.length!==visible.length||visible.some(id=>!order.includes(id))))throw Error('账号顺序无效');
   definition.items=[...order.map(id=>definition.items.find(item=>item.id===id)),...definition.items.filter(item=>!order.includes(item.id))];
  }else if(action==='remove'){
   if(!item)throw Error('搜题酱账号不存在');
   await this.use(uid,id,()=>this.engine.stop(uid));
   const profile=this.profile(uid,id),root=path.resolve(this.engine.root);
   for(let parent=profile;parent!==root;parent=path.dirname(parent)){if(parent===path.dirname(parent)||!parent.startsWith(root+path.sep))throw Error('登录目录不属于本软件');if(fs.existsSync(parent)&&fs.lstatSync(parent).isSymbolicLink())throw Error('登录目录包含链接，未移除');}
   const original=this.controller.data.profiles[uid].soutijiangAccounts,wasConfigured=this.engine.configured(uid),previousState=this.saved[uid]?.[id],previousRemoved=this.saved[uid]?._removedIdentities;
   definition.items=definition.items.filter(item=>item.id!==id);
   if(definition.selectedId===id)delete definition.selectedId;
   const staged=profile+'.removing-'+crypto.randomBytes(6).toString('hex'),exists=fs.existsSync(profile);
   if(exists)fs.renameSync(profile,staged);
   try{
    this.saveDefinition(uid,definition);this.engine.setConfigured(uid,false);delete this.saved[uid]?.[id];
    const identity=stateIdentity(previousState);
    if(identity&&!definition.items.some(item=>stateIdentity(this.saved[uid]?.[item.id])===identity)){
     (this.saved[uid]??={})._removedIdentities=[...new Set([...this.removedIdentities(uid),identity])];
    }
    this.persistState();
   }
   catch(error){
    if(exists)fs.renameSync(staged,profile);
    // Keep the original login available if any metadata write fails. Failed
    // rollback writes must not hide the original failure or delete the data.
    if(original===undefined)delete this.controller.data.profiles[uid].soutijiangAccounts;else this.controller.data.profiles[uid].soutijiangAccounts=original;
    if(previousState)(this.saved[uid]??={})[id]=previousState;
    if(previousRemoved===undefined)delete this.saved[uid]?._removedIdentities;else(this.saved[uid]??={})._removedIdentities=previousRemoved;
    for(const restore of [()=>this.controller.persist?.(),()=>this.engine.setConfigured(uid,wasConfigured),()=>this.persistState()])try{restore();}catch{}
    throw error;
   }
   this.current.delete(uid);
   this.attention.remove(uid,id);
   if(exists)fs.rmSync(staged,{recursive:true,force:false,maxRetries:3,retryDelay:100});
  }else throw Error('搜题酱账号操作无效');
  if(action!=='remove')this.saveDefinition(uid,definition);if(action==='reorder'||action==='remove'||action==='select'&&id==='')this.browserIds.delete(uid);
  return this.view(uid,action==='add'||action==='select'?id:undefined);
 });}
 query(uid,question){
  const key=validUid(uid)+'\0'+crypto.createHash('sha256').update(JSON.stringify(question)).digest('hex');if(this.pendingQueries.has(key))return this.pendingQueries.get(key);
  if(this.pendingQueries.size>=32)return Promise.reject(new Core.SoutijiangError('soutijiang_busy','搜题酱等待队列已满，请稍后重试',429));
  const generation=this.cancellations.get(uid)||0;
  const run=this.lock(uid,async()=>{
   if(!this.engine.enabled(uid))throw new Core.SoutijiangError('soutijiang_disabled','该账号未启用搜题酱题库',409);
   const definition=this.definition(uid),items=definition.items.filter(item=>item.enabled);if(!definition.items.length)throw new Core.SoutijiangError('soutijiang_login_required','请先添加并登录搜题酱账号',409);
   if(!items.length)throw new Core.SoutijiangError('soutijiang_accounts_disabled','请在题库配置中启用至少一个搜题酱账号',409);
   let unavailable=false;
   for(const item of items){
    if(this.closed||(this.cancellations.get(uid)||0)!==generation)throw new Core.SoutijiangError('soutijiang_cancelled','搜题酱请求已取消',409);
    if(this.attention.find(uid,item.id)){unavailable=true;continue;}
    try{return await this.use(uid,item.id,async()=>{if(!definition.selectedId)this.browserIds.set(uid,item.id);const answer=await this.engine.query(uid,question);if(this.closed||(this.cancellations.get(uid)||0)!==generation)throw new Core.SoutijiangError('soutijiang_cancelled','搜题酱请求已取消',409);return answer;});}
    catch(error){if(error.code==='soutijiang_daily_exhausted')continue;if(this.markAttention(uid,item.id,error.code)){unavailable=true;continue;}throw error;}
   }
   if(unavailable)throw new Core.SoutijiangError('soutijiang_accounts_unavailable','搜题酱账号需要处理，已跳过并继续其他搜题方式',409);
   throw new Core.SoutijiangError('soutijiang_daily_exhausted','全部搜题酱账号今日额度已明确耗尽，今日跳过此方式',429);
  });this.pendingQueries.set(key,run);run.finally(()=>this.pendingQueries.delete(key)).catch(()=>{});return run;
 }
 markAttention(uid,id,code){
  if(!this.attention.mark(uid,id,code))return false;
  const identity=stateIdentity(this.saved[uid]?.[id]);
  if(identity)for(const item of this.definition(uid).items)if(item.id!==id&&stateIdentity(this.saved[uid]?.[item.id])===identity)this.attention.mark(uid,item.id,code);
  return true;
 }
 ticket(uid){validUid(uid);for(const [key,value]of this.tickets)if(value.uid===uid)this.tickets.delete(key);const token=crypto.randomBytes(32).toString('hex');this.tickets.set(token,{uid,revision:0,slotId:'',browserDigest:'',bankDigest:'',initialized:false,inputLoginDigest:''});return {token};}
 removedIdentities(uid){return Array.isArray(this.saved[uid]?._removedIdentities)?this.saved[uid]._removedIdentities.filter(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)):[];}
 removedCredentials(uid,identity){const values=this.saved[uid]?._removedCredentials?.[identity];return Array.isArray(values)?values.filter(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)):[];}
 rememberRemovedCredential(uid,identity,digest){
  const previous=this.removedCredentials(uid,identity);if(previous.includes(digest))return;
  this.saved[uid]._removedCredentials={...this.saved[uid]._removedCredentials,[identity]:[...previous,digest]};this.persistState();
 }
 forgetRemoved(uid,identity){if(!this.removedIdentities(uid).includes(identity))return;this.saved[uid]._removedIdentities=this.removedIdentities(uid).filter(value=>value!==identity);delete this.saved[uid]._removedCredentials?.[identity];this.persistState();}
 async adopt(uid,id,snapshot){return this.use(uid,id,async()=>{
  const session=await this.engine.ensure(uid),previous=await session.readAuth();
  const freshLogin=Auth.user(snapshot).loggedIn&&Auth.loginDigest(previous)!==Auth.loginDigest(snapshot);
  await session.applyAuth(snapshot);
  if(freshLogin&&this.attention.find(uid,id)){
   this.attention.beginRecovery(uid,id);
   this.engine.states.set(uid,{...this.engine.states.get(uid),blocked:false,status:'awaiting-login'});
  }
  this.engine.states.set(uid,{...this.engine.states.get(uid),browserImportBlocked:!Auth.user(snapshot).loggedIn});
  return this.engine.state(uid,{refresh:true});
 });}
 async preserveBrowser(uid,snapshot){
  const definition=this.definition(uid),identity=Auth.identity(snapshot);if(!identity)return null;
  const known=definition.items.find(item=>stateIdentity(this.saved[uid]?.[item.id])===identity);if(known){await this.adopt(uid,known.id,snapshot);this.forgetRemoved(uid,identity);return known.id;}
  if(definition.items.length>=Accounts.MAX_ACCOUNTS)throw Error('搜题酱账号已达上限，请先整理账号，现有登录未覆盖');
  const id=crypto.randomBytes(12).toString('hex');definition.items.push({id,remark:'浏览器已有登录'});this.saveDefinition(uid,definition);await this.adopt(uid,id,snapshot);this.forgetRemoved(uid,identity);return id;
 }
 async browserQuota(token,input){
  const ticket=typeof token==='string'?this.tickets.get(token):null;if(!ticket)throw Error('搜题酱登录共享授权无效');
  return this.lock(ticket.uid,async()=>{
   const uid=ticket.uid,event=input?.quota,id=this.browserAccount(uid),state=this.saved[uid]?.[id];
   if(this.tickets.get(token)!==ticket||input.revision!==ticket.revision||ticket.slotId!==id||!state?.providerUid||event?.identity!==stateIdentity(state))return {rotated:false,reason:'stale'};
   const reason=Core.classifyError(event);
   if(!['solve','screenshot'].includes(event.method)||!Number.isInteger(event.error)||!['quota','login','blocked'].includes(reason))return {rotated:false,reason:'not-quota'};
   if(reason==='quota')this.engine.markIdentityQuota(state.providerUid,event.method);
   else this.markAttention(uid,id,reason==='login'?'soutijiang_login_required':'soutijiang_verification_required');
   const rows=this.rows(uid),index=rows.findIndex(row=>row.id===id),ordered=[...rows.slice(index+1),...rows.slice(0,index)];
   for(const next of ordered){
    if(!next.configured||next.blocked||next.attention||next[event.method+'Exhausted']||stateIdentity(this.saved[uid]?.[next.id])===event.identity)continue;
    try{await this.use(uid,next.id,()=>this.engine.probe(uid));}
    catch{this.markAttention(uid,next.id,'soutijiang_session_unavailable');continue;}
    if(!this.engine.view(uid).loggedIn){this.markAttention(uid,next.id,'soutijiang_login_required');continue;}
    ticket.pendingRotation={from:id,to:next.id,identity:event.identity};
    return {rotated:true,reason,message:'当前搜题酱账号已跳过，已切换到下一可用登录；网页现有作答内容已保留。'};
   }
   return {rotated:false,reason:reason==='quota'?'exhausted':'unavailable',message:'搜题酱没有其他可用登录账号；异常提醒不阻塞后台任务，请处理登录后恢复此方式。'};
  });
 }
 async exchange(token,input){
  const ticket=typeof token==='string'?this.tickets.get(token):null;if(!ticket)throw Error('搜题酱登录共享授权无效');
  const snapshot=Auth.normalize(input?.snapshot),browserDigest=Auth.digest(snapshot),inputLoginDigest=Auth.loginDigest(snapshot),uid=ticket.uid;
  return this.lock(uid,async()=>{
   if(this.tickets.get(token)!==ticket)throw Error('搜题酱登录共享已结束');
   const first=!ticket.initialized,identity=Auth.identity(snapshot);
   // A removed login may still exist in a closed browser profile. Import it
   // again only after a completed sync observes genuinely changed credentials.
   // Replaying the old snapshot or refreshing member/display data is not login.
   const removed=this.removedIdentities(uid).includes(identity),rejectedCredentials=this.removedCredentials(uid,identity);
   const canImport=!removed||(!first&&input.revision===ticket.revision&&rejectedCredentials.length>0&&!rejectedCredentials.includes(inputLoginDigest)&&inputLoginDigest!==ticket.inputLoginDigest);
   // Keep the rejected identity's credential hashes across acknowledgements of
   // another account and across restarts. Comparing only the previous request
   // would mistake a replay of the deleted login for a fresh scan.
   if(removed&&!canImport&&(first||!rejectedCredentials.length))this.rememberRemovedCredential(uid,identity,inputLoginDigest);
   const finish=(id,saved)=>{ticket.revision++;ticket.initialized=true;ticket.slotId=id;ticket.browserDigest=Auth.digest(saved);ticket.bankDigest=Auth.loginDigest(saved);ticket.inputLoginDigest=inputLoginDigest;return {revision:ticket.revision,slotId:id,snapshot:browserDigest===ticket.browserDigest?null:saved};};
   let id=this.browserAccount(uid);
   const rotation=ticket.pendingRotation;delete ticket.pendingRotation;
   // A new manual scan or selection during quota checking wins. Commit the
   // next login only when the browser still holds the exhausted identity.
   if(rotation&&id===rotation.from&&identity===rotation.identity&&input.revision===ticket.revision){
    const definition=this.definition(uid);
    if(definition.items.some(item=>item.id===rotation.to)){definition.selectedId=rotation.to;this.saveDefinition(uid,definition);this.browserIds.set(uid,rotation.to);id=rotation.to;}
   }
   if(!id&&Auth.user(snapshot).loggedIn&&canImport&&(first||input.revision===ticket.revision))id=await this.preserveBrowser(uid,snapshot);
   if(!id)return finish('',{schema:1,storage:{},cookies:[]});
   await this.use(uid,id,()=>this.engine.ensure(uid));let session=this.engine.sessions.get(uid),saved=await session.readAuth();
   // A local logout or fresh scan must win over a stale browser heartbeat.
   // Membership/name refreshes are not credential changes.
   const sameRevision=input.revision===ticket.revision&&id===ticket.slotId&&Auth.loginDigest(saved)===ticket.bankDigest;
   if(first){
    if(canImport&&Auth.identity(saved)&&Auth.identity(saved)===identity&&Auth.loginDigest(saved)!==inputLoginDigest){await this.engine.probe(uid);saved=await session.readAuth();}
    if(canImport&&!Auth.user(saved).loggedIn&&Auth.user(snapshot).loggedIn&&!this.saved[uid]?.[id]?.browserImportBlocked){await this.adopt(uid,id,snapshot);saved=snapshot;}
    else if(canImport&&Auth.user(saved).loggedIn&&Auth.user(snapshot).loggedIn&&Auth.identity(saved)!==identity){await this.preserveBrowser(uid,snapshot);await this.use(uid,id,()=>this.engine.ensure(uid));}
   }else if(canImport&&sameRevision&&ticket.browserDigest&&browserDigest!==ticket.browserDigest){
    if(Auth.user(saved).loggedIn&&Auth.user(snapshot).loggedIn&&Auth.identity(saved)!==Auth.identity(snapshot)){
     id=await this.preserveBrowser(uid,snapshot);this.browserIds.set(uid,id);
     const definition=this.definition(uid);if(definition.selectedId){definition.selectedId=id;this.saveDefinition(uid,definition);}
    }else {await this.adopt(uid,id,snapshot);this.forgetRemoved(uid,identity);}
   }
   await this.use(uid,id,()=>this.engine.state(uid,{refresh:true}));session=await this.engine.ensure(uid);saved=await session.readAuth();
   return finish(id,saved);
  });
 }
 async stop(uid){validUid(uid);this.cancellations.set(uid,(this.cancellations.get(uid)||0)+1);this.retain(uid);await this.engine.stop(uid);for(const [key,value]of this.parked)if(key.startsWith(uid+'\0')){this.parked.delete(key);await value.session.close().catch(()=>{});}}
 async dispose(){this.closed=true;clearTimeout(this.recoveryTimer);this.attention.dispose();this.tickets.clear();await this.engine.dispose();await Promise.allSettled([...this.parked.values()].map(value=>value.session.close()));this.parked.clear();await Promise.allSettled([...this.locks.values()]);}
}
module.exports={SoutijiangPool,createPool:options=>new SoutijiangPool(options)};
