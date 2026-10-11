export const RELOAD_BUFFER_SECONDS=.22;
export function reloadRequested(p,w,input,time){
 if(!input.reload&&!p.pendingReload&&!p.reloadHeld&&(input.reloadPress||0)<=(p.lastReloadPress||0))return false;
 const held=!!(input.reloadHeld??input.reload),edge=(input.reloadPress||0)>(p.lastReloadPress||0)||held&&!p.reloadHeld;
 p.reloadHeld=held;
 if(edge)p.lastReloadPress=Math.max(p.lastReloadPress||0,input.reloadPress||0);
 if(p.health<=0||p.downed||p.spectating||p.reviving||p.use||p.traversal||input.buildMode||input.editing||input.drop){p.pendingReload=null;return false;}
 if(edge)p.pendingReload={until:time+RELOAD_BUFFER_SECONDS,slot:p.slot,weapon:w.id};
 const pending=p.pendingReload;
 if(pending&&(pending.until<time||pending.slot!==p.slot||pending.weapon!==w.id))p.pendingReload=null;
 return held||!!p.pendingReload;
}
