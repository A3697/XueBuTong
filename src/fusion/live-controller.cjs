'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {IntegrationController:ProfileStore,uidOf,redact}=require('./controller.cjs');
const {createGateway}=require('./gateway/index.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class IntegrationController extends ProfileStore{
 constructor(options){super(options);this.python=path.join(this.labRoot,'python3144','python.exe');this.statusRevision=0;this.startCancellations=new Map();this.automaticRelogin=new (require('./automatic-relogin.cjs').AutomaticRelogin)({root:this.labRoot});}
 saveSettings(input){
  const uid=uidOf(input.uid),old=this.base(uid),username=old.username,schoolId=old.schoolId,password=this.plainSecret(uid,'password'),r=this.runtimes.get(uid);
  // Saving never partly changes a running account's credentials or search order.
  this.runtimes.delete(uid);let result;
  try{result=super.saveSettings(input);}finally{if(r)this.runtimes.set(uid,r);}
  const identityChanged=username!==result.username||schoolId!==result.schoolId||password!==this.plainSecret(uid,'password');
  if(r&&identityChanged)r.identityChanged=true;
  if(r)this.appendLog(uid,'INFO','新配置已保存；点击重启并重新登录后应用。');
  return result;
 }
 async machineJson(script,args=[]){return new Promise((resolve,reject)=>{
  const child=spawn(this.python,['-I','-S','-B','-X','utf8',path.join(this.labRoot,'tools',script),...args],{cwd:this.labRoot,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let out='',size=0;child.stdout.on('data',b=>{size+=b.length;if(size>512*1024)child.kill();else out+=b;});child.stderr.resume();
  const timer=setTimeout(()=>{child.kill();reject(Error('本机凭据助手超时'));},8000);
  child.once('error',()=>{clearTimeout(timer);reject(Error('本机凭据助手无法启动'));});child.once('exit',code=>{clearTimeout(timer);if(code!==0)return reject(Error('本机凭据助手失败'));try{resolve(JSON.parse(out));}catch{reject(Error('本机凭据助手返回无效数据'));}});
 });}
 async importAuthorized(){return;}
 appendLog(uid,level,message){super.appendLog(uid,level,String(message).replace('账号独立配置已保存；当前为协议模拟验证，未登录真实学习通。','账号独立配置已保存。'));}
 additionalRedactionValues(uid){const values=[];for(const r of this.runtimes.values()){if(r.token)values.push(r.token);if(r.gatewayProfile?.apiKey)values.push(r.gatewayProfile.apiKey);if(r.uid===uid&&r.appliedSecrets)values.push(...r.appliedSecrets);}return values;}
 status(uid){uidOf(uid);const p=this.base(uid),r=this.runtimes.get(uid),needsRestart=!!r&&r.appliedRevision!==null&&r.appliedRevision!==p.revision;return {uid,starEnhancementsEnabled:r?r.enhanced!==false:p.starEnhancementsEnabled!==false,statusRevision:++this.statusRevision,mode:r?'live':'unconnected',state:r?.state||'stopped',summary:r?(needsRestart?'新配置待重启后应用。':r.loggedIn?(r.enhanced===false?'星蝉 1.3.1 原生模式已登录；原生设置独立保存，队列按原版行为管理。':'真实星蝉后端已登录。'):'真实星蝉后端正在启动或登录。'):'星蝉未启动。',settingsApplied:!!r&&r.appliedRevision===p.revision,needsRestart,appliedRevision:r?.appliedRevision??null,updatedAt:r?.updatedAt||this.stoppedAt.get(uid)||null,displayName:p.displayName||'',nameSource:p.nameSource||'',loggedIn:!!r?.loggedIn,...(r?{pid:r.child.pid,port:r.port}:{})};}
 async request(r,method,url,body,timeout=15000){
  const response=await fetch('http://127.0.0.1:'+r.port+url,{method,headers:{'X-Token':r.token,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.any([AbortSignal.timeout(timeout),...(r.abort?[r.abort.signal]:[])])});
  let data;try{data=await response.json();}catch{throw Error('星蝉返回无效数据');}if(!response.ok)throw Error('星蝉接口请求失败（HTTP '+response.status+'），详情可在独立实例日志查看。');return data;
 }
 async start({uid}){
  uidOf(uid);if(this.pendingStarts.has(uid))return this.pendingStarts.get(uid);
  const cancellation=new AbortController();this.startCancellations.set(uid,cancellation);
  const timer=setTimeout(()=>cancellation.abort(Error('星蝉启动超时，请查看账号日志后重试')),180000);
  const operation=(async()=>{const r=this.runtimes.get(uid);if(r&&r.appliedRevision===this.base(uid).revision&&r.loggedIn)return this.status(uid);if(r)await this.stopRuntime(uid);cancellation.signal.throwIfAborted();return this.startRuntime(uid,cancellation);})().finally(()=>{clearTimeout(timer);if(this.pendingStarts.get(uid)===operation)this.pendingStarts.delete(uid);if(this.startCancellations.get(uid)===cancellation)this.startCancellations.delete(uid);});
  this.pendingStarts.set(uid,operation);return operation;
 }
 async duringStart(promise,signal){
  signal.throwIfAborted();let abort;
  try{return await Promise.race([promise,new Promise((_,reject)=>{abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});})]);}
  finally{signal.removeEventListener('abort',abort);}
 }
 async startRuntime(uid,cancellation=new AbortController()){
  const p=this.base(uid),password=this.plainSecret(uid,'password');
  if(typeof p.loginKind==='string'&&!['cx-phone','cx-unit'].includes(p.loginKind))throw Error('星蝉仅支持学习通账号，请先选择超星登录方式。');
  if(!p.username||!password)throw Error('请先在账号设置中填写登录账号和密码');
  if(p.loginKind==='cx-unit'&&!p.schoolId){
   if(!p.loginUnit||!this.resolveSchool)throw Error('请先填写学校或单位，再启动星蝉。');
   const revision=p.revision,fid=await this.duringStart(this.resolveSchool({kind:p.loginKind,username:p.username,password,unit:p.loginUnit}),cancellation.signal);
   if(this.base(uid)!==p||p.revision!==revision)throw Error('登录配置已更改，请重新启动。');
   if(typeof fid!=='string'||!/^\d{1,16}$/.test(fid)||Number(fid)<=0)throw Error('学校编号无法确认，请检查学校或单位的完整名称。');
   p.schoolId=fid;try{this.persist();}catch(error){p.schoolId='';throw error;}
  }
  cancellation.signal.throwIfAborted();
  const enhanced=p.starEnhancementsEnabled!==false;
  const revision=p.revision,session='run-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'),home=path.join(this.labRoot,'instances',uid,'sessions',session);
  if(enhanced)this.validateClientEnvironments(this.data.profiles);
  const environment=require('./client-environment.js').normalize(p.clientEnvironment);
  const child=spawn(this.python,['-I','-S','-B','-X','utf8','-X','faulthandler',path.join(this.labRoot,'tools','run_integrated_backend.py'),'--uid',uid,'--session',session,'--port','0',...(enhanced?[]:['--native'])],{cwd:this.labRoot,env:{...process.env,XBT_CLIENT_ENVIRONMENT:JSON.stringify(environment)},windowsHide:true,stdio:['pipe','pipe','pipe']});
  const r={uid,child,home,session,enhanced,state:'starting',port:0,token:'',loggedIn:false,appliedRevision:null,updatedAt:new Date().toISOString(),stopping:false,abort:cancellation};this.runtimes.set(uid,r);this.appendLog(uid,'INFO',enhanced?'正在启动独立星蝉后端。':'正在启动星蝉 1.3.1 原生模式，使用独立的原生配置与队列。');
  child.stdout.resume();child.stderr.resume();child.once('error',()=>{r.failed=true;});child.once('exit',(code,signal)=>{r.exited=true;try{require('./backend-lifecycle.cjs').recordExit(r,code,signal);}catch{this.appendLog(uid,'WARN','进程已退出，但退出诊断未能保存。');}if(this.runtimes.get(uid)===r)this.runtimes.delete(uid);r.socket?.close();clearInterval(r.poll);clearTimeout(r.reconnect);r.abort.abort();r.gateway?.close().catch(()=>{});if(!this.runtimes.has(uid)){this.automaticRelogin.cancel(uid);this.stoppedAt.set(uid,new Date().toISOString());this.appendLog(uid,'INFO','此账号的星蝉进程已退出。');}});
  try{
   const statePath=path.join(home,'startup-state.json'),deadline=Date.now()+45000;let state;
   while(Date.now()<deadline){if(r.stopping||r.exited||r.failed||r.abort.signal.aborted)throw Error('星蝉启动失败，请检查本融合版的实例日志');if(fs.existsSync(statePath)){try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{}if(state?.state==='failed')throw Error('星蝉初始化失败，请检查独立实例日志');if(state?.state==='listening')break;}await sleep(200);}
   if(state?.state!=='listening')throw Error('星蝉启动超时');
   const info=await this.duringStart(this.machineJson('read_runtime_info.py',[path.join(home,'startup-token.dpapi')]),r.abort.signal);if(info.pid!==child.pid||info.host!=='127.0.0.1'||info.uid!==uid)throw Error('星蝉启动身份校验失败');r.port=info.port;r.token=info.token;
   const bankToken=this.plainSecret(uid,'yanxiToken'),originalKey=this.plainSecret(uid,'xingchanBankKey'),aiKey=this.plainSecret(uid,'aiKey');const ais=this.aiConfigurations(uid);r.appliedSecrets=[password,bankToken,originalKey,aiKey,...ais.map(ai=>ai.key),...require('./question-bank-config.js').secrets(this.bankConfig(uid))].filter(Boolean);
   if(enhanced){
   const answerSettings=this.answerSettings(uid);const account={id:uid,enrollmentYear:require('./enrollment-year.js').normalize(p.enrollmentYear),answerSettings,maxConcurrent:answerSettings.thread,searchMethods:p.searchMethods,questionBanks:this.bankConfig(uid).banks,...(bankToken?{bank:{driver:'yanxi-post-v2',endpoint:'https://tk.enncy.cn/query',token:bankToken,timeoutMs:15000}}:{}),...(originalKey?{xingchanBank:{driver:'xingchan-original',endpoint:'http://127.0.0.1:'+r.port+'/api/integration/original-bank',token:originalKey,sessionToken:r.token,timeoutMs:20000}}:{})};
   account.aiProviders=ais.filter(require('./ai-config.js').configured).map(ai=>({...ai,type:require('./ai-config.js').type(ai),driver:'xingchan-original-ai',endpoint:'http://127.0.0.1:'+r.port+'/api/integration/ai',apiKey:ai.key,sessionToken:r.token,timeoutMs:60000}));
   r.gateway=createGateway({mode:'live',accounts:[account],soutijiangSearch:(id,q)=>{if(!this.soutijiang)throw Error('soutijiang_unavailable');return this.soutijiang.query(id,q);},logger:e=>{const bank=account.questionBanks.find(b=>b.id===e.source),source=(e.source==='soutijiang'?'大学搜题酱':'')||bank?.name||ais.find(ai=>ai.id===e.source)?.name||(e.source==='bank'?'言溪题库':e.source==='xingchan_bank'?'万能题库':'星蝉 AI');if(e.event==='answer')this.appendLog(uid,'INFO',source+' 命中，已返回答案。');if(e.event==='miss')this.appendLog(uid,'INFO',source+' 未找到答案，按保存顺序检查下一项。');if(e.event==='method_error')this.appendLog(uid,'WARN',source+' 查询失败（'+(/^[a-z0-9_]{1,80}$/i.test(e.code||'')?e.code:'unknown_error')+'），继续检查后续搜题方式。');if(e.event==='request_error')this.appendLog(uid,'ERROR','搜题停止：'+e.code);}});await r.gateway.listen();r.gatewayProfile=r.gateway.clientProfiles()[0];
   await this.request(r,'PUT','/api/ai',{base_url:r.gatewayProfile.baseUrl,api_key:r.gatewayProfile.apiKey,model:r.gatewayProfile.model,style:'openai',proxy:'',answer_priority:'ai',bank_fallback:'',bank_fallback_api_key:''});
   await this.request(r,'PUT','/api/integration/answer-policy',{settings:answerSettings,baseUrl:r.gatewayProfile.baseUrl,apiKey:r.gatewayProfile.apiKey});
   }
   r.login={username:p.username,password,schoolid:p.schoolId||''};r.state='logging-in';this.appendLog(uid,'INFO','正在登录学习通并读取姓名。');await this.request(r,'POST','/api/session/login',{username:p.username,password,schoolid:p.schoolId||''},65000);
   const s=await this.request(r,'GET','/api/session');if(s.session_guard?.reason==='concurrent-login'){this.onSessionGuardEvent?.(r,{type:'integration.session-displaced',payload:s.session_guard});throw Error('账号在其他设备登录，当前任务已停止。多次操作会导致账号风控。');}if(!s.logged_in)throw Error('星蝉未返回有效登录会话');r.loggedIn=true;if(typeof s.name==='string'&&s.name.trim()){p.displayName=s.name.trim().slice(0,120);p.nameSource='xingchan';this.persist();}r.state='running';r.appliedRevision=revision;r.updatedAt=new Date().toISOString();
   this.appendLog(uid,'INFO','登录成功'+(p.displayName?'，姓名：'+p.displayName:'，平台暂未返回姓名')+'。未自动启动课程任务。');if(enhanced&&!p.searchMethods.some(m=>m.enabled))this.appendLog(uid,'INFO','此账号没有启用搜题方式，请按需单独配置。');this.connectEvents(r);r.poll=setInterval(()=>{if(!r.lastSessionRead||Date.now()-r.lastSessionRead>10000)this.syncSession(r).catch(()=>{});},5000);r.poll.unref?.();return this.status(uid);
  }catch(error){if(r.port&&!r.stopping&&!r.exited&&!r.sessionDisplaced&&!r.abort.signal.aborted){try{const snapshot=await this.request(r,'GET','/api/session',undefined,2000);if(snapshot.session_guard?.reason==='concurrent-login')this.onSessionGuardEvent?.(r,{type:'integration.session-displaced',payload:snapshot.session_guard});}catch{}}this.appendLog(uid,'ERROR',error.message||'启动失败');await this.stopRuntime(uid);throw error;}
 }
 async syncSession(r){if(r.stopping||r.exited)return;if(r.sessionRequest)return r.sessionRequest;r.sessionRequest=(async()=>{const s=await this.request(r,'GET','/api/session');if(r.stopping||r.exited)return;if(s.session_guard?.reason==='concurrent-login'){this.onSessionGuardEvent?.(r,{type:'integration.session-displaced',payload:s.session_guard});return;}r.loggedIn=!!s.logged_in;const p=this.base(r.uid);if(!r.identityChanged&&s.logged_in&&typeof s.name==='string'&&s.name.trim()&&p.displayName!==s.name){p.displayName=s.name.slice(0,120);p.nameSource='xingchan';this.persist();}r.updatedAt=new Date().toISOString();r.lastSessionRead=Date.now();})().finally(()=>{r.sessionRequest=null;});return r.sessionRequest;}
 connectEvents(r){
  if(r.stopping||r.exited)return;
  const Socket=globalThis.WebSocket||require(path.join(this.labRoot,'ocs-lab/resources/app/node_modules/ws'));
  const ws=new Socket('ws://127.0.0.1:'+r.port+'/ws?t='+encodeURIComponent(r.token));r.socket=ws;
  ws.onmessage=event=>{
   if(r.stopping||r.exited||this.runtimes.get(r.uid)!==r)return;let m;try{m=JSON.parse(String(event.data));}catch{return;}const d=m.payload||{};if(this.onSessionGuardEvent?.(r,m))return;this.onMonitorEvent?.(r,m);
   if(r.enhanced!==false&&m.type==='integration.risk-blocked')this.scheduleRelogin(r,d);
   if(r.enhanced!==false&&m.type==='integration.recovery-cancel')this.cancelAutomaticRelogin(r.uid);
   if(m.type==='log.line'||m.type==='status.action')this.appendLog(r.uid,d.level||'INFO',d.text||'星蝉日志事件');
   else if(m.type==='log.history'){for(const line of (Array.isArray(d.lines)?d.lines:[]).slice(-150))this.appendLog(r.uid,line.level||'INFO',line.text||'');}
   else if(m.type==='session.changed')this.syncSession(r).catch(()=>{});
   else if(m.type==='status.error')this.appendLog(r.uid,'ERROR',d.summary||d.title||d.text||d.message||'星蝉报告错误');
   else if(m.type==='run.state'){const signature=JSON.stringify([d.running,d.paused,d.stopping]);if(r.lastRunLog!==signature){r.lastRunLog=signature;this.appendLog(r.uid,'INFO',d.stopping?'正在停止课程任务。':d.running?(d.paused?'课程任务已暂停。':'课程任务正在运行。'):'课程任务空闲。');}}
  };
  ws.onerror=()=>{};ws.onclose=()=>{if(!r.stopping&&!r.exited){r.reconnect=setTimeout(()=>this.connectEvents(r),3000);r.reconnect.unref?.();}};
 }
 async stopRuntime(uid){const r=this.runtimes.get(uid);if(!r)return;if(r.stopPromise)return r.stopPromise;this.automaticRelogin.cancel(uid);r.stopping=true;r.state='stopping';r.updatedAt=new Date().toISOString();r.abort.abort();return r.stopPromise=(async()=>{if(this.onCloseHtml)try{await this.onCloseHtml({uid});}catch{this.appendLog(uid,'WARN','控制面板关闭失败，继续停止后端进程。');}r.socket?.close();clearTimeout(r.reconnect);clearInterval(r.poll);if(!r.exited)await require('./backend-lifecycle.cjs').stopChild(r);await r.gateway?.close().catch(()=>{});if(this.runtimes.get(uid)===r)this.runtimes.delete(uid);this.stoppedAt.set(uid,new Date().toISOString());})().catch(error=>{r.stopPromise=null;throw error;});}
 async stop({uid}){uidOf(uid);this.startCancellations.get(uid)?.abort(Error("星蝉启动已取消"));this.automaticRelogin.cancel(uid);if(this.runtimes.has(uid))await this.stopRuntime(uid);if(this.pendingStarts.has(uid))await this.pendingStarts.get(uid).catch(()=>{});await this.stopRuntime(uid);return this.status(uid);}
 cancelAutomaticRelogin(uid){this.automaticRelogin.cancel(uid);}
 scheduleRelogin(r,signal={}){
  const valid=()=>this.runtimes.get(r.uid)===r&&!r.stopping&&!r.exited&&!r.identityChanged&&!r.sessionDisplaced;
  const resume=signal.resume===true;
  this.automaticRelogin.schedule(r.uid,{valid,onWait:delay=>this.appendLog(r.uid,'WARN',delay?'风控限制尚未解除，自动重新登录将在 '+Math.ceil(delay/60000)+' 分钟后重试；可随时手动重启。':'风控限制尚未解除，准备自动重新登录。'),onError:()=>this.appendLog(r.uid,'WARN','自动重新登录未完成，至少两分钟后重试。'),attempt:async current=>{
   r.state='logging-in';r.updatedAt=new Date().toISOString();
   try{
    await this.request(r,'POST','/api/run/stop');
    const deadline=Date.now()+15000;let run;
    while(current()&&Date.now()<deadline){run=await this.request(r,'GET','/api/run');if(!run.running)break;await sleep(300);}
    if(!current())return;if(run?.running)throw Error('runner_still_stopping');
    await this.request(r,'POST','/api/session/login',r.login,65000);
    if(!current())return;await this.syncSession(r);if(!r.loggedIn)throw Error('login_not_confirmed');
    this.appendLog(r.uid,'INFO','自动重新登录成功，课程队列和进度已保留。');
    if(resume&&current()){const options=await this.request(r,'GET','/api/integration/run-options');if(current())await this.request(r,'POST','/api/run/start',options,30000);}
   }finally{if(this.runtimes.get(r.uid)===r&&!r.stopping&&!r.exited){r.state='running';r.updatedAt=new Date().toISOString();}}
  }});
 }
 async openHtml({uid}){uidOf(uid);const r=this.runtimes.get(uid);if(!r?.port||!r.token)throw Error('请先启动该账号的星蝉后端');if(!this.onOpenHtml)throw Error('管理窗口处理器未连接');await this.onOpenHtml({uid,url:'http://127.0.0.1:'+r.port+'/#t='+r.token,mode:r.enhanced===false?'native':'live'});return {opened:true,mode:'live',uid};}
 getLogs({uid,limit=200,after}){uidOf(uid);const all=this.logBuffers.get(uid)||[],count=Math.min(500,Math.max(1,Number(limit)||200)),cursor=this.logSequences.get(uid)||0,incremental=Number.isSafeInteger(after)&&after>=0&&after<=cursor,reset=!incremental||!!all.length&&after<all[0].id-1;return {uid,mode:this.runtimes.has(uid)?'live':'unconnected',cursor,reset,lines:(reset?all:all.filter(line=>line.id>after)).slice(-count)};}
}
module.exports={IntegrationController,uidOf,redact};
