'use strict';
// The upstream file stays immutable. This optional module builds the browser
// runtime using checked, unique anchors; a mismatch never drops an adaptation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function metadata(bytes){
 const text=bytes.toString('utf8'),header=text.match(/^\s*\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
 if(!header||Buffer.byteLength(text)>8*1024*1024)throw Error('OCS 脚本文件格式无效');
 const field=name=>header[0].match(new RegExp('^//\\s*@'+name+'\\s+(.+)$','m'))?.[1].trim();
 const version=field('version');
 if(field('name')!=='OCS 网课助手'||field('namespace')!=='https://enncy.cn'||!/^\d+\.\d+\.\d+$/.test(version||''))throw Error('OCS 官方脚本标识或版本格式无效');
 new vm.Script('(function(){\n'+text+'\n})',{filename:'ocs-upstream.user.js'});
 return {name:field('name'),version,sha256:hash(bytes)};
}
function settingsLifecycle(enhanced){
 const keys=Object.keys(require('./answer-settings.js').defaults).map(k=>'common.settings.'+k).concat(['common.settings.answererWrappers','common.settings.disabledAnswererWrapperNames','cx.new.study.enableChapterTest']);
 return `\n// XueBuTong enhancement lifecycle; official source is kept separately.\n(function(){
 const enabled=${JSON.stringify(enhanced)},keys=${JSON.stringify(keys)},backupKey='fusion.enhancement.originalSettings.v1';
 try{
  const backup=GM_getValue(backupKey,null);
  if(enabled&&!backup){
   const present=new Set(GM_listValues()),saved={};for(const key of keys)saved[key]={present:present.has(key),value:GM_getValue(key,null)};
   // Older fusion releases have no independent-settings snapshot. Do not
   // restore an account capability as an ordinary, user-configured bank.
   if(GM_getValue('fusion.managedAnswers',false))saved['common.settings.answererWrappers']={present:true,value:[]};
   GM_setValue(backupKey,saved);
  }else if(!enabled){
   if(backup&&typeof backup==='object'){for(const key of keys){const item=backup[key];if(item?.present)GM_setValue(key,item.value);else GM_deleteValue(key);}GM_deleteValue(backupKey);}
   else if(GM_getValue('fusion.managedAnswers',false)){const banks=GM_getValue('common.settings.answererWrappers',[]);if(Array.isArray(banks))GM_setValue('common.settings.answererWrappers',banks.filter(b=>!b.fusionManaged));}
   for(const key of ['fusion.managedAnswers','fusion.managedAnswerKeys','fusion.hasUsableAnswerSource','fusion.chapterDefaultApplied'])GM_deleteValue(key);
  }
 }catch(error){console.error('[学不通] 增强插件配置恢复失败',error?.name||'Error');throw error;}
})();\n`;
}
function compose(bytes,{root,enhanced=true}={}){
 const info=metadata(bytes);let code=bytes.toString('utf8');
 if(enhanced){
  const adapter=JSON.parse(fs.readFileSync(path.join(root,'assets/defaults/ocs-adapter.json'),'utf8'));
  code=code.replace(/\r\n/g,'\n');
  for(const patch of adapter.patches){
   const start=code.indexOf(patch.before);
   if(start<0||code.indexOf(patch.before,start+1)>=0)throw Object.assign(Error('增强插件与 OCS '+info.version+' 不兼容（'+patch.id+'）'),{code:'OCS_ADAPTER_CONFLICT',patch:patch.id});
   code=code.slice(0,start)+patch.after+code.slice(start+patch.before.length);
  }
  // Supplemental task requests use the ordinary Chaoxing session. Declare
  // only that platform, instead of asking the script manager for all hosts.
  if(!/^\/\/\s*@connect\s+chaoxing\.com\s*$/m.test(code))code=code.replace('// ==/UserScript==','// @connect chaoxing.com\n// ==/UserScript==');
 }
 // Official checks are owned by the desktop manager, so an extension cannot
 // silently replace a validated runtime via a future upstream downloadURL.
 code=code.replace(/^\/\/\s*@(updateURL|downloadURL)\s+.*\r?\n/gm,'').replace('// ==/UserScript==','// @downloadURL none\n// ==/UserScript==');
 const end=code.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length;
 const supplemental=enhanced?fs.readFileSync(path.join(__dirname,'supplemental-tasks.js'),'utf8'):'';
 code=code.slice(0,end)+settingsLifecycle(enhanced)+'\n'+supplemental+'\n'+code.slice(end);
 const revision=enhanced?JSON.parse(fs.readFileSync(path.join(root,'assets/defaults/ocs-adapter.json'),'utf8')).revision:'official';
 code+='\n// XueBuTong runtime identity\n'+`globalThis.__xbtOcsRuntime=${JSON.stringify({version:info.version,upstreamSha256:info.sha256,enhanced,revision})};\n`;
 // Public API contract only. Site/network failures must not freeze updates.
 if(enhanced)code+=`try{const api=globalThis.OCS;const ok=!!(api?.BackgroundProject?.scripts?.appConfigSync&&api?.CommonProject?.scripts?.settings&&typeof api.OCSWorker?.prototype?.doWork==='function');(document.documentElement||document).dispatchEvent(new CustomEvent('xuebutong-ocs-contract',{detail:{ok,version:${JSON.stringify(info.version)}}}));if(document.documentElement)document.documentElement.setAttribute('data-xuebutong-ocs-contract',ok?'passed':'failed');}catch{}\n`;
 new vm.Script('(function(){\n'+code+'\n})',{filename:'xuebutong-ocs-runtime.user.js'});
 return {...info,code,runtimeSha256:hash(code),enhanced,revision};
}
module.exports={metadata,compose,hash,settingsLifecycle};
