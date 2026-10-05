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
 const account={receipts:[publicReceipt,publicReceipt,{...publicReceipt,id:'private',custom:true},{...publicReceipt,id:'arena',mode:'ffa'},{...publicReceipt,id:'idle',eligible:false}]};
 assert.deepEqual(publicTotals(account),{version:1,kills:7,wins:1});account.receipts=[];assert.equal(publicTotals(account).kills,7);
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
