'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('fusionPanelBridge',Object.freeze({
 get:()=>ipcRenderer.invoke('fusion-html:preferences',{action:'get'}),
 openAbout:()=>ipcRenderer.invoke('fusion-html:about'),
 set:preferences=>ipcRenderer.invoke('fusion-html:preferences',{action:'set',preferences})
}));
