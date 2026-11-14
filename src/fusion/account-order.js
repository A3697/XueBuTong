(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionAccountOrder=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const accounts=items=>items.filter(item=>item.type==='browser');
 function ordered(items,order){
  const positions=new Map((Array.isArray(order)?order:[]).map((uid,index)=>[uid,index]));
  const rows=accounts(items).map((item,index)=>({item,index})).sort((a,b)=>(positions.get(a.item.uid)??1e9)-(positions.get(b.item.uid)??1e9)||a.index-b.index).map(row=>row.item);
  return [...items.filter(item=>item.type!=='browser'),...rows];
 }
 // Freeze the effective order, including newly added accounts absent from saved order arrays.
 function snapshot(browser){
  const entries=[];
  function visit(group){
   const children=Object.values(group.children||{});
   entries.push([group.uid,accounts(ordered(children,browser.accountOrders?.[group.uid])).map(item=>item.uid)]);
   for(const child of children)if(child.type==='folder')visit(child);
  }
  visit(browser.root);return Object.fromEntries(entries);
 }
 function move(items,uid,targetUid){const ids=accounts(items).map(item=>item.uid),from=ids.indexOf(uid),to=ids.indexOf(targetUid);if(from<0||to<0||from===to)return ids;ids.splice(to,0,ids.splice(from,1)[0]);return ids;}
 function sorted(items,mode){
  if(!['name-asc','name-desc','time-asc','time-desc'].includes(mode))throw Error('排序方式无效');
  const direction=mode.endsWith('desc')?-1:1;
  return accounts(items).map((item,index)=>({item,index})).sort((a,b)=>{
   const value=mode.startsWith('name')?String(a.item.name||'').localeCompare(String(b.item.name||''),'zh-CN',{numeric:true,sensitivity:'base'}):(Number(a.item.createTime)||0)-(Number(b.item.createTime)||0);
   return value*direction||a.index-b.index;
  }).map(row=>row.item.uid);
 }
 function createUi({store,native,notify}){
  let dragging=null;
  const searching=()=>!!store.render.browser.search.value||!!store.render.browser.search.tags.length;
  const folder=()=>native.c.value;
  const rows=()=>ordered(folder().listChildren(),store.render.browser.accountOrders?.[folder().uid]);
  const clearHighlights=()=>document.querySelectorAll('.fusion-account-dragging,.fusion-account-drop-target').forEach(row=>row.classList.remove('fusion-account-dragging','fusion-account-drop-target'));
  const row=uid=>[...document.querySelectorAll('[data-fusion-account-uid]')].find(element=>element.dataset.fusionAccountUid===uid);
  function allowed(){if(searching()){notify('请先清空搜索，再调整当前分组的账号顺序。');return false;}return true;}
  function save(ids){
   const group=folder();store.render.browser.accountOrders??={};store.render.browser.accountOrders[group.uid]=ids;
   window.__fusionSaveStore?.().catch(()=>notify('账号顺序保存失败，请重试。'));
  }
  function reorder(uid,targetUid){if(!allowed())return;save(move(rows(),uid,targetUid));}
  function sort(mode){if(!allowed())return;save(sorted(rows(),mode));notify('已调整当前分组的账号顺序；可继续拖动微调。');}
  function start(event,uid){
   if(!allowed()){event.preventDefault();return;}
   event.stopPropagation();dragging={uid,parent:folder().uid};event.dataTransfer?.setData('text/plain',uid);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';row(uid)?.classList.add('fusion-account-dragging');
  }
  function end(){dragging=null;clearHighlights();}
  function rowProps(uid){return {'data-fusion-account-uid':uid,
   onDragover:event=>{if(dragging&&dragging.uid!==uid&&dragging.parent===folder().uid){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';row(uid)?.classList.add('fusion-account-drop-target');}},
   onDragleave:event=>{if(!row(uid)?.contains(event.relatedTarget))row(uid)?.classList.remove('fusion-account-drop-target');},
   onDrop:event=>{if(!dragging||dragging.parent!==folder().uid)return;event.preventDefault();event.stopPropagation();reorder(dragging.uid,uid);end();}
  };}
  function key(event,uid){
   if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(!allowed())return;
   const list=accounts(rows()),index=list.findIndex(item=>item.uid===uid),target=list[index+(event.key==='ArrowUp'?-1:1)];if(target){reorder(uid,target.uid);requestAnimationFrame(()=>row(uid)?.querySelector('.fusion-account-sort-handle')?.focus());}
  }
  store.render.browser.accountOrders={...(store.render.browser.accountOrders||{})};
  return {sort,start,end,key,rowProps,dispose:end};
 }
 return {ordered,snapshot,move,sorted,createUi,ui:null};
});
