import test from 'node:test';
import assert from 'node:assert/strict';
import {updateZoneDistrict} from '../src/zone-wars-view.js';
test('leaving Zone Wars clears preparation gates without reading cleared match state',()=>{
 const world={userData:{zoneWars:{gates:{visible:true}}}};
 updateZoneDistrict(world,null);assert.equal(world.userData.zoneWars.gates.visible,false);
 updateZoneDistrict(world,undefined);updateZoneDistrict(world,{options:{mode:'ffa'}});
 assert.equal(world.userData.zoneWars.gates.visible,false);
});
