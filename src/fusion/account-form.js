(()=>{
 'use strict';
 const jobs=new Set(),flushers=new Set();
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const errorText=error=>String(error?.message||'操作未完成，请重试。').replace(/^Error invoking remote method '[^']*': Error: /,'');
 function mount({container,uid,options,bridge,model}){
  let alive=true,snapshot=null,methods=[],checks=new Map(),write=Promise.resolve(),dirty=0,saved=0,writing=false,checking=false,drag=null,providerOpen=false,providerAbort=new AbortController(),checksVersion=0;
  const active=()=>alive&&(!options?.isCurrent||options.isCurrent()),fields={},answerFields={},labels={},starOnly=[],environmentFields={},environmentTouched=new Set(),methodChecks=new Map();let environmentRevision=0,mouseRevision=0,mouseTouched=false,enrollmentRevision=0,enrollmentTouched=false,starRevision=0,starTouched=false,ocsRevision=0,ocsTouched=false,scriptRevision=0,scriptTouched=false;
  const node=el('section','xc-poc-root xc-poc-account');node.id='bp-xingchan';node.dataset.xcUid=uid;node.dataset.label='题库与答题设置';
  node.append(el('h3','','题库与答题设置'),el('p','xc-poc-note','设置按账号保存，供开启增强的浏览器与星蝉使用。关闭增强后配置仍保留，请在对应原生页面调整设置。星蝉的题库和 API 配置重启增强模式后应用。'));
  const mouseHost=container.querySelector('#bp-browser-behavior'),mouseLabel=el('label','fusion-browser-playback-setting'),mouseSwitch=el('input','fusion-answer-switch');
  mouseSwitch.type='checkbox';mouseSwitch.setAttribute('role','switch');mouseSwitch.setAttribute('aria-label','鼠标移出网页时继续播放');mouseSwitch.disabled=true;
  mouseLabel.title='仅作用于当前账号的浏览器模式，默认关闭。启用后阻止网页因鼠标移出或紧随其后的失焦而直接暂停视频，保留点击、拖动和手动暂停；保存后数秒内生效。';
  mouseLabel.append(mouseSwitch,document.createTextNode('鼠标移出网页时继续播放'));mouseHost?.append(mouseLabel);
  mouseSwitch.onchange=()=>{mouseTouched=true;mouseRevision++;autosave();};
  const enrollmentHost=container.querySelector('#bp-enrollment-year'),enrollmentBox=el('div','fusion-enrollment-setting'),enrollmentHint=el('p','xc-poc-note','此信息用于 AI 解题的提示词'),enrollmentSelect=el('select','xc-poc-input');
  enrollmentBox.style.maxWidth='360px';enrollmentHint.style.margin='0 0 8px';enrollmentSelect.setAttribute('aria-label','入学年份');enrollmentSelect.disabled=true;
  enrollmentSelect.title='按每年 9 月开学计算年级，不推断学制或休学。未选择时使用“大学生”。按账号保存，仅增强模式使用；浏览器下次搜题生效，星蝉重启后应用。';
  for(const [value,label]of [['','未选择'],...Array.from({length:new Date().getFullYear()-window.FusionEnrollment.MIN_YEAR+1},(_,i)=>{const year=new Date().getFullYear()-i;return [String(year),year+' 年入学'];})]){const option=el('option','',label);option.value=value;enrollmentSelect.append(option);}
  enrollmentBox.append(enrollmentHint,enrollmentSelect);enrollmentHost?.append(enrollmentBox);enrollmentSelect.onchange=()=>{enrollmentTouched=true;enrollmentRevision++;autosave();};
  const starMode=el('section','xc-poc-root xc-star-mode'),starLabel=el('label','fusion-browser-playback-setting'),starSwitch=el('input','fusion-answer-switch');
  starMode.id='bp-star-mode';starMode.dataset.label='学不通增强配置';starMode.dataset.xcUid=uid;starSwitch.type='checkbox';starSwitch.setAttribute('role','switch');starSwitch.setAttribute('aria-label','星蝉增强');starSwitch.disabled=true;
  starLabel.title='默认开启。关闭后，下次启动使用星蝉 1.3.1 原生前后端，题库、执行设置和队列在原生面板独立管理；学不通的星蝉业务增强不生效。原生版本重启后不恢复队列；再次开启增强会恢复融合版配置与队列。浏览器模式不受影响。';starLabel.append(starSwitch,document.createTextNode('星蝉增强'));starMode.append(starLabel);starOnly.push(starLabel);starSwitch.onchange=()=>{starTouched=true;starRevision++;autosave();};
  const ocsLabel=el('label','fusion-browser-playback-setting'),ocsSwitch=el('input','fusion-answer-switch');ocsSwitch.type='checkbox';ocsSwitch.setAttribute('role','switch');ocsSwitch.setAttribute('aria-label','OCS 增强');ocsSwitch.disabled=true;ocsLabel.title='按账号设置，下次启动浏览器时完全生效。开启后由学不通接管该账号的题库、AI、答题配置及增强功能；关闭后使用官方 OCS 脚本和原有独立配置，不影响其他账号或星蝉。';ocsLabel.append(ocsSwitch,document.createTextNode('OCS 增强'));starMode.prepend(ocsLabel);ocsSwitch.onchange=()=>{ocsTouched=true;ocsRevision++;autosave();};
  const modeOptions=el('div','fusion-enhancement-options');modeOptions.append(ocsLabel,starLabel);starMode.replaceChildren(el('h3','fusion-account-option-title','学不通增强配置'),modeOptions);
  const scriptMode=el('section','xc-poc-root fusion-script-selection'),scriptOptions=el('div','fusion-script-options'),scriptSwitch=el('input','fusion-answer-switch'),ocsChoice=el('label','','启用 OCS'),soutiChoice=el('label','','启用搜题酱');
  scriptMode.id='bp-script-selection';scriptMode.dataset.label='脚本选择';scriptMode.dataset.xcUid=uid;scriptSwitch.id='fusion-script-choice-'+uid;scriptSwitch.type='checkbox';scriptSwitch.setAttribute('role','switch');scriptSwitch.setAttribute('aria-label','启用搜题酱');scriptSwitch.disabled=true;ocsChoice.htmlFor=scriptSwitch.id;soutiChoice.htmlFor=scriptSwitch.id;
  scriptOptions.append(ocsChoice,scriptSwitch,soutiChoice);scriptMode.append(el('h3','fusion-account-option-title','脚本选择'),scriptOptions);
  const soutiLoginHost=el('div','fusion-souti-selector');scriptMode.append(soutiLoginHost);
  const soutiLoginSelector=window.FusionSoutijiangUI.mountSelector(soutiLoginHost,{uid,bridge,isActive:active});
  scriptSwitch.onchange=()=>{scriptOptions.dataset.selected=scriptSwitch.checked?'soutijiang':'ocs';scriptTouched=true;scriptRevision++;autosave();};
  for(const [label,checked]of [[ocsChoice,false],[soutiChoice,true]])label.onclick=event=>{event.preventDefault();if(!scriptSwitch.disabled&&scriptSwitch.checked!==checked){scriptSwitch.checked=checked;scriptSwitch.onchange();}};
  const status=el('p','xc-poc-state','正在读取配置…');status.setAttribute('role','status');node.append(status);
  const form=el('div','xc-poc-fields');node.append(form);
  const promptError=error=>{if(!active())return;status.textContent=errorText(error);void window.FusionDialogs.alert(status.textContent);};
  function button(text,action){const n=el('button','xc-poc-button',text);n.type='button';n.onclick=event=>{event.preventDefault();event.stopPropagation();Promise.resolve().then(action).catch(promptError);};return n;}
  function field(host,key,label,{type='text',value='',entries,rows,min,max}={}){
   const row=el('label','xc-poc-field'),n=el(entries?'select':rows?'textarea':'input','xc-poc-input');row.append(el('span','',label));
   if(entries)for(const [v,text]of entries){const option=el('option','',text);option.value=v;n.append(option);}else if(rows)n.rows=rows;else n.type=type;
   if(type==='checkbox'){n.className='fusion-answer-switch';n.setAttribute('role','switch');n.checked=!!value;}else n.value=value;
   if(min!==undefined)n.min=min;if(max!==undefined)n.max=max;n.setAttribute('aria-label',label);n.autocomplete='off';row.append(n);host.append(row);return n;
  }
  const providerSection=el('section','fusion-config-container'),providerButton=button('题库配置',()=>openProviders()),providerSummary=el('p','xc-poc-note');providerButton.classList.add('fusion-config-button');providerSection.append(providerButton,providerSummary);form.append(providerSection);
  const methodList=el('ol','xc-poc-methods');methodList.setAttribute('aria-label','搜题顺序');
  const answer=el('section','xc-answer-settings');answer.append(el('h4','','自动答题设置'));
  const upload=[['save','自动保存（不提交）'],['nomove','不保存也不提交'],...[10,20,30,40,50,60,70,80,90,100].map(v=>[v,v===100?'全部题目搜到答案才提交':'搜到 '+v+'% 的答案就自动提交']),['force','不管有没有答案都强制提交']];
  answerFields.upload=field(answer,'upload','答案提交方式（提交率）',{entries:upload});
  const bools=[['work-when-no-job','强制答题（仅超星）','非任务点章节测试也答题；是否提交仍由“答案提交方式”决定，不代表强制提交。'],['randomWork-choice','随机选择（仅超星）','所有已启用搜题方式均明确无答案后随机选择；接口报错不触发。随机答案不计入题库命中率。'],['randomWork-complete','随机填空（仅超星）','所有已启用搜题方式均明确无答案后从下方文案随机填空；接口报错不触发。随机答案不计入题库命中率。']];
  for(const [key,label,title]of bools){const n=answerFields[key]=field(answer,key,label,{type:'checkbox'});n.title=title;}
  answer.append(el('p','xc-poc-note','强制答题包含非任务点章节测试，不等于强制提交。随机补答仅在所有搜题方式明确无答案时生效，补答不计入命中率；提交仍遵循上方设置。'));
  answerFields['randomWork-completeTexts-textarea']=field(answer,'texts','随机填空文案（每行一条）',{rows:3});
  const advanced=el('details'),summary=el('summary','','高级设置'),advancedBody=el('div');advanced.append(summary,advancedBody);answer.append(advanced);
  const defs=[['thread','线程数量（个）','number',1,3],['imageOptimize','图片题优化','checkbox'],['answerWrapperHandlerTimeout','搜题最大耗时（秒）','number',10,180],['stopSecondWhenFinish','答题结束后暂停（秒）','number',3,9999],['period','搜题间隔（秒）','number',1,60],['answerSeparators','答案分隔符（英文逗号分隔）','text'],['redundanceWordsText','题目冗余字段自动删除（每行一条）','textarea']];
  for(const [key,label,type,min,max]of defs)answerFields[key]=field(advancedBody,key,label,{type:type==='textarea'?'text':type,...(type==='textarea'?{rows:4}:{}),min,max});
  form.append(el('h4','xc-poc-method-title','搜题顺序'),methodList,answer);
  const autoStatus=el('p','xc-poc-note','输入框失焦自动保存，开关与排序即时保存。');form.append(autoStatus);
  const connection=el('section','xc-poc-root xc-poc-connection xc-account-checks');connection.id='bp-connection-checks';connection.dataset.label='连接检查';connection.dataset.xcUid=uid;
  const heading=el('div','xc-connection-heading'),checkButton=button('检查已启用连接',()=>checkConnections());heading.append(el('h4','','连接检查'),checkButton);
  const runtime=el('p','xc-poc-note'),list=el('ul','xc-connection-results');list.setAttribute('aria-label','已启用的 AI 与题库连接状态');connection.append(heading,runtime,list);starOnly.push(runtime);
  const environment=window.FusionClientEnvironment;
  if(!environment)throw Error('客户端环境配置模块尚未就绪，请重新打开账号设置。');
  const environmentHelp='仅用于学习通的星蝉增强模式，按账号保存，重启此账号后生效并重新登录。修改可能需要完成验证码，或暂时无法登录；不改变公网 IP、TLS、真实硬件或浏览器硬件指纹。';
  const environmentGroup=el('div','fusion-fold-group xc-environment-group');starOnly.push(environmentGroup);
  function environmentSection(id,title){const section=el('details','fusion-account-fold xc-environment-section');section.id=id;section.dataset.label=title;section.dataset.xcUid=uid;const summary=el('summary'),hint=el('span','fusion-fold-help','ⓘ'),body=el('div','fusion-fold-body xc-environment-body');hint.title=environmentHelp;hint.tabIndex=0;hint.setAttribute('aria-label',environmentHelp);summary.append(el('span','',title),hint);section.append(summary,body);environmentGroup.append(section);starOnly.push(section);return body;}
  const deviceBody=environmentSection('bp-client-device','设备号'),fingerprintBody=environmentSection('bp-client-fingerprint','客户端与指纹');
  function environmentField(host,key,label,title,maxLength=80){const n=environmentFields[key]=field(host,key,label);n.title=title;n.maxLength=maxLength;n.spellcheck=false;n.disabled=true;n.dataset.environmentField=key;n.addEventListener('input',()=>{environmentTouched.add(key);environmentRevision++;});n.addEventListener('blur',()=>{if(environmentTouched.has(key))autosave();});return n;}
  const deviceInput=environmentField(deviceBody,'deviceId','设备号','留空沿用本账号已持久保存的设备号；尚无记录时自动生成。留空不会强制生成新号，自定义为 32 位十六进制字符。'+environmentHelp,32);
  const deviceActions=el('div','xc-environment-actions');deviceActions.append(button('随机生成设备号',()=>setEnvironment({deviceId:environment.randomDeviceId()})),button('留空沿用设备号',()=>setEnvironment({deviceId:''})));deviceBody.append(deviceActions);
  for(const [key,label,title]of [['androidVersion','Android 版本','请求中声明的 Android 系统版本，例如 17。'],['model','设备机型','请求中声明的机型名称。'],['buildNumber','系统构建号','请求中声明的 Android 构建号。'],['chromeVersion','Chrome 版本','请求中声明的 WebView Chrome 版本，使用四段数字。']])environmentField(fingerprintBody,key,label,title+environmentHelp);
  const headerDetails=el('details','xc-environment-advanced'),headerSummary=el('summary','','高级请求头'),headerBody=el('div','xc-environment-body');headerDetails.append(headerSummary,headerBody);fingerprintBody.append(headerDetails);
  for(const [key,label,title,max]of [['webviewBase','WebView UA 基础串','留空根据上述系统、机型及 Chrome 版本生成；设备号和 schild 后缀由程序追加。',1024],['dalvikBase','Dalvik UA 基础串','留空根据上述系统和机型生成；设备号和 schild 后缀由程序追加。',1024],['schildWebview','WebView schild','留空保留星蝉原默认值；自定义为 32 位十六进制字符。',32],['schildDalvik','Dalvik schild','留空保留星蝉原默认值；自定义为 32 位十六进制字符。',32]]){const n=environmentField(headerBody,key,label,title+environmentHelp,max);n.placeholder=key.endsWith('Base')?'留空自动构建':'留空保留原默认值';}
  for(const [key,label]of [['webviewFull','完整 WebView User-Agent'],['dalvikFull','完整 Dalvik User-Agent']]){const n=environmentField(headerBody,key,label,'完整值优先于本类型的 UA 基础串、系统机型、schild 和自动后缀；原样作为请求头，不会自动解析或同步上方设备号。留空恢复自动构建；请确保身份与版本参数一致。随机生成或恢复原版会清空完整覆盖。'+environmentHelp,2048);n.placeholder='留空沿用自动构建的 User-Agent';}
  const fingerprintActions=el('div','xc-environment-actions');fingerprintActions.append(button('随机生成客户端配置',()=>setEnvironment(environment.randomFingerprint())),button('恢复原版客户端配置',()=>{const defaults=environment.defaults();delete defaults.deviceId;return setEnvironment(defaults);}));fingerprintBody.append(fingerprintActions);
  let environmentImportBusy=false,environmentImportDialog=null;
  const environmentImportButton=button('导入设备 JSON',importDeviceProfile);environmentImportButton.title='导入设备读取器的实际学习通记录，预览后仅保存到当前账号的星蝉增强环境；OCS 独立浏览器配置不变。';fingerprintActions.prepend(environmentImportButton);
  const environmentState=el('p','xc-environment-state');environmentState.setAttribute('role','status');fingerprintBody.append(environmentState);
  const details=container.querySelector('.fusion-account-details');for(const section of [scriptMode,starMode,node,connection,environmentGroup])if(details)container.insertBefore(section,details);else container.append(section);
  function environmentValue(){return environment.normalize(Object.fromEntries(Object.entries(environmentFields).map(([key,n])=>[key,n.value])));}
  function showEnvironment(){const value=environment.normalize(snapshot.clientEnvironment);for(const [key,n]of Object.entries(environmentFields)){if(!environmentTouched.has(key)&&document.activeElement!==n)n.value=value[key];n.disabled=!snapshot;}deviceInput.placeholder=snapshot.clientEnvironmentDeviceId||'留空使用本账号自动分配的设备号';}
  async function setEnvironment(patch){if(!snapshot)return;for(const [key,value]of Object.entries(patch)){if(environmentFields[key]){environmentFields[key].value=value;environmentTouched.add(key);environmentRevision++;}}await saveForm();}
  async function importDeviceProfile(){
   if(environmentImportBusy||!snapshot||!active())return;environmentImportBusy=true;environmentImportButton.disabled=true;
   try{
    await flush();if(!active())return;const revision=environmentRevision,originalEnvironment=JSON.stringify(snapshot.clientEnvironment);
    const preview=await bridge.importDeviceProfile({uid});if(!active()||preview.canceled)return;
    const content=el('div','xc-device-import-preview');
    content.append(el('p','','以下参数将保存到当前账号的星蝉配置，重启该账号的星蝉增强模式后生效；OCS 的独立浏览器配置不变。'));
    for(const key of preview.fields){const input=environmentFields[key];if(!input)continue;const row=el('label','xc-poc-field'),value=el('textarea','xc-poc-input');row.append(el('span','',input.getAttribute('aria-label')));value.value=preview.patch[key];value.readOnly=true;value.rows=key==='webviewFull'?4:1;value.setAttribute('aria-label','导入预览：'+input.getAttribute('aria-label'));row.append(value);content.append(row);}
    for(const warning of preview.warnings)content.append(el('p','xc-poc-note',warning));
    content.append(el('p','xc-poc-note','修改后可能需要重新登录或完成验证。未列出的现有参数保留，不导入文件中的账号、会话或其他隐私数据。'));
    environmentImportDialog=window.FusionDialogs.open({title:'导入星蝉设备配置',content,buttons:['取消','导入并保存'],defaultId:0,cancelId:0,onAction:async index=>{
     if(index!==1)return;if(!active())throw Error('账号窗口已关闭，未导入配置。');
     if(environmentRevision!==revision)throw Error('客户端参数已被修改，请取消并重新导入。');
     const latest=model.normalizeSettings(uid,await bridge.getSettings({uid}));
     if(!active()||environmentRevision!==revision)throw Error('账号窗口或客户端参数已改变，请取消并重新导入。');
     if(!latest.starEligible||latest.starEnhancementsEnabled===false)throw Error('账号登录方式或星蝉增强开关已改变，请取消并重新打开账号设置。');
     if(JSON.stringify(latest.clientEnvironment)!==originalEnvironment)throw Error('客户端环境已在其他窗口更新，请取消并重新打开账号设置。');
     const clientEnvironment=environment.normalize({...latest.clientEnvironment,...preview.patch});
     const data=await bridge.saveSettings(model.buildSaveRequest(uid,latest,{aiBaseUrl:latest.ai.baseUrl,aiModel:latest.ai.model,aiType:latest.ai.type,clientEnvironment}));
     if(active()){environmentRevision++;await refreshSettings(data);environmentState.textContent='已导入星蝉设备配置，重启此账号的星蝉增强模式后生效。';}
    }});
    await environmentImportDialog.result;
   }finally{environmentImportDialog=null;environmentImportBusy=false;if(active())environmentImportButton.disabled=false;}
  }
  let checkFlight=null;
  function answerValue(){return window.FusionAnswerSettings.normalize(Object.fromEntries(Object.entries(answerFields).map(([key,n])=>[key,n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value])));}
  const sameApi=s=>JSON.stringify([s.ai,s.aiConfigurations,s.questionBankConfig,s.searchMethods,s.answerSettings,s.xingchanBank,s.soutijiangEnabled]);
  function saveForm(){dirty++;const job=write.catch(()=>{}).then(async()=>{
   if(!snapshot||saved===dirty)return;writing=true;const revision=dirty;
   try{
    const ocsEdit=ocsRevision,ocsChanged=ocsTouched,ocsEnhancementsEnabled=ocsSwitch.checked;
    const scriptEdit=scriptRevision,scriptChanged=scriptTouched,browserScript=scriptSwitch.checked?'soutijiang':'ocs';
    const starEdit=starRevision,starChanged=starTouched,starEnhancementsEnabled=starSwitch.checked;
    const mouseEdit=mouseRevision,mouseChanged=mouseTouched,keepPlayingOnLeave=mouseSwitch.checked,enrollmentEdit=enrollmentRevision,enrollmentChanged=enrollmentTouched,enrollmentYear=window.FusionEnrollment.normalize(enrollmentSelect.value);
    const value=answerValue(),environmentEdit=environmentRevision,environmentChanged=environmentTouched.size>0,clientEnvironment=environmentChanged?environmentValue():undefined,draftMethods=methods.map(m=>({...m}));
    status.textContent='正在保存…';await window.FusionWorkspace?.flushCredentials();
    const latest=model.normalizeSettings(uid,await bridge.getSettings({uid}));if(latest.revision!==snapshot.revision&&sameApi(latest)!==sameApi(snapshot))throw Error('配置已在其他窗口更新，请关闭并重新打开账号设置。');
    if(scriptChanged&&latest.browserScript!==snapshot.browserScript)throw Error('脚本选择已在其他窗口更新，请重新打开后核对。');
    if(ocsChanged&&latest.ocsEnhancementsEnabled!==snapshot.ocsEnhancementsEnabled)throw Error('OCS 增强设置已在其他窗口更新，请重新打开后核对。');
    if(starChanged&&latest.starEnhancementsEnabled!==snapshot.starEnhancementsEnabled)throw Error('星蝉模式已在其他窗口更新，请重新打开账号设置后核对。');
    if(enrollmentChanged&&latest.enrollmentYear!==snapshot.enrollmentYear)throw Error('入学年份已在其他窗口更新，请重新打开账号设置后核对。');
    if(environmentChanged&&JSON.stringify(latest.clientEnvironment)!==JSON.stringify(snapshot.clientEnvironment))throw Error('客户端环境已在其他窗口更新，请核对后重新打开账号设置；当前输入尚未覆盖。');
    const data=await bridge.saveSettings(model.buildSaveRequest(uid,latest,{aiBaseUrl:latest.ai.baseUrl,aiModel:latest.ai.model,aiType:latest.ai.type,searchMethods:draftMethods,answerSettings:value,...(starChanged?{starEnhancementsEnabled}:{}),...(ocsChanged?{ocsEnhancementsEnabled}:{}),...(scriptChanged?{browserScript}:{}),...(mouseChanged?{keepPlayingOnLeave}:{}),...(enrollmentChanged?{enrollmentYear}:{}),...(environmentChanged?{clientEnvironment}:{})}));
    saved=revision;
    if(active()){if(scriptChanged&&scriptRevision===scriptEdit)scriptTouched=false;if(ocsChanged&&ocsRevision===ocsEdit)ocsTouched=false;if(starChanged&&starRevision===starEdit)starTouched=false;if(enrollmentChanged&&enrollmentRevision===enrollmentEdit)enrollmentTouched=false;if(mouseChanged&&mouseRevision===mouseEdit)mouseTouched=false;if(environmentChanged&&environmentRevision===environmentEdit)environmentTouched.clear();if(environmentChanged)environmentState.textContent='客户端环境已保存，重启此账号的星蝉后生效。';await refreshSettings(data,{preserveMethods:dirty!==revision});status.textContent=data.answerSettingsApplied===true?'已保存。自动答题设置已同步，下一次章节测试或作业生效。':data.answerSettingsApplied===false?'已保存，但暂未同步到星蝉，请重启后应用。':'已自动保存。开启增强的浏览器会同步；星蝉接口配置重启增强模式后应用。';window.FusionWorkspace?.syncCredentialsFromStar(uid,data);}
   }finally{writing=false;}
  });write=job;jobs.add(job);job.finally(()=>jobs.delete(job)).catch(()=>{});return job;}
  function autosave(){void saveForm().catch(promptError);}
  for(const n of Object.values(answerFields))n.addEventListener(n.type==='checkbox'||n.tagName==='SELECT'?'change':'blur',autosave);
  async function flush(){await write;if(active()&&snapshot&&(JSON.stringify(answerValue())!==JSON.stringify(snapshot.answerSettings)||environmentTouched.size||mouseTouched||enrollmentTouched||starTouched||ocsTouched||scriptTouched))await saveForm();if(saved!==dirty)throw Error('账号配置尚未保存，请先修正输入。');}
  flushers.add(flush);
  function renderAI(){providerSummary.textContent='普通题库 '+snapshot.questionBanks.length+' 个 · AI '+snapshot.aiConfigurations.length+' 个 · 万能题库'+(snapshot.xingchanBank.hasKey?'已配置':'未配置')+(snapshot.soutijiangEnabled?' · 搜题酱接管已开启':'');}
  const A=window.FusionAIConfig;
  function updateMethods(){methods=A.reconcile(window.FusionQuestionBanks.reconcile(snapshot.searchMethods,snapshot.questionBanks),snapshot.aiConfigurations).map(method=>({...method,enabled:method.enabled&&(method.id==='soutijiang'?snapshot.soutijiangEnabled:configured(method.id))}));for(const key of Object.keys(labels))delete labels[key];for(const bank of snapshot.questionBanks)labels[bank.id]=bank.name;renderMethods();}
  const methodName=id=>snapshot?.aiConfigurations.find(ai=>ai.id===id)?.name||labels[id]||({'soutijiang':'大学搜题酱','xingchan-ai':'AI 搜题','xingchan-bank':'万能题库',yanxi:'言溪题库'})[id]||'自定义题库';
  function configured(id){return id==='soutijiang'?snapshot?.soutijiangEnabled===true&&snapshot?.soutijiangConfigured===true:A.isId(id)?A.configured(snapshot?.aiConfigurations.find(ai=>ai.id===id)):id==='xingchan-bank'?snapshot?.xingchanBank.hasKey===true:snapshot?.questionBanks.some(bank=>bank.id===id);}
  async function refreshSettings(data,{preserveMethods=false}={}){
   const revision=++checksVersion;snapshot=model.normalizeSettings(uid,data);renderScriptSelection();if(!ocsTouched)ocsSwitch.checked=snapshot.ocsEnhancementsEnabled;ocsSwitch.disabled=false;if(!starTouched)starSwitch.checked=snapshot.starEnhancementsEnabled;starSwitch.disabled=false;updateEligibility();if(!enrollmentTouched)enrollmentSelect.value=snapshot.enrollmentYear===null?'':String(snapshot.enrollmentYear);enrollmentSelect.disabled=false;if(!mouseTouched)mouseSwitch.checked=snapshot.keepPlayingOnLeave;mouseSwitch.disabled=false;checks.clear();renderAI();showEnvironment();
   if(preserveMethods)renderMethods();else updateMethods();
   try{const cached=await bridge.getConnectionChecks({uid});if(active()&&revision===checksVersion){checks=new Map((cached.items||[]).map(item=>[item.id,item]));renderChecks();}}catch{if(active()&&revision===checksVersion)status.textContent='配置已保存，连接状态暂时无法读取；可点击“检查已启用连接”重试。';}
  }
  async function removeMethod(id){
   await flush();const name=methodName(id),detail=id==='soutijiang'?'将关闭本账号的搜题酱接管，登录状态保留；可在题库配置中重新开启。':A.isId(id)?'将移除此 AI 配置及其 API Key，不影响其他模型。':id==='xingchan-bank'?'将清除本账号的万能题库 Key，并关闭该方式。':'将删除本账号保存的这份题库配置。';
   const confirm=await window.FusionDialogs.show({title:'移除'+name+'配置',message:detail,buttons:['取消','确认移除'],defaultId:0,cancelId:0});if(confirm.response!==1||!active())return;
   let data;if(A.isId(id)||id==='xingchan-bank'||id==='soutijiang'){
    const latest=model.normalizeSettings(uid,await bridge.getSettings({uid}));
    if(sameApi(latest)!==sameApi(snapshot))throw Error('配置已在其他窗口更新，请重新打开后移除。');
    data=await bridge.saveSettings(model.buildSaveRequest(uid,latest,{aiBaseUrl:latest.ai.baseUrl,aiModel:latest.ai.model,aiType:latest.ai.type,...(A.isId(id)?{aiConfigurations:latest.aiConfigurations.filter(ai=>ai.id!==id)}:{}),clearXingchanBankKey:id==='xingchan-bank',...(id==='soutijiang'?{soutijiangEnabled:false}:{}),searchMethods:methods.map(method=>({...method,enabled:method.id===id?false:method.enabled})),answerSettings:answerValue()}));
   }else data=await bridge.removeQuestionBank({uid,id});
   await refreshSettings(data);status.textContent=name+'配置已移除。';
  }

  function renderMethods(){
   methods=[...methods.filter(method=>method.enabled),...methods.filter(method=>!method.enabled)];
   methodList.replaceChildren();methodChecks.clear();const shown=methods.filter(method=>method.id==='soutijiang'?snapshot.soutijiangEnabled:!A.isId(method.id)||configured(method.id));
   shown.forEach((method,index)=>{
    const ready=configured(method.id),row=el('li','xc-poc-method');row.dataset.xcMethod=method.id;row.dataset.enabled=String(ready&&method.enabled);row.dataset.configured=String(ready);row.draggable=true;
    const handle=el('span','xc-poc-drag','⋮⋮'),identity=el('div','xc-poc-method-identity'),name=el('strong','xc-poc-method-name',(index+1)+'. '+methodName(method.id));handle.title='拖动调整搜题顺序';identity.append(name);
    if(A.isId(method.id)){const ai=snapshot.aiConfigurations.find(ai=>ai.id===method.id);if(ai.name!==ai.model)identity.append(el('span','xc-poc-model-name',ai.model));identity.append(el('small','xc-poc-method-detail',ai.type+' · '+(ai.keyPreview||'无需 API Key')));}
    else if(!ready)identity.append(el('small','xc-poc-method-detail',method.id==='soutijiang'?'请在题库配置中扫码登录搜题酱':'请点击上方“题库配置”完成设置'));
    const copy=labels[method.id]?button('复制题库配置',async()=>{await bridge.copyQuestionBank({uid,id:method.id});status.textContent='已复制 '+methodName(method.id)+' 的完整配置。';}):null;
    const label=el('label','xc-poc-toggle'),toggle=el('input');toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','启用'+methodName(method.id));toggle.checked=ready&&method.enabled;toggle.disabled=!ready;toggle.title=ready?'启用或关闭此搜题方式；未启用的方式自动置底':'请先完成此方式的配置';toggle.onchange=()=>{method.enabled=toggle.checked;renderMethods();autosave();};label.append(toggle,el('span','',ready?'启用':'未配置'));
    const movement=el('span','xc-poc-movement'),move=to=>{methods=model.reorderSearchMethods(methods,method.id,shown[to].id);renderMethods();autosave();};
    const up=button('↑',()=>move(index-1)),down=button('↓',()=>move(index+1));up.disabled=index===0||shown[index-1].enabled!==method.enabled;down.disabled=index===shown.length-1||shown[index+1].enabled!==method.enabled;up.setAttribute('aria-label','上移'+methodName(method.id));down.setAttribute('aria-label','下移'+methodName(method.id));
    const verify=button('验证',()=>checkConnections([method.id])),verification=el('span','xc-poc-method-verification');verify.setAttribute('aria-label','验证'+methodName(method.id));verify.title=ready?(method.id==='soutijiang'?'单独检查官方登录状态，不消耗搜题额度。':'只验证此方式，不会启用它；会发送一条测试请求，可能消耗接口额度。'):'请先完成此方式的配置';verification.setAttribute('role','status');identity.append(verification);methodChecks.set(method.id,{verify,verification,ready});movement.append(verify);
    const remove=button('移除',()=>removeMethod(method.id));remove.classList.add('xc-danger-button');remove.disabled=!ready&&method.id!=='soutijiang';remove.setAttribute('aria-label','移除'+methodName(method.id)+'配置');if(copy)movement.append(copy);if(ready||method.id==='soutijiang')movement.append(button('更改配置',()=>openProviders(method.id==='soutijiang'?'soutijiang':A.isId(method.id)?'ai':method.id==='xingchan-bank'?'universal':'banks',method.id)));movement.append(up,down,remove);row.append(handle,identity,label,movement);
    row.ondragstart=e=>{if(e.target.closest('button,input'))return e.preventDefault();drag=method.id;e.dataTransfer?.setData('text/plain',uid+':'+method.id);};row.ondragover=e=>{if(drag)e.preventDefault();};row.ondrop=e=>{e.preventDefault();if(!drag)return;const source=methods.find(item=>item.id===drag);if(source?.enabled!==method.enabled){drag=null;return;}methods=model.reorderSearchMethods(methods,drag,method.id);drag=null;renderMethods();autosave();};row.ondragend=()=>drag=null;methodList.append(row);
   });updateEligibility();renderChecks();
  }
  function renderScriptSelection(){const available=snapshot.browserScriptAvailability;if(!scriptTouched)scriptSwitch.checked=available.selected==='soutijiang';scriptSwitch.disabled=!available.canChoose;scriptOptions.dataset.selected=scriptSwitch.checked?'soutijiang':'ocs';scriptOptions.classList.toggle('is-disabled',scriptSwitch.disabled);scriptOptions.title=available.canChoose?'按账号选择，下次启动浏览器时生效。只切换 OCS 与官方搜题酱，保留其他用户脚本；搜题酱题库配置独立生效。':available.ocs?'仅安装了 OCS，安装大学搜题酱后可切换。':available.soutijiang?'仅安装了大学搜题酱，安装 OCS 脚本和脚本管理器后可切换。':'请先在应用中心安装脚本管理器及 OCS 脚本，或安装大学搜题酱。';}
  function updateEligibility(){const isStar=window.FusionWorkspace?.loginProfile?.(uid)?.starEligible===true;for(const n of starOnly)n.hidden=!isStar;environmentGroup.hidden=!isStar||snapshot?.starEnhancementsEnabled===false;}
  function renderChecks(){for(const [id,{verify,verification,ready}]of methodChecks){const item=checks.get(id),state=item?.state||(ready?'unchecked':'unconfigured');verify.disabled=checking||!ready;verification.textContent=({unchecked:'尚未验证',connected:'连接正常',failed:'连接失败',limited:'额度受限',waiting:'等待处理',unconfigured:'未配置'})[state]||'尚未验证';if(checking&&state==='waiting')verification.textContent='正在验证…';verification.className='xc-poc-method-verification xc-check-state xc-check-'+state;verification.title=(item?.message||'点击验证检查此搜题方式')+(item?.checkedAt?'；上次检查：'+new Date(item.checkedAt).toLocaleString():'');}list.replaceChildren();for(const method of methods.filter(m=>m.enabled)){const item=checks.get(method.id)||{state:'unchecked',message:'尚未验证'},row=el('li','xc-connection-result');row.dataset.checkId=method.id;row.dataset.state=item.state;if(item.checkedAt)row.title='上次检查：'+new Date(item.checkedAt).toLocaleString();row.append(el('strong','',methodName(method.id)),el('span','xc-check-state xc-check-'+item.state,({unchecked:'未验证',connected:'连接正常',failed:'连接失败',limited:'额度受限',waiting:'验证中',unconfigured:'未配置'})[item.state]||item.state),el('p','',item.message));list.append(row);}checkButton.disabled=checking||!snapshot||!methods.some(m=>m.enabled);}
   async function checkConnections(only){if(checkFlight)await checkFlight.catch(()=>{});await flush();checking=true;const ids=only||methods.filter(m=>m.enabled).map(m=>m.id);for(const id of ids)checks.set(id,{state:'waiting',message:'正在验证连接…'});renderChecks();const checkedRevision=checksVersion,job=(async()=>{try{const data=await bridge.checkConnections({uid,only:ids});if(!active()||checkedRevision!==checksVersion)return;for(const item of data.items||[])checks.set(item.id,item);}finally{checking=false;if(active())renderChecks();}})();checkFlight=job;try{return await job;}finally{if(checkFlight===job)checkFlight=null;}}
  async function openProviders(initialTab='banks',editId){
   await flush();if(providerOpen||!snapshot||!active())return;providerOpen=true;const old=snapshot;
   try{await window.FusionProviderConfig.open({uid,snapshot:old,bridge,initialTab,editId,signal:providerAbort.signal,save:async draft=>{
    if(!active())throw Error('账号窗口已关闭，未保存配置。');
    const latest=model.normalizeSettings(uid,await bridge.getSettings({uid}));if(sameApi(latest)!==sameApi(old))throw Error('配置已在其他窗口更新，请取消并重新打开后修改。');
    const data=await bridge.saveSettings(model.buildSaveRequest(uid,latest,{aiBaseUrl:latest.ai.baseUrl,aiModel:latest.ai.model,aiType:latest.ai.type,...draft,answerSettings:answerValue()}));
    await refreshSettings(data);status.textContent='题库配置已保存，搜题顺序和连接检查已刷新；星蝉重启增强模式后应用。';
    const changed=snapshot.questionBanks.filter(bank=>!old.questionBanks.some(before=>before.id===bank.id)||old.questionBankConfig!==snapshot.questionBankConfig).map(bank=>bank.id);
    if(changed.length)void checkConnections(changed).catch(promptError);
   }});}finally{providerOpen=false;if(active()){const current=await bridge.getSettings({uid});await refreshSettings(current);await soutiLoginSelector.refresh();}}
  }
  function placeConnection(){
   updateEligibility();const details=container.querySelector('.fusion-account-details');if(details){let previous=node;for(const section of [connection,environmentGroup,details]){if(previous.nextElementSibling!==section)previous.after(section);previous=section;}}
   const toc=document.querySelector('#browser-panel .bp-toc');if(toc){const sections=[...container.querySelectorAll('[id^="bp-"][data-label]')].filter(section=>!section.hidden),signature=sections.map(n=>n.id+':'+n.dataset.label).join('|');if(toc.dataset.fusionSections!==signature){toc.dataset.fusionSections=signature;toc.replaceChildren(...sections.map(section=>{const link=el('div','',section.dataset.label);link.tabIndex=0;link.setAttribute('role','button');link.onclick=()=>{if(section.tagName==='DETAILS')section.open=true;section.scrollIntoView({block:'start',inline:'nearest'});};link.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();link.click();}};return link;}));}}
  }
  let runtimeBusy=false;async function refreshRuntime(){if(!active()||document.hidden||window.__fusionWindowVisible===false||runtimeBusy)return;runtimeBusy=true;try{const raw=await bridge.listStatus({uids:[uid]}),s=raw.items?.find(x=>x.uid===uid);if(active()&&s)runtime.textContent=(s.summary||'星蝉未启动。')+(s.displayName?' 登录姓名：'+s.displayName:'');}catch{}finally{runtimeBusy=false;}}
  async function load(){try{await window.FusionWorkspace?.flushCredentials();const data=await bridge.getSettings({uid});if(!active())return;await refreshSettings(data);for(const [key,n]of Object.entries(answerFields)){const v=window.FusionAnswerSettings.normalize(snapshot.answerSettings)[key];if(n.type==='checkbox')n.checked=v;else n.value=String(v);}status.textContent='配置已载入；修改后自动保存。';}catch(error){promptError(error);}}
  void load();void refreshRuntime();const timer=setInterval(refreshRuntime,2500);
  return {uid,node,connection,placeConnection,dispose(){alive=false;flushers.delete(flush);clearInterval(timer);providerAbort.abort();environmentImportDialog?.close();soutiLoginSelector.dispose();scriptMode.remove();starMode.remove();node.remove();connection.remove();environmentGroup.remove();mouseLabel.remove();enrollmentBox.remove();}};
 }
 window.FusionAccountForm={mount,async flush(){await Promise.all([...flushers].map(flush=>flush()));await Promise.all([...jobs]);}};
})();
