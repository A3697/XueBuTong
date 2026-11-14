'use strict';
const Profiles=require('./login-profiles.js');
const {uidOf}=require('./controller.cjs');
const {identity,information}=require('./login-api.cjs');
class LoginService {
 constructor({controller,modes,verifier}){Object.assign(this,{controller,modes,verifier});}
 async verify({uid,login}){
  uidOf(uid);const profile=Profiles.normalize(login);
  if(!Profiles.complete(profile))return{state:'unverified',message:'请补全账号、密码及所需学校信息。'};
  // Verification signs in too. Reserve the account to avoid invalidating a running session.
  const lease=this.modes.claimVerification({uid,login:profile});
  try{
   const result=await this.verifier.verify(profile);
   if(result.state==='success'){
    const p=this.controller.data.profiles[uid];
    const matches=p&&(p.nativeLoginIdentity===identity(profile)||profile.starEligible&&!p.nativeLoginIdentity&&Profiles.signature({kind:p.loginKind,username:p.username,password:this.controller.plainSecret(uid,'password'),unit:p.loginUnit})===Profiles.signature(profile));
    if(matches){
     const oldName=p.displayName,oldSource=p.nameSource,oldDetails=p.verifiedDetails;
     const details=information(result.info||{name:result.name},profile);
     if(details.name){p.displayName=details.name.slice(0,120);p.nameSource='verification';}
     p.verifiedDetails={...(oldDetails||{}),...Object.fromEntries(Object.entries(details).filter(([,value])=>value))};
     try{this.controller.persist();}catch(error){p.displayName=oldName;p.nameSource=oldSource;p.verifiedDetails=oldDetails;throw error;}
    }
   }
   return result;
  }finally{this.modes.releaseVerification(lease);}
 }
 dispose(){return this.verifier.dispose();}
}
module.exports={LoginService};
