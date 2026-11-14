(() => {
 'use strict';
 if(window.FusionSidebar)return;
 const labels=['账号列表','脚本列表','应用中心','监控列表','软件设置'];
 let sider=null,toggle=null,mountObserver=null,itemsObserver=null;
 function sync(){
  const settings=window.store?.render?.setting;
  if(!settings)return;
  const found=document.querySelector('#app .sider');
  const items=found?.querySelector('.sider-items');
  if(!items)return;
  if(sider!==found){
   itemsObserver?.disconnect();sider=found;sider.classList.add('fusion-sidebar-nav');
   if(!items.id)items.id='fusion-main-navigation';
   items.setAttribute('aria-label','主导航');
   toggle=document.createElement('button');toggle.type='button';toggle.className='fusion-sidebar-toggle';
   toggle.setAttribute('aria-controls',items.id);
   const icon=document.createElement('span');icon.className='material-icons-outlined';icon.setAttribute('aria-hidden','true');
   const text=document.createElement('span');text.className='fusion-sidebar-toggle-text';
   toggle.append(icon,text);toggle.addEventListener('click',()=>{
    settings.showSideBarText=settings.showSideBarText===false;
    sync();Promise.resolve(window.__fusionSaveStore?.()).catch(error=>window.FusionWorkspace?.notifyError(error));
   });
   sider.insertBefore(toggle,items);mountObserver?.disconnect();
   itemsObserver=new MutationObserver(sync);
   itemsObserver.observe(items,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  for(const [index,item]of [...items.querySelectorAll('.sider-item')].entries()){
   const label=item.querySelector('.sider-item-title')?.textContent.trim()||item.getAttribute('aria-label')||labels[index];
   if(label){item.setAttribute('aria-label',label);item.title=label;}
   item.setAttribute('role','button');item.tabIndex=0;
   if(item.classList.contains('active'))item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
  }
  const collapsed=settings.showSideBarText===false;
  sider.classList.toggle('fusion-sidebar-collapsed',collapsed);
  const action=collapsed?'展开导航':'收起导航';
  toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',action);toggle.title=action;
  const icon=toggle.firstElementChild,text=toggle.lastElementChild;
  const glyph=collapsed?'chevron_right':'chevron_left';
  if(icon.textContent!==glyph)icon.textContent=glyph;
  if(text.textContent!==action)text.textContent=action;
 }
 function resize(){requestAnimationFrame(sync);}
 function keydown(event){
  if((event.key!=='Enter'&&event.key!==' ')||event.altKey||event.ctrlKey||event.metaKey)return;
  const item=event.target.closest?.('.sider-item');
  if(item&&sider?.contains(item)){event.preventDefault();item.click();}
 }
 function start(){
  mountObserver=new MutationObserver(sync);mountObserver.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});sync();
 }
 window.addEventListener('resize',resize);
 window.addEventListener('hashchange',resize);
 document.addEventListener('keydown',keydown);
 window.addEventListener('unload',()=>{mountObserver?.disconnect();itemsObserver?.disconnect();},{once:true});
 window.FusionSidebar={sync};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
