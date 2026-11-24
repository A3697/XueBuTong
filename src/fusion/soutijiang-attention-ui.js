(()=>{'use strict';if(window.FusionSoutijiangAttention)return;let active=null;
 function show(snapshot){
  if(!snapshot?.items?.length){if(active){active.automatic=true;active.dialog.close();}return;}
  if(!active){
   const list=document.createElement('div');list.className='fusion-souti-attention-list';list.setAttribute('aria-live','polite');
   const dialog=FusionDialogs.open({title:'搜题酱账号需要处理',message:'后台任务继续运行，无需等待处理',detail:'异常账号已立即跳过，继续尝试其他可用账号或搜题方式。10 分钟内无人处理会自动关闭提醒；重新登录成功后才恢复该账号。',content:list,buttons:['暂时跳过并关闭提醒']});
   const view=active={dialog,list,items:[],automatic:false};
   view.timer=setInterval(()=>{void xingchanBridge.getSoutijiangAttention().then(show).catch(()=>{});},1000);
   dialog.result.then(()=>{clearInterval(view.timer);if(active===view)active=null;if(!view.automatic)for(const item of view.items)void xingchanBridge.skipSoutijiangAttention({uid:item.uid,slotId:item.slotId}).catch(()=>{});});
  }
  active.items=snapshot.items;
  const rows=snapshot.items.map(item=>{
   const row=document.createElement('article');row.className='fusion-souti-attention-row';
   const text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('p');
   name.textContent=item.accountName+' · '+item.providerName;
   detail.textContent=item.message+'；提醒将于 '+new Date(item.deadline).toLocaleTimeString()+' 自动关闭';text.append(name,detail);
   const login=document.createElement('button');login.type='button';login.className='fusion-dialog-button';login.textContent='处理登录';
   login.onclick=async()=>{login.disabled=true;try{await xingchanBridge.loginSoutijiang({uid:item.uid,slotId:item.slotId,visible:true});detail.textContent='请在官方窗口处理登录；后台任务继续运行。';}catch{detail.textContent='官方登录窗口未能打开，请从题库配置中处理；后台任务继续运行。';}finally{login.disabled=false;}};
   row.append(text,login);return row;
  });
  // Keep focused buttons and in-flight login actions stable while the deadline updates.
  const signature=JSON.stringify(snapshot.items.map(x=>[x.uid,x.slotId,x.message]));
  if(active.signature!==signature){active.signature=signature;active.list.replaceChildren(...rows);}
 }
 window.FusionSoutijiangAttention={show};
})();
