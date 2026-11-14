(()=>{
 'use strict';if(window.FusionDialogs)return;
 let sequence=0;
 function open({title='学不通',message='',detail='',buttons=['确定'],defaultId=0,cancelId=buttons.length-1,checkboxLabel,checkboxChecked=false,content,footerContent,onAction}={}){
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const previous=document.activeElement,overlay=el('div','fusion-dialog-overlay'),panel=el('section','fusion-dialog'),heading=el('h2','',title),body=el('div','fusion-dialog-body'),footer=el('footer','fusion-dialog-footer');
  heading.id='fusion-dialog-'+(++sequence);panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby',heading.id);
  if(message)body.append(el('p','fusion-dialog-message',message));if(detail)body.append(el('p','fusion-dialog-detail',detail));if(content)body.append(content);
  let checkbox;if(checkboxLabel){const label=el('label','fusion-dialog-checkbox');checkbox=el('input');checkbox.type='checkbox';checkbox.checked=checkboxChecked;label.append(checkbox,document.createTextNode(checkboxLabel));body.append(label);}
  let resolve,closed=false,busy=false;const result=new Promise(r=>resolve=r);
  const close=(response=cancelId)=>{if(closed)return;closed=true;overlay.remove();if(previous?.isConnected)previous.focus();resolve({response,checkboxChecked:checkbox?.checked===true});};
  if(footerContent)footer.append(footerContent);
  const controls=buttons.map((label,index)=>{const button=el('button','fusion-dialog-button',label);button.type='button';button.onclick=async()=>{if(busy)return;busy=true;if(footerContent)footerContent.inert=true;controls.forEach(b=>b.disabled=true);try{if(onAction&&await onAction(index,{body,panel,close})===false)return;close(index);}catch(error){let note=body.querySelector('.fusion-dialog-error');if(!note){note=el('p','fusion-dialog-error');note.setAttribute('role','alert');body.append(note);}note.textContent=error?.message||'操作未完成，请重试。';}finally{busy=false;if(footerContent)footerContent.inert=false;controls.forEach(b=>b.disabled=false);}};footer.append(button);return button;});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy){event.preventDefault();event.stopPropagation();close();}else if(event.key==='Tab'){const list=[...panel.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length);if(!list.length)return;const first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  panel.append(heading,body,footer);overlay.append(panel);document.body.append(overlay);(controls[defaultId]||controls[0]||panel).focus();return {result,close,body,panel,overlay};
 }
 window.FusionDialogs={open,show:options=>open(options).result,alert:message=>open({title:'提示',message}).result};
})();
