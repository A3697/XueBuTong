'use strict';
// Window hosting only: preserve upstream preferences across per-launch local ports.
// Do not inject fusion page features or change upstream API/answer logic.
const {ipcRenderer}=require('electron');
const keys=['xxtsk.runParams','xxtsk.theme','xxtsk.announce.seen'];
let previous='';
const snapshot=()=>Object.fromEntries(keys.flatMap(key=>{const value=localStorage.getItem(key);return value===null?[]:[[key,value]];}));
try{
 const saved=ipcRenderer.sendSync('fusion-native-panel:get');
 if(saved?.ok){for(const key of keys){if(typeof saved.value[key]==='string')localStorage.setItem(key,saved.value[key]);else localStorage.removeItem(key);}}
 previous=JSON.stringify(snapshot());
}catch{}
function save(){try{const value=snapshot(),serialized=JSON.stringify(value);if(serialized!==previous){ipcRenderer.send('fusion-native-panel:set',value);previous=serialized;}}catch{}}
const timer=setInterval(save,500);
window.addEventListener('beforeunload',()=>{save();clearInterval(timer);},{once:true});
