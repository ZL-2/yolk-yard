// A visible, accessible thumb works with mouse, trackpad, touch and keyboard.
// Geometry updates on resize/scroll only; there is no polling or gameplay work.
const controllers=new Map();
export function installLeaderboardScrollbars(root=document){
 for(const [pane,c]of controllers)if(!pane.isConnected){c.destroy();controllers.delete(pane);}
 for(const wrapper of root.querySelectorAll('.frontier-board-scroll')){
  const pane=wrapper.querySelector('.frontier-board-ranks'),bar=wrapper.querySelector('.frontier-scrollbar'),thumb=bar?.firstElementChild;if(!pane||!bar||controllers.has(pane))continue;
  let drag=null,frame=0;
  const geometry=()=>{const height=bar.clientHeight,max=Math.max(0,pane.scrollHeight-pane.clientHeight),size=max?Math.min(height,Math.max(24,height*pane.clientHeight/pane.scrollHeight)):height;return {height,max,size,travel:Math.max(0,height-size)};};
  const update=()=>{if(!pane.isConnected)return;const g=geometry();bar.hidden=g.max===0;thumb.style.height=g.size+'px';thumb.style.transform=`translateY(${g.max?pane.scrollTop/g.max*g.travel:0}px)`;bar.setAttribute('aria-valuemax',String(Math.round(g.max)));bar.setAttribute('aria-valuenow',String(Math.round(pane.scrollTop)));};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
  const observer=new ResizeObserver(schedule);observer.observe(pane);const rows=pane.querySelector('ol');if(rows)observer.observe(rows);pane.addEventListener('scroll',schedule,{passive:true});
  bar.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const g=geometry();if(!g.max||!g.travel)return;
   if(e.target!==thumb){const y=e.clientY-bar.getBoundingClientRect().top-g.size/2;pane.scrollTop=Math.max(0,Math.min(g.max,y/g.travel*g.max));}
   drag={y:e.clientY,top:pane.scrollTop,max:g.max,travel:g.travel};bar.setPointerCapture(e.pointerId);bar.focus({preventScroll:true});update();
  });
  bar.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();pane.scrollTop=Math.max(0,Math.min(drag.max,drag.top+(e.clientY-drag.y)/drag.travel*drag.max));update();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])bar.addEventListener(event,()=>{drag=null;});
  wrapper.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key)||e.target.closest('[role=tab]'))return;e.preventDefault();e.stopPropagation();const max=pane.scrollHeight-pane.clientHeight;pane.scrollTop=e.key==='Home'?0:e.key==='End'?max:pane.scrollTop+({'ArrowUp':-28,'ArrowDown':28,'PageUp':-pane.clientHeight*.8,'PageDown':pane.clientHeight*.8}[e.key]||0);schedule();},{capture:true});
  controllers.set(pane,{destroy(){observer.disconnect();pane.removeEventListener('scroll',schedule);cancelAnimationFrame(frame);drag=null;}});schedule();
 }
}
