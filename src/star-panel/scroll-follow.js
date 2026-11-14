(function(root){
 'use strict';
 function attach({scroll,rows,limit,target,onChange}){
  let enabled=true,until=0,pointer=false,timer=0,frame=0,disposed=false;
  const list=()=>Array.from(rows()).filter(row=>row.getClientRects().length);
  const wanted=()=>target?.()||list().at(-1);
  function align(){
   if(!enabled||disposed||Date.now()<until||pointer||!scroll.clientHeight)return;
   const row=wanted();if(!row)return;
   if(!target){scroll.scrollTop=scroll.scrollHeight;return;}
   const box=scroll.getBoundingClientRect(),rect=row.getBoundingClientRect();
   if(rect.top<box.top+4||rect.bottom>box.bottom-4)scroll.scrollTop+=rect.top-box.top-Math.max(0,(scroll.clientHeight-rect.height)/2);
  }
  function update(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;align();});}
  function set(value){enabled=!!value;until=0;onChange?.(enabled);if(enabled)update();}
  function measure(){
   if(!enabled||disposed||(!pointer&&Date.now()>until))return;
   const items=list(),row=wanted(),idx=items.indexOf(row);if(idx<0)return;
   const box=scroll.getBoundingClientRect();
   const visible=items.map((item,i)=>({i,rect:item.getBoundingClientRect()})).filter(item=>item.rect.bottom>box.top&&item.rect.top<box.bottom);
   if(!visible.length)return;
   const first=visible[0].i,last=visible.at(-1).i;
   const distance=idx>last?idx-last:idx<first?first-idx:0;
   if(distance>limit)set(false);
  }
  function gesture(){until=Date.now()+1400;clearTimeout(timer);timer=setTimeout(update,1450);requestAnimationFrame(measure);}
  function wheel(e){if(!e.ctrlKey)gesture();}
  function key(e){if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))gesture();}
  function down(){pointer=true;gesture();}
  function up(){if(pointer){pointer=false;gesture();}}
  scroll.addEventListener('wheel',wheel,{passive:true});scroll.addEventListener('keydown',key);
  scroll.addEventListener('pointerdown',down);scroll.addEventListener('scroll',measure,{passive:true});window.addEventListener('pointerup',up);
  onChange?.(true);
  return {set,update,get enabled(){return enabled;},get reviewing(){return pointer||Date.now()<until;},dispose(){disposed=true;clearTimeout(timer);cancelAnimationFrame(frame);scroll.removeEventListener('wheel',wheel);scroll.removeEventListener('keydown',key);scroll.removeEventListener('pointerdown',down);scroll.removeEventListener('scroll',measure);window.removeEventListener('pointerup',up);}};
 }
 root.FusionScrollFollow={attach};
})(globalThis);
