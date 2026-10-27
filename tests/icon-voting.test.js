import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {IconVoting} from '../server/realtime/icon-voting.js';
import {ICON_POLL_ID,ICON_WINNER,ICON_CATEGORIES,ICON_BUNDLE_VOTE_CLOSED,iconOptionText} from '../src/icon-voting-rules.js';
import {fixture} from './helpers/public-match.js';
const command=(action,category,extra={})=>({pollId:ICON_POLL_ID,action,category,...extra});
const saved=()=>({schema:2,pollId:ICON_POLL_ID,archive:{schema:1,votes:{a:'jim'},candidates:[{id:'jim',first:'Jim',last:'McLaughlin'}],closed:true,winner:ICON_WINNER},options:ICON_CATEGORIES.map(c=>({id:c.id+'-option',category:c.id,text:'Saved '+c.label,revision:1,creator:'a'})),ballots:{a:Object.fromEntries(ICON_CATEGORIES.map(c=>[c.id,c.id+'-option'])),b:{pickaxe:'pickaxe-option'}}});

test('the finished bundle vote releases new, partial and completed players without inventing answers',async()=>{
 assert.equal(ICON_BUNDLE_VOTE_CLOSED,true);const v=new IconVoting({path:null});await v.ready;v.data=saved();
 for(const id of ['a','b','new']){const s=v.summary(id);assert.equal(s.closed,true);assert.equal(s.complete,true);assert.equal(s.phase,'archived');assert.equal(s.winner,ICON_WINNER);assert.equal(v.assertCanPlay(id),true);}
 assert.equal(v.summary('a').completed,5);assert.equal(v.summary('b').completed,1);assert.equal(v.summary('new').completed,0);assert.equal(v.summary().categories[0].options[0].votes,2);
});

test('stored ballots and original nomination history remain byte-for-byte intact across restart',async()=>{
 const dir=await mkdtemp(tmpdir()+'/bundle-archive-');try{const path=dir+'/poll.json',raw=JSON.stringify(saved());await writeFile(path,raw);const v=new IconVoting({path});await v.ready;
  for(const owner of [false,true])for(const action of ['vote','nominate','edit','delete'])await assert.rejects(v.mutate('a',command(action,'pickaxe',{candidate:'pickaxe-option',id:'pickaxe-option',expectedRevision:1,text:'Changed'}),owner),/ended/);
  assert.equal(await readFile(path,'utf8'),raw);assert.deepEqual(v.data,saved());assert.equal(new IconVoting({path}).summary('new').complete,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('original nominations migrate to an archive and do not gate play',async()=>{
 const dir=await mkdtemp(tmpdir()+'/bundle-migration-');try{const path=dir+'/poll.json',old={schema:1,candidates:[{id:'jim',first:'Jim',last:'McLaughlin',creator:'a'}],votes:{a:'jim'}};await writeFile(path,JSON.stringify(old));const v=new IconVoting({path});await v.ready;
  assert.equal(v.summary('a').closed,true);assert.equal(v.summary('a').completed,0);assert.equal(v.summary('a').complete,true);const disk=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(disk.archive.votes,old.votes);assert.deepEqual(disk.archive.candidates,old.candidates);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('damaged voting storage cannot prevent play and is never overwritten',async()=>{
 const dir=await mkdtemp(tmpdir()+'/bundle-damage-');try{const path=dir+'/vote.json',raw=JSON.stringify({schema:2,pollId:ICON_POLL_ID,options:[],ballots:'invalid'});await writeFile(path,raw);const v=new IconVoting({path});await v.ready;
  assert.equal(v.assertCanPlay('new'),true);assert.throws(()=>v.summary(),/recovery/);await assert.rejects(v.mutate('new',command('vote','pickaxe')),/ended/);assert.equal(await readFile(path,'utf8'),raw);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('real social clients can ready and queue without voting; stale vote writes are rejected',async()=>{
 const f=await fixture();try{const u=await f.user('Bundle Tester',{voted:false});const summary=await u.ask('icon-voting');assert.equal(summary.closed,true);assert.equal(summary.complete,true);
  await assert.rejects(u.ask('icon-voting',{body:command('nominate','pickaxe',{text:'Stale client idea'})}),/ended/);
  await u.ask('ready',{value:true});await u.ask('queue');assert.ok(u.launches.length);
  assert.equal(f.app.relay.iconVoting.summary(u.id).completed,0);
 }finally{await f.close();}
});

test('owner can read archived results but cannot modify them through HTTP',async()=>{
 const origin='https://zl-2.github.io',code='89271406539284756012',f=await fixture({serverOptions:{ownerCode:code}});try{const url='http://127.0.0.1:'+f.app.server.address().port+'/owner/',post=async(path,body)=>{const r=await fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  assert.equal((await post('icon-voting',{action:'list'})).status,401);const token=(await post('login',{code})).data.token;const s=await post('icon-voting',{token,action:'list'});assert.equal(s.status,200);assert.equal(s.data.closed,true);
  const edit=await post('icon-voting',{token,...command('nominate','pickaxe',{text:'New owner option'})});assert.ok(edit.status>=400);assert.match(edit.data.error,/ended/);
 }finally{await f.close();}
});

test('a Cup team with no saved bundle answers can enter the event',async()=>{
 const {TOURNAMENT}=await import('../src/tournament.js'),E={...TOURNAMENT,id:'bundle-ended-cup',code:'BNDLCUP2',teamSize:2,capacity:8};let now=E.opensAt;
 const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
  const a=await f.user('Cup Leader',{voted:false}),b=await f.user('Cup Mate',{voted:false}),p=f.app.relay.parties;p.join(p.users.get(b.id),p.users.get(a.id).party);
  await a.ask('tournament-join',{eventId:E.id});assert.equal(f.app.relay.tournament.active.entryTeams.size,2);assert.ok(p.users.get(a.id).ticket);assert.ok(p.users.get(b.id).ticket);
 }finally{await f.close();}
});

test('retired browser entry points create no dialog, polling timer, or network dependency',async()=>{
 const ui=await import('../src/icon-voting-ui.js');assert.equal(await ui.requireIconVote(),true);
 const [main,lobby]=await Promise.all(['src/main.js','src/lobby-ui.js'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));assert.ok(!main.includes('requireIconVote'));assert.ok(!lobby.includes('data-icon-vote'));
});

test('archived filter semantics stay compatible with existing stored data',()=>{
 for(const s of ['Hellfire glider','Damn cool gold wrap','Jim’s lucky #23 bat','Neon laser gun','Silly goose backpack 😂','Crap cannon','Assassin wings','Cockpit glider'])assert.equal(iconOptionText(s),s);
 for(const s of ['f u c k','sh1t trail','N1GG3R wrap','nudes of Jim','kill Jim','<img src=x>','www.example.com','a@b.com','xx'])assert.throws(()=>iconOptionText(s),s);
});
