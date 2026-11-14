'use strict';
const LoginProfiles=require('./login-profiles.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

// These are the native OCS 2.9.24 renderer defaults. Decryption must precede
// applying defaults; otherwise lodash treats the encrypted render as a string.
function renderDefaults(){return {
 scripts:[],notifies:[],
 browser:{currentFolderUid:'',currentBrowserUid:'',root:{name:'根目录',createTime:Date.now(),type:'root',uid:'root-folder',children:{},renaming:false},tags:{},search:{value:'',tags:[]}},
 dashboard:{details:{tags:false,notes:false},num:4,video:{aspectRatio:0}},
 setting:{browserType:'diy',showSideBarText:true,launchOptions:{custom:false,executablePath:''},theme:{dark:false},ocs:{currentProjectName:'',store:{},openSync:false},browser:{cachesSizeWarningPoint:10,enableDialog:false,forceUpdateScript:false}},
 langs:{},state:{first:true,setup:true,mini:false,responsive:'small',height:900,read_record:{}}
};}
function mergeDefaults(value,defaults){
 if(!object(value))throw Error('OCS 配置对象格式无效');
 for(const [key,fallback]of Object.entries(defaults)){
  if(value[key]===undefined||value[key]===null)value[key]=copy(fallback);
  else if(object(fallback)){
   if(!object(value[key]))throw Error('OCS 配置字段格式无效：'+key);
   mergeDefaults(value[key],fallback);
  }else if(Array.isArray(fallback)&&!Array.isArray(value[key]))throw Error('OCS 配置列表格式无效：'+key);
 }
 return value;
}
function normalizeRender(render){const value=mergeDefaults(copy(render),renderDefaults());require('./account-tags.js').repair(value.browser);return value;}
function reconcileLogin(profile,native,vault){
 const login=LoginProfiles.parse(native.playwrightScripts);
 // The old Star-only editor is migrated by credential-sync once, provided
 // there is no native login selection. A configured native removal stays empty.
 if(!login.hasNativeSelection&&typeof profile.loginKind!=='string')return profile;
 const cx=login.starEligible;
 const sameIdentity=profile.username===login.username&&(!profile.loginKind||profile.loginKind===login.kind)&&
  (login.kind!=='cx-unit'||profile.loginUnit===login.unit);
 const oldPassword=profile.secrets?.password;
 let password='',passwordKnown=true;
 if(oldPassword){try{password=String(vault.decryptString(Buffer.from(oldPassword,'base64')));}catch{passwordKnown=false;/* Replaced from native configuration below. */}}
 const nativeLoginIdentity=require('./login-api.cjs').identity(login);
 const verifiedIdentityMatches=typeof profile.nativeLoginIdentity==='string'?profile.nativeLoginIdentity===nativeLoginIdentity:
  cx&&sameIdentity&&passwordKnown&&password===login.password;
 profile.loginKind=login.kind;profile.loginPlatform=login.platform;profile.loginUnit=login.unit||'';profile.starEligible=cx;
 profile.username=cx?login.username:'';
 profile.schoolId=cx&&login.kind==='cx-unit'?(/^\d+$/.test(login.unit)?login.unit:sameIdentity?profile.schoolId||'':''):'';
 profile.secrets??={};
 if(cx&&login.password){if(password!==login.password)profile.secrets.password=vault.encryptString(login.password).toString('base64');}
 else delete profile.secrets.password;
 profile.nativeLoginIdentity=nativeLoginIdentity;
 if(!verifiedIdentityMatches){profile.displayName='';profile.nameSource='';delete profile.verifiedDetails;}
 return profile;
}
function loginMetadata(profile){
 if(typeof profile.loginKind!=='string')return {};
 if(!['none','ambiguous',...Object.keys(LoginProfiles.kinds)].includes(profile.loginKind))throw Error('账号登录方式格式无效');
 if(profile.loginUnit!==undefined&&(typeof profile.loginUnit!=='string'||profile.loginUnit.length>500))throw Error('学校或机构名称格式无效');
 const spec=LoginProfiles.kinds[profile.loginKind];
 return {loginKind:profile.loginKind,loginPlatform:spec?.platform||'none',loginUnit:spec?.unit?profile.loginUnit||'':'',starEligible:spec?.platform==='chaoxing',...(/^[a-f0-9]{64}$/.test(profile.nativeLoginIdentity||'')?{nativeLoginIdentity:profile.nativeLoginIdentity}:{})};
}
module.exports={renderDefaults,normalizeRender,reconcileLogin,loginMetadata};
