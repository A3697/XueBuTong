(()=>{'use strict';if(window.FusionSessionGuard)return;let current=null,revision=0;
 function show(snapshot){
  if(!snapshot?.items?.length)return;
  revision=snapshot.revision;
  if(!current){const list=document.createElement('ul');list.style.cssText='padding-left:22px;line-height:1.8;overflow-wrap:anywhere';list.setAttribute('aria-live','polite');
   const dialog=window.FusionDialogs.open({title:'账号登录已被替换',message:'多次操作会导致账号风控',detail:'以下账号在其他设备登录，已触发任务停止保护。请先确认其他设备上的使用情况，再手动启动。',content:list,buttons:['我知道了']});current={dialog,list};
   dialog.result.then(()=>{const acknowledged=revision;current=null;void window.xingchanBridge?.acknowledgeSessionGuard({revision:acknowledged});});
  }
  current.list.replaceChildren(...snapshot.items.map(item=>{const row=document.createElement('li');row.textContent=item.name+'（'+(item.mode==='browser'?'浏览器':'星蝉')+'）：'+({stopping:'正在停止',stopped:'已停止',failed:'停止未完成，请手动停止'}[item.status]||'正在停止');return row;}));
 }
 window.FusionSessionGuard={show};
})();
