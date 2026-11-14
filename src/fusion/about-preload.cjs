'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('aboutApi',Object.freeze({info:()=>ipcRenderer.invoke('xuebutong-about:info'),open:kind=>ipcRenderer.invoke('xuebutong-about:open',kind),update:action=>ipcRenderer.invoke('xuebutong-about:update',action)}));
