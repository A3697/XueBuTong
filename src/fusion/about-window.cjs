'use strict';
const fs=require('node:fs'),path=require('node:path');
const CHANNEL_LINKS=Object.freeze({'ocs-channel':'https://pd.qq.com/g/du8ic7y5zw','xingchan-channel':'https://pd.qq.com/g/x786s240s3'});
function installAbout({root,app,BrowserWindow,ipcMain,shell,dialog,directNetwork,canUpdate=()=>false,finishClose}){
 let window=null;
 const {GitHubUpdates,PROJECT_URL}=require('./github-updates.cjs');
 const updates=new GitHubUpdates({root});
 const page=path.join(root,'assets/about/index.html');
 const allowed=event=>window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===event.sender.mainFrame;
 ipcMain.handle('xuebutong-about:info',event=>{
  if(!allowed(event))throw Error('关于页面未授权');
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'fusion-install.json'),'utf8'));
  const links=JSON.parse(fs.readFileSync(path.join(root,'assets/product-links.json'),'utf8'));
  let provenance;try{provenance=JSON.parse(fs.readFileSync(path.join(root,'installation-provenance.json'),'utf8'));}catch{}
  const sha=provenance?.version===metadata.version&&/^[a-f0-9]{64}$/i.test(provenance.installerSha256)?provenance.installerSha256:null;
  return{version:metadata.version,dependencies:metadata.dependencies,installerSha256:sha,xingchanLinkStatus:links.xingchanLinkStatus||'',projectUrl:PROJECT_URL};
 });
 ipcMain.handle('xuebutong-about:open',async(event,kind)=>{
  if(!allowed(event)||!['ocs','xingchan','product','github','releases','quark-download',...Object.keys(CHANNEL_LINKS)].includes(kind))throw Error('页面入口未授权');
  if(kind==='product'){window.show();window.focus();return true;}
  if(kind==='github'||kind==='releases'){await shell.openExternal(PROJECT_URL+(kind==='releases'?'/releases':''));return true;}
  if(kind==='quark-download'){await shell.openExternal('https://pan.quark.cn/s/6de4b34e2712');return true;}
  if(Object.hasOwn(CHANNEL_LINKS,kind)){await shell.openExternal(CHANNEL_LINKS[kind]);return true;}
  if(kind==='xingchan'){await dialog.showMessageBox(window,{type:'info',title:'星蝉刷课',message:'暂无官网',buttons:['知道了']});return true;}
  const links=JSON.parse(fs.readFileSync(path.join(root,'assets/product-links.json'),'utf8')),url=new URL(links[kind]);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('链接格式不受支持');await shell.openExternal(url.href);return true;
 });
 ipcMain.handle('xuebutong-about:update',async(event,action)=>{
  if(!allowed(event))throw Error('关于页面未授权');
  if(action==='state')return updates.snapshot();
  if(action==='check')return updates.check();
  if(action==='download')return updates.download();
  if(action!=='install')throw Error('更新操作无效');
  if(!canUpdate())throw Error('请先停止正在运行或启动中的账号，再安装更新。');
  const answer=await dialog.showMessageBox(window,{type:'question',title:'安装学不通更新',message:'保存配置、退出学不通并安装更新？',detail:'保留账号、登录数据和使用设置；完整安装包会同时更新随包运行组件。',buttons:['取消','退出并安装'],defaultId:0,cancelId:0});
  if(answer.response!==1)return updates.snapshot();
  if(!canUpdate())throw Error('账号正在运行，请先停止后重试。');
  const info=await updates.verifiedPackage();
  const child=require('node:child_process').spawn(info.file,[`/DIR=${root}`,`/WAITFORPID=${process.pid}`,'/UPDATEONLY','/NORESTART'],{cwd:root,detached:true,windowsHide:false,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>reject(Error('无法启动更新安装器，请稍后重试。')));});child.unref();
  await finishClose();return {status:'installing',message:'更新安装器已启动。'};
 });
 return async()=>{
  if(window&&!window.isDestroyed()){window.show();window.focus();return true;}
  window=new BrowserWindow({title:'关于学不通',width:1040,height:740,minWidth:720,minHeight:580,show:false,autoHideMenuBar:true,icon:path.join(root,'assets/fusion.ico'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,partition:'persist:xuebutong-about',preload:path.join(root,'src/about-preload.cjs')}});
  window.setMenu(null);window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  window.on('closed',()=>window=null);await directNetwork.prepare(window.webContents.session);await window.loadFile(page);if(!window.isDestroyed()){window.show();window.focus();}return true;
 };
}
module.exports={installAbout};
