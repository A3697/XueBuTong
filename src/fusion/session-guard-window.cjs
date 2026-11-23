'use strict';
const fs=require('node:fs'),path=require('node:path');
function createWarningPresenter({root,findMain,getSnapshot}){
 let pending=Promise.resolve();
 return snapshot=>{pending=pending.catch(()=>{}).then(async()=>{
  const win=findMain();if(!win||win.isDestroyed()||!snapshot.items.length)return;
  snapshot=getSnapshot?.()||snapshot;if(!snapshot.items.length)return;
  if(win.isMinimized())win.restore();win.show();win.focus();
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/session-guard-ui.js'),'utf8')+'\nwindow.FusionSessionGuard.show('+JSON.stringify(snapshot)+');void 0;');
 });return pending;};
}
module.exports={createWarningPresenter};
