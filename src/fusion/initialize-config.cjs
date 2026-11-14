'use strict';
const fs=require('node:fs'),path=require('node:path');
const clone=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const configurationError=message=>Object.assign(Error(message),{code:'FUSION_CONFIG'});
function defaults(target,source){for(const key of Object.keys(source)){if(target[key]===undefined)target[key]=clone(source[key]);else if(object(target[key])&&object(source[key]))defaults(target[key],source[key]);}return target;}
function seedInitialConfig(file,browserPath){
 if(fs.existsSync(file))return false;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const value={app:{fusionDefaultSetupPromptPending:true},render:{setting:{launchOptions:{executablePath:browserPath},theme:{mode:'system'}},state:{first:false,setup:false}}};
 try{fs.writeFileSync(file,JSON.stringify(value,null,2),{encoding:'utf8',flag:'wx'});return true;}
 catch(error){if(error.code==='EEXIST')return false;throw error;}
}
function prepareNativeConfig(current,original,{vault,browserPath,installRoot}={}){
 if(!object(current))throw configurationError('本地配置格式无效，请从备份恢复配置。');
 const next=defaults(clone(current),original),wasEncrypted=typeof current.render==='string';
 if(!object(next.app))throw configurationError('软件设置格式无效，原文件未被改写。');
 let render;
 try{render=wasEncrypted?JSON.parse(vault.decryptString(Buffer.from(current.render,'base64'))):clone(current.render||{});}
 catch{throw configurationError('无法读取已保存的账号配置，请使用原 Windows 用户或恢复配置备份；原文件未被改写。');}
 if(!object(render))throw configurationError('账号配置格式无效，原文件未被改写。');
 const beforeRender=JSON.stringify(render);
 if(!object(render.setting))render.setting={};
 if(!object(render.setting.launchOptions))render.setting.launchOptions={};
 if(!render.setting.launchOptions.executablePath)render.setting.launchOptions.executablePath=browserPath;
 if(!object(render.setting.theme))render.setting.theme={};
 if(!['system','light','dark'].includes(render.setting.theme.mode))render.setting.theme.mode=typeof render.setting.theme.dark==='boolean'?(render.setting.theme.dark?'dark':'light'):'system';
 require('./bundled-script.cjs').seedBundledScript(render,next.app,installRoot);
 if(installRoot&&fs.existsSync(path.join(installRoot,'assets/defaults/ocs.upstream.user.js')))require('./ocs-plugin-manager.cjs').manager(installRoot).reconcile(render);
 if(typeof next.app.fusionDefaultSetupPromptPending!=='boolean')next.app.fusionDefaultSetupPromptPending=false;
 if(!object(render.setting.ocs))render.setting.ocs={};
 if(!object(render.setting.ocs.store))render.setting.ocs.store={};
 if(!Object.hasOwn(render.setting.ocs.store,'cx.new.study.enableChapterTest'))render.setting.ocs.store['cx.new.study.enableChapterTest']=false;
 if(!object(render.state))render.state={};
 render.state.first=false;render.state.setup=false;
 if(!next.app.fusionEncryptionDefaultApplied){next.app.data_encryption=true;next.app.fusionEncryptionDefaultApplied=true;}
 next.name=original.name;next.version=original.version;
 next.paths={...clone(original.paths),userDataDirsFolder:current.paths?.userDataDirsFolder||original.paths.userDataDirsFolder};
 const serialized=JSON.stringify(render);
 if(next.app.data_encryption&&vault.isEncryptionAvailable())next.render=wasEncrypted&&serialized===beforeRender?current.render:vault.encryptString(serialized).toString('base64');
 else next.render=render;
 return{value:next,changed:JSON.stringify(next)!==JSON.stringify(current)};
}
module.exports={seedInitialConfig,prepareNativeConfig};
