import {MATERIALS,PIECES,aimedObject,targetBuild} from './building.js';
import {canEdit,harvestDefinition,EDIT_RANGE,selectMaterial} from './building-rules.js';
import {editRay,validEdit,wallPattern} from './building-shapes.js';
import {direction,EYE} from './physics.js';
const paths={wood:'M8 4 24 8 24 24 8 28 2 23 2 9ZM8 4V28M2 9 8 13 24 8M8 19 24 14',brick:'M2 10 20 4 30 10 12 17ZM2 10V22L12 28 30 21V10M12 17V28M20 14V24',metal:'M5 5H27V12H21V23H27V29H5V23H11V12H5Z',wall:'M3 4H29V29H3ZM3 12H29M3 21H29M12 4V12M21 12V21M12 21V29',floor:'M2 18 17 7 31 15 16 28ZM9 12 24 22M9 24 24 11',stairs:'M2 29V23H9V17H16V11H23V5H30V29Z',roof:'M2 24 16 5 30 24 16 30ZM16 5V30'};
export const buildIcon=name=>`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
export class BuildingUI{
 constructor(root,controls,send){this.root=root;this.controls=controls;this.send=send;this.edit=null;this.down=false;
 root.insertAdjacentHTML('beforeend',`<div class="build-hud"><div class="build-materials">${Object.keys(MATERIALS).map(m=>`<button data-material="${m}" aria-label="Build with ${m}">${buildIcon(m)}<b id="material-${m}">0</b></button>`).join('')}</div><div class="build-pieces">${PIECES.map(p=>`<button data-piece="${p}" aria-label="Build ${p}">${buildIcon(p)}<kbd></kbd></button>`).join('')}</div><div><button class="build-toggle" data-build-control="toggle">BUILD <kbd></kbd></button><button data-build-control="rotate">ROTATE</button><button data-build-control="edit">EDIT</button><button data-build-control="repair">REPAIR</button></div></div><div class="build-help" hidden></div><div class="build-target" hidden></div><div class="build-edit" hidden><strong>EDIT STRUCTURE</strong><p class="edit-status"></p><div class="edit-prompts"><button data-build-control="confirm">CONFIRM</button><button data-build-control="reset">RESET</button><button data-build-control="cancel">CANCEL</button></div></div><div class="harvest-gain" role="status"></div>`);
 root.addEventListener('click',e=>{const material=e.target.closest('[data-material]'),piece=e.target.closest('[data-piece]'),action=e.target.closest('[data-build-control]');if(material)controls.buildMaterial=material.dataset.material;if(piece)this.choose(piece.dataset.piece);if(action)this.action(action.dataset.buildControl);});
 }
 choose(type){if(!this.controls.buildMode)this.controls.buildRotation=0;this.controls.buildType=type;this.controls.buildMode=true;this.cancel();}
 action(action){const c=this.controls;
  if(action==='toggle'){if(!c.buildMode)c.buildRotation=0;c.buildMode=!c.buildMode;this.cancel();}
  if(action==='rotate'&&!this.edit)c.buildRotation=(c.buildRotation+1)%4;
  if(action==='material')c.buildMaterial=Object.keys(MATERIALS)[(Object.keys(MATERIALS).indexOf(c.buildMaterial)+1)%3];
  if(action==='cancel')this.cancel();
  if(action==='reset'&&this.edit&&!this.pending){this.edit.mask=0;this.edit.path=[];this.error='';this.renderEdit();}
  if(action==='confirm'&&this.edit&&!this.pending){
   if(!validEdit(this.edit)){this.error='INVALID SELECTION';this.renderEdit();return;}
   this.pending=true;this.error='';this.renderEdit();
   this.send('build-change:'+JSON.stringify({id:this.edit.id,revision:this.edit.revision||0,mask:this.edit.mask,path:this.edit.path||[],yaw:c.yaw,pitch:c.pitch}));
  }
 }
 result(event){if(!this.edit||event.buildId!==this.edit.id)return;this.pending=false;if(event.ok)this.cancel();else{this.error=event.reason;this.renderEdit();}}
 cancel(){if(this.edit)this.controls.suppressBuildFire=true;this.edit=null;this.root.classList.remove('manual-editing');this.pending=false;this.down=false;this.controls.editing=false;this.controls.editDraft=null;this.root.querySelector('.build-edit').hidden=true;}
 eligible(state,p,map){
  if(!p||p.health<=0||p.flight!=='ground')return false;
  const b=targetBuild(map,state.royale.builds,{...p,yaw:this.controls.yaw??p.yaw,pitch:this.controls.pitch??p.pitch});
  return canEdit(b,p);
 }
 beginEdit(state,p,map){if(!p||p.health<=0||p.flight!=='ground')return false;const pose={...p,yaw:this.controls.yaw??p.yaw,pitch:this.controls.pitch??p.pitch},b=targetBuild(map,state.royale.builds,pose);if(!canEdit(b,p))return false;
  this.edit={...b,path:[...(b.path||[])]};this.pending=false;this.error='';this.down=false;this.root.classList.add('manual-editing');this.controls.editing=true;this.controls.editTarget=b.id;this.renderEdit();return true;
 }
 renderEdit(){if(!this.edit)return;this.controls.editDraft=this.edit;const valid=validEdit(this.edit);this.controls.editValid=valid;this.root.querySelector('.build-edit').hidden=false;this.root.querySelector('.build-edit').classList.toggle('invalid',!valid||!!this.error);this.root.querySelector('.build-edit strong').textContent=this.edit.type.toUpperCase()+' · EDIT';this.root.querySelector('.edit-status').textContent=this.pending?'CONFIRMING…':this.error||(!valid?'INVALID SELECTION':this.edit.type==='stairs'?'DRAG A CONTINUOUS STAIR PATH':this.edit.type==='roof'?'SELECT CORNERS TO RAISE':'SELECT TILES');}
 sample(pose,held,confirmOnRelease){
  if(!this.edit||this.pending)return;
  const hit=editRay(this.edit,{x:pose.x,y:pose.y+EYE,z:pose.z},direction(pose.yaw,pose.pitch),EDIT_RANGE);
  this.controls.editHover=hit?.cell??-1;
  if(held&&!this.down){this.visited=new Set();this.paint=null;this.previous=null;if(this.edit.type==='stairs')this.edit.path=[];}
  if(held&&hit){
   const old=this.previous||hit,steps=Math.max(1,Math.ceil(Math.hypot(hit.u-old.u,hit.v-old.v)*24)),n=['wall','stairs'].includes(this.edit.type)?3:2;
   for(let i=1;i<=steps;i++){
    const u=old.u+(hit.u-old.u)*i/steps,v=old.v+(hit.v-old.v)*i/steps,cell=Math.min(n-1,Math.floor(v*n))*n+Math.min(n-1,Math.floor(u*n));
    if(this.edit.type==='stairs'){
     const path=this.edit.path,last=path.at(-1);
     if(last===cell)continue;
     if(path.length>1&&path.at(-2)===cell){path.pop();continue;}
     if(last==null||(!path.includes(cell)&&Math.abs(last%3-cell%3)+Math.abs(Math.floor(last/3)-Math.floor(cell/3))===1))path.push(cell);
     this.edit.mask=0;
    }else if(!this.visited.has(cell)){
     this.paint??=!(this.edit.mask&1<<cell);this.visited.add(cell);
     if(this.paint)this.edit.mask|=1<<cell;else this.edit.mask&=~(1<<cell);
    }
   }
   this.previous=hit;this.error='';this.renderEdit();
  }else if(held)this.previous=null;
  if(!held&&this.down&&confirmOnRelease)this.action('confirm');
  this.down=held;
 }
 update(state,p,map,label){
  const gain=this.root.querySelector('.harvest-gain'),harvest=p.lastHarvest;gain.innerHTML=harvest&&state.time-harvest.time<1.3?buildIcon(harvest.material)+' +'+harvest.amount:'';
  const c=this.controls;
  if(c.buildMode)c.buildMaterial=selectMaterial(p.materials,c.buildMaterial)||c.buildMaterial;
  for(const m of Object.keys(MATERIALS)){this.root.querySelector('#material-'+m).textContent=p.materials?.[m]||0;this.root.querySelector(`[data-material="${m}"]`).classList.toggle('selected',c.buildMaterial===m);}
  for(const type of PIECES)this.root.querySelector(`[data-piece="${type}"]`).classList.toggle('selected',c.buildMode&&c.buildType===type);
  for(const [type,key]of [['wall','buildWall'],['floor','buildFloor'],['stairs','buildStairs'],['roof','buildRoof']])this.root.querySelector(`[data-piece="${type}"] kbd`).textContent=label(key);
  this.root.querySelector('.build-toggle kbd').textContent=label('buildToggle');
  const help=this.root.querySelector('.build-help');help.hidden=!c.buildMode||p.health<=0||!!this.edit;help.textContent=`${c.reason||'10 '+c.buildMaterial.toUpperCase()+' · '+c.buildType.toUpperCase()} · ${label('fire')} BUILD · ${label('buildRotate')} ROTATE · ${label('buildMaterial')} MATERIAL`;
  const pose={...p,yaw:c.yaw??p.yaw,pitch:c.pitch??p.pitch},hit=aimedObject(map,pose,EDIT_RANGE),b=this.edit||targetBuild(map,state.royale.builds||[],pose),current=state.royale.builds.find(v=>v.id===b?.id),health=current||state.royale.worldDamage?.[hit?.box.objectId],def=hit?harvestDefinition(hit.box,map):null;
  const target=this.root.querySelector('.build-target');target.hidden=(!hit&&!b)||p.health<=0;
  if(hit||b){const max=health?.maxHealth??def?.health??0,hp=health?.health??max;target.innerHTML=`<b>${b?b.material.toUpperCase()+' '+b.type.toUpperCase():hit.box.material.toUpperCase()}</b><div><i style="width:${Math.max(0,hp/max*100)}%"></i></div><span>${Math.ceil(hp)} / ${max} HP${current?.constructionRemaining>0?' · CONSTRUCTING':''}${canEdit(b,p)?' · '+label('buildEdit')+' EDIT · '+label('buildRepair')+' REPAIR':''}${b&&wallPattern(b.mask)?.door!=null?' · '+label('interact')+' '+(b.doorOpen?'CLOSE':'OPEN'):''}</span>`;}
  if(this.edit){
   this.root.querySelector('[data-build-control="confirm"]').textContent=label('buildEdit')+' CONFIRM';
   this.root.querySelector('[data-build-control="reset"]').textContent=label('buildReset')+' RESET';
   this.root.querySelector('[data-build-control="cancel"]').textContent='ESC CANCEL';
   if(!current||p.health<=0||!canEdit(current,p)||Math.hypot(current.x-p.x,current.y-p.y,current.z-p.z)>EDIT_RANGE+GRID_MARGIN)this.cancel();
  }
 }
}
const GRID_MARGIN=3;
