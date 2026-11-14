'use strict';
Object.defineProperty(exports,'__esModule',{value:true});
const {app,BrowserWindow,shell}=require('electron'),path=require('path');
async function updater(){}
async function updateApp(){const root=path.resolve(app.getAppPath(),'../../..'),win=BrowserWindow.getFocusedWindow()||BrowserWindow.getAllWindows()[0];const dialog=require(path.join(root,'src/themed-dialog.cjs')).createThemedDialog({root});const result=await dialog.showMessageBox(win,{title:'更新学不通',message:'请使用学不通新版安装包更新。',detail:'从发行方获取安装包后运行，安装器会识别旧版目录并保留用户配置。可先通过导出配置备份账号设置。',buttons:['查看版本说明','关闭'],cancelId:1});if(result.response===0)await shell.openPath(path.join(root,'assets/about/index.html'));return {managedByFusion:true};}
exports.updater=updater;exports.updateApp=updateApp;
