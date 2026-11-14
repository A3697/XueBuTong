(()=>{
 'use strict';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 async function choose({conflicts,newAccounts}){
  const decisions={};let all;
  for(let index=0;index<conflicts.length;index++){
   const item=conflicts[index];if(all){decisions[item.id]=all;continue;}
   const content=node('div'),comparison=node('div'),summary=node('p','相同项 '+item.rows.filter(r=>r.equal).length+'，不同项 '+item.rows.filter(r=>!r.equal).length+'。');comparison.hidden=true;content.append(summary,comparison);
   let shown=false;
   const dialog=window.FusionDialogs.open({title:'导入配置冲突（'+(index+1)+'/'+conflicts.length+'）',message:item.label,detail:'本机已存在此配置。覆盖会使用导入值，跳过则保留本机值；未导入的账号继续保留。',content,buttons:['覆盖','跳过','对比','取消导入'],defaultId:1,cancelId:3,checkboxLabel:'对后续冲突使用同一选择',onAction:button=>{
    if(button!==2)return;comparison.hidden=!comparison.hidden;if(shown)return false;shown=true;
    const table=node('table');table.className='fusion-config-diff';const head=node('tr');for(const label of ['字段','本机配置','导入配置'])head.append(node('th',label));table.append(head);comparison.append(table);let offset=0;
    const more=node('button','显示更多字段');more.className='fusion-dialog-button';more.type='button';const append=()=>{for(const row of item.rows.slice(offset,offset+100)){const tr=node('tr');tr.dataset.equal=String(row.equal);tr.append(node('td',row.path),node('td',row.before),node('td',row.after));table.append(tr);}offset+=100;more.hidden=offset>=item.rows.length;};more.onclick=append;comparison.append(more);append();return false;
   }});
   const result=await dialog.result;if(result.response===3)return {canceled:true};const choice=result.response===0?'overwrite':'skip';decisions[item.id]=choice;if(result.checkboxChecked)all=choice;
  }
  const result=await window.FusionDialogs.show({title:'导入配置',message:'将新增 '+newAccounts+' 个账号，并应用已选择的配置。',detail:'未导入的账号保留。当前配置将自动备份；应用后界面会重新加载。',buttons:['导入并应用','取消'],defaultId:0,cancelId:1});return result.response===0?{decisions}:{canceled:true};
 }
 window.FusionImportConflicts={choose};
})();
