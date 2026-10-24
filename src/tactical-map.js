const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function mapViewport(view={},size=256){
 const zoom=clamp(Number(view.zoom)||1,1,6),limit=size-size/zoom;
 return {zoom,x:clamp(Number(view.x)||0,-limit,limit)||0,z:clamp(Number(view.z)||0,-limit,limit)||0};
}
export function mapPosition(view,size,u,v){
 const p=mapViewport(view,size),span=size*2/p.zoom;
 return {x:p.x+(u-.5)*span,z:p.z+(v-.5)*span};
}
export function zoomMap(view,size,zoom,u=.5,v=.5){
 const before=mapPosition(view,size,u,v),next=mapViewport({...view,zoom},size),after=mapPosition(next,size,u,v);
 return mapViewport({...next,x:next.x+before.x-after.x,z:next.z+before.z-after.z},size);
}
// One controller per open dialog. Listeners and the resize observer are removed
// on close; dragging never doubles as a waypoint click.
export function bindTacticalMap(root,{size,view={},onView,onMarker,player,draw}){
 const canvas=root.querySelector('canvas'),stage=root.querySelector('.tactical-map-stage'),label=root.querySelector('[data-map-zoom-label]'),abort=new AbortController(),options={signal:abort.signal};
 let current=mapViewport(view,size),drag=null;
 const render=()=>{onView(current);label.textContent=current.zoom.toFixed(1)+'×';root.querySelector('[data-map-control="out"]').disabled=current.zoom<=1;root.querySelector('[data-map-control="in"]').disabled=current.zoom>=6;draw();};
 const zoom=(value,u=.5,v=.5)=>{current=zoomMap(current,size,value,u,v);render();};
 const coords=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];};
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(current.zoom*Math.exp(-clamp(e.deltaY,-200,200)*.003),...coords(e));},{...options,passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||drag)return;e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,view:{...current},moved:false};},options);
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;canvas.classList.add('panning');const span=size*2/current.zoom,rect=canvas.getBoundingClientRect();current=mapViewport({...current,x:drag.view.x-dx/rect.width*span,z:drag.view.z-dy/rect.height*span},size);render();},options);
 canvas.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;const moved=drag.moved;drag=null;canvas.classList.remove('panning');canvas.releasePointerCapture(e.pointerId);const [u,v]=coords(e);if(!moved&&u>=0&&u<=1&&v>=0&&v<=1){onMarker(mapPosition(current,size,u,v));draw();}},options);
 const cancel=()=>{drag=null;canvas.classList.remove('panning');};canvas.addEventListener('pointercancel',cancel,options);canvas.addEventListener('lostpointercapture',cancel,options);
 const control=action=>{if(action==='in'||action==='out')zoom(current.zoom*(action==='in'?1.4:1/1.4));else if(action==='reset'){current=mapViewport({},size);render();}else if(action==='player'){const p=player();if(p){current=mapViewport({zoom:Math.max(2,current.zoom),x:p.x,z:p.z},size);render();}}};
 root.addEventListener('click',e=>{const button=e.target.closest('[data-map-control]');if(button)control(button.dataset.mapControl);},options);
 canvas.addEventListener('keydown',e=>{if(['+','=','-','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();if(['+','=','-'].includes(e.key))control(e.key==='-'?'out':'in');else if(e.key==='0'||e.key==='Home')control('reset');else{const step=size*.16/current.zoom;current=mapViewport({...current,x:current.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),z:current.z+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)},size);render();}}},options);
 const resize=()=>{const r=stage.getBoundingClientRect(),pixels=Math.max(160,Math.round(Math.min(r.width,r.height)));canvas.style.width=pixels+'px';canvas.style.height=pixels+'px';if(canvas.width!==pixels){canvas.width=canvas.height=pixels;}render();};
 const observer=new ResizeObserver(resize);observer.observe(stage);resize();
 return {destroy(){abort.abort();observer.disconnect();},get view(){return current;}};
}
