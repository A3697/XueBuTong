'use strict';
const MAX_ACCOUNTS=20;
function normalize(input){
 if(input===undefined)return {items:[]};
 if(!input||!Array.isArray(input.items)||input.items.length>MAX_ACCOUNTS)throw Error('搜题酱账号列表无效');
 const seen=new Set();const items=input.items.map(item=>{
  if(!item||typeof item.id!=='string'||!(/^(?:default|[a-f0-9]{24})$/).test(item.id)||seen.has(item.id))throw Error('搜题酱账号标识无效或重复');seen.add(item.id);
  if(typeof item.remark!=='string'||item.remark.length>80||/[\u0000-\u001f\u007f]/.test(item.remark))throw Error('搜题酱备注请使用 80 字以内文本');
  if(item.enabled!==undefined&&typeof item.enabled!=='boolean')throw Error('搜题酱账号的题库开关无效');
  return {id:item.id,remark:item.remark.trim(),enabled:item.enabled!==false};
 });
 if(input.selectedId!==undefined&&(typeof input.selectedId!=='string'||!items.some(item=>item.id===input.selectedId)))throw Error('当前搜题酱登录不在账号列表中');
 return {items,...(input.selectedId===undefined?{}:{selectedId:input.selectedId})};
}
module.exports={normalize,MAX_ACCOUNTS};
