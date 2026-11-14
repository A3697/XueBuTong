(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionClientEnvironment=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const DEFAULTS=Object.freeze({deviceId:'',androidVersion:'17',model:'2410DPN6CC',buildNumber:'CP2A.260605.016',chromeVersion:'151.0.7922.199',webviewBase:'',dalvikBase:'',schildWebview:'',schildDalvik:''});
 function defaults(){return {...DEFAULTS};}
 function normalize(input){
  if(input==null)return defaults();
  if(typeof input!=='object'||Array.isArray(input))throw Error('客户端环境配置格式无效。');
  const result=defaults();
  for(const key of Object.keys(DEFAULTS)){
   if(input[key]===undefined)continue;
   if(typeof input[key]!=='string')throw Error('客户端环境字段必须为文本。');
   result[key]=input[key].trim();
  }
  for(const key of ['deviceId','schildWebview','schildDalvik']){
   if(result[key]&&!/^[a-f0-9]{32}$/i.test(result[key]))throw Error((key==='deviceId'?'设备号':'schild 标识')+'应为 32 位十六进制字符，不含短横线。');
   result[key]=result[key].toLowerCase();
  }
  if(!/^\d{1,2}(?:\.\d{1,2}){0,2}$/.test(result.androidVersion))throw Error('Android 版本格式无效，例如 17 或 14.0。');
  for(const key of ['model','buildNumber'])if(!/^[A-Za-z0-9._ -]{1,80}$/.test(result[key]))throw Error('机型和构建号仅支持字母、数字、空格、点、下划线和短横线。');
  if(!/^\d{1,3}(?:\.\d{1,6}){3}$/.test(result.chromeVersion))throw Error('Chrome 版本需包含四段数字。');
  for(const key of ['webviewBase','dalvikBase'])if(result[key]&&(result[key].length>1024||!/^[\x20-\x7e]+$/.test(result[key])||/\(schild:|ChaoXingStudy_/i.test(result[key])))throw Error('UA 基础串需为单行英文字符，最多 1024 字符；设备号及 schild 后缀由程序追加。');
  return result;
 }
 function bytes(length){const data=new Uint8Array(length);if(typeof globalThis.crypto?.getRandomValues==='function')globalThis.crypto.getRandomValues(data);else if(typeof require==='function')data.set(require('node:crypto').randomBytes(length));else throw Error('随机生成器不可用。');return data;}
 function randomDeviceId(){const data=bytes(16);data[6]=(data[6]&15)|64;data[8]=(data[8]&63)|128;return [...data].map(value=>value.toString(16).padStart(2,'0')).join('');}
 function randomFingerprint(){
  // Header templates describe client compatibility; they do not emulate real
  // hardware, TLS, Canvas, WebGL, an IP address or platform risk decisions.
  const templates=[
   {androidVersion:'17',model:'2410DPN6CC',buildNumber:'CP2A.260605.016',chromeVersion:'151.0.7922.199'},
   {androidVersion:'14',model:'Pixel 7',buildNumber:'UP1A.231005.007',chromeVersion:'126.0.0.0'},
   {androidVersion:'13',model:'Pixel 7',buildNumber:'TQ3A.230805.001',chromeVersion:'126.0.0.0'}
  ];
  const result={...DEFAULTS,...templates[bytes(1)[0]%templates.length],schildWebview:randomDeviceId(),schildDalvik:randomDeviceId()};
  delete result.deviceId;return result;
 }
 function forClone(input){return {...normalize(input),deviceId:'',schildWebview:'',schildDalvik:''};}
 return {defaults,normalize,randomDeviceId,randomFingerprint,forClone};
});
