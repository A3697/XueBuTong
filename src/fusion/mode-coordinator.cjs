'use strict';
const {randomUUID}=require('node:crypto');
const {uidOf}=require('./controller.cjs');
const LoginProfiles=require('./login-profiles.js');
class ModeCoordinator {
  constructor(controller){this.controller=controller;this.leases=new Map();this.pending=new Map();}
  conflict(mode){const error=Error(mode==='verification'?'LOGIN_VERIFY_BUSY:该账号正在验证登录，请稍后重试。':mode==='browser'?'MODE_CONFLICT_BROWSER:该账号的浏览器正在运行。请先在学不通中点击该账号浏览器的“停止”，再继续此操作。':'MODE_CONFLICT_XINGCHAN:该账号的星蝉正在运行。请先在学不通中点击该账号星蝉的“停止”，再继续此操作。');error.code=mode==='verification'?'LOGIN_VERIFY_BUSY':'MODE_CONFLICT';return error;}
  identity(uid,username,login){const p=this.controller.data?.profiles?.[uid];const native=login&&LoginProfiles.kinds[login.kind]?LoginProfiles.normalize(login):null;const account=native?.username||(typeof username==='string'?username.trim():p?.username?.trim()||'');if(!account)return '';const platform=native?.platform||p?.loginPlatform||'chaoxing',kind=native?.kind||p?.loginKind||'cx-phone',unit=native?.unit??p?.loginUnit??p?.schoolId??'';return JSON.stringify([platform,kind.endsWith('-unit')?unit.toLowerCase():'',account.toLowerCase()]);}
  checkIdentity(uid,mode,identity){if(!identity)return;for(const lease of this.leases.values())if(lease.uid!==uid&&(lease.identity===identity||lease.pendingIdentity===identity))throw this.conflict(lease.mode);}
  current(uid){uidOf(uid);if(this.controller.runtimes.has(uid)||this.controller.pendingStarts.has(uid))return 'xingchan';return this.leases.get(uid)?.mode||null;}
  claimBrowser({uid,username,login}){
    uidOf(uid);const mode=this.current(uid);if(mode&&mode!=='browser')throw this.conflict(mode);
    const identity=this.identity(uid,username,login);this.checkIdentity(uid,'browser',identity);
    const existing=this.leases.get(uid);if(existing)return {...existing};
    const lease={uid,mode:'browser',id:randomUUID(),identity};this.leases.set(uid,lease);return {...lease};
  }
  releaseBrowser({uid,id}){uidOf(uid);const lease=this.leases.get(uid);if(lease?.mode==='browser'&&lease.id===id){this.leases.delete(uid);return true;}return false;}
  claimVerification({uid,login}){uidOf(uid);const mode=this.current(uid);if(mode)throw this.conflict(mode);const identity=this.identity(uid,undefined,login);this.checkIdentity(uid,'verification',identity);const lease={uid,mode:'verification',id:randomUUID(),identity};this.leases.set(uid,lease);return {...lease};}
  releaseVerification({uid,id}){uidOf(uid);const lease=this.leases.get(uid);if(lease?.mode==='verification'&&lease.id===id){this.leases.delete(uid);return true;}return false;}
  async start({uid}){
    uidOf(uid);const mode=this.current(uid);if(mode&&mode!=='xingchan')throw this.conflict(mode);
    if(this.pending.has(uid))return this.pending.get(uid);
    const identity=this.identity(uid);this.checkIdentity(uid,'xingchan',identity);
    const lease=this.leases.get(uid)?.mode==='xingchan'?this.leases.get(uid):{uid,mode:'xingchan',id:randomUUID(),identity};
    lease.pendingIdentity=identity;lease.cancelled=false;this.leases.set(uid,lease);
    const pending=Promise.resolve().then(()=>{if(lease.cancelled)throw Error('星蝉启动已取消');return this.controller.start({uid});}).then(result=>{
      const runtime=this.controller.runtimes.get(uid);
      lease.identity=identity;delete lease.pendingIdentity;lease.child=runtime?.child;
      if(runtime?.child)runtime.child.once('exit',()=>{if(this.leases.get(uid)===lease&&lease.child===runtime.child&&!this.pending.has(uid))this.leases.delete(uid);});
      return result;
    }).catch(error=>{delete lease.pendingIdentity;if(this.leases.get(uid)===lease&&!this.controller.runtimes.has(uid))this.leases.delete(uid);throw error;}).finally(()=>{if(this.pending.get(uid)===pending)this.pending.delete(uid);});
    this.pending.set(uid,pending);return pending;
  }
  async stop({uid}){
    uidOf(uid);const lease=this.leases.get(uid);if(lease?.mode==='xingchan')lease.cancelled=true;this.controller.cancelAutomaticRelogin?.(uid);
    await Promise.all([this.controller.stop({uid}),this.pending.get(uid)?.catch(()=>{})]);
    await this.controller.stop({uid});if(this.leases.get(uid)?.mode==='xingchan')this.leases.delete(uid);
    return this.controller.status(uid);
  }
  anyActive(){return !!(this.leases.size||this.pending.size||this.controller.runtimes.size||this.controller.pendingStarts.size);}
}
module.exports={ModeCoordinator};
