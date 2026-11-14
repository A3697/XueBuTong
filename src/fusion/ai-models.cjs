'use strict';
const {requestJson,endpoint}=require('./connection-checks.cjs');
function protocol(ai){return ai.type==='auto'?(/generativelanguage\.googleapis\.com/i.test(ai.baseUrl)?'gemini':/anthropic/i.test(ai.baseUrl)?'anthropic':/11434|ollama/i.test(ai.baseUrl)?'ollama':'openai'):ai.type;}
function draftKey(ai,controller,uid){
 if(typeof ai.key==='string'&&ai.key.length>8192)throw Error('API Key 过长');
 if(ai.key)return ai.key;if(ai.clearKey)return '';
 const saved=require('./ai-config.js').read(controller,uid).find(item=>item.id===(ai.id||'xingchan-ai'));
 // Changing a provider never forwards a different provider's saved secret.
 if(saved?.baseUrl&&new URL(ai.baseUrl).origin===new URL(saved.baseUrl).origin)return saved.key;
 return '';
}
async function listModels({uid,ai},controller,transport=requestJson){
 if(!ai||typeof ai.baseUrl!=='string'||!['auto','openai','anthropic','gemini','ollama'].includes(ai.type))throw Error('请选择接口类型并填写地址');
 const type=protocol(ai),base=endpoint(ai.baseUrl,''),key=draftKey(ai,controller,uid);
 if(type!=='ollama'&&!key)return {models:[],needsKey:true,message:'填写此厂商的 API Key 后自动获取模型，也可手动输入模型名称。'};
 const url=endpoint(base.href,type==='ollama'?'/api/tags':'/models'),headers={};
 if(type==='gemini'){headers['x-goog-api-key']=key;url.searchParams.set('pageSize','1000');}
 else if(type==='anthropic'){headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';url.searchParams.set('limit','1000');}
 else if(key)headers.Authorization='Bearer '+key;
 const names=new Set();let more=false;
 for(let page=0;page<4;page++){
  let response;try{response=await transport(url,{method:'GET',headers});}catch{throw Error('模型列表获取超时或连接失败；可重试或手动填写模型。');}
  if(response.status<200||response.status>=300)throw Error(response.status===401||response.status===403?'模型列表鉴权失败，请检查此厂商的 API Key。':'模型列表暂不可用（HTTP '+response.status+'），可手动填写模型。');
  const data=response.json,rows=type==='ollama'||type==='gemini'?data?.models:data?.data;if(!Array.isArray(rows))throw Error('接口没有返回有效的模型列表；可手动填写模型。');
  for(const row of rows){if(type==='gemini'&&Array.isArray(row.supportedGenerationMethods)&&!row.supportedGenerationMethods.includes('generateContent'))continue;const name=type==='gemini'?row.name?.replace(/^models\//,''):type==='ollama'?row.model||row.name:row.id;if(typeof name==='string'&&name.length<=256&&name.trim())names.add(name);}
  more=false;
  if(type==='gemini'&&typeof data.nextPageToken==='string'&&data.nextPageToken){url.searchParams.set('pageToken',data.nextPageToken);more=true;}
  else if(type==='anthropic'&&data.has_more&&typeof data.last_id==='string'){url.searchParams.set('after_id',data.last_id);more=true;}
  if(!more)break;
 }
 return {models:[...names],truncated:more,message:names.size?'已从当前接口读取 '+names.size+' 个模型；仍可手动输入自定义模型。':type==='ollama'?'本地 Ollama 没有已安装模型。请先在 Ollama 中下载模型。':'接口返回空列表，仍可手动输入模型名称。'};
}
module.exports={listModels,protocol,draftKey};
