// Asynchronous GPU timings. Never wait for a query or force a GPU/CPU sync.
export class GpuFrameTimer {
 constructor(renderer){this.gl=renderer.getContext();this.ext=this.gl.getExtension('EXT_disjoint_timer_query_webgl2');this.pending=[];this.active=null;this.ms=null;}
 poll(){
  if(!this.ext)return null;const gl=this.gl;
  if(gl.isContextLost()||gl.getParameter(this.ext.GPU_DISJOINT_EXT)){for(const q of this.pending)gl.deleteQuery(q);this.pending=[];this.ms=null;return null;}
  while(this.pending.length&&gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)){
   const q=this.pending.shift(),ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);
   if(Number.isFinite(ms)&&ms>=0)this.ms=ms;
  }
  return this.ms;
 }
 begin(){if(!this.ext||this.active||this.pending.length>=6||this.gl.isContextLost())return;this.active=this.gl.createQuery();this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,this.active);}
 end(){if(!this.active)return;this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.active);this.active=null;}
}
