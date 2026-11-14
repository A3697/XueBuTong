(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionQuestionBanks=api;})(globalThis,()=>{
 'use strict';
 const MAX_BYTES=262144;
 const secretName=key=>/token|key|secret|password|authorization/i.test(key);
 const legacyPreview=value=>value.length>8?value.slice(0,4)+'…'+value.slice(-4):'********';
 const preview=value=>legacyPreview(String(value).replace(/^sk-/i,''));
 const mask=value=>'<已保存：'+preview(value)+'>';
 function stableId(value){let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return 'ocs-'+(n>>>0).toString(16).padStart(8,'0');}
 function walk(value,fn,path=[]){if(path.length>48)throw Error('题库配置层级过深');if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('题库配置包含无效字段');if(typeof item==='string'&&key==='url')value[key]=item.replace(/([?&])([^=&#]+)=([^&#]*)/g,(whole,sep,name,raw)=>{let decoded;try{decoded=decodeURIComponent(name);}catch{return whole;}if(!secretName(decoded))return whole;let text;try{text=decodeURIComponent(raw.replace(/\+/g,' '));}catch{text=raw;}return sep+name+'='+encodeURIComponent(fn(text,[...path,key,'@query:'+decoded]));});else if(typeof item==='string'&&secretName(key))value[key]=fn(item,[...path,key]);else if(item&&typeof item==='object')walk(item,fn,[...path,key]);}}
 function parse(input,{saved}={}){
  let entries;try{if(typeof input==='string'&&input.length>MAX_BYTES)throw Error();entries=typeof input==='string'?JSON.parse(input.replace(/^\uFEFF/,'')):JSON.parse(JSON.stringify(input));}catch{throw Error('题库配置不是有效的 JSON，请粘贴 OCS 格式的题库配置数组。');}
  if(!Array.isArray(entries)||entries.length>32)throw Error('题库配置必须是 JSON 数组，最多支持 32 个题库。');
  const ids=new Set(),names=new Map();
  const banks=entries.map((wrapper,index)=>{
   if(!wrapper||typeof wrapper!=='object'||typeof wrapper.name!=='string'||!wrapper.name.trim()||wrapper.name.length>100)throw Error('第 '+(index+1)+' 个题库缺少有效名称。');
   let url;try{url=new URL(wrapper.url);}catch{throw Error(wrapper.name+'：接口地址无效。');}
   if(!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw Error(wrapper.name+'：接口需要使用 HTTPS，本机接口可使用 HTTP。');
   const method=(wrapper.method||'get').toLowerCase();if(!['get','post','put','patch','delete'].includes(method))throw Error(wrapper.name+'：请求方法不支持。');
   if(wrapper.type&&!['GM_xmlhttpRequest','fetch','xmlhttprequest'].includes(wrapper.type))throw Error(wrapper.name+'：请求类型不支持。');
   if(wrapper.contentType&&!['json','text'].includes(wrapper.contentType))throw Error(wrapper.name+'：contentType 需要是 json 或 text（OCS 的响应数据类型）。');
   if(typeof wrapper.handler!=='string'||!wrapper.handler.trim()||wrapper.handler.length>32768)throw Error(wrapper.name+'：缺少 OCS 响应 handler。');
   if(wrapper.data!==undefined&&(!wrapper.data||typeof wrapper.data!=='object'||Array.isArray(wrapper.data)))throw Error(wrapper.name+'：data 必须是对象。');
   if(wrapper.headers!==undefined&&(!wrapper.headers||typeof wrapper.headers!=='object'||Array.isArray(wrapper.headers)||Object.values(wrapper.headers).some(v=>typeof v!=='string')))throw Error(wrapper.name+'：headers 必须是字符串对象。');
   const identityUrl=new URL(url.href);for(const name of identityUrl.searchParams.keys())if(secretName(name))identityUrl.searchParams.set(name,'$SAVED_KEY');
   const identity=wrapper.name.trim()+'\0'+identityUrl.href+'\0'+method,count=names.get(identity)||0;names.set(identity,count+1);
   const id=wrapper.name.trim()==='言溪题库'&&url.href==='https://tk.enncy.cn/query'&&count===0?'yanxi':stableId(identity+'\0'+count);
   if(ids.has(id))throw Error('题库标识冲突，请为重复题库设置不同名称。');ids.add(id);
   walk(wrapper,value=>value,[]);
   return {id,name:wrapper.name.trim(),wrapper:null,index};
  });
  // Re-read to retain scalar values after structural validation.
  entries=typeof input==='string'?JSON.parse(input.replace(/^\uFEFF/,'')):JSON.parse(JSON.stringify(input));
  for(const bank of banks){
   const wrapper=entries[bank.index],old=saved?.banks?.find(item=>item.id===bank.id)?.wrapper;
   walk(wrapper,(value,path)=>{if(!value.startsWith('<已保存：'))return value;let original=old;for(const part of path)original=part.startsWith('@query:')?new URL(original).searchParams.get(part.slice(7)):original?.[part];if(typeof original!=='string'||(mask(original)!==value&&'<已保存：'+legacyPreview(original)+'>'!==value)){if(saved)throw Error(bank.name+'：已保存密钥的标记无效，请重新填写密钥。');return value;}return original;});bank.wrapper=wrapper;
  }
  return {banks,entries,json:JSON.stringify(entries,null,2)};
 }
 function display(parsed){const copy=JSON.parse(JSON.stringify(parsed.entries));for(const entry of copy)walk(entry,value=>value?mask(value):'');return JSON.stringify(copy,null,2);}
 function secrets(parsed){const values=[];for(const bank of parsed.banks)walk(JSON.parse(JSON.stringify(bank.wrapper)),value=>{if(value&&!value.startsWith('<已保存：'))values.push(value);return value;});return values;}
 function summaries(parsed){return parsed.banks.map(bank=>({id:bank.id,name:bank.name,keyPreviews:secrets({banks:[bank]}).map(preview)}));}
 function reconcile(methods,banks,{enableImported=false}={}){const valid=new Set(banks.map(b=>b.id)),existing=new Map(methods.map(m=>[m.id,m]));const result=methods.filter(m=>m.id==='xingchan-ai'||/^ai-[a-f0-9]{16}$/.test(m.id)||m.id==='xingchan-bank'||m.id==='soutijiang'||valid.has(m.id)).map(m=>({...m,enabled:enableImported&&valid.has(m.id)?true:m.enabled}));for(const bank of banks)if(!existing.has(bank.id)){const index=result.findIndex(m=>m.id==='xingchan-ai');result.splice(index<0?0:index,0,{id:bank.id,enabled:enableImported});}for(const id of ['xingchan-ai','xingchan-bank'])if(!result.some(m=>m.id===id))result.push({id,enabled:false});return result;}
 return {parse,display,secrets,summaries,reconcile,preview,MAX_BYTES};
});
