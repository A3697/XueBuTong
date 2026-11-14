(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FusionYanxiConfig=api;})(globalThis,()=>{
 'use strict';
 const ENDPOINT='https://tk.enncy.cn/query';
 const RESPONSE_HANDLER='return (res)=>res.code === 0 ? [res.data.answer, undefined, { tags: res.data.tags }] : [res.data.question, res.data.answer, { ai: res.data.ai, tags: res.data.tags }]';
 const IMAGE_HANDLER='return (env) => env.images';
 const compact=value=>String(value||'').replace(/\s+/g,'').replace(/;$/,'');
 const preview=token=>token.length>8?token.slice(0,4)+'…'+token.slice(-4):'********';
 const marker=token=>'<已保存 Token：'+preview(token)+'>';
 function template(token){return [{contentType:'json',data:{images:{handler:IMAGE_HANDLER},options:'${options}',suggestion_options:'${suggestion_options}',suggestion_title:'${suggestion_title}',title:'${title}',token,type:'${type}',v:'2'},handler:RESPONSE_HANDLER,headers:{'Content-Type':'application/json'},homepage:'https://tk.enncy.cn/',method:'post',name:'言溪题库',type:'GM_xmlhttpRequest',url:ENDPOINT}];}
 function parse(value,{savedToken=''}={}){
  let entries;try{entries=typeof value==='string'?JSON.parse(value.replace(/^\uFEFF/,'')):JSON.parse(JSON.stringify(value));}catch{throw Error('言溪题库配置必须是有效的 JSON 数组，请粘贴 OCS 的完整题库配置。');}
  if(!Array.isArray(entries)||entries.length!==1||!entries[0]||typeof entries[0]!=='object')throw Error('请填写只包含一个言溪题库入口的 JSON 数组。');
  const entry=entries[0],data=entry.data;
  if(entry.url!==ENDPOINT||String(entry.method).toLowerCase()!=='post'||entry.contentType!=='json'||entry.type!=='GM_xmlhttpRequest')throw Error('言溪题库需要使用 https://tk.enncy.cn/query 的 POST JSON 配置。');
  if(!data||typeof data!=='object'||Array.isArray(data)||String(data.v)!=='2')throw Error('言溪题库 data 配置无效或缺少 v: "2"。');
  if(savedToken&&data.token===marker(savedToken))data.token=savedToken;
  if(typeof data.token!=='string'||!data.token.trim()||data.token.length>8192||/[\s<>]/.test(data.token))throw Error('言溪题库 data.token 无效，请填写题库的实际 Token。');
  for(const name of ['title','options','suggestion_title','suggestion_options','type'])if(data[name]!==undefined&&data[name]!=='${'+name+'}')throw Error('言溪题库 '+name+' 需要保留 OCS 的 ${'+name+'} 模板。');
  if(data.title!=='${title}')throw Error('言溪题库必须包含 title: "${title}"。');
  if(data.images!==undefined&&!(Array.isArray(data.images)&&!data.images.length)&&!(data.images&&compact(data.images.handler)===compact(IMAGE_HANDLER)))throw Error('言溪题库 images 请保留原 OCS 的 env.images 配置。');
  if(entry.handler&&compact(entry.handler)!==compact(RESPONSE_HANDLER))throw Error('此言溪响应处理器暂不支持，请使用 OCS 标准言溪题库 JSON。');
  const headers=entry.headers||{};
  if(Object.entries(headers).some(([name,value])=>name.toLowerCase()!=='content-type'||!/^application\/json(?:\s*;.*)?$/i.test(String(value))))throw Error('言溪题库请求头请使用 Content-Type: application/json。');
  return {entries,entry,token:data.token,json:JSON.stringify(entries,null,2)};
 }
 function masked(value){const result=parse(value);result.entry.data.token=marker(result.token);return JSON.stringify(result.entries,null,2);}
 return {parse,template,masked,preview,marker,ENDPOINT,RESPONSE_HANDLER,IMAGE_HANDLER};
});
