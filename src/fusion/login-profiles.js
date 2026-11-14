(function(root,factory){const api=factory(root.FusionAutomationConfigs||(typeof module==='object'&&module.exports?require('./automation-config.js'):undefined));if(typeof module==='object'&&module.exports)module.exports=api;root.FusionLoginProfiles=api;})(typeof globalThis==='object'?globalThis:this,function(Automation){
 'use strict';
 const definitions={
  '超星-手机密码登录':{kind:'cx-phone',platform:'chaoxing',username:'phone'},
  '超星-学校机构登录':{kind:'cx-unit',platform:'chaoxing',username:'id',unit:'unit'},
  '智慧树-手机密码登录':{kind:'zhs-phone',platform:'zhihuishu',username:'phone'},
  '智慧树-学校登录':{kind:'zhs-unit',platform:'zhihuishu',username:'id',unit:'schoolname'},
  '职教云-账号密码登录':{kind:'zjy',platform:'zjy',username:'username'},
  '智慧职教-账号密码登录':{kind:'icve',platform:'icve',username:'username'}
 };
 const kinds=Object.fromEntries(Object.entries(definitions).map(([name,spec])=>[spec.kind,{name:Automation.aliases[name]?.[0]||name,...spec}]));
 kinds.icourse={name:'中国大学MOOC-自动账号登录',kind:'icourse',platform:'icourse',username:'username'};
 for(const item of Automation.catalog)if(/登录/.test(item.name))definitions[item.name]=Automation.loginSpec(item)||{platform:item.name.startsWith('超星')?'chaoxing':'zhihuishu'};
 for(const [name]of Object.entries(Automation.aliases))if(!definitions[name])definitions[name]=Automation.loginSpec({name,configs:{}})||{};
 const value=(script,key)=>{const entry=script.configs?.[key];return typeof entry==='string'?entry:String(entry?.value??'');};
 function parse(scripts=[]){
  const selected=(Array.isArray(scripts)?scripts:[]).filter(s=>s&&typeof s.name==='string'&&/登录/.test(s.name)),items=selected.filter(s=>Automation.loginSpec(s)),selection={hasNativeSelection:selected.length>0,selectedLoginNames:selected.map(s=>s.name)};
  if(items.length!==1||selected.length!==1)return{...selection,kind:selected.length?'ambiguous':'none',platform:'none',starEligible:false,name:'',username:'',password:'',unit:'',reason:selected.length?'请仅选择一种受支持的账号登录方式':'请先配置账号登录方式'};
  const script=Automation.normalize(items[0]),spec=Automation.loginSpec(script);
  return{...selection,kind:spec.kind,platform:spec.platform,starEligible:spec.platform==='chaoxing',name:script.name,username:value(script,spec.username).trim(),password:value(script,'password'),unit:spec.unit?value(script,spec.unit).trim():'',reason:spec.platform==='chaoxing'?'':'星蝉仅支持学习通账号'};
 }
 function normalize(profile){
  if(!profile||!kinds[profile.kind])throw Error('请选择有效的账号登录方式');
  const spec=kinds[profile.kind],username=String(profile.username??'').trim(),password=String(profile.password??''),unit=spec.unit?String(profile.unit??'').trim():'';
  if(username.length>500||password.length>8192||unit.length>500)throw Error('账号登录配置过长');
  return{kind:spec.kind,platform:spec.platform,starEligible:spec.platform==='chaoxing',name:spec.name,username,password,unit};
 }
 function complete(profile){return!!profile&&!!profile.username&&!!profile.password&&(!kinds[profile.kind]?.unit||!!profile.unit);}
 function signature(profile){return JSON.stringify([profile?.kind||'none',profile?.username||'',profile?.password||'',profile?.unit||'']);}
 // A login identity does not depend on the password. School accounts are scoped to their school.
 function accountKey(profile){
  const spec=kinds[profile?.kind],username=String(profile?.username||'').trim(),unit=spec?.unit?String(profile?.unit||'').trim():'';
  return spec&&username&&(!spec.unit||unit)?JSON.stringify([profile.kind,username,unit]):'';
 }
 return{definitions,kinds,parse,normalize,complete,signature,accountKey};
});
