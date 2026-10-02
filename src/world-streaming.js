// Render-only residency. Authoritative collision, loot and bots never unload.
export const WORLD_STREAMING=Object.freeze({cell:64,nearLow:112,nearHigh:152,unloadMargin:80,budgetMs:2.5,scopedRange:500});
export class WorldDetails {
 constructor(world,cells,build,dispose){this.world=world;this.cells=cells;this.build=build;this.dispose=dispose;this.pending=null;this.loaded=0;this.revision=0;}
 attach(world){this.world=world;world.userData.details=this;}
 distance(cell,p){return Math.hypot(Math.max(0,Math.abs(p.x-cell.x)-cell.radius),Math.max(0,Math.abs(p.z-cell.z)-cell.radius));}
 update(p,{quality='low',scoped=false,time=0}={}){
  if(!p)return;const radius=quality==='low'?WORLD_STREAMING.nearLow:WORLD_STREAMING.nearHigh;
  // Scope detail is loaded along the view direction rather than all around the island.
  const wanted=c=>{const d=this.distance(c,p);if(d<radius)return true;if(!scoped||d>WORLD_STREAMING.scopedRange)return false;const yaw=Math.atan2(p.x-c.x,p.z-c.z),a=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));return Math.abs(a)<.38+c.radius/Math.max(1,d);};
  if(time>=this.scanAt||this.scanAt===undefined||scoped!==this.scoped){this.scanAt=time+.2;this.scoped=scoped;this.queue=[];
   for(const c of this.cells){c.wanted=wanted(c);if(c.detail&&!c.wanted&&this.distance(c,p)>radius+WORLD_STREAMING.unloadMargin){c.detail.removeFromParent();this.dispose(c.detail);c.detail=null;c.coarse.visible=true;this.loaded--;this.changed();}if(c.wanted&&!c.detail)this.queue.push(c);}
   this.queue.sort((a,b)=>this.distance(a,p)-this.distance(b,p));
  }
  const end=performance.now()+WORLD_STREAMING.budgetMs;let steps=0;
  do{
   if(!this.pending){const cell=this.queue?.find(c=>c.wanted&&!c.detail);if(!cell)break;this.pending={cell,...this.build(cell)};}
   const pending=this.pending;
   if(!pending.cell.wanted){this.dispose(pending.group);this.pending=null;continue;}
   if(pending.steps.next().done){pending.cell.detail=pending.group;this.world.add(pending.group);pending.cell.coarse.visible=false;this.loaded++;this.pending=null;this.changed();}
  }while(++steps<64&&performance.now()<end);
 }
 changed(){this.world.userData.geometryRevision=++this.revision;}
 diagnostics(){return {cells:this.cells.length,resident:this.loaded,pending:!!this.pending,revision:this.revision};}
 close(){if(this.pending)this.dispose(this.pending.group);this.pending=null;this.queue=[];}
}
