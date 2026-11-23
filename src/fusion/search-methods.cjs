'use strict';
const defaults=Object.freeze([
 Object.freeze({id:'yanxi',enabled:false}),
 Object.freeze({id:'xingchan-ai',enabled:false}),
 Object.freeze({id:'xingchan-bank',enabled:false})
]);
function normalizeSearchMethods(value,legacy='yanxi-first'){
 if(value===undefined){const copy=defaults.map(x=>({...x}));if(legacy==='ai-first')copy.splice(0,2,copy[1],copy[0]);return copy;}
 if(!Array.isArray(value)||value.length<2||value.length>50)throw Error('搜题方式列表无效');
 const ids=new Set();const copy=value.map(item=>{
  if(!item||!(defaults.some(x=>x.id===item.id)||item.id==='soutijiang'||/^(?:ocs-[a-f0-9]{8}|ai-[a-f0-9]{16})$/.test(item.id))||ids.has(item.id)||typeof item.enabled!=='boolean')throw Error('搜题方式无效或重复');
  ids.add(item.id);return{id:item.id,enabled:item.enabled};
 });
 if(!ids.has('xingchan-ai'))throw Error('缺少搜题方式入口');
 if(!ids.has('xingchan-bank'))copy.push({id:'xingchan-bank',enabled:false});
 return copy.filter(item=>item.enabled).concat(copy.filter(item=>!item.enabled));
}
module.exports={normalizeSearchMethods};
