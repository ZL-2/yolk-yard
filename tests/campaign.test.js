import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STAGES,ENEMIES,MISSION_ID,validSave,readSave,checkpoint,createMission,interactionBlocked,rayBox,blockedRay,moveBody} from '../src/campaign-mission.js';

test('checkpoints reject corrupt and foreign data and preserve completed patrol members',()=>{
 for(const value of [null,{},'x',{mission:MISSION_ID,stage:-1},{mission:MISSION_ID,stage:5},{mission:MISSION_ID,stage:2.5},{mission:'other',stage:2}])assert.equal(validSave(value),null);
 assert.equal(readSave({getItem(){throw Error('Storage disabled');}}),null);
 const m=createMission(null,'story');m.stage=1;m.kills=1;m.defeated=['y1'];m.elapsed=46;m.hits=2;m.shots=3;
 const saved=checkpoint(m),restored=createMission(saved);assert.equal(restored.stage,1);assert.equal(restored.difficulty,'story');assert.deepEqual(restored.defeated,['y1']);assert.equal(restored.kills,1);assert.equal(restored.elapsed,46);
 const hostile=validSave({...saved,defeated:['y1','y1','<script>'],elapsed:-1,shots:Infinity});assert.deepEqual(hostile.defeated,['y1']);assert.equal(hostile.elapsed,0);assert.equal(hostile.shots,100000);
});
test('objectives cannot advance through active hostiles or before extraction arrives',()=>{
 const enemies=ENEMIES.map(e=>({...e,health:100}));assert.equal(interactionBlocked(0,enemies),'');assert.match(interactionBlocked(1,enemies),/Hostiles/);enemies.filter(e=>e.group==='yard').forEach(e=>e.health=0);assert.equal(interactionBlocked(1,enemies),'');assert.match(interactionBlocked(2,enemies),/Hostiles/);
 enemies.forEach(e=>e.health=0);assert.match(interactionBlocked(4,enemies,0),/22s/);assert.equal(interactionBlocked(4,enemies,22),'');assert.equal(STAGES.length,5);
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
