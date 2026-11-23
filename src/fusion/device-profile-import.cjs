'use strict';
const Environment=require('./client-environment.js');
const MAX_BYTES=1024*1024;
const LABELS={deviceId:'设备号',androidVersion:'Android 版本',model:'设备型号',buildNumber:'系统构建号',chromeVersion:'Chrome 版本',schildWebview:'WebView schild'};

function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function validateJson(value,depth=0){
 if(depth>32)fail('device_import_depth','设备 JSON 层级过深。');
 if(!value||typeof value!=='object')return;
 for(const key of Object.keys(value)){
  if(['__proto__','constructor','prototype'].includes(key))fail('device_import_field','设备 JSON 包含不支持的字段。');
  validateJson(value[key],depth+1);
 }
}

// This returns a preview patch only. It performs no file, network or account
// mutation and never promotes the reader's reference templates to real capture.
function parse(text){
 if(typeof text!=='string')fail('device_import_type','请提供设备读取器导出的 JSON 文本。');
 if(Buffer.byteLength(text,'utf8')>MAX_BYTES)fail('device_import_size','设备 JSON 不能超过 1 MiB。');
 let report;
 try{report=JSON.parse(text.replace(/^\uFEFF/,''));}
 catch{fail('device_import_json','设备文件不是有效的 JSON。');}
 validateJson(report);
 if(!object(report)||report.schema_version!==2)fail('device_import_schema','仅支持设备读取器 schema_version 为 2 的导出文件。');
 const capture=report.study_capture;
 if(!object(capture))fail('device_import_capture','文件没有所选学习通的实际读取记录，请先在读取器中从学习通读取后重新导出。');
 if(typeof capture.user_agent!=='string'||!capture.user_agent.trim())fail('device_import_ua','实际读取记录缺少完整 WebView User-Agent。');
 if(capture.user_agent.length>2048||!/^[\x20-\x7e]+$/.test(capture.user_agent))
  fail('device_import_ua','实际 WebView User-Agent 格式无效：需要单行 ASCII 文本，最多 2048 字符。');
 let ua;
 try{ua=Environment.normalize({webviewFull:capture.user_agent}).webviewFull;}
 catch{fail('device_import_ua','实际 WebView User-Agent 格式无效：需要单行 ASCII 文本，最多 2048 字符。');}
 if(capture.study_ua_marker!==true||!/(?:^| )com\.chaoxing\.mobile\/ChaoXingStudy_[^ ]+(?= |$)/.test(ua))
  fail('device_import_source','该记录没有一致的学习通 UA 标记，不能当作学习通实际配置导入。');
 if(!/^Mozilla\/\d+(?:\.\d+)*(?: |$)/.test(ua))fail('device_import_ua_kind','尚不支持该实际 UA 格式，未套用参考模板或修改配置。');
 if(capture.flag_info!==undefined&&capture.flag_info!==null&&(typeof capture.flag_info!=='string'||capture.flag_info.length>8192))
  fail('device_import_flag','设备特征码字段格式无效。');

 const patch={webviewFull:ua};
 const warnings=['仅对星蝉增强模式生效，不修改 OCS 浏览器配置或关闭增强后的原生星蝉。','仅导入实际 WebView UA；已有完整 Dalvik UA 保持原配置，可能仍含原身份，请在保存前核对。','完整 WebView UA 优先按原值发送，调整设备号或 schild 不会自动改写它。','记录由助手页面上报，不构成客户端身份或签名证明。'];
 const extract=(key,pattern)=>{
  const matches=[...ua.matchAll(pattern)];
  if(matches.length!==1){warnings.push('未唯一识别'+LABELS[key]+'，该项保持原配置。');return;}
  try{if(!matches[0][1].trim())throw Error();patch[key]=Environment.normalize({[key]:matches[0][1]})[key];}
  catch{warnings.push('实际 UA 中的'+LABELS[key]+'格式暂不支持，该项保持原配置。');}
 };
 extract('deviceId',/\(@(?:Kalimdor|Azeroth)\)_([^ ]+)/g);
 extract('androidVersion',/\bAndroid ([^;)]+)/g);
 extract('model',/\(device:([^)]*)\)/g);
 extract('buildNumber',/\bBuild\/([^; )]+)/g);
 extract('chromeVersion',/\b(?:Chrome|Chromium)\/([^ )]+)/g);
 extract('schildWebview',/\(schild:([^)]*)\)/g);
 const hasDeviceFeatureCode=typeof capture.flag_info==='string'&&capture.flag_info.trim().length>0;
 if(hasDeviceFeatureCode)warnings.push('文件包含设备特征码，当前星蝉接口未支持，此项未导入、不会发送。');
 return {patch,fields:Object.keys(patch),warnings,source:{schemaVersion:2,uaKind:'webview',hasDeviceFeatureCode}};
}

module.exports={parse,MAX_BYTES};
