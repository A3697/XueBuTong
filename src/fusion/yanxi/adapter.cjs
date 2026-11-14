'use strict';
const http=require('node:http'),https=require('node:https');
const {parseYanxiV2Response,YanxiProtocolError}=require('./yanxi-v2.cjs');
const ENDPOINT='https://tk.enncy.cn/query';
const Wrapper=require('../yanxi-config.js');
const TYPES=new Set(['single','multiple','judgement','completion','short']);
function fail(code,category='configuration'){throw new YanxiProtocolError(code,category);}
function buildPlainV2Data(token,question) {
 if(typeof token!=='string'||!token||token.length>16384)fail('yanxi_token_missing_or_invalid');
 if(!question||typeof question.title!=='string'||!question.title.trim()||question.title.length>20000)fail('yanxi_invalid_question');
 if(!TYPES.has(question.type))fail('yanxi_unsupported_question_type');
 if(question.images!==undefined&&(!Array.isArray(question.images)||question.images.length))fail('yanxi_image_request_not_validated');
 let options='';
 if(typeof question.options==='string')options=question.options;
 else if(Array.isArray(question.options)){options=question.options.map(option=>{if(typeof option==='string')return option;if(option&&typeof option.text==='string')return option.text;fail('yanxi_invalid_options');}).join('\n');}
 else if(question.options!==undefined)fail('yanxi_invalid_options');
 if(options.length>100000)fail('yanxi_options_too_large');
 // No arbitrary data handler is evaluated. These are the observed plain-text fields.
 // OCS classifies free-text/short-answer questions as completion for wrappers.
 return {images:[],options,suggestion_options:'',suggestion_title:'',title:question.title,token,type:question.type==='short'?'completion':question.type,v:'2'};
}
function validateEndpoint(value,allowLoopbackTestEndpoint) {
 let url;try{url=new URL(value);}catch(_){fail('yanxi_endpoint_invalid');}
 const official=url.href===ENDPOINT;
 const local=allowLoopbackTestEndpoint===true&&url.protocol==='http:'&&['127.0.0.1','[::1]'].includes(url.hostname)&&url.pathname==='/query';
 if((!official&&!local)||url.username||url.password||url.search||url.hash)fail('yanxi_endpoint_not_allowlisted');return url;
}
function createYanxiV2Adapter(config) {
 if(!config||typeof config!=='object')fail('yanxi_config_missing');
 const endpoint=validateEndpoint(config.endpoint||ENDPOINT,config.allowLoopbackTestEndpoint);
 const wrapper=config.wrapper?Wrapper.parse(config.wrapper):null;
 const token=wrapper?.token||config.token;
 if(typeof token!=='string'||!token||token.length>16384)fail('yanxi_token_missing_or_invalid');
 const timeoutMs=config.timeoutMs===undefined?10000:config.timeoutMs,maxResponseBytes=config.maxResponseBytes===undefined?524288:config.maxResponseBytes;
 if(!Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>30000||!Number.isInteger(maxResponseBytes)||maxResponseBytes<1024||maxResponseBytes>2097152)fail('yanxi_invalid_limits');
 return async function lookup(question) {
  const data=buildPlainV2Data(token,question);
  if(wrapper){for(const field of ['suggestion_title','suggestion_options'])data[field]=typeof question[field]==='string'?question[field]:'';}
  const payload=Buffer.from(JSON.stringify(data),'utf8');
  return new Promise((resolve,reject)=>{
   let settled=false,timer,request;
   function done(error,value){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);}
   try {
    const client=endpoint.protocol==='https:'?https:http;
    request=client.request(endpoint,{method:'POST',agent:false,rejectUnauthorized:true,headers:{'Content-Type':'application/json','Accept':'application/json','Accept-Encoding':'identity','Content-Length':payload.length}},response=>{
     const status=response.statusCode||0,chunks=[];let size=0;
     response.on('data',chunk=>{size+=chunk.length;if(size>maxResponseBytes){done(new YanxiProtocolError('yanxi_response_too_large','transport'));response.destroy();request.destroy();}else chunks.push(chunk);});
     response.on('error',()=>done(new YanxiProtocolError('yanxi_response_network_error','transport')));
     response.on('end',()=>{
      if(settled)return;
      if(status>=300&&status<400){done(new YanxiProtocolError('yanxi_redirect_refused','transport'));return;}
      let json=null;
      if(status===200){try{json=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){done(new YanxiProtocolError('yanxi_invalid_json','protocol'));return;}}
      try{done(null,parseYanxiV2Response({httpStatus:status,json},data.title));}catch(error){done(error instanceof YanxiProtocolError?error:new YanxiProtocolError('yanxi_response_parse_error','protocol'));}
     });
    });
    request.on('error',()=>done(new YanxiProtocolError('yanxi_request_network_error','transport')));
    timer=setTimeout(()=>{done(new YanxiProtocolError('yanxi_timeout','transport'));request.destroy();},timeoutMs);
    request.end(payload);
   }catch(_){done(new YanxiProtocolError('yanxi_request_failed','transport'));if(request)request.destroy();}
  });
 };
}
module.exports={createYanxiV2Adapter,buildPlainV2Data,ENDPOINT};
