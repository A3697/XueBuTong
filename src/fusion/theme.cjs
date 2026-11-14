'use strict';
function installTheme({ipcMain,nativeTheme,isSender}){
 const channel='fusion-theme:mode';
 ipcMain.handle(channel,(event,mode)=>{
  if(!isSender(event)||!['system','light','dark'].includes(mode))throw Error('主题设置无效');
  if(nativeTheme.themeSource!==mode)nativeTheme.themeSource=mode;
  return{mode,dark:nativeTheme.shouldUseDarkColors};
 });
 return()=>ipcMain.removeHandler(channel);
}
module.exports={installTheme};
