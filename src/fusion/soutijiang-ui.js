(()=>{
 'use strict';
 const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
 function mount(host,{uid,bridge,enabled}){
  let active=true,visible=false,busy=false,state=null,selectedId='',timer,child;
  const label=el('label','fusion-provider-switch'),toggle=el('input','fusion-answer-switch');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','接管大学搜题酱');toggle.checked=enabled===true;
  label.append(toggle,el('span','','接管大学搜题酱'));label.title='仅控制作为题库使用，不影响脚本选择。按账号顺序使用；明确额度耗尽才切换，验证、限流和登录失效会暂停并提示。';
  const heading=el('div','fusion-souti-heading'),title=el('strong','','搜题酱账号'),list=el('div','fusion-souti-accounts'),status=el('p','xc-poc-note','正在读取登录状态…'),qr=el('img','fusion-soutijiang-qr'),tools=el('div','fusion-provider-actions');
  status.setAttribute('role','status');list.setAttribute('aria-label','搜题酱账号使用顺序');qr.alt='大学搜题酱官方登录二维码';qr.hidden=true;
  title.title='每个学不通账号独立管理。账号、备注、顺序及登录操作立即保存；接管开关点击外层“确定”后保存。插件与题库共用当前登录。';
  function button(text,run,{danger=false}={}){const b=el('button','xc-poc-button'+(danger?' xc-danger-button':''),text);b.type='button';b.onclick=()=>Promise.resolve().then(run).catch(error=>window.FusionDialogs.alert(error.message));return b;}
  const add=button('添加账号',()=>action(()=>bridge.changeSoutijiangAccounts({uid,action:'add'}),true));heading.append(title,add);
  const install=button('安装官方扩展',()=>action(async()=>{await bridge.installSoutijiang();return bridge.getSoutijiangState({uid});}));
  const login=button('获取登录二维码',()=>action(()=>bridge.loginSoutijiang({uid,slotId:selectedId})));
  const open=button('打开官方登录窗口',()=>action(()=>bridge.loginSoutijiang({uid,slotId:selectedId,visible:true})));
  const refresh=button('检查登录状态',()=>load(true));
  const logout=button('退出此登录',async()=>{if((await window.FusionDialogs.show({title:'退出大学搜题酱',message:'插件与题库将同步退出当前选中的搜题酱登录，不影响学习平台及其他保存的搜题酱账号。此操作立即生效。',buttons:['取消','退出登录'],defaultId:0,cancelId:0})).response===1)await action(()=>bridge.logoutSoutijiang({uid,slotId:selectedId}));},{danger:true});
  tools.append(install,login,open,refresh,logout);host.append(label,heading,list,status,qr,tools);
  function schedule(){clearTimeout(timer);if(active&&visible&&state?.phase==='awaiting-login')timer=setTimeout(()=>void load(),3000);}
  async function action(run,selectResult=false){if(!active||busy)return;busy=true;render();let failure;
   try{let result=await run();if(!active)return;if(result.uid!==uid)throw Error('搜题酱账号不匹配');if(selectResult||!selectedId||!result.accounts?.some(row=>row.id===selectedId))selectedId=result.selectedId;
    // Mutations can return the first account in usage order. Keep the detail
    // controls bound to the card the user is currently managing.
    if(selectedId&&result.selectedId!==selectedId){result=await bridge.getSoutijiangState({uid,slotId:selectedId,refresh:true});if(!active)return;if(result.uid!==uid||result.selectedId!==selectedId)throw Error('搜题酱账号不匹配');}
    state=result;}
   catch(error){failure=error;}finally{busy=false;if(active){render();if(failure)status.textContent=failure.message;else schedule();}}
   return !failure;
  }
  async function editRemark(row){
   const body=el('div'),input=el('input','xc-poc-input');input.type='text';input.value=row.remark;input.maxLength=80;input.setAttribute('aria-label','账号备注');body.append(input);
   child=window.FusionDialogs.open({title:'修改搜题酱账号备注',content:body,buttons:['取消','保存'],defaultId:1,cancelId:0,onAction:async index=>{if(index===1&&!(await action(()=>bridge.changeSoutijiangAccounts({uid,action:'rename',id:row.id,remark:input.value}))))throw Error('备注未能保存，请检查后重试。');}});await child.result;child=null;
  }
  function move(row,step){const order=state.accounts.map(item=>item.id),index=order.indexOf(row.id),to=index+step;if(to<0||to>=order.length)return;[order[index],order[to]]=[order[to],order[index]];return action(()=>bridge.changeSoutijiangAccounts({uid,action:'reorder',order}));}
  async function remove(row){if((await window.FusionDialogs.show({title:'移除搜题酱账号',message:'从此学不通账号中移除此登录记录。其他搜题酱账号与学习平台登录不受影响。此操作立即生效。',buttons:['取消','移除'],defaultId:0,cancelId:0})).response===1)await action(()=>bridge.changeSoutijiangAccounts({uid,action:'remove',id:row.id}),true);}
  function render(){
   if(!active)return;const data=state||{},ready=data.installed&&data.compatible,rows=data.accounts||[];
   list.replaceChildren();for(const [index,row]of rows.entries()){
    const card=el('article','fusion-souti-account'+(row.id===selectedId?' is-selected':'')),main=el('div','fusion-souti-account-main'),name=el('strong','',`${index+1}. ${row.remark||row.name||'未登录账号'}`);
    const detail=el('span','fusion-souti-detail',(row.name&&row.remark?row.name+' · ':'')+(row.blocked?'需要处理验证':row.loggedIn?'已登录':row.configured?'已保存登录':'未登录')+(row.id===data.browserAccountId?' · 插件共用账号':''));
    const usage=el('span','fusion-souti-usage',`本机今日成功搜题：截图 ${row.screenshotUsed} 次 · 自动答题 ${row.solveUsed} 次`);usage.title=data.usageNote||'统计本机题库调用，不代表官方扣减次数。';
    const quota=el('span','fusion-souti-detail',row.screenshotExhausted&&row.solveExhausted?'官方确认：今日额度已耗尽':row.screenshotExhausted?'官方确认：截图额度已耗尽':row.solveExhausted?'官方确认：自动答题额度已耗尽':'官方已用／剩余额度：未提供');
    main.append(name,detail,usage,quota);const controls=el('div','fusion-souti-row-actions');
    const manage=button(row.id===selectedId?'当前查看':'管理',()=>{selectedId=row.id;void load();});manage.disabled=busy||row.id===selectedId;
    const rename=button('备注',()=>editRemark(row)),up=button('↑',()=>move(row,-1)),down=button('↓',()=>move(row,1)),del=button('移除',()=>remove(row),{danger:true});
    up.setAttribute('aria-label','上移 '+(row.remark||row.name||'账号'));down.setAttribute('aria-label','下移 '+(row.remark||row.name||'账号'));up.disabled=busy||index===0;down.disabled=busy||index===rows.length-1;rename.disabled=del.disabled=busy;controls.append(manage,rename,up,down,del);card.append(main,controls);list.append(card);
   }
   if(state&&!rows.length)list.append(el('p','xc-poc-note','尚未保存搜题酱账号，点击“添加账号”后扫码登录。'));
   status.textContent=!state?'正在读取登录状态…':!data.installed?'请先安装大学搜题酱官方扩展。':!data.compatible?'当前扩展版本尚未验证，暂不接管。':data.message||(data.loggedIn?'当前查看：'+(data.name||'已登录账号'):'选择账号后恢复登录或获取二维码。');
   const image=typeof data.qrDataUrl==='string'&&/^data:image\/png;base64,/.test(data.qrDataUrl)?data.qrDataUrl:'';qr.hidden=!image||data.loggedIn;if(image)qr.src=image;else qr.removeAttribute('src');
   add.disabled=busy||rows.length>=20;install.hidden=!!data.installed;install.disabled=busy;login.hidden=open.hidden=data.loggedIn===true;login.disabled=open.disabled=busy||!ready||!selectedId;refresh.disabled=busy||!ready||!selectedId;logout.hidden=!data.loggedIn;logout.disabled=busy;
  }
  async function load(connect=false){await action(()=>bridge.getSoutijiangState({uid,slotId:selectedId||undefined,refresh:true,connect}));}
  render();return {get enabled(){return toggle.checked;},setVisible(value){visible=value;clearTimeout(timer);if(visible)void load();},dispose(){active=false;clearTimeout(timer);child?.close();}};
 }
 window.FusionSoutijiangUI={mount};
})();
