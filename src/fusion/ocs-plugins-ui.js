(()=>{
 'use strict';
 let current=null,pending=null;
 const apply=value=>{current=value;const render=window.store?.render;if(render){if(value.scripts)render.scripts=value.scripts;render.setting??={};render.setting.fusionOcsPlugins=value.preferences;}window.dispatchEvent(new CustomEvent('fusion-ocs-plugins',{detail:value}));return value;};
 async function action(method,input){if(pending)await pending;await window.__fusionSaveStore?.();pending=window.xingchanBridge[method](input).then(apply);try{return await pending;}finally{pending=null;}}
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 function mount(host){
  if(!host||host.__fusionOcsPlugins)return;host.__fusionOcsPlugins=true;
  const section=node('section',null,'fusion-ocs-plugins');section.style.cssText='border:1px solid var(--color-border-2,#555);border-radius:12px;padding:18px;margin:0 0 18px;color:var(--color-text-1);background:var(--color-bg-2)';host.append(section);
  let busy=false;
  const run=async(method,input)=>{if(busy)return;busy=true;render();try{await action(method,input);}catch(error){window.FusionWorkspace?.notify(String(error?.message||'插件操作未完成'),{role:'alert'});}finally{busy=false;if(host.isConnected)render();}};
  function toggle(label,checked,fn,disabled=false){const row=node('label');row.style.cssText='display:flex;align-items:center;gap:12px;cursor:pointer';const input=node('input');input.type='checkbox';input.setAttribute('role','switch');input.setAttribute('aria-label',label);input.className='fusion-answer-switch';input.checked=checked;input.disabled=busy||disabled;input.onchange=()=>fn(input.checked);row.append(node('span',label),input);return row;}
  function button(text,fn,disabled=false){const e=node('button',text,'fusion-button');e.type='button';e.disabled=busy||disabled;e.onclick=fn;return e;}
  function render(){
   section.replaceChildren();const title=node('h3','OCS 与学不通增强插件');title.style.margin='0 0 14px';section.append(title);
   if(!current){section.append(node('p','正在读取插件状态…'));return;}
   const p=current.preferences,enabled=current.installed;
   const install=toggle('OCS 自动安装',current.autoInstall,v=>run('changeOcsPlugins',{autoInstall:v}),!enabled);install.title='关闭后停止自动安装或更新；已安装的 OCS 可在浏览器脚本管理器中停用。';install.style.marginBottom='14px';section.append(install);
   const enhancement=node('p','OCS 增强已移至账号设置，可分别启用或关闭。启用的账号使用兼容版本并同步学不通的题库、AI 与答题配置；关闭的账号使用下方选择的官方版本。');enhancement.style.cssText='font-size:13px;line-height:1.7;color:var(--color-text-2);margin:0 0 14px';section.append(enhancement);
   const table=node('div');table.style.cssText='display:grid;gap:8px';
   const versions=current.latest.sha256===current.compatible.sha256?[{key:'compatible',info:current.compatible,label:'官方最新 · 已兼容增强插件'}]:[{key:'latest',info:current.latest,label:'官方最新 · 可单独运行'},{key:'compatible',info:current.compatible,label:'可兼容增强插件的版本'}];
   for(const version of versions){const row=node('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--color-border-2,#555);border-radius:8px';const selected=(p.selected===version.key||versions.length===1);row.append(node('span','OCS 网课助手 '+version.info.version+'　'+version.label),button(selected?'已选用':'选用',()=>run('changeOcsPlugins',{selected:version.key}),selected||!enabled));table.append(row);}section.append(table);
   const notes=node('p',enabled?'上方版本选择仅作用于关闭 OCS 增强的账号，不改变其他账号的增强开关。同一账号只安装一个 OCS 版本；切换在下次启动浏览器时生效。关闭增强后恢复该浏览器原有的独立配置。':'OCS 自动安装条目已移除；请通过首次使用引导重新添加。');notes.style.cssText='font-size:13px;line-height:1.7;color:var(--color-text-2);margin:12px 0';section.append(notes);
   const controls=node('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:14px';controls.append(toggle('自动检查官方更新',p.autoUpdate&&!current.locked,v=>run('changeOcsPlugins',{autoUpdate:v}),current.locked||!enabled),button(busy?'处理中…':'检查更新',()=>run('checkOcsUpdate',{}),!enabled));
   if(current.locked)controls.append(button('重新允许自动更新',async()=>{const result=await window.FusionDialogs.show({title:'恢复自动更新？',message:'此前发生过兼容性冲突。恢复后会重新检查；若仍不兼容，将再次保留兼容版本并停止自动更新。',buttons:['取消','恢复'],defaultId:0,cancelId:0});if(result.response===1)run('changeOcsPlugins',{resumeUpdates:true});}));section.append(controls);
   if(current.locked){const warning=node('p','自动更新已暂停：'+(current.lockReason||'检测到兼容性冲突'));warning.style.color='var(--color-warning-6,#db951a)';section.append(warning);}
   const history=node('details');history.style.marginTop='14px';history.append(node('summary','更新记录'));const list=node('ul');for(const item of (current.history||[]).slice(0,20)){const row=node('li',new Date(item.time).toLocaleString()+' · '+item.message);row.style.cssText='margin:8px 0;line-height:1.5';list.append(row);}if(!list.children.length)list.append(node('li','尚未检查网络更新；可直接使用已附带的官方版本。'));history.append(list);section.append(history);
  }
  const changed=()=>{if(host.isConnected)render();else window.removeEventListener('fusion-ocs-plugins',changed);};window.addEventListener('fusion-ocs-plugins',changed);render();void action('getOcsPlugins').catch(()=>{});
 }
 window.FusionOcsPlugins={mount,action,apply,prepare:async uid=>{await window.__fusionSaveStore?.();const state=apply(await window.xingchanBridge.getOcsPlugins());return uid?window.xingchanBridge.getAccountOcsRuntime({uid}):state;},initialize:async()=>{document.querySelectorAll('.fusion-ocs-plugins-host').forEach(mount);await action('getOcsPlugins');void action('checkOcsUpdate',{automatic:true}).catch(()=>{});},get current(){return current;}};
})();
