'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fileURLToPath}=require('node:url');
const PREFIX='/fusion-userscripts/';
function localPath(value){
 if(typeof value!=='string')return null;
 try{if(/^file:/i.test(value))return path.resolve(fileURLToPath(value));if(path.isAbsolute(value))return path.resolve(value);}catch{}
 return null;
}
function key(file,token){return crypto.createHmac('sha256',token).update(file.toLowerCase()).digest('hex');}
function installationURL(value,{serverPort,authToken}){
 const file=localPath(value);if(!file)return value;
 if(!authToken||!Number.isInteger(Number(serverPort))||Number(serverPort)<1||Number(serverPort)>65535)throw Error('本地脚本安装服务尚未就绪。');
 return `http://127.0.0.1:${serverPort}${PREFIX}${key(file,authToken)}/script.user.js`;
}
function installRoute(app,getConfig){
 app.get(PREFIX+':key/script.user.js',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!/^[a-f0-9]{64}$/.test(req.params.key))return res.sendStatus(404);
  try{
   const {scripts,authToken,root}=getConfig();
   if(!authToken)return res.sendStatus(404);
   const candidates=(scripts||[]).filter(s=>s?.enable&&s.isLocalScript).map(s=>localPath(s.info?.code_url||s.url));
   // A browser already starting retains its immutable runtime URL even if the
   // user changes the selected version while installation is in progress.
   if(root){const folder=path.join(root,'bridge-data/ocs-scripts');if(fs.existsSync(folder))for(const name of fs.readdirSync(folder))if(/^[a-f0-9]{64}\.user\.js$/.test(name))candidates.push(path.join(folder,name));}
   const file=candidates.find(p=>p&&key(p,authToken)===req.params.key);
   if(!file)return res.sendStatus(404);
   const stat=fs.statSync(file);if(!stat.isFile()||stat.size>20*1024*1024)return res.sendStatus(413);
   res.type('application/javascript').send(fs.readFileSync(file));
  }catch{res.status(404).send('本地脚本不可用，请在脚本列表检查文件是否存在。');}
 });
}
// Only the verified built-in script uses content revisions. A user's other
// scripts retain the manager's normal version/update behavior.
function bundledUpdate({root,userDataDir,userscripts,serverPort,authToken,uid,accountRuntime}){
 if(accountRuntime&&(accountRuntime.uid!==uid||typeof accountRuntime.enhanced!=='boolean'))throw Error('OCS 账号运行配置不匹配');
 const managed=(userscripts||[]).map(localPath).find(file=>file&&path.dirname(file).toLowerCase()===path.resolve(root,'bridge-data/ocs-scripts').toLowerCase()&&/^[a-f0-9]{64}\.user\.js$/.test(path.basename(file)));
 const file=managed||path.resolve(root,'assets/defaults/ocs.user.js');
 if(accountRuntime?.runtime&&(!managed||localPath(accountRuntime.runtime.file)?.toLowerCase()!==managed.toLowerCase()))throw Error('OCS 账号脚本选择已失效，请重新启动');
 if(accountRuntime&&!accountRuntime.runtime&&managed)throw Error('OCS 账号脚本状态不匹配');
 if(!userscripts.some(value=>localPath(value)?.toLowerCase()===file.toLowerCase()))return null;
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/defaults/ocs-script.json'),'utf8'));
 const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(hash!==(managed?path.basename(file,'.user.js'):manifest.sha256))throw Error('内置脚本内容与发布清单不一致，请修复软件后再启动。');
 let identity;try{identity=JSON.parse(fs.readFileSync(file,'utf8').match(/globalThis\.__xbtOcsRuntime=(\{[^\n]+\});/)?.[1]||'null');}catch{}
 if(accountRuntime?.runtime&&(hash!==accountRuntime.runtime.hash||identity?.enhanced!==accountRuntime.enhanced||identity?.upstreamSha256!==accountRuntime.runtime.upstreamSha256))throw Error('OCS 账号脚本身份校验失败');
 const receipt=path.join(userDataDir,'xuebutong-bundled-script.json');
 let previous;try{if(fs.statSync(receipt).size<2048)previous=JSON.parse(fs.readFileSync(receipt,'utf8'));}catch{}
 return {url:installationURL(file,{serverPort,authToken}),hash,receipt,force:previous?.sha256!==hash,enhanced:identity?.enhanced!==false,upstreamSha256:identity?.upstreamSha256};
}
function confirmBundledUpdate(update){
 if(!update)return;
 fs.mkdirSync(path.dirname(update.receipt),{recursive:true});
 const temp=update.receipt+'.tmp';
 fs.writeFileSync(temp,JSON.stringify({schema:1,sha256:update.hash}));fs.renameSync(temp,update.receipt);
}
// Read only the built-in script's metadata and code digest. Receipts and the
// upstream version cannot prove that a same-version fusion revision is present.
async function installedBundledDigest(browser,chromeId){
 const origin='chrome-extension://'+chromeId+'/';
 const target=(browser.serviceWorkers?.()||[]).find(w=>w.url().startsWith(origin))||browser.pages().find(p=>p.url().startsWith(origin));
 if(!target)return null;
 return target.evaluate(async()=>{
  const keys=(await chrome.storage.local.getKeys()).filter(k=>k.startsWith('script:'));
  const metadata=await chrome.storage.local.get(keys);
  for(const item of Object.values(metadata)){
   if(item?.namespace!=='https://enncy.cn'||item?.name!=='OCS 网课助手')continue;
   const key='scriptCode:'+item.uuid,code=(await chrome.storage.local.get(key))[key]?.code;
   if(typeof code!=='string')return null;
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));
   return {sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),status:item.status};
  }
  return null;
 });
}
module.exports={localPath,installationURL,installRoute,bundledUpdate,confirmBundledUpdate,installedBundledDigest};
