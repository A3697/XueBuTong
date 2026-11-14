"use strict";
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {store}=require('../store');
const execute=promisify(execFile);
const folder=()=>path.join(store.store.paths.downloadFolder,'apps/ocr');
const binary=()=>path.join(folder(),process.platform==='win32'?'ocr.exe':'ocr');
async function recognize(images,args){
 const cache=path.join(folder(),'img_cache');await fs.promises.mkdir(cache,{recursive:true});
 const files=images.map(()=>path.join(cache,randomUUID()+'.png'));
 try{
  for(let i=0;i<files.length;i++)await fs.promises.writeFile(files[i],images[i],'base64');
  // execFile preserves paths and spaces. Stderr can contain native warnings.
  const {stdout}=await execute(binary(),args(files),{windowsHide:true,timeout:60000,maxBuffer:1024*1024,encoding:'utf8'});
  if(!stdout.trim())throw Error('OCR 未返回识别结果。');return stdout.trim();
 }finally{await Promise.all(files.map(file=>fs.promises.rm(file,{force:true}).catch(()=>{})));}
}
async function ocr(base64){return recognize([base64],([file])=>['--ocr',file]);}
async function det(target,background){
 const output=await recognize([target,background],([a,b])=>['--det-target',a,'--det-bg',b]);
 try{return JSON.parse(output.replace(/'/g,'"'));}catch{throw Error('OCR 返回的滑块位置无效，请重试。');}
}
function canOCR(){
 try{const file=path.resolve(__dirname,'../../../../../../bridge-data/application-settings.json');if(fs.existsSync(file)){const prefs=JSON.parse(fs.readFileSync(file,'utf8'));if(prefs.schema!==1||!prefs.items||prefs.items['apps:ocr']===false)return false;}}catch{return false;}
 return fs.existsSync(binary());
}
module.exports={ocr,det,canOCR};
