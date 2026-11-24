'use strict';
window.aboutApi.info().then(info=>{document.querySelector('#version').textContent=info.version;document.querySelector('#ocs-version').textContent='桌面底座 v'+info.dependencies.ocs;document.querySelector('#ocs-script-version').textContent='内置网页脚本 v'+info.dependencies.ocsScript;document.querySelector('#star-version').textContent='v'+info.dependencies.xingchan;document.querySelector('#hash').textContent=info.installerSha256||'当前为本地更新版本，尚未由 '+info.version+' 安装包安装。';}).catch(()=>document.querySelector('#hash').textContent='未能读取安装来源。');
for(const button of document.querySelectorAll('[data-link]'))button.addEventListener('click',()=>window.aboutApi.open(button.dataset.link).catch(()=>document.querySelector('#status').textContent='页面暂时无法打开，请稍后再试。'));
const check=document.querySelector('#check-update'),download=document.querySelector('#download-update'),install=document.querySelector('#install-update'),progress=document.querySelector('#update-progress'),message=document.querySelector('#update-status');
let polling;
function renderUpdate(state){
 message.textContent=state.message||'';
 check.disabled=['checking','downloading','installing'].includes(state.status);
 download.hidden=state.status!=='available';install.hidden=state.status!=='ready';
 progress.hidden=state.status!=='downloading';progress.value=state.size?Math.round((state.received||0)*100/state.size):0;
 if(state.status!=='downloading'){clearInterval(polling);polling=null;}
}
async function update(action){
 check.disabled=true;download.disabled=true;install.disabled=true;
 if(action==='download'){message.textContent='正在下载更新…';polling=setInterval(()=>window.aboutApi.update('state').then(renderUpdate).catch(()=>{}),500);}
 try{renderUpdate(await window.aboutApi.update(action));}catch(error){clearInterval(polling);polling=null;renderUpdate({status:'error',message:String(error.message||'更新未完成，请稍后重试。').replace(/^Error invoking remote method '[^']+': Error: /,'')});}
 finally{download.disabled=false;install.disabled=false;}
}
check.addEventListener('click',()=>update('check'));download.addEventListener('click',()=>update('download'));install.addEventListener('click',()=>update('install'));
window.aboutApi.update('state').then(renderUpdate).catch(()=>{});
window.addEventListener('beforeunload',()=>clearInterval(polling));
