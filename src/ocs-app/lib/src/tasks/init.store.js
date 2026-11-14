"use strict";
Object.defineProperty(exports,"__esModule",{value:true});
const {app,safeStorage}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {store,OriginalAppStore}=require('../store');
const logger=require('../logger').Logger('store-init');
const root=path.resolve(__dirname,'../../../../../..');
const {prepareNativeConfig}=require(path.join(root,'src/initialize-config.cjs'));
function initStore(){
 const original={...OriginalAppStore,name:app.getName(),version:app.getVersion(),paths:{...OriginalAppStore.paths,userDataDirsFolder:path.join(app.getPath('userData'),'userDataDirs')}};
 const result=prepareNativeConfig(store.store,original,{vault:safeStorage,browserPath:path.join(root,'ocs-lab/resources/bin/chrome/chrome/chrome.exe'),installRoot:root});
 OriginalAppStore.paths.userDataDirsFolder=result.value.paths.userDataDirsFolder;
 for(const key of ['userDataDirsFolder','extensionsFolder','downloadFolder'])fs.mkdirSync(result.value.paths[key],{recursive:true});
 if(result.changed)store.store=result.value;
 logger.log('本地配置已就绪',{version:original.version,updated:result.changed});
}
exports.initStore=initStore;
