'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCE='https://cdn.ocsjs.com/ocs.user.js';
const OFFICIAL_SOURCE=/^https:\/\/cdn\.ocsjs\.com\/ocs\.user\.js(?:[?#]|$)/i;
// Verified, unmodified bundled releases only; custom scripts are never replaced.
const PREVIOUS_BUNDLED_SHA256=new Set([
 '1f49355c2c11b8428714e567eedc82857d24ca0afd5d43b905c1ae5d4b19189e',
 '1d44861ae65d99938c59459c050a85b80cea66b297d1bd307e66fb8b0f8e4925',
 '254802aec93a17ba6b4092eee8074ab9a8fe9a76fa86522a1469f2d729ee94de',
 '69421d8a5396e9801bbfcddeb8be9ebc05a57557d9f5c92c093f643baf09afa4',
 '565a965b7197c01c7405fad810c5b7c36c2cb746d74a810175237efc8bf48114',
 '3aa9cf73a557647302ba04ac4715969c464cba83d9f85294e1e1421e6bcbf810',
  '116efc386c8bfccb366c29131ecc644874a3b2cf5eee22b7088d4eadf2f2069f'
]);
function isOCSScript(script){return script?.fusionBundled===true||/^(?:https:\/\/cdn\.ocsjs\.com\/ocs\.user\.js)(?:[?#]|$)/i.test(script?.url||'')||/^OCS\s*网课助手$/i.test(script?.info?.name||'');}
function bundledScript(root){
 const file=path.join(root,'assets/defaults/ocs.user.js'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/defaults/ocs-script.json'),'utf8'));
 const bytes=fs.readFileSync(file),actual=require('./default-components.cjs').metadata(bytes.toString('utf8'));
 if(actual.version!==manifest.metadata?.version||actual.name!==manifest.metadata?.name)throw Error('内置 OCS 脚本版本与清单不一致，请使用完整安装包修复。');
 if(manifest.source!==SOURCE||crypto.createHash('sha256').update(bytes).digest('hex')!==manifest.sha256||!/^OCS\s*网课助手$/i.test(manifest.metadata?.name||'')||!manifest.metadata?.version)throw Error('内置 OCS 脚本校验失败，请使用完整安装包修复。');
 return {id:2200000000000,url:file,enable:true,isLocalScript:true,isInternetLinkScript:false,fusionBundled:true,info:{id:2200000000000,url:SOURCE,code_url:file,ratings:0,total_installs:0,daily_installs:0,create_time:0,update_time:0,...manifest.metadata}};
}
function seedBundledScript(render,app,root){
 if(!root)return false;
 if(!Array.isArray(render.scripts))render.scripts=[];
 if(render.scripts.some(s=>s.fusionOcsManaged))return false;
 const before=JSON.stringify(render.scripts);
 // Imported copies retain the original bytes but lose fusionBundled. Verify
 // their contents, never infer a local script's identity from its filename or
 // official-looking metadata. A customized local script remains untouched.
 const hasOCS=render.scripts.some(script=>isOCSScript(script)||OFFICIAL_SOURCE.test(script.info?.code_url||script.code_url||script.url||''));
 if(hasOCS){
  const bundled=bundledScript(root),currentHash=crypto.createHash('sha256').update(fs.readFileSync(bundled.info.code_url)).digest('hex');
  const approved=render.scripts.filter(script=>{
   const source=script.info?.code_url||script.code_url||script.url||'';
   if(OFFICIAL_SOURCE.test(source))return true;
   if(!isOCSScript(script))return false;
   try{
    const file=/^file:/i.test(source)?require('node:url').fileURLToPath(source):path.isAbsolute(source)?source:null;
    if(!file)return false;const stat=fs.statSync(file);if(!stat.isFile()||stat.size>20*1024*1024)return false;
    const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return PREVIOUS_BUNDLED_SHA256.has(hash)||hash===currentHash;
   }catch{return false;}
  });
  if(approved.length){
   const selected=approved.find(script=>script.enable!==false)||approved[0],id=selected.id??bundled.id;
   const replacement={...selected,...bundled,id,enable:selected.enable!==false,info:{...selected.info,...bundled.info,id}};
   render.scripts=render.scripts.flatMap(script=>script===selected?[replacement]:approved.includes(script)?[]:[script]);
  }
 }
 if(app.fusionBundledScriptSeeded===true)return JSON.stringify(render.scripts)!==before;
 const existing=render.scripts.find(isOCSScript);
 if(!existing){const item=bundledScript(root);while(render.scripts.some(script=>script.id===item.id))item.id++;item.info.id=item.id;render.scripts.push(item);}
 app.fusionBundledScriptSeeded=true;return JSON.stringify(render.scripts)!==before;
}
module.exports={SOURCE,isOCSScript,bundledScript,seedBundledScript};
