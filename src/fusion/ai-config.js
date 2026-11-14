(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionAIConfig=api;})(globalThis,()=>{
 'use strict';
 const TYPES=['auto','openai','anthropic','gemini','ollama'],MAX=16;
 const isId=id=>id==='xingchan-ai'||/^ai-[a-f0-9]{16}$/.test(id);
 const empty=()=>({baseUrl:'',model:'',type:'openai'});
 const type=ai=>ai?.type==='auto'?(/generativelanguage\.googleapis\.com/i.test(ai.baseUrl)?'gemini':/anthropic/i.test(ai.baseUrl)?'anthropic':/11434|ollama/i.test(ai.baseUrl)?'ollama':'openai'):ai?.type;
 const configured=ai=>!!(ai?.baseUrl&&ai.model&&(ai.key||ai.hasKey||type(ai)==='ollama'));
 const normalizedName=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase();
 function address(value){
  const text=String(value||'').trim();if(!text)return '';
  let url;try{url=new URL(text);}catch{throw Error('AI 地址格式不合法');}
  if(text.length>2000||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('AI 地址需要使用 HTTPS（本机接口可使用 HTTP），不能含账号、查询参数或片段');
  return url.href.replace(/\/$/,'');
 }
 function normalize(entries,{saved=[],requireComplete=false}={}){
  if(!Array.isArray(entries)||entries.length>MAX)throw Error('最多支持 '+MAX+' 个 AI 配置');
  const ids=new Set(),names=new Set();
  return entries.map(entry=>{
   if(!entry||!isId(entry.id)||ids.has(entry.id)||!TYPES.includes(entry.type))throw Error('AI 配置标识或接口类型无效');ids.add(entry.id);
   const model=String(entry.model||'').trim(),name=String(entry.name||model).trim(),baseUrl=address(entry.baseUrl);
   if(!name||name.length>500||model.length>256)throw Error('请填写 AI 配置名称和有效的模型名称（模型名最多 256 个字符）');
   if(names.has(normalizedName(name)))throw Error('不允许多个 AI 配置使用相同名称');names.add(normalizedName(name));
   if(entry.key!==undefined&&(typeof entry.key!=='string'||entry.key.length>8192))throw Error('API Key 格式或长度无效');
   const previous=saved.find(item=>item.id===entry.id),sameOrigin=!!(baseUrl&&previous?.baseUrl&&new URL(baseUrl).origin===new URL(previous.baseUrl).origin);
   const key=entry.clearKey?'':entry.key||((sameOrigin&&previous?.key)||'');
   const result={id:entry.id,name,baseUrl,model,type:entry.type,key};
   const unchanged=previous&&['id','name','baseUrl','model','type','key'].every(field=>result[field]===previous[field]);
   if(requireComplete&&!configured(result)&&!unchanged)throw Error(name+'：请填写接口地址、模型及对应 API Key（Ollama 可不填 Key）');
   return result;
  });
 }
 function read(controller,uid){
  const raw=controller.plainSecret(uid,'aiConfigurations');
  if(raw){let entries;try{entries=JSON.parse(raw);}catch{throw Error('已保存的 AI 配置无法解析');}return normalize(entries);}
  const ai=controller.base?controller.base(uid).ai:controller.data.profiles[uid]?.ai;
  const key=controller.plainSecret(uid,'aiKey');
  return ai&&(ai.baseUrl||ai.model||key)?normalize([{...ai,id:'xingchan-ai',name:ai.model||'AI 搜题',key}]):[];
 }
 function summaries(entries,preview){return entries.map(({key,...ai})=>({...ai,hasKey:!!key,keyPreview:key?preview(key):''}));}
 function reconcile(methods,entries){
  const valid=new Set(entries.map(ai=>ai.id)),result=methods.filter(item=>!isId(item.id)||item.id==='xingchan-ai'||valid.has(item.id)).map(item=>({...item,enabled:item.enabled&&(!isId(item.id)||valid.has(item.id))}));
  for(const ai of entries)if(!result.some(item=>item.id===ai.id))result.splice(Math.max(0,result.findIndex(item=>item.id==='xingchan-bank')),0,{id:ai.id,enabled:configured(ai)});
  return result;
 }
 return {TYPES,MAX,isId,empty,type,configured,normalizedName,address,normalize,read,summaries,reconcile};
});
