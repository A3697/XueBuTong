(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.FusionCourseFilter=api;})(globalThis,()=>{
 'use strict';
 const key=c=>String(c.course_id)+':'+String(c.clazz_id);
 const term=value=>/^\d{4}-[12]$/.test(value||'')?value:'';
 function normalize(value={}){if(!value||typeof value!=='object')value={};return{start:term(value.start),end:term(value.end),blackStart:term(value.blackStart),blackEnd:term(value.blackEnd),showEnded:value.showEnded!==false,blacklist:Array.isArray(value.blacklist)?[...new Set(value.blacklist.filter(v=>typeof v==='string'&&v.length<=256&&v.includes(':')))].slice(0,10000):[]};}
 function semester(value){const match=/^(\d{4})-(\d{2})-\d{2}$/.exec(value||'');return match?match[1]+'-'+(Number(match[2])<=6?1:2):'';}
 const termLabel=value=>value.slice(0,4)+(value.endsWith('1')?'上半年':'下半年');
 const dateLabel=c=>'开课：'+(c.start_date||'平台未提供')+' · 结课：'+(c.end_date||'平台未提供');
 function matches(c,filter,black=false,today=new Date()){
  const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  if(!filter.showEnded&&c.end_date&&c.end_date<date)return false;
  const value=semester(c.start_date),start=filter[black?'blackStart':'start'],end=filter[black?'blackEnd':'end'];
  // Undated courses stay visible and are explicitly labelled in the dialog.
  return !value||(!start||value>=start)&&(!end||value<=end);
 }
 const visible=(courses,filter,query='')=>courses.filter(c=>!filter.blacklist.includes(key(c))&&matches(c,filter)&&(!query||String(c.name||'').toLowerCase().includes(query.toLowerCase())));
 function periods(courses){const values=courses.map(c=>semester(c.start_date)).filter(Boolean).sort();if(!values.length)return[];const end=values.at(-1),out=[];let y=Number(values[0].slice(0,4)),half=Number(values[0].slice(-1));while(out.length<300){const value=y+'-'+half;out.push(value);if(value>=end)break;if(half===1)half=2;else{y++;half=1;}}return out;}
 function open({courses,filter,onChange,onBlacklist}){
  let value=normalize(filter),black=false,busy=false;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
  const dialog=el('dialog','course-filter-dialog'),header=el('header','course-filter-heading'),title=el('h2','','筛选课程'),endedLabel=el('label','course-filter-switch'),ended=el('input');ended.type='checkbox';ended.checked=value.showEnded;ended.setAttribute('role','switch');ended.setAttribute('aria-label','展示已结课课程');endedLabel.append(ended,document.createTextNode('展示已结课课程'));
  const close=el('button','sm','关闭');close.onclick=()=>dialog.close();header.append(title,endedLabel,close);
  const tabs=el('div','course-filter-tabs');tabs.setAttribute('role','tablist');const courseTab=el('button','','展示范围'),blackTab=el('button','','黑名单');for(const b of[courseTab,blackTab])b.setAttribute('role','tab');tabs.append(courseTab,blackTab);
  const range=el('div','course-filter-range'),start=el('select'),end=el('select');start.setAttribute('aria-label','起始学期');end.setAttribute('aria-label','截至学期');const startLabel=el('label','','起始学期'),endLabel=el('label','','截至学期');startLabel.append(start);endLabel.append(end);range.append(startLabel,endLabel);
  for(const select of [start,end]){const all=el('option','','不限');all.value='';select.append(all);for(const period of [...new Set([...periods(courses),value.start,value.end,value.blackStart,value.blackEnd].filter(Boolean))].sort()){const option=el('option','',termLabel(period));option.value=period;select.append(option);}}
  const note=el('p','note','按开课学期筛选；平台未提供日期的课程仍展示并参与批量添加。拉黑会移除尚未开始的队列项，正在执行或已经执行过的项目保留。'),status=el('p','note'),list=el('div','course-filter-list');status.setAttribute('role','status');dialog.append(header,tabs,range,note,status,list);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  async function save(next){busy=true;lock();try{await onChange(next);value=next;status.textContent='已保存';return true;}catch(error){status.textContent='保存失败：'+String(error?.message||'请重试');return false;}finally{busy=false;draw();}}
  function lock(){for(const n of dialog.querySelectorAll('button,select,input'))n.disabled=busy;}
  function draw(){
   courseTab.setAttribute('aria-selected',String(!black));blackTab.setAttribute('aria-selected',String(black));tabs.dataset.black=String(black);start.value=value[black?'blackStart':'start'];end.value=value[black?'blackEnd':'end'];ended.checked=value.showEnded;list.replaceChildren();
   const matching=courses.filter(c=>matches(c,value,black));
   for(const c of matching){const blocked=value.blacklist.includes(key(c)),row=el('article','course-filter-row'+(blocked?' blocked':'')),info=el('div','course-filter-info');info.append(el('strong','',c.name||'未命名课程'),el('small','',dateLabel(c)));row.append(info);
    if(black){const toggle=el('button',blocked?'sm':'sm course-block-button',blocked?'解除':'拉黑');toggle.onclick=async()=>{if(busy)return;const next={...value,blacklist:blocked?value.blacklist.filter(v=>v!==key(c)):[...value.blacklist,key(c)]};if(!await save(next))return;if(!blocked){busy=true;lock();try{const result=await onBlacklist(c);status.textContent='已拉黑；移除尚未开始的队列项 '+(result?.removed||0)+' 项。';}catch(error){status.textContent='已拉黑，但队列清理未完成：'+String(error?.message||'请重试');}finally{busy=false;lock();}}};row.append(toggle);}else if(blocked)row.append(el('span','pill muted','已拉黑，不展示'));
    list.append(row);
   }if(!matching.length)list.append(el('p','empty','该时间范围内没有课程'));lock();
  }
  courseTab.onclick=()=>{black=false;draw();};blackTab.onclick=()=>{black=true;draw();};ended.onchange=()=>save({...value,showEnded:ended.checked});
  const rangeChange=()=>{const a=start.value,b=end.value;if(a&&b&&a>b){status.textContent='起始学期不能晚于截至学期';draw();return;}void save({...value,[black?'blackStart':'start']:a,[black?'blackEnd':'end']:b});};start.onchange=end.onchange=rangeChange;draw();return dialog;
 }
 return{key,normalize,semester,matches,visible,periods,dateLabel,open};
});
