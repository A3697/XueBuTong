(()=>{
 'use strict';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const clone=value=>JSON.parse(JSON.stringify(value));
 function field(host,label,{value='',password=false,rows=0,options}={}){
  const row=el('label','xc-poc-field'),input=el(options?'select':rows?'textarea':'input','xc-poc-input');
  if(options)for(const [value,text]of options){const option=el('option','',text);option.value=value;input.append(option);}
  else if(rows){input.rows=rows;input.spellcheck=false;}else input.type=password?'password':'text';
  input.value=value;input.autocomplete='off';input.setAttribute('aria-label',label);row.append(el('span','',label),input);host.append(row);return input;
 }
 function button(text,action,{danger=false}={}){const node=el('button','xc-poc-button'+(danger?' xc-danger-button':''),text);node.type='button';node.onclick=()=>Promise.resolve().then(action).catch(error=>window.FusionDialogs.alert(error.message));return node;}
 function duplicateToast(){const node=el('div','fusion-provider-toast','已重复配置此模型');node.setAttribute('role','status');document.body.append(node);setTimeout(()=>node.remove(),4500);}
 async function confirmRemove(name){return (await window.FusionDialogs.show({title:'移除'+name+'配置',message:'确定移除此配置吗？点击外层“确定”后保存，取消仍可保留原配置。',buttons:['取消','确认移除'],defaultId:0,cancelId:0})).response===1;}
 async function open({uid,snapshot,bridge,save,initialTab='banks',editId,signal}){
  const A=window.FusionAIConfig,B=window.FusionQuestionBanks;
  const loaded=await bridge.getQuestionBankConfiguration({uid});if(signal?.aborted)return;if(loaded.uid!==uid)throw Error('题库配置账号不匹配');
  let banks=B.parse(loaded.json).banks,ais=clone(snapshot.aiConfigurations||[]),methods=clone(snapshot.searchMethods),universalCleared=false,active=true,tab=initialTab;
  const body=el('div','fusion-provider-config'),tabs=el('div','fusion-provider-tabs'),content=el('div','fusion-provider-content'),note=el('p','xc-poc-note','在此处新增、修改或移除后，点击“确定”统一保存；“取消”保留原配置。');
  tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','题库类型');body.append(tabs,note,content);
  const pages=new Map(),tabButtons=new Map();let child=null,soutiTimer=null,soutiBusy=false,soutiState=null;
  for(const [key,label]of [['banks','普通题库'],['ai','AI'],['universal','万能题库'],['soutijiang','大学搜题酱']]){
   const page=el('section','fusion-provider-page'),control=button(label,()=>select(key));page.id='fusion-provider-'+key;page.setAttribute('role','tabpanel');control.setAttribute('role','tab');control.setAttribute('aria-controls',page.id);tabs.append(control);content.append(page);pages.set(key,page);tabButtons.set(key,control);
  }
  function select(key){tab=pages.has(key)?key:'banks';for(const [id,page]of pages){page.hidden=id!==tab;const control=tabButtons.get(id);control.setAttribute('aria-selected',String(id===tab));control.tabIndex=id===tab?0:-1;}if(tab==='soutijiang')void refreshSouti();else clearTimeout(soutiTimer);}
  tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=[...pages.keys()],index=keys.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:keys.length-1))%keys.length;select(keys[next]);tabButtons.get(keys[next]).focus();};
  function reconcile(){methods=A.reconcile(B.reconcile(methods,banks),ais);}
  function enable(id){const method=methods.find(m=>m.id===id);if(method)method.enabled=true;}
  const bankPage=pages.get('banks'),bankList=el('div','fusion-provider-list'),json=field(bankPage,'新增题库（OCS JSON）',{rows:7});json.maxLength=B.MAX_BYTES;json.placeholder='粘贴原 OCS 格式的题库配置数组';
  bankPage.append(button('解析并添加',()=>{const incoming=B.parse(json.value);if(!incoming.banks.length)throw Error('请粘贴至少一个题库配置');const combined=new Map(banks.map(bank=>[bank.id,bank]));for(const bank of incoming.banks)combined.set(bank.id,bank);banks=B.parse([...combined.values()].map(bank=>bank.wrapper)).banks;reconcile();for(const bank of incoming.banks)enable(bank.id);json.value='';renderBanks();}));
  bankPage.append(bankList);
  function renderBanks(){
   bankList.replaceChildren();if(!banks.length)bankList.append(el('p','xc-poc-note','尚未配置普通题库。'));
   for(const bank of banks){const row=el('div','fusion-provider-row'),title=el('div','fusion-provider-identity'),actions=el('div','fusion-provider-actions');title.append(el('strong','',bank.name),el('small','',new URL(bank.wrapper.url).hostname));
    actions.append(button('更改配置',()=>editBank(bank.id)),button('移除',async()=>{if(await confirmRemove(bank.name)){banks=banks.filter(item=>item.id!==bank.id);reconcile();renderBanks();}},{danger:true}));row.append(title,actions);bankList.append(row);}
  }
  async function editBank(id){
   if(child)return;const bank=banks.find(item=>item.id===id);if(!bank)return;
   const box=el('div'),editor=field(box,'当前题库 JSON',{value:JSON.stringify([bank.wrapper],null,2),rows:15});editor.maxLength=B.MAX_BYTES;editor.classList.add('fusion-provider-json');
   child=window.FusionDialogs.open({title:'更改题库配置 · '+bank.name,content:box,buttons:['取消','保存'],defaultId:1,cancelId:0,onAction:index=>{
    if(index!==1)return;const parsed=B.parse(editor.value);if(parsed.banks.length!==1)throw Error('更改配置时请保留一个题库；多个题库请使用“新增题库”。');
    const next=parsed.banks[0];if(banks.some(item=>item.id!==id&&item.id===next.id))throw Error('更改后的名称和接口与已有题库重复，请修改名称。');
    banks=B.parse(banks.map(item=>item.id===id?next.wrapper:item.wrapper)).banks;methods=methods.map(item=>item.id===id?{...item,id:next.id}:item);reconcile();renderBanks();
   }});await child.result;editor.value='';child=null;
  }
  const aiPage=pages.get('ai'),aiList=el('div','fusion-provider-list');aiPage.append(button('添加 AI 配置',()=>editAI()),aiList);
  function renderAI(){
   aiList.replaceChildren();if(!ais.length)aiList.append(el('p','xc-poc-note','尚未配置 AI。已有配置也可从抽屉中的搜题顺序直接修改。'));
   for(const ai of ais){const row=el('div','fusion-provider-row'),title=el('div','fusion-provider-identity'),actions=el('div','fusion-provider-actions');title.append(el('strong','',ai.name),el('small','',ai.model+' · '+ai.type+' · '+(ai.key?B.preview(ai.key):ai.keyPreview||'无需 API Key')));actions.append(button('更改配置',()=>editAI(ai.id)),button('移除',async()=>{if(await confirmRemove(ai.name)){ais=ais.filter(item=>item.id!==ai.id);reconcile();renderAI();}},{danger:true}));row.append(title,actions);aiList.append(row);}
  }
  async function editAI(id){
   if(child)return;if(!id&&ais.length>=A.MAX)throw Error('最多支持 '+A.MAX+' 个 AI 配置');
   const previous=id?ais.find(item=>item.id===id):null;if(id&&!previous)return;
   const old=previous||{...A.empty(),id:!ais.some(ai=>ai.id==='xingchan-ai')?'xingchan-ai':'ai-'+Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>n.toString(16).padStart(2,'0')).join(''),name:'',hasKey:false};
   const box=el('div','xc-poc-fields'),providers=window.FusionAiProviders,provider=field(box,'模型厂商',{options:providers.map(p=>[p.id,p.name])});provider.value=providers.find(p=>p.baseUrl.replace(/\/$/,'')===old.baseUrl.replace(/\/$/,''))?.id||'custom';
   const name=field(box,'名称',{value:old.name}),url=field(box,'AI 接口地址',{value:old.baseUrl}),key=field(box,'API Key',{password:true,value:old.key||''}),preview=el('p','xc-poc-key-preview',old.keyPreview?'已保存：'+old.keyPreview:'尚未配置 Key');name.maxLength=500;key.maxLength=8192;key.placeholder='留空保留此配置、此接口已保存的密钥';box.append(preview);
   const type=field(box,'接口类型',{value:old.type,options:A.TYPES.map(t=>[t,t])}),choices=field(box,'官方可用模型',{options:[['','获取后请选择，也可手动填写']]}),model=field(box,'模型名称（支持自定义）',{value:old.model}),hint=el('p','xc-poc-note');model.maxLength=256;hint.setAttribute('role','status');box.append(hint);
   let generation=0,open=true,pending=false,customName=!!old.name&&old.name!==old.model,lastWarning='';
   const read=()=>({id:old.id,name:name.value.trim()||model.value.trim(),baseUrl:A.address(url.value),type:type.value,model:model.value.trim(),key:key.value});
   const repeated=value=>ais.some(ai=>ai.id!==old.id&&ai.model===value);
   function modelChanged(){if(!customName)name.value=model.value.trim();if(repeated(model.value.trim())&&lastWarning!==model.value.trim()){lastWarning=model.value.trim();duplicateToast();}else if(!repeated(model.value.trim()))lastWarning='';}
   name.oninput=()=>customName=!!name.value.trim()&&name.value.trim()!==model.value.trim();model.oninput=modelChanged;choices.onchange=()=>{if(choices.value){model.value=choices.value;modelChanged();}};
   async function fetchModels(){const seq=++generation;try{const draft=read();if(!draft.baseUrl){hint.textContent='请选择厂商或填写接口地址。';return;}hint.textContent='正在获取模型列表…';const result=await bridge.listAiModels({uid,ai:draft});if(!open||seq!==generation)return;choices.replaceChildren();const first=el('option','','请选择，或保留自定义模型');first.value='';choices.append(first);for(const value of result.models||[]){const option=el('option','',value);option.value=value;choices.append(option);}if([...choices.options].some(option=>option.value===model.value))choices.value=model.value;hint.textContent=result.message;}catch(error){if(open&&seq===generation)hint.textContent=error.message;}}
   const tools=el('div','xc-ai-footer-tools'),refresh=button('刷新模型列表',fetchModels),verify=button('验证 API',async()=>{if(pending)return;pending=true;verify.disabled=true;try{hint.textContent='正在验证 API…';const result=await bridge.checkConnections({uid,only:old.id,draftAI:read()});if(open)hint.textContent=result.items[0]?.message||'未取得结果';}finally{pending=false;verify.disabled=false;}});tools.append(refresh,verify);
   let aiDialog;
   if(previous)tools.append(button('清除 AI 配置',async()=>{if(await confirmRemove(old.name)){ais=ais.filter(ai=>ai.id!==old.id);reconcile();renderAI();aiDialog.close();}},{danger:true}));
   provider.onchange=()=>{const preset=providers.find(p=>p.id===provider.value);if(preset?.id!=='custom'){url.value=preset.baseUrl;type.value=preset.type;model.value='';key.value='';modelChanged();preview.textContent=preset.baseUrl===old.baseUrl&&old.keyPreview?'已保存：'+old.keyPreview:'请填写此接口的 Key（Ollama 可留空）';void fetchModels();}};
   key.onblur=()=>void fetchModels();url.onblur=()=>void fetchModels();type.onchange=()=>void fetchModels();
   aiDialog=child=window.FusionDialogs.open({title:previous?'更改 AI 配置':'添加 AI 配置',content:box,footerContent:tools,buttons:['取消','保存'],defaultId:1,cancelId:0,onAction:index=>{
    if(index!==1)return;const draft=read(),sameOrigin=!!(draft.baseUrl&&old.baseUrl&&new URL(draft.baseUrl).origin===new URL(old.baseUrl).origin),hasKey=!!draft.key||sameOrigin&&old.hasKey;
    A.normalize([...ais.filter(ai=>ai.id!==old.id),draft]);if(!A.configured({...draft,hasKey}))throw Error('请填写接口地址、模型和此接口的 API Key（Ollama 可不填 Key）');
    if(repeated(draft.model))duplicateToast();
    const next={...draft,hasKey,keyPreview:draft.key?B.preview(draft.key):sameOrigin?old.keyPreview:''};ais=previous?ais.map(ai=>ai.id===old.id?next:ai):[...ais,next];reconcile();if(!previous)enable(old.id);renderAI();
   }});void fetchModels();await child.result;open=false;generation++;key.value='';child=null;
  }
  const universalPage=pages.get('universal');universalPage.append(el('p','xc-poc-note','沿用星蝉原题库接口，与普通题库 JSON 解析相互独立。'));
  const universalKey=field(universalPage,'万能题库 Key',{password:true}),universalStatus=el('p','xc-poc-key-preview',snapshot.xingchanBank.keyPreview?'已保存：'+snapshot.xingchanBank.keyPreview:'未配置，默认关闭');universalKey.maxLength=8192;universalKey.placeholder='留空保留已保存密钥';
  const clear=button('清除万能题库配置',async()=>{if(await confirmRemove('万能题库')){universalKey.value='';universalCleared=true;universalStatus.textContent='将在点击“确定”后清除';clear.disabled=true;}},{danger:true});clear.disabled=!snapshot.xingchanBank.hasKey;universalPage.append(universalStatus,clear);universalKey.oninput=()=>{if(universalKey.value){universalCleared=false;clear.disabled=false;}};
  const soutiPage=pages.get('soutijiang'),soutiLabel=el('label','fusion-provider-switch'),soutiSwitch=el('input','fusion-answer-switch');soutiSwitch.type='checkbox';soutiSwitch.setAttribute('role','switch');soutiSwitch.setAttribute('aria-label','接管大学搜题酱');soutiSwitch.checked=snapshot.soutijiangEnabled===true;
  soutiLabel.title='按账号独立配置，默认关闭。按搜题顺序调用官方扩展，优先截图搜题；服务明确当天额度耗尽后才使用自动答题额度，全部耗尽后当日跳过。验证、会员限制和限流会停止请求，不切换额度。';soutiLabel.append(soutiSwitch,el('span','','接管大学搜题酱'));
  const soutiStatus=el('p','xc-poc-note','正在读取登录状态…'),soutiQr=el('img','fusion-soutijiang-qr'),soutiTools=el('div','fusion-provider-actions');soutiStatus.setAttribute('role','status');soutiQr.alt='大学搜题酱官方登录二维码';soutiQr.hidden=true;
  const soutiInstall=button('安装官方扩展',()=>soutiAction(async()=>{await bridge.installSoutijiang();return bridge.getSoutijiangState({uid});})),soutiLogin=button('恢复登录／获取二维码',()=>soutiAction(()=>bridge.loginSoutijiang({uid}))),soutiWindow=button('打开官方登录窗口',()=>soutiAction(()=>bridge.loginSoutijiang({uid,visible:true}))),soutiRefresh=button('检查登录状态',()=>refreshSouti(true)),soutiLogout=button('退出登录',async()=>{if((await window.FusionDialogs.show({title:'退出大学搜题酱',message:'将退出此账号保存的搜题酱登录，不影响学习平台登录。此操作立即生效。',buttons:['取消','退出登录'],defaultId:0,cancelId:0})).response===1)await soutiAction(()=>bridge.logoutSoutijiang({uid}));},{danger:true});
  soutiTools.append(soutiInstall,soutiLogin,soutiWindow,soutiRefresh,soutiLogout);soutiPage.append(soutiLabel,soutiStatus,soutiQr,soutiTools,el('p','xc-poc-note','请按二维码提示选择微信或大学搜题酱 App 扫码；二维码未能显示时，可打开官方登录窗口。网络使用直连。登录与退出立即生效；接管开关点击“确定”后保存。导入配置后需重新登录搜题酱。'));
  function renderSouti(){
   if(!active)return;const state=soutiState||{},ready=state.installed&&state.compatible;
   soutiStatus.textContent=!state.installed?'尚未安装大学搜题酱官方扩展。':!state.compatible?'当前扩展版本尚未验证，暂不接管；请保留原版使用。':state.message||(state.loggedIn?'已登录：'+(state.name||'大学搜题酱账号'):'尚未确认登录，可恢复登录或获取二维码。');
   if(state.loggedIn&&(state.screenshotExhausted||state.solveExhausted))soutiStatus.textContent+=' '+(state.screenshotExhausted&&state.solveExhausted?'今日额度已耗尽，次日恢复。':state.screenshotExhausted?'截图额度已耗尽，将使用自动答题额度。':'自动答题额度已耗尽。');
   const qr=typeof state.qrDataUrl==='string'&&/^data:image\/png;base64,/.test(state.qrDataUrl)?state.qrDataUrl:'';soutiQr.hidden=!qr||state.loggedIn;if(qr)soutiQr.src=qr;else soutiQr.removeAttribute('src');
   soutiInstall.hidden=!!state.installed;soutiInstall.disabled=soutiBusy;soutiLogin.hidden=state.loggedIn===true;soutiLogin.disabled=soutiBusy||!ready;soutiWindow.hidden=state.loggedIn===true;soutiWindow.disabled=soutiBusy||!ready;soutiRefresh.disabled=soutiBusy||!ready;soutiLogout.hidden=!state.loggedIn;soutiLogout.disabled=soutiBusy;
  }
  function pollSouti(){clearTimeout(soutiTimer);if(active&&tab==='soutijiang'&&soutiState?.phase==='awaiting-login')soutiTimer=setTimeout(()=>void refreshSouti(),3000);}
  async function soutiAction(action){if(soutiBusy||!active)return;soutiBusy=true;renderSouti();let failure;try{soutiStatus.textContent='正在处理…';const result=await action();if(active){if(result.uid!==uid)throw Error('搜题酱登录账号不匹配');soutiState=result;}}catch(error){failure=error;}finally{soutiBusy=false;if(active){renderSouti();if(failure)soutiStatus.textContent=failure.message;else pollSouti();}}}
  async function refreshSouti(connect=false){if(!bridge.getSoutijiangState){soutiStatus.textContent='当前版本未提供搜题酱接管，请更新后使用。';return;}await soutiAction(()=>bridge.getSoutijiangState({uid,refresh:true,connect}));}
  renderBanks();renderAI();select(initialTab);
  const dialog=window.FusionDialogs.open({title:'题库配置',content:body,buttons:['取消','确定'],defaultId:1,cancelId:0,onAction:async index=>{
   if(index!==1)return;if(json.value.trim())throw Error('普通题库中还有未解析的 JSON，请先“解析并添加”，或清空后再确定。');
   reconcile();const bankMethod=methods.find(m=>m.id==='xingchan-bank');if(universalCleared)bankMethod.enabled=false;else if(universalKey.value&&!snapshot.xingchanBank.hasKey)bankMethod.enabled=true;
   await save({questionBankConfig:B.parse(banks.map(bank=>bank.wrapper)).json,aiConfigurations:ais,searchMethods:methods,xingchanBankKey:universalKey.value,clearXingchanBankKey:universalCleared,soutijiangEnabled:soutiSwitch.checked});
  }});dialog.panel.classList.add('fusion-provider-dialog');const abort=()=>dialog.close();signal?.addEventListener('abort',abort,{once:true});
  if(editId)Promise.resolve().then(()=>active&&(A.isId(editId)?editAI(editId):editId==='soutijiang'?select('soutijiang'):editId==='xingchan-bank'?select('universal'):editBank(editId))).catch(error=>window.FusionDialogs.alert(error.message));
  await dialog.result;signal?.removeEventListener('abort',abort);active=false;clearTimeout(soutiTimer);child?.close();banks=[];ais=[];universalKey.value='';json.value='';soutiQr.removeAttribute('src');body.replaceChildren();
 }
 window.FusionProviderConfig={open};
})();
