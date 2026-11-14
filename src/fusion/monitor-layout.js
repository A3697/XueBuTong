(()=>{
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function divider({host,first,second,axis='y',ratio=.6,onChange}){
  const bar=document.createElement('div');bar.className='fusion-resize-divider';bar.tabIndex=0;bar.setAttribute('role','separator');bar.setAttribute('aria-label','调整任务列表与日志的比例');
  let activeAxis=axis,current=ratio,drag=null,disposed=false;
  host.insertBefore(bar,second);
  function set(nextAxis,nextRatio){activeAxis=nextAxis;current=clamp(Number.isFinite(nextRatio)?nextRatio:.6,activeAxis==='x'?.25:.2,activeAxis==='x'?.75:.8);host.dataset.splitAxis=activeAxis;host.style.setProperty('--fusion-split-ratio',String(current));first.style.flex='0 0 calc('+current*100+'% - '+8*current+'px)';second.style.flex='1 1 0';bar.setAttribute('aria-orientation',activeAxis==='x'?'vertical':'horizontal');bar.setAttribute('aria-valuemin',activeAxis==='x'?'25':'20');bar.setAttribute('aria-valuemax',activeAxis==='x'?'75':'80');bar.setAttribute('aria-valuenow',String(Math.round(current*100)));bar.setAttribute('aria-valuetext','任务 '+Math.round(current*100)+'%，日志 '+Math.round((1-current)*100)+'%');bar.title=activeAxis==='x'?'拖动调整全部星蝉卡片的任务与日志宽度，也可按左右方向键':'拖动调整全部星蝉卡片的任务与日志高度，也可按上下方向键';}
  const change=value=>{set(activeAxis,value);onChange?.(current,activeAxis);};
  bar.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();bar.setPointerCapture(event.pointerId);drag={id:event.pointerId,start:activeAxis==='x'?event.clientX:event.clientY,ratio:current,axis:activeAxis};bar.classList.add('dragging');});
  bar.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id||activeAxis!==drag.axis)return;const size=(activeAxis==='x'?host.clientWidth:host.clientHeight)-8;if(size<30)return;change(drag.ratio+((activeAxis==='x'?event.clientX:event.clientY)-drag.start)/size);});
  const end=()=>{drag=null;bar.classList.remove('dragging');};bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);bar.addEventListener('lostpointercapture',end);
  bar.addEventListener('keydown',event=>{const keys=activeAxis==='x'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'],index=keys.indexOf(event.key);if(index>=0){event.preventDefault();change(current+(index?1:-1)*.025);}});
  set(axis,ratio);
  return {set,dispose(){if(disposed)return;disposed=true;bar.remove();}};
 }
 function heightHandle({host,getHeight,onChange,min=360,max=1800,label='调整卡片高度'}){
  const bar=document.createElement('div');bar.className='fusion-height-handle';bar.tabIndex=0;bar.setAttribute('role','separator');bar.setAttribute('aria-label',label);bar.setAttribute('aria-orientation','horizontal');bar.setAttribute('aria-valuemin',String(min));bar.setAttribute('aria-valuemax',String(max));bar.title=label+'，也可按上下方向键';host.append(bar);let drag=null;
  function set(value){bar.setAttribute('aria-valuenow',String(Math.round(value)));bar.setAttribute('aria-valuetext',Math.round(value)+' 像素');}
  const change=value=>{const height=clamp(Math.round(value),min,max);set(height);onChange(height);};
  bar.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();bar.setPointerCapture(event.pointerId);drag={id:event.pointerId,y:event.clientY,height:getHeight()};bar.classList.add('dragging');});
  bar.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)change(drag.height+event.clientY-drag.y);});
  const end=()=>{drag=null;bar.classList.remove('dragging');};bar.addEventListener('pointerup',end);bar.addEventListener('pointercancel',end);bar.addEventListener('lostpointercapture',end);
  bar.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();change(getHeight()+(event.key==='ArrowUp'?-20:20));}});
  set(getHeight());return {set,dispose(){bar.remove();}};
 }
 window.FusionMonitorLayout={divider,heightHandle};
})();
