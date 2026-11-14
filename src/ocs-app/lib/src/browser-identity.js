'use strict';
// Read the existing authenticated account header. Do not log in, use an account
// remark, or infer a person's name from course content or a stored profile.
function observe(browser,{login,signature,onName}){
 let stopped=false,busy=false,again=false,currentName='';
 const listeners=new Map();
 const supported=['chaoxing','zhihuishu','zjy','icve'];
 const selected=supported.includes(login?.platform)?login.platform:'';
 const platformURL=url=>{try{
  const parsed=new URL(url);if(parsed.protocol!=='https:')return null;const host=parsed.hostname;
  const actual=/(^|\.)chaoxing\.com$/.test(host)?'chaoxing':/(^|\.)zhihuishu\.com$/.test(host)?'zhihuishu':/(^|\.)icve\.com\.cn$/.test(host)?'icve':'';
  return actual&&(!selected||actual===selected||actual==='icve'&&selected==='zjy')?parsed:null;
 }catch{return null;}};
 const loginURL=url=>{const parsed=platformURL(url);return !!parsed&&(parsed.hostname.startsWith('passport')||/(^|\/)login(?:[/.]|$)/i.test(parsed.pathname));};
 const publish=name=>{if(stopped||name===currentName)return;currentName=name;onName({name,signature});};
 async function check(){
  if(stopped)return;if(busy){again=true;return;}busy=true;
  try{
   const names=new Set();let loginVisible=false;
   for(const page of browser.pages()){
    if(loginURL(page.url())){loginVisible=true;continue;}
    if(!platformURL(page.url()))continue;
    const result=await page.evaluate(()=>{
     if(Array.from(document.querySelectorAll('input[type="password"]')).some(node=>node.getClientRects().length))return {login:true};
     // Generic .userName/.user-name also match teachers and classmates on
     // course pages. Only the authenticated account header is an identity.
     const selectors=['#userName','.personalName','.zl_profile_info strong','.user-info .realName','.user-info .user-name','.userInfo .userName'];
     // Confirmed personal-space account header. This class is also used for
     // teachers on course pages, so require both its account container and URL.
     if(location.protocol==='https:'&&location.hostname==='i.chaoxing.com'&&/^\/base\/?$/.test(location.pathname))selectors.unshift('.con-left > .user-block > p.user-name');
     if(location.protocol==='https:'&&location.hostname==='wisdom-mooc.zhihuishu.com'&&/^\/study\/index\/?$/.test(location.pathname))selectors.unshift('.el-dropdown > .name-box > span.realName');
     if(location.protocol==='https:'&&location.hostname==='onlineweb.zhihuishu.com'&&/^\/onlinestuh5(?:\/|$)/.test(location.pathname))selectors.unshift('.header-content_rightBox .user-logo_name');
     for(const selector of selectors){
      for(const node of document.querySelectorAll(selector)){
       const name=(node.textContent||'').replace(/[\u0000-\u001f\u007f]/g,'').trim();
       if(node.getClientRects().length&&name&&name.length<=60&&!/^\d+$/.test(name)&&!/登录|个人中心|退出|未认证|备注/.test(name))return {name};
      }
     }
     return {};
    }).catch(()=>({}));
    if(result.name)names.add(result.name);if(result.login)loginVisible=true;
   }
   if(stopped)return;
   if(loginVisible||names.size>1)publish('');
   else if(names.size===1)publish([...names][0]);
   // A lesson page need not repeat the account header. Keep the name observed
   // in this live context until an explicit login/identity transition occurs.
  }finally{busy=false;if(again&&!stopped){again=false;void check();}}
 }
 const attach=page=>{
  if(stopped||listeners.has(page))return;
  const loaded=()=>{void check();};
  const navigated=frame=>{if(frame!==page.mainFrame())return;if(loginURL(frame.url()))publish('');void check();};
  const closed=()=>{page.off('domcontentloaded',loaded);page.off('framenavigated',navigated);listeners.delete(page);void check();};
  page.on('domcontentloaded',loaded);page.on('framenavigated',navigated);page.once('close',closed);listeners.set(page,{loaded,navigated,closed});
 };
 const stop=()=>{
  if(stopped)return;stopped=true;clearInterval(timer);browser.off('page',attach);browser.off('close',stop);
  for(const [page,{loaded,navigated,closed}] of listeners){page.off('domcontentloaded',loaded);page.off('framenavigated',navigated);page.off('close',closed);}listeners.clear();
 };
 const timer=setInterval(()=>void check(),12000);timer.unref?.();
 for(const page of browser.pages())attach(page);browser.on('page',attach);browser.once('close',stop);void check();
 return stop;
}
module.exports={observe};
