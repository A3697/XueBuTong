'use strict';
const path=require('node:path');
const {spawn}=require('node:child_process');

async function attachWindowGuard(context,{executablePath,toolRoot=path.resolve(__dirname,'../../../../../tools')}){
 if(process.platform!=='win32')throw Error('浏览器后台窗口管理仅支持 Windows。');
 const session=await context.browser().newBrowserCDPSession();
 let pid;
 try{const data=await session.send('SystemInfo.getProcessInfo');pid=data.processInfo.find(item=>item.type==='browser')?.id;}finally{await session.detach();}
 if(!Number.isSafeInteger(pid)||pid<1)throw Error('无法确认浏览器进程，未启用后台窗口管理。');
 const child=spawn(path.join(toolRoot,'browser-window-guard.exe'),[String(pid),path.resolve(executablePath)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stderr.resume();
 let ready=false,closed=false,disposed=false,buffer='',refreshTimer,showSequence=0;const showRequests=new Map();
 const rejectShows=()=>{for(const item of showRequests.values()){clearTimeout(item.timer);item.reject(Error('浏览器窗口已关闭'));}showRequests.clear();};
 let resolveReady,rejectReady;
 const whenReady=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 const timer=setTimeout(()=>rejectReady(Error('浏览器后台窗口管理启动超时。')),8000);
 child.stdout.on('data',chunk=>{buffer+=chunk.toString('utf8');let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const data=JSON.parse(line);if(data.showRequest){const item=showRequests.get(data.showRequest);if(item){clearTimeout(item.timer);showRequests.delete(data.showRequest);data.shown?item.resolve():item.reject(Error('浏览器窗口暂时无法恢复，请重试'));}}if(data.ready){clearTimeout(timer);if(data.version!==4||data.windows<1||data.groupedWindows!==data.windows){rejectReady(Error('浏览器窗口管理组件版本不匹配，请修复安装。'));continue;}ready=true;resolveReady();}}catch{}}});
 child.once('error',()=>{clearTimeout(timer);rejectReady(Error('无法启动浏览器窗口管理组件。'));});
 child.once('exit',()=>{closed=true;rejectShows();clearTimeout(timer);clearInterval(refreshTimer);if(!ready)rejectReady(Error('无法保护浏览器后台任务，请检查内置浏览器及窗口管理组件。'));});
 child.stdin.on('error',()=>{});
 const command=value=>{if(!closed&&!disposed&&!child.stdin.destroyed)child.stdin.write(value+'\n');};
 const guard={pid,show(){if(closed||disposed)return Promise.reject(Error('浏览器窗口管理已关闭'));const id=++showSequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{showRequests.delete(id);reject(Error('恢复浏览器窗口超时，请重试'));},5000);showRequests.set(id,{resolve,reject,timer});command('show\t'+id);});},hide(){command('hide');},setIdentity(name){command('name\t'+(typeof name==='string'?name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,120):''));},async dispose(){
  clearInterval(refreshTimer);if(disposed||closed)return;disposed=true;rejectShows();
  await new Promise(resolve=>{const timeout=setTimeout(resolve,4000);child.once('exit',()=>{clearTimeout(timeout);resolve();});child.stdin.end('stop\n');});
 }};
 context.once('close',()=>guard.dispose().catch(()=>{}));
 try{await whenReady;refreshTimer=setInterval(()=>command('refresh'),1000);refreshTimer.unref?.();return guard;}catch(error){await guard.dispose();throw error;}
}
module.exports={attachWindowGuard};
