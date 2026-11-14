'use strict';
// Observed wrapper-v2 POST response handling. This module never sends a request.
const MISS_PREFIX='非常抱歉，题库没有该题的答案（';
const INVALID_TOKEN_PREFIX='⚠️此题库配置已经无效 (或被重置)！';
class YanxiProtocolError extends Error {
  constructor(code,category='protocol') { super(code);this.name='YanxiProtocolError';this.code=code;this.category=category; }
}
const fail=(code,category)=>{throw new YanxiProtocolError(code,category);};
function own(object,key) {if(!object||typeof object!=='object')return undefined;const d=Object.getOwnPropertyDescriptor(object,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}
function plainMessage(value) {
  if(typeof value!=='string'||value.length>16384)fail('yanxi_invalid_answer_message');
  // No DOM parser or browser is involved. Only known inert formatting is removed.
  const stripped=value.replace(/<[^>]*>/g,tag=>{
    if(!/^<\/?(?:a|b|strong|em|span|p|div|br)(?:\s|\/?>)/i.test(tag))fail('yanxi_unsupported_message_markup');
    return '';
  });
  if(stripped.includes('<'))fail('yanxi_malformed_message_markup');
  return stripped.replace(/&(?:nbsp|amp|lt|gt|quot|apos);|&#(?:x[0-9a-fA-F]+|[0-9]+);/g,entity=>{
    const names={'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(Object.hasOwn(names,entity))return names[entity];
    const number=entity.startsWith('&#x')?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10);
    return Number.isInteger(number)&&number>0&&number<=0x10ffff?String.fromCodePoint(number):'';
  }).replace(/\s+/g,' ').trim();
}
function parseYanxiV2Response(response,expectedTitle) {
  const status=own(response,'httpStatus');
  if(status===401||status===403)fail('yanxi_http_authentication_or_access_error','authentication-or-access');
  if(status===402)fail('yanxi_http_payment_required','payment-required');
  if(status===429)fail('yanxi_http_rate_limit','rate-limit');
  if(status!==200)fail('yanxi_http_upstream_error','transport');
  const json=own(response,'json');if(!json||typeof json!=='object'||Array.isArray(json))fail('yanxi_invalid_json_shape');
  if(own(json,'error'))fail('yanxi_unexpected_error_field','business-unknown');
  const code=own(json,'code'),message=own(json,'message'),data=own(json,'data');
  if(!data||typeof data!=='object'||Array.isArray(data))fail('yanxi_invalid_data_shape');
  const question=own(data,'question'),answer=own(data,'answer'),tags=own(data,'tags');
  if(typeof question!=='string'||typeof answer!=='string')fail('yanxi_invalid_result_shape');
  if(code===0) {
    if(!Array.isArray(tags)||tags.length>100)fail('yanxi_invalid_failure_shape');
    if(typeof expectedTitle!=='string'||!expectedTitle||question!==expectedTitle)fail('yanxi_miss_question_mismatch');
    const normalized=plainMessage(answer);
    if(message==='请求失败'&&normalized.startsWith(MISS_PREFIX))return {kind:'miss',protocolStatus:'observed-post-v2-miss',evidence:'authorized-live-response-prefix-and-shape'};
    if(message==='请求失败'&&normalized.startsWith(INVALID_TOKEN_PREFIX))fail('yanxi_token_invalid','authentication');
    // Authentication, credit and other business failures may share code=0.
    // Their unknown messages are never returned or treated as an empty bank.
    fail('yanxi_code_zero_business_error','business-unknown');
  }
  // Only the genuine observed code=1/message pair is admitted, not code != 0.
  if(code!==1||message!=='请求成功')fail('yanxi_success_protocol_not_verified','business-unknown');
  const times=own(data,'times'),ai=own(data,'ai');
  if(!Number.isSafeInteger(times)||typeof ai!=='boolean'||(tags!==undefined&&(!Array.isArray(tags)||tags.length>100)))fail('yanxi_invalid_success_shape');
  if(!question.trim()||!answer.trim())fail('yanxi_empty_success');
  return {kind:'hit',answer,question,ai,protocolStatus:'observed-post-v2-hit'};
}
module.exports={parseYanxiV2Response,plainMessage,YanxiProtocolError,MISS_PREFIX,INVALID_TOKEN_PREFIX};
