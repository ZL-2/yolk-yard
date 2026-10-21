import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STAGES,ENEMIES,MISSION_ID,validSave,readSave,checkpoint,createMission,interactionBlocked,rayBox,blockedRay,moveBody,distance} from '../src/campaign-mission.js';

test('checkpoints reject corrupt and foreign data and preserve completed patrol members',()=>{
 for(const value of [null,{},'x',{mission:MISSION_ID,stage:-1},{mission:MISSION_ID,stage:STAGES.length},{mission:MISSION_ID,stage:2.5},{mission:'other',stage:2}])assert.equal(validSave(value),null);
 assert.equal(readSave({getItem(){throw Error('Storage disabled');}}),null);
 const m=createMission(null,'story');m.stage=1;m.kills=1;m.defeated=['y1'];m.elapsed=46;m.hits=2;m.shots=3;
 const saved=checkpoint(m),restored=createMission(saved);assert.equal(restored.stage,1);assert.equal(restored.difficulty,'story');assert.deepEqual(restored.defeated,['y1']);assert.equal(restored.kills,1);assert.equal(restored.elapsed,46);
 const hostile=validSave({...saved,defeated:['y1','y1','<script>'],elapsed:-1,shots:Infinity});assert.deepEqual(hostile.defeated,['y1']);assert.equal(hostile.elapsed,0);assert.equal(hostile.shots,100000);
});
test('objectives cannot advance through active hostiles or before extraction arrives',()=>{
 const enemies=ENEMIES.map(e=>({...e,health:100}));assert.equal(interactionBlocked(0,enemies),'');assert.match(interactionBlocked(1,enemies),/Hostiles/);enemies.filter(e=>e.group==='yard').forEach(e=>e.health=0);assert.equal(interactionBlocked(1,enemies),'');assert.match(interactionBlocked(2,enemies),/Hostiles/);
 enemies.forEach(e=>e.health=0);assert.match(interactionBlocked(5,enemies,0),/32s/);assert.equal(interactionBlocked(5,enemies,32),'');assert.equal(STAGES.length,6);
});
test('cover blocks bullets, sight and blast; opened doors stop blocking',()=>{
 const b={x:0,y:1.5,z:0,sx:3,sy:3,sz:.2},a={x:0,y:1.5,z:4},dir={x:0,y:0,z:-1};assert.equal(rayBox(a,dir,b),3.9);assert.equal(rayBox({...a,x:5},dir,b),Infinity);assert.equal(blockedRay(a,{x:0,y:1.5,z:-4},[b]),true);b.active=false;assert.equal(rayBox(a,dir,b),Infinity);assert.equal(blockedRay(a,{x:0,y:1.5,z:-4},[b]),false);
});
test('movement substeps cannot tunnel through thin walls and slide along cover',()=>{
 const wall={x:0,y:1.5,z:0,sx:10,sy:3,sz:.1},p={x:0,y:0,z:2};moveBody(p,2,-8,[wall]);assert.ok(p.z>.3);assert.ok(p.x>1.9);wall.active=false;moveBody(p,0,-8,[wall]);assert.ok(p.z<0);
});
test('campaign remains outside public mode selection and revalidates owner access',()=>{
 const lobby=readFileSync(new URL('../src/lobby-ui.js',import.meta.url),'utf8'),owner=readFileSync(new URL('../src/owner-console.js',import.meta.url),'utf8'),main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');assert.doesNotMatch(lobby,/data-experience=["'](?:campaign|blackglass)/);assert.match(owner,/async openCampaign\(\).*await this.post\('\/summary'/);assert.match(main,/screen==='editor'\|\|screen==='campaign'/);assert.match(main,/campaign\?\.close\(\{returnToOwner:false\}\)/);
});

import {createFacilityLayout,CollisionIndex,moveFacilityBody} from '../src/campaign-layout.js';
import {FacilityNavigator} from '../src/campaign-navigation.js';
import {CampaignAI} from '../src/campaign-ai.js';
import {cinematicFrame,INTRO_DURATION} from '../src/campaign-cinematic.js';
function facility(){const w=createFacilityLayout();w.boxes.forEach(b=>{if(b.unlock)b.active=false;});w.index=new CollisionIndex(w.boxes);w.navigation=new FacilityNavigator(w);w.move=(...args)=>moveFacilityBody(w,...args);return w;}
test('every objective has a physically traversable route across real floors and ramps',()=>{
 const w=facility();for(let i=0;i<STAGES.length;i++){const p={...(i?STAGES[i-1].target:STAGES[0].spawn)},target=STAGES[i].target,path=w.navigation.path(p,target);assert.ok(path.length,'route '+i);
  for(const node of path){let steps=0;while(distance(p,node)>.12&&steps++<180){const d=distance(p,node);w.move(p,(node.x-p.x)/d*.1,(node.z-p.z)/d*.1);}assert.ok(steps<180,'blocked route '+i+' at '+JSON.stringify(p));assert.ok(Math.abs(p.y-node.y)<.55,'correct floor');}
  assert.ok(Math.hypot(p.x-target.x,p.y-target.y,p.z-target.z)<3.25,'interaction reachable '+i);
 }
});
test('gate and operations door prevent navigation until the correct objective',()=>{const w=facility(),a=STAGES[0].spawn,b=STAGES[1].target;w.boxes.find(b=>b.id==='gate').active=true;w.navigation.rebuild();assert.equal(w.navigation.path(a,b).length,0);w.boxes.find(b=>b.id==='gate').active=false;w.navigation.rebuild();assert.ok(w.navigation.path(a,b).length>0);});
function actor(extra={}){return {id:'test',index:0,group:'yard',role:'rifle',x:0,y:0,z:0,yaw:0,health:100,startX:0,startY:0,startZ:0,patrol:[0,-2],travel:0,mesh:{visible:true},...extra};}
function aiFixture(boxes=[]){const w={boxes,covers:[],navigation:{path:()=>[]},move(){}},ai=new CampaignAI(w,{random:()=>.5});return {w,ai};}
test('perception respects walls, facing, crouching and powered-down visibility',()=>{const {w,ai}=aiFixture(),e=actor(),p={x:0,y:0,z:-25,crouch:false};ai.reset([e]);assert.equal(ai.sight(e,p,{}),true);assert.equal(ai.sight(e,{...p,z:25},{}),false);w.boxes.push({x:0,y:1.5,z:-12,sx:8,sy:3,sz:.4});assert.equal(ai.sight(e,p,{}),false);w.boxes=[];assert.equal(ai.sight(e,{...p,z:-44},{powerOff:true}),false);assert.equal(ai.sight(e,{...p,z:-44},{powerOff:true,flashlight:true}),true);});
test('lost contact searches remembered positions, then disengages; it does not track through walls',()=>{const {ai}=aiFixture(),e=actor(),p={x:100,y:0,z:100};ai.reset([e]);ai.remember(e,{x:0,y:0,z:-12},0);e.sees=false;ai.decide(e,p,7,{enemies:[e]});assert.equal(e.state,'search');assert.ok(distance(e.goal,{x:0,z:-12})<8);assert.ok(distance(e.goal,p)>80);ai.decide(e,p,22,{enemies:[e]});assert.equal(e.state,'patrol');assert.equal(e.aware,false);});
test('suppression, empty magazines and nearby grenades interrupt attack decisions',()=>{const {ai}=aiFixture(),e=actor(),p={x:0,y:0,z:-12};ai.reset([e]);ai.remember(e,p,0);e.sees=true;e.suppression=.9;ai.decide(e,p,1,{enemies:[e]});assert.equal(e.state,'cover');e.reloadEnd=4;ai.decide(e,p,2,{enemies:[e]});assert.equal(e.state,'reload');ai.decide(e,p,2,{enemies:[e],grenades:[{life:2,mesh:{position:{x:1,y:0,z:0}}}]});assert.equal(e.state,'evade');assert.ok(distance(e.goal,{x:1,z:0})>7);});
test('shared sightings stay in the local squad and flank roles react to supporting teammates',()=>{const {ai}=aiFixture(),e=actor({id:'spotter'}),ally=actor({id:'ally',index:1,x:2,role:'flanker'}),other=actor({id:'other',group:'other',x:4});ai.reset([e,ally,other]);e.alert=1;other.yaw=Math.PI;const p={x:0,y:0,z:-15};ai.update(.14,1,p,[e,ally,other],{});assert.ok(ally.lastKnown);assert.equal(other.lastKnown,null);e.state='engage';ally.sees=true;ai.decide(ally,p,2,{enemies:[e,ally,other]});assert.equal(ally.state,'flank');assert.ok(Math.abs(ally.goal.x)>5);});
test('cinematic is finite, has deterministic camera shots, and ends at the actual player insertion',()=>{assert.equal(cinematicFrame(0).index,0);assert.equal(cinematicFrame(10).index,1);assert.equal(cinematicFrame(25).index,3);const end=cinematicFrame(INTRO_DURATION);assert.equal(end.done,true);assert.deepEqual(end.position,[42,5.64,96]);assert.equal(cinematicFrame(999).done,true);});
test('campaign dependency graph never reaches multiplayer simulation or network modules',()=>{const seen=new Set(),blocked=['network.js','simulation.js','royale.js','zone-wars.js','box-fights.js','party.js','voice-chat.js'];const walk=file=>{if(seen.has(file))return;seen.add(file);const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');for(const m of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)){assert.ok(!blocked.includes(m[1]),file+' imports '+m[1]);if(m[1].endsWith('.js'))walk(m[1]);}assert.doesNotMatch(source,/new (?:WebSocket|RTCPeerConnection)\(/);};walk('campaign.js');assert.ok(seen.has('campaign-ai.js'));});
