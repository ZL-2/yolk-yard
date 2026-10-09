import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProgressionService} from '../server/realtime/progression.js';
import {publicTotals,rankPublicPlayers,publicLeaderboardView} from '../server/realtime/leaderboards.js';
import {leaderboardMarkup} from '../src/leaderboard-ui.js';
import {lobbyMarkup} from '../src/lobby-ui.js';

test('available old public Royale receipts migrate once without private, duplicate or arena results',()=>{
 const publicReceipt={id:'a',mode:'royale',eligible:true,custom:false,kills:7,won:true};
 const account={receipts:[publicReceipt,publicReceipt,{...publicReceipt,id:'private',custom:true},{...publicReceipt,id:'arena',mode:'ffa'},{...publicReceipt,id:'idle',eligible:false,reason:'Removed for inactivity'}]};
 assert.deepEqual(publicTotals(account),{version:1,kills:7,wins:1});account.receipts=[];assert.equal(publicTotals(account).kills,7);
});

function publicFixture(){
 let now=100;
 const identities=new Map([['host-social',{profile:{name:'Host'}}],['guest-social',{profile:{name:'Guest'}}],['viewer-social',{profile:{name:'Viewer'}}]]);
 const relay={peers:new Map(),send(){},parties:{store:{identities}}},service=new ProgressionService(relay,{clock:()=>now,path:null});
 const host={id:'public-room',progressId:'host-account',ws:{},listing:{},links:new Map(),rewardPublic:true},guest={id:'guest',progressId:'guest-account',ws:{},links:new Map([['guest-link',host]])},viewer={id:'viewer',progressId:'viewer-account',ws:{},links:new Map([['viewer-link',host]])};
 host.links.set('guest-link',guest);host.links.set('viewer-link',viewer);for(const p of [host,guest,viewer])relay.peers.set(p.id,p);
 service.bindPublicPlayer(host,'host-social',{participant:true});service.bindPublicPlayer(guest,'guest-social',{participant:true});service.bindPublicPlayer(viewer,'viewer-social');
 const state={round:1,matchId:'round-one',mode:'royale',phase:'playing',stage:'active',hostId:'host',winnerId:null,teamSize:1,players:[{id:'host',health:100,x:0,y:0,z:0,kills:0,contestant:true},{id:'guest',health:100,x:2,y:0,z:0,kills:0,contestant:true},{id:'bot-1',health:100,x:4,y:0,z:0,bot:true,contestant:true},{id:'viewer',health:100,kills:47,place:1,lateSpectator:true,contestant:false}],events:[]};
 return {service,relay,host,guest,viewer,state,advance:n=>now+=n??1};
}

test('both rankings include real zero-score entrants, combine saved identities and paginate past 25',async()=>{
 const {service,host,guest}=publicFixture();await service.ready;
 let b=service.leaderboards('guest-social');assert.equal(b.kills.total,2);assert.equal(b.wins.total,2);assert.equal(b.wins.self.wins,0);assert.equal(b.kills.rows.some(p=>p.name==='Viewer'),false);
 service.recordPublicStat({identity:host.progressId},'kills');service.accounts.set('guest-old',{socialId:'guest-social',publicTotals:{version:1,kills:9,wins:2}});
 b=service.leaderboards('guest-social');assert.equal(b.kills.total,2);assert.equal(b.kills.self.kills,9);assert.equal(b.wins.self.wins,2);
 for(let i=0;i<55;i++)service.accounts.set('extra-'+i,{publicName:'Entrant '+i,publicParticipant:true});service.leaderboardCache=null;
 b=service.leaderboards('guest-social',{offset:25});assert.equal(b.kills.total,57);assert.equal(b.kills.rows.length,25);assert.equal(b.kills.rows[0].rank,26);assert.equal(b.kills.hasMore,true);assert.equal(b.kills.self.rank,1);
 b=service.leaderboards('guest-social',{offset:1e8});assert.equal(b.kills.offset,50);assert.equal(b.kills.rows.length,7);assert.equal(b.kills.hasMore,false);assert.equal(JSON.stringify(b).includes('account'),false);assert.equal(service.leaderboards().kills.rows.some(p=>p.you),false);await service.close();
});

test('cumulative host and guest kills survive an overflowing event buffer, repeated frames and a backwards checkpoint',async()=>{
 const {service,host,state,advance}=publicFixture();await service.ready;
 state.players[0].kills=3;state.players[1].kills=5;state.events=Array.from({length:60},(_,i)=>({id:100+i,type:'shot',player:'bot-1'}));
 service.frame(host,state);assert.equal(service.leaderboards('host-social').kills.self.kills,3);assert.equal(service.leaderboards('guest-social').kills.self.kills,5);
 advance();service.frame(host,state);assert.equal(service.leaderboards('guest-social').kills.self.kills,5);
 advance();state.players[1].kills=2;service.frame(host,state);assert.equal(service.leaderboards('guest-social').kills.self.kills,5);
 advance();state.players[1].kills=6;service.frame(host,state);assert.equal(service.leaderboards('guest-social').kills.self.kills,6);
 advance();state.players[1].kills=NaN;service.frame(host,state);assert.equal(service.leaderboards('guest-social').kills.self.kills,6);assert.equal(service.leaderboards('viewer-social').kills.self,null);await service.close();
});

test('host transfer keeps guest scoring and does not replay kills or final wins',async()=>{
 const {service,relay,host,guest,state,advance}=publicFixture();await service.ready;
 state.players[1].kills=4;service.frame(host,state);
 const alias={...host,progressId:guest.progressId,links:new Map()};relay.peers.set(alias.id,alias);relay.peers.delete(host.id);relay.peers.set(alias.id,alias);
 state.hostId='guest';state.players=state.players.filter(p=>p.id!=='host');state.players[0].kills=6;advance();service.frame(alias,state);
 assert.equal(service.leaderboards('guest-social').kills.self.kills,6);
 state.phase='results';state.winnerId='guest';state.players[0].place=1;service.frame(alias,state);advance();service.frame(alias,state);
 assert.equal(service.leaderboards('guest-social').wins.self.wins,1);assert.equal(service.leaderboards('host-social').wins.self.wins,0);await service.close();
});

test('a score change immediately after a periodic report is counted before the host can leave',async()=>{
 const {service,host,state,advance}=publicFixture();await service.ready;service.frame(host,state);advance(.02);state.players[0].kills=1;service.frame(host,state);assert.equal(service.leaderboards('host-social').kills.self.kills,1);await service.close();
});

test('a final-only report after restart awards a real public winner once and reconciles already saved kills',async()=>{
 const {service,relay,host,state,advance}=publicFixture();await service.ready;
 state.players[0].kills=7;service.frame(host,state);
 const restored=new ProgressionService(relay,{clock:()=>200,path:null});await restored.ready;restored.accounts=new Map(structuredClone([...service.accounts]));
 state.phase='results';state.winnerId='host';state.players[0].place=1;restored.frame(host,state);restored.frame(host,state);
 assert.deepEqual(publicTotals(restored.account(host.progressId)),{version:1,kills:7,wins:1});
 const replay=new ProgressionService(relay,{clock:()=>300,path:null});await replay.ready;replay.accounts=new Map(structuredClone([...restored.accounts]));replay.frame(host,state);assert.deepEqual(publicTotals(replay.account(host.progressId)),{version:1,kills:7,wins:1});
 advance();await Promise.all([service.close(),restored.close(),replay.close()]);
});

test('a draw, private results, bots and late observers cannot receive public wins',async()=>{
 const {service,host,state,advance}=publicFixture();await service.ready;
 state.phase='results';state.players[0].place=1;state.players[0].health=0;state.players[1].place=1;state.players[1].health=0;state.winnerId=null;
 service.frame(host,state);assert.equal(service.leaderboards('host-social').wins.self.wins,0);assert.equal(service.leaderboards('guest-social').wins.self.wins,0);
 advance();service.frame({...host,id:'private',rewardPublic:false},{...state,matchId:'private-win',phase:'playing'});advance();service.frame({...host,id:'private',rewardPublic:false},{...state,matchId:'private-win',winnerId:'host'});assert.equal(service.leaderboards('host-social').wins.self.wins,0);assert.equal(service.leaderboards('viewer-social').wins.self,null);await service.close();
});

test('receipt recovery preserves larger all-time totals, includes short wins and never adds the same history twice',()=>{
 const account={publicTotals:{version:1,kills:3,wins:1},receipts:[{id:'first',mode:'royale',custom:false,eligible:true,kills:4,won:true},{id:'short',mode:'royale',custom:false,eligible:false,reason:'Match too short',kills:0,won:true}]};
 assert.deepEqual(publicTotals(account),{version:1,kills:4,wins:2});assert.deepEqual(publicTotals(account),{version:1,kills:4,wins:2});account.publicTotals.kills=90;delete account.publicHistoryReconciled;assert.equal(publicTotals(account).kills,90);
});

test('overlapping round records under the same social identity cannot duplicate a leaderboard score',()=>{
 const accounts=new Map([['a',{socialId:'same',publicTotals:{version:1,kills:8,wins:1},publicRounds:[{id:'round:1',kills:8,wins:1}]}],['b',{socialId:'same',publicTotals:{version:1,kills:10,wins:1},publicRounds:[{id:'round:1',kills:10,wins:1}]}]]);
 const board=publicLeaderboardView(rankPublicPlayers(accounts),'same');assert.equal(board.kills.total,1);assert.equal(board.kills.self.kills,10);assert.equal(board.wins.self.wins,1);
});

test('expanded rankings expose paging, counts and refresh errors without replacing saved scores with zero',()=>{
 const board={total:55,offset:25,hasMore:true,rows:[{rank:26,name:'Scout',kills:8,wins:0}],self:{rank:45,name:'You',kills:1,wins:0,you:true}},model={profile:{name:'You'},leaderboards:{kills:board},expanded:true,leaderboardError:'Disconnected'};
 const markup=leaderboardMarkup(model);assert.match(markup,/55 OPERATORS · 26–26/);assert.match(markup,/data-leaderboard-page="0"/);assert.match(markup,/data-leaderboard-page="50"/);assert.match(markup,/Showing last saved rankings/);assert.match(markup,/leaderboard-ranks-full/);assert.match(markup,/>8<\/b>/);assert.equal(markup.includes('TOP 25'),false);
});
test('public kills count during combat, win settles once, and private games cannot enter the rankings',async()=>{
 let now=0;const relay={peers:new Map(),send(){}},service=new ProgressionService(relay,{clock:()=>now,path:null});await service.ready;
 const host={id:'public',progressId:'player',ws:{},listing:{},links:new Map(),rewardPublic:true};relay.peers.set(host.id,host);
 const frame={round:1,matchId:'public-round',mode:'royale',phase:'playing',stage:'active',hostId:'host',players:[{id:'host',name:'Scout',x:0,y:0,z:0,health:100,place:1},{id:'bot-1',bot:true,x:2,y:0,z:2,health:100,place:2}],events:[{id:1,type:'elimination',player:'host',target:'bot-1'}]};
 service.frame(host,frame);now=1;service.frame(host,frame);assert.equal(publicTotals(service.account('player')).kills,1);now=2;service.frame(host,frame);assert.equal(publicTotals(service.account('player')).kills,1);now=3;service.frame(host,{...frame,phase:'results'});now=4;service.frame(host,{...frame,phase:'results'});assert.equal(publicTotals(service.account('player')).wins,1,'short legitimate rounds also count wins');
 const privateHost={...host,id:'private',rewardPublic:false};relay.peers.set(privateHost.id,privateHost);service.frame(privateHost,{...frame,matchId:'private-round'});now=5;service.frame(privateHost,{...frame,matchId:'private-round',phase:'results'});assert.deepEqual(publicTotals(service.account('player')),{version:1,kills:1,wins:1});await service.close();
});
test('rankings have deterministic ties, a top-25 cap, renamed players and a personal row below that cap without credentials',()=>{
 const accounts=new Map(Array.from({length:30},(_,i)=>['account-'+i,{socialId:'social-'+i,publicName:'Operator '+i,publicTotals:{version:1,kills:30-i,wins:i%3}}]));
 const identities=new Map([['social-29',{profile:{name:'Renamed Scout'}}]]),ranks=rankPublicPlayers(accounts,identities),board=publicLeaderboardView(ranks,'social-29');
 assert.equal(board.kills.total,30);assert.equal(board.kills.rows.length,25);assert.equal(board.kills.self.rank,30);assert.equal(board.kills.self.name,'Renamed Scout');assert.equal(board.kills.self.you,true);assert.equal(board.wins.rows[0].wins,2);assert.equal(board.wins.rows[0].kills,28);assert.equal(JSON.stringify(board).includes('account-'),false);assert.equal(JSON.stringify(board).includes('social-'),false);
});
test('totals and authenticated display identity survive a process restart beyond retained receipts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'frontier-board-')),path=join(dir,'progress.json'),relay={send(){},parties:{store:{identities:new Map([['member',{profile:{name:'Real Operator'}}]])}}};
 try{const first=new ProgressionService(relay,{path});await first.ready;const peer={progressId:'owner'};first.bindPublicPlayer(peer,'member');const p={identity:'owner',bot:false};for(let i=0;i<75;i++)first.recordPublicStat(p,'kills');first.recordPublicStat(p,'wins');first.account('owner').receipts=[];await first.close();const second=new ProgressionService(relay,{path});await second.ready;assert.equal(second.leaderboards('member').kills.self.kills,75);assert.equal(second.leaderboards('member').wins.self.wins,1);assert.equal(second.leaderboards('member').wins.self.name,'Real Operator');await second.close();}finally{await rm(dir,{recursive:true,force:true});}
});
test('two usable leaderboard tabs escape names and sit between Quality Update and Private Match',()=>{
 const profile={name:'Operator'},markup=lobbyMarkup({profile,balance:0,id:'self',online:true}),box=markup.indexOf('class="frontier-leaderboard"');assert.ok(markup.indexOf('QUALITY UPDATE')<box);assert.ok(box<markup.indexOf('CUSTOM PRIVATE MATCH'));
 const board={rows:[{rank:1,name:'<img onerror=bad>',kills:17,wins:3,you:true}],self:null},html=leaderboardMarkup({profile,leaderboardTab:'wins',leaderboards:{wins:board}});assert.match(html,/data-leaderboard-tab="kills"/);assert.match(html,/data-leaderboard-tab="wins"[^>]*aria-selected="true"/);assert.match(html,/&lt;img onerror=bad&gt;/);assert.equal(html.includes('<img onerror=bad>'),false);assert.match(html,/MAIN MATCH WINS/);
});

test('the lobby restores prior public totals with the existing private progression credential before another match',async()=>{
 const identities=new Map([['saved-social',{profile:{name:'Returning Operator'}}],['other-social',{profile:{name:'Unrelated Operator'}}]]),service=new ProgressionService({parties:{store:{identities}},send(){}},{path:null});await service.ready;
 const token='a'.repeat(32),id=service.identity(token);service.accounts.set(id,{receipts:[{id:'prior-public',mode:'royale',eligible:true,custom:false,kills:14,won:true}]});
 service.restoreLeaderboardViewer('b'.repeat(32),'other-social');assert.equal(service.leaderboards('other-social').kills.self,null);assert.equal(service.accounts.size,1,'unknown credentials do not create new accounts');
 service.restoreLeaderboardViewer(token,'saved-social');const board=service.leaderboards('saved-social');assert.equal(board.kills.self.kills,14);assert.equal(board.wins.self.wins,1);assert.equal(board.kills.self.name,'Returning Operator');service.dirty=false;service.restoreLeaderboardViewer(token,'saved-social');assert.equal(service.dirty,false,'unchanged polling does not rewrite the progression file');await service.close();
});
