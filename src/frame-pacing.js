export const FPS_LIMITS=Object.freeze([30,60,90,120,144,'unlimited']);
export function fpsLimit(value){return value==='unlimited'||value===0||value==='0'?0:FPS_LIMITS.includes(Number(value))?Number(value):60;}
export function fpsLimitHTML(value){const selected=fpsLimit(value);return `<div class="setting-row"><label for="fpsLimit" class="setting-label">Frame rate limit</label><select id="fpsLimit" data-setting="fpsLimit">${FPS_LIMITS.map(n=>`<option value="${n}" ${selected===fpsLimit(n)?'selected':''}>${n==='unlimited'?'Unlimited':n+' FPS'}</option>`).join('')}</select></div>`;}
// Rendering follows a deadline; simulation and input continue on every browser
// callback. Fractional deadlines avoid a 60/90 cap becoming 48/72 on 144Hz.
export class FramePacer{
 constructor(){this.limit=null;this.nextAt=0;this.lastAt=null;this.elapsedMs=1000/60;this.frames=0;}
 shouldRender(now,value){
  const limit=fpsLimit(value);if(limit!==this.limit){this.limit=limit;this.nextAt=now;}
  if(limit&&now+.35<this.nextAt)return false;
  this.elapsedMs=this.lastAt===null?1000/(limit||60):Math.max(.01,now-this.lastAt);this.lastAt=now;this.frames++;
  if(limit){const interval=1000/limit;this.nextAt+=Math.max(1,Math.floor((now-this.nextAt)/interval)+1)*interval;}else this.nextAt=now;
  return true;
 }
}
