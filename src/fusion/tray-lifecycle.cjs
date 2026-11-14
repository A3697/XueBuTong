'use strict';
class TrayLifecycle{
 constructor({Tray,Menu,dialog,icon,version,preferences,requestExit}){Object.assign(this,{Tray,Menu,dialog,icon,version,preferences,requestExit});this.tray=null;this.window=null;this.pending=null;this.disposed=false;}
 show(){const win=this.window;if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();}
 exit(){this.show();this.requestExit(this.window);}
 attach(win){
  this.window=win;if(this.tray||this.disposed)return;
  this.tray=new this.Tray(this.icon);this.tray.setToolTip('学不通 '+this.version);
  this.tray.setContextMenu(this.Menu.buildFromTemplate([{label:'打开学不通',click:()=>this.show()},{type:'separator'},{label:'退出学不通',click:()=>this.exit()}]));
  this.tray.on('double-click',()=>this.show());this.tray.on('click',()=>this.show());
 }
 async closeWindow(win,event){
  if(this.disposed)return;event?.preventDefault();if(this.pending)return this.pending;
  this.pending=(async()=>{
   if(this.preferences.get().closeBehavior==='exit'){this.exit();return;}
   if(this.preferences.get().trayNoticeAccepted!==true){
    const result=await this.dialog.showMessageBox(win,{type:'question',title:'关闭主窗口',message:'是否最小化到托盘，继续在后台运行？',detail:'关闭主窗口后，浏览器和星蝉任务继续运行。点击托盘图标可恢复主窗口；托盘菜单中的“退出学不通”会结束软件和运行中的任务。以后关闭窗口将直接最小化到托盘。',buttons:['最小化到托盘','退出软件','取消'],defaultId:0,cancelId:2,noLink:true});
    if(result.response===2||this.disposed)return;
    if(result.response===1){this.exit();return;}
    const value=this.preferences.get();value.trayNoticeAccepted=true;this.preferences.set(value);
   }
   if(!win.isDestroyed())win.hide();
  })().finally(()=>{this.pending=null;});return this.pending;
 }
 dispose(){this.disposed=true;this.tray?.destroy();this.tray=null;this.window=null;}
}
module.exports={TrayLifecycle};
