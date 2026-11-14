(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionAnswerSettings=api;})(globalThis,()=>{
 'use strict';
 const defaults={upload:80,'work-when-no-job':false,'randomWork-choice':false,'randomWork-complete':false,'randomWork-completeTexts-textarea':'不会\n不知道\n不清楚\n不懂\n不会写',thread:1,imageOptimize:true,answerWrapperHandlerTimeout:120,stopSecondWhenFinish:3,period:3,answerSeparators:'===,#,---,###,|,;,；',redundanceWordsText:'单选题(必考)\n填空题(必考)\n多选题(必考)\n(单选题)\n(多选题)\n(判断题)\n(填空题)\n【单选题】\n【多选题】\n【填空题】\n【判断题】\n【單選题】\n【多選题】\n【判斷题】\n【Single Choice】\n【Multiple Choice】\n【single choice】\n【multiple choice】\n【True or False】'};
 const ranges={thread:[1,3],answerWrapperHandlerTimeout:[10,180],stopSecondWhenFinish:[3,9999],period:[1,60]};
 function normalize(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('答题设置格式无效');
  const result={...defaults};
  for(const key of Object.keys(defaults)){
   if(!Object.hasOwn(value,key))continue;let v=value[key];
   if(key==='upload'){if(!['save','nomove','force'].includes(v)){v=Number(v);if(!Number.isInteger(v)||v<0||v>100)throw Error('答案提交率需为 0–100');}}
   else if(ranges[key]){const [min,max]=ranges[key];if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw Error('答题数值设置超出允许范围');}
   else if(typeof defaults[key]==='boolean'){if(typeof v!=='boolean')throw Error('答题开关格式无效');}
   else if(typeof v!=='string'||v.length>16000)throw Error('答题文本过长或格式无效');
   result[key]=v;
  }
  return result;
 }
 function ocsStore(value,banks){return Object.fromEntries(Object.entries({...normalize(value),answererWrappers:banks,disabledAnswererWrapperNames:[]}).map(([key,value])=>['common.settings.'+key,value]));}
  function fromOcsStore(store={}){const values={};for(const key of Object.keys(defaults))if(Object.hasOwn(store,'common.settings.'+key))values[key]=store['common.settings.'+key];return normalize(values);}
  return {defaults,ranges,normalize,ocsStore,fromOcsStore};
});
