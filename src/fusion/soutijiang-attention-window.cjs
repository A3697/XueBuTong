'use strict';
const fs=require('node:fs'),path=require('node:path');
function createPresenter({root,findMain,getSnapshot}){
 let pending=Promise.resolve(),shown=false;
 return ()=>{pending=pending.catch(()=>{}).then(async()=>{
  const win=findMain();if(!win||win.isDestroyed())return;
  const snapshot=getSnapshot();
  if(snapshot.items.length&&!shown){if(win.isMinimized())win.restore();win.show();win.focus();}
  shown=!!snapshot.items.length;
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/soutijiang-attention-ui.js'),'utf8')+'\nwindow.FusionSoutijiangAttention.show('+JSON.stringify(snapshot)+');void 0;');
 });return pending;};
}
module.exports={createPresenter};
