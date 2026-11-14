(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionEnrollment=api;})(globalThis,()=>{
 'use strict';
 const MIN_YEAR=1950;
 function normalize(value,currentYear=new Date().getFullYear()){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value==='string'&&/^\d{4}$/.test(value))value=Number(value);
  if(!Number.isInteger(value)||value<MIN_YEAR||value>currentYear)throw Error('入学年份须为 1950 年至当前年份，或选择“未选择”。');
  return value;
 }
 return {MIN_YEAR,normalize};
});
