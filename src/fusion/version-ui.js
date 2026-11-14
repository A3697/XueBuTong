(() => {
 'use strict';
 if(window.__fusionVersionUI||!window.__fusionVersionInfo)return;
 const info=window.__fusionVersionInfo,attached=new WeakSet();
 const open=event=>{event?.preventDefault();event?.stopPropagation();const bridge=window.xingchanBridge||window.fusionPanelBridge;bridge?.openAbout().catch(()=>{});};
 function reconcile(){
  const targets=[document.getElementById('version'),...document.querySelectorAll('#app .sider .version')].filter(Boolean);
  for(const node of targets){
   if(node.hasAttribute('data-fusion-native-about')){const label='学不通 '+info.version;if(node.textContent!==label)node.textContent=label;node.title='关于'+label;continue;}
   node.textContent='v'+info.version;node.title='打开学不通说明页';node.style.cursor='pointer';
   if(attached.has(node))continue;attached.add(node);node.setAttribute('role','button');node.tabIndex=0;
   node.addEventListener('click',open);node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')open(event);});
  }
 }
 let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;observer.disconnect();reconcile();observer.observe(document.body,{subtree:true,childList:true});});});
 reconcile();observer.observe(document.body,{subtree:true,childList:true});window.__fusionVersionUI={reconcile};
})();
