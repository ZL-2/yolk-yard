import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicHost} from '../server/realtime/public-host.js';
import {RealtimeRelay} from '../server/realtime/relay.js';
const fixture=()=>{
 const accounts=new Map(),frames=[],relay={peers:new Map(),parties:{tickets:new Map(),parties:new Map(),publishPublicMatch(){},cancel(){}},progression:{account(id){if(!accounts.has(id))accounts.set(id,{});return accounts.get(id);},save(){},frame:(p,s)=>frames.push([p,s])},remove(p){this.peers.delete(p.id);this.publicHost.left(p);}};
 relay.publicHost=new PublicHost(relay).enable();return {relay,host:relay.publicHost,accounts,frames};
};
test('the public address requires the reserved leader ticket or the elected live session proof',()=>{
 const {relay,host}=fixture();assert.equal(host.authorize({}),false);host.pending={party:'party',leader:'first'};relay.parties.tickets.set('ticket',{recurring:true,member:'first',party:'party',expires:Date.now()+1000});assert.equal(host.authorize({publicTicket:'ticket'}),true);assert.equal(host.authorize({publicTicket:'unknown'}),false);
 host.pending=null;for(const [id,order]of [['oldest',1],['later',2]]){relay.peers.set(id,{id,token:id+'-secret',ws:{readyState:1}});host.members.set(id,{peer:id,order,admission:{}});}
 assert.equal(host.authorize({publicHostProof:{id:'later',token:'later-secret'}}),false);assert.equal(host.authorize({publicHostProof:{id:'oldest',token:'wrong'}}),false);assert.equal(host.authorize({publicHostProof:{id:'oldest',token:'oldest-secret'}}),true);
 host.host={peer:'oldest',address:host.key,id:'oldest'};assert.equal(host.authorize({publicHostProof:{id:'later',token:'later-secret'}}),false,'a second host cannot claim a live lease');
});
test('private callers cannot publish the public phase or save crowns; spectators preserve ownership',()=>{
 const {relay,host}=fixture(),peer={id:'player',progressId:'account',ws:{readyState:1}};relay.peers.set(peer.id,peer);assert.equal(host.publish(peer,{recurring:true}),false);host.saveCrown(peer,{season:1,owned:true});assert.equal(relay.progression.account('account').crowns,undefined);
 peer.publicMember=true;host.members.set(peer.id,{peer:peer.id,id:peer.id,admission:{spectator:true}});relay.progression.account('account').crowns={season:1,owned:true,wins:2};host.saveCrown(peer,{season:1,owned:false,wins:0});assert.equal(relay.progression.account('account').crowns.owned,true);
 host.members.get(peer.id).admission.spectator=false;host.saveCrown(peer,{season:1,owned:true,wins:3});assert.equal(relay.progression.account('account').crowns.wins,3);
});
test('the elected public host supplies progression only for the active match identity',()=>{
 const {relay,host,frames}=fixture(),peer={id:host.key};host.host={address:peer.id,peer:peer.id,id:'host'};host.state={matchId:'active-round'};
 RealtimeRelay.prototype.handle.call(relay,{id:'unrelated'},{type:'public-progress',state:{matchId:'active-round'}});
 RealtimeRelay.prototype.handle.call(relay,peer,{type:'public-progress',state:{matchId:'stale-round'}});
 assert.equal(frames.length,0);RealtimeRelay.prototype.handle.call(relay,peer,{type:'public-progress',state:{matchId:'active-round'}});assert.equal(frames.length,1);
});
test('warmup and results exits retain earned crowns while active-round exits relinquish them',()=>{
 for(const [stage,phase,owned]of [['spawn-island','playing',true],['finished','results',true],['active','playing',false]]){
  const {relay,host}=fixture(),peer={id:'player',progressId:'account'};host.members.set(peer.id,{peer:peer.id,admission:{spectator:false}});host.state={stage,phase};relay.progression.account('account').crowns={season:1,owned:true,wins:2};host.left(peer);assert.equal(relay.progression.account('account').crowns.owned,owned);assert.equal(relay.progression.account('account').crowns.wins,2);
 }
});
