import test from 'node:test';
import assert from 'node:assert/strict';
import {setOwnReferralURL} from '../src/referrals.js';
import {EggWallet,WALLET_KEY} from '../src/egg-wallet.js';
import {BuildingUI} from '../src/building-ui.js';
import {pieceBoxes,editRay,localToWorld} from '../src/building-shapes.js';
import {targetBuild,editBuilding} from '../src/building.js';
import {sightRay,reachablePoint} from '../src/perspective.js';

test('own referral replaces inbound attribution only after acknowledgement and preserves room/navigation',()=>{
 const incoming='https://example.com/yolk-yard/?room=ABCD&ref=AAAAA-BBBBB&qa#locker',location={href:incoming};
 let replacements=0;const history={state:{menuSection:'locker'},replaceState(state,title,url){replacements++;assert.deepEqual(state,this.state);location.href=url;}};
 assert.equal(setOwnReferralURL('CCCCC-DDDDD',{location,history}),true);const u=new URL(location.href);
 assert.equal(u.searchParams.get('ref'),'CCCCC-DDDDD');assert.equal(u.searchParams.get('room'),'ABCD');assert.ok(u.searchParams.has('qa'));assert.equal(u.hash,'#locker');
 setOwnReferralURL('CCCCC-DDDDD',{location,history});assert.equal(replacements,1);
 assert.equal(setOwnReferralURL('invalid',{location,history}),false);assert.equal(replacements,1);
});
test('referral notice survives reload, credits once, and acknowledges only the displayed award',async()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};let wallet=new EggWallet(storage);const before=wallet.value.balance;
 await wallet.syncReferrals({id:'owner',marks:1000});wallet=new EggWallet(storage);
 assert.deepEqual(wallet.pendingReferralReward('owner'),{id:'owner',amount:1000,through:1000});
 await wallet.syncReferrals({id:'owner',marks:1000});assert.equal(wallet.value.balance,before+1000);
 await wallet.syncReferrals({id:'owner',marks:2000});await wallet.acknowledgeReferralReward('owner',1000);
 assert.deepEqual(wallet.pendingReferralReward('owner'),{id:'owner',amount:1000,through:2000});
 await wallet.acknowledgeReferralReward('owner',2000);wallet=new EggWallet(storage);assert.equal(wallet.pendingReferralReward('owner'),null);assert.equal(wallet.value.balance,before+2000);
 const existing=wallet.read();delete existing.referralNotices;storage.setItem(WALLET_KEY,JSON.stringify(existing));await wallet.syncReferrals({id:'owner',marks:2000});assert.equal(wallet.pendingReferralReward('owner'),null,'historical credits do not announce again');
});
test('third-person angled wall grid paints, confirms and resets on every wall rotation',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const b={id:'build-1',type:'wall',material:'wood',owner:'a',x:0,y:0,z:0,rotation,mask:0,health:150,maxHealth:150,revision:0};
  const start=localToWorld(b,-1.5,0,4),p={id:'a',health:100,...start,yaw:rotation*Math.PI/2-.35,pitch:.03,flight:'ground',perspective:'third',viewBlend:0,viewBoom:1,building:true,editing:true};
  const map={size:100,boxes:pieceBoxes(b)},sight=sightRay(map,p,8),hit=editRay(b,sight.origin,sight.d,sight.range);assert.ok(hit);
  assert.equal(reachablePoint(map,p,hit.point,8),false,'wall thickness reproduced the old bug');
  assert.equal(reachablePoint(map,p,hit.point,8,b.id),true);assert.equal(targetBuild(map,[b],p)?.id,b.id);
  const ui=Object.assign(Object.create(BuildingUI.prototype),{map,edit:{...b,path:[]},controls:{},renderEdit(){}});ui.sample(p,true,false);assert.equal(ui.edit.mask,1<<hit.cell);ui.sample(p,false,false);
  const sim={map,builds:[b],worldBoxes:[],worldDamage:{},players:new Map([['a',p]]),time:1,buildVersion:0,emit(){}};
  assert.equal(editBuilding(sim,p,'build-change:'+JSON.stringify({id:b.id,revision:0,mask:16,path:[],yaw:p.yaw,pitch:p.pitch})),true);
  assert.equal(b.mask,16);assert.equal(editBuilding(sim,p,'build-change:'+JSON.stringify({id:b.id,revision:1,mask:0,path:[],yaw:p.yaw,pitch:p.pitch})),true);
  map.boxes=[...pieceBoxes(b),{x:p.x*.5,y:0,z:p.z*.5,w:2,h:5,d:2,buildId:'different-cover'}];
  assert.equal(reachablePoint(map,p,hit.point,8,b.id),false,'other cover must still block');
 }
});
