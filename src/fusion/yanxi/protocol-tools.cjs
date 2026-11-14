'use strict';
// Pure, offline helpers. No file access, no network, no wrapper execution.
// This file deliberately contains no default Yanxi success/miss/error codes.
const { createHash } = require('node:crypto');
const SAFE_PARAMS = new Set(['title','question','options','type','token','key','apiKey','query','q','subject','images','suggestion_title','suggestion_options']);
const SAFE_HEADERS = new Set(['authorization','x-token','x-api-key','content-type','accept','user-agent','origin','referer']);
const SAFE_PARTS = new Set(['api','v1','v2','v3','query','search','answer','answers','question','questions','index','get','find']);
const SAFE_RESPONSE_PARTS = new Set(['code','status','data','question','answer','answers','result','results','content','message','msg','error','ai','tags','success','balance','remaining','count']);
const SECRET_FIELD = /token|key|secret|password|authorization|cookie/i;

function own(object, key) {
  if (!object || typeof object !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object,key);
  return descriptor && Object.hasOwn(descriptor,'value') ? descriptor.value : undefined;
}
function dataKeys(object) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return [];
  return Object.keys(Object.getOwnPropertyDescriptors(object));
}
function simpleCodeOnly(source) {
  // Conservative lexer: skip quoted literals/comments. Template or regex/division
  // syntax declines semantic projection instead of risking quoted-secret output.
  if (source.includes('`')) return '';
  let result='';
  for(let i=0;i<source.length;i++) {
    const char=source[i],next=source[i+1];
    if(char==='/'&&next==='/'){while(i<source.length&&source[i]!=='\n')i++;result+='\n';continue;}
    if(char==='/'&&next==='*'){i+=2;while(i<source.length&&!(source[i]==='*'&&source[i+1]==='/'))i++;i++;result+=' ';continue;}
    if(char==='/')return '';
    if(char==='"'||char==="'") {const quote=char;i++;while(i<source.length&&source[i]!==quote){if(source[i]==='\\')i++;i++;}result+=' ';continue;}
    result+=char;
  }
  return result;
}
function handlerSummary(value) {
  if (typeof value !== 'string') return {present:false};
  const conditions = [],codeOnly=simpleCodeOnly(value);
  for (const match of codeOnly.matchAll(/\b(?:res|response)\.(code|status)\s*(===|==|!==|!=)\s*(-?\d{1,6})\b/g)) {
    const item={field:match[1],operator:match[2],constant:Number(match[3])};
    if (!conditions.some(entry=>JSON.stringify(entry)===JSON.stringify(item))) conditions.push(item);
  }
  const responsePaths = [];
  for (const match of codeOnly.matchAll(/\b(?:res|response)((?:\.[A-Za-z_$][A-Za-z0-9_$]*)+)/g)) {
    const path=match[1].slice(1),parts=path.split('.');
    if (parts.length<=6 && parts.every(part=>SAFE_RESPONSE_PARTS.has(part)) && !responsePaths.includes(path)) responsePaths.push(path);
  }
  return {
    present:true,bytes:Buffer.byteLength(value),sha256:createHash('sha256').update(value).digest('hex'),
    numericCodeComparisons:conditions.slice(0,32),responsePaths:responsePaths.slice(0,32),staticFactsAvailable:!!codeOnly,
    containsDynamicExecution:/\beval\s*\(|\bFunction\s*\(|\bimport\s*\(/.test(value),
    containsNetworkOrStorage:/\bfetch\s*\(|XMLHttpRequest|GM_xmlhttpRequest|localStorage|sessionStorage|cookie/i.test(value),
    interpretation:'structure-only; branch meaning and completeness require private static review'
  };
}
function endpointSummary(value) {
  if (typeof value!=='string') return {present:false};
  try {
    const url=new URL(value);
    const host=['tk.enncy.cn','api.enncy.cn','localhost','127.0.0.1','[::1]'].includes(url.hostname)?url.hostname:'[other-host-redacted]';
    const scheme=['https:','http:'].includes(url.protocol)?url.protocol:'[other-scheme]';
    return {
      present:true,scheme,host,port:url.port||null,
      pathShape:url.pathname.split('/').map(part=>part===''?'':SAFE_PARTS.has(part)?part:':redacted-segment').join('/'),
      queryKeys:[...new Set([...url.searchParams.keys()].map(key=>SAFE_PARAMS.has(key)?key:'[other-param]'))],
      hadUserInfo:!!(url.username||url.password),hadFragment:!!url.hash,
      note:'No URL query values, credentials, fragment text, or unknown path segments are returned'
    };
  } catch (_) { return {present:true,parseable:false}; }
}
function valueShape(key,value) {
  if (SECRET_FIELD.test(key)) return {kind:'secret-slot',present:value!==undefined&&value!==null};
  if (typeof value==='string') {
    const placeholders=[...value.matchAll(/\$\{(title|options|type|images|suggestion_title|suggestion_options)\}/g)].map(m=>m[1]);
    return {kind:'string',placeholders:[...new Set(placeholders)],hasOtherLiteralText:value.replace(/\$\{(title|options|type|images|suggestion_title|suggestion_options)\}/g,'').length>0};
  }
  if (value && typeof value==='object' && typeof own(value,'handler')==='string') return {kind:'field-handler',handler:handlerSummary(own(value,'handler'))};
  return {kind:value===null?'null':Array.isArray(value)?'array':typeof value};
}
function publicWrapperSummary(wrapper) {
  const headers=own(wrapper,'headers'),data=own(wrapper,'data');
  const method=own(wrapper,'method'),responseType=own(wrapper,'responseType'),contentType=own(wrapper,'contentType'),transport=own(wrapper,'type');
  return {
    schema:'wrapper-public-structure-v1',
    endpoint:endpointSummary(own(wrapper,'url')),
    method:['get','post'].includes(method)?method:method===undefined?'get (OCS default)':'[unsupported-method]',
    transport:['fetch','GM_xmlhttpRequest'].includes(transport)?transport:transport===undefined?'fetch (OCS default)':'[unsupported-transport]',
    responseType:['json','text'].includes(responseType)?responseType:['json','text'].includes(contentType)?contentType:'json (OCS default)',
    headerNames:[...new Set(dataKeys(headers).map(key=>SAFE_HEADERS.has(key.toLowerCase())?key.toLowerCase():'[other-header]'))],
    dataFields:dataKeys(data).map(key=>({name:SAFE_PARAMS.has(key)?key:'[other-field]',shape:valueShape(key,own(data,key))})),
    handler:handlerSummary(own(wrapper,'handler')),
    protocolVerified:false
  };
}
function pathValue(object,path) {
  if (typeof path!=='string'||!path||path.split('.').some(part=>!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)||['__proto__','prototype','constructor'].includes(part))) return undefined;
  let value=object;for(const part of path.split('.'))value=own(value,part);return value;
}
function validMapping(mapping) {
  if (!mapping || typeof mapping!=='object' || !mapping.codePath || !mapping.answerPath) return false;
  const seen = new Set();
  for(const key of ['hit','miss','authentication','credit','rateLimit']) {
    if(!Array.isArray(mapping[key])||mapping[key].length>64)return false;
    for(const code of mapping[key]) {
      if(!['number','string'].includes(typeof code))return false;
      const marker=typeof code+':'+String(code);if(seen.has(marker))return false;seen.add(marker);
    }
  }
  return mapping.hit.length>0;
}
function classifyWithExplicitMapping(response,mapping) {
  const error=(category,reason)=>({kind:'error',category,reason});
  const status=response && response.httpStatus;
  if(status===401||status===403)return error('authentication-or-access','http_authentication_or_access_error');
  if(status===402)return error('payment-required','http_payment_required');
  if(status===429)return error('rate-limit','http_rate_limit');
  if(!Number.isInteger(status)||status<200||status>=300)return error('transport','http_upstream_error');
  if(!response.json||typeof response.json!=='object'||Array.isArray(response.json))return error('protocol','invalid_json_shape');
  if(own(response.json,'error'))return error('business-unknown','unexpected_error_field');
  if(!validMapping(mapping))return error('protocol','explicit_verified_mapping_required');
  const code=pathValue(response.json,mapping.codePath),answer=pathValue(response.json,mapping.answerPath);
  for(const [group,category] of [['authentication','authentication'],['credit','credit'],['rateLimit','rate-limit']])if(mapping[group].includes(code))return error(category,'mapped_business_error');
  if(mapping.hit.includes(code)) {
    if(typeof answer!=='string'||!answer.trim())return error('protocol','empty_or_unsupported_success_answer');
    return {kind:'hit',answer};
  }
  if(mapping.miss.includes(code)) {
    if(answer!==undefined&&answer!==null&&answer!=='')return error('protocol','contradictory_miss_answer');
    return {kind:'miss'};
  }
  return error('business-unknown','unknown_business_code');
}
module.exports={publicWrapperSummary,handlerSummary,endpointSummary,classifyWithExplicitMapping};
