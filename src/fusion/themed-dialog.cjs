'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const initialized=new WeakSet();
function createThemedDialog({root}){
 return {async showMessageBox(win,options){
  if(!win||win.isDestroyed()||options.signal?.aborted)return {response:options.cancelId??(options.buttons||['确定']).length-1,checkboxChecked:false};
  if(win.isMinimized())win.restore();if(!win.isVisible())win.show();
  // Also supports the separate About window, which has no main renderer loader.
  if(!initialized.has(win.webContents)){await win.webContents.insertCSS(fs.readFileSync(path.join(root,'src/dialogs.css'),'utf8'));initialized.add(win.webContents);win.webContents.on('did-start-navigation',()=>initialized.delete(win.webContents));}
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/dialogs.js'),'utf8'));
  const id=crypto.randomUUID(),{signal,...data}=options;
  const abort=()=>{if(!win.isDestroyed())void win.webContents.executeJavaScript('window.__fusionMessageDialogs?.get('+JSON.stringify(id)+')?.close()').catch(()=>{});};
  if(signal?.aborted)return {response:options.cancelId??(options.buttons||['确定']).length-1,checkboxChecked:false};
   signal?.addEventListener('abort',abort,{once:true});
  try{return await win.webContents.executeJavaScript('(async()=>{window.__fusionMessageDialogs??=new Map();const id='+JSON.stringify(id)+',dialog=window.FusionDialogs.open('+JSON.stringify(data)+');window.__fusionMessageDialogs.set(id,dialog);try{return await dialog.result;}finally{window.__fusionMessageDialogs.delete(id);}})()');}
  finally{signal?.removeEventListener('abort',abort);}
 }};
}
module.exports={createThemedDialog};
