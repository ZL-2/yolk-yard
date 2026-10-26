import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {IconVoting} from '../server/realtime/icon-voting.js';
import {ICON_POLL_ID,ICON_WINNER,ICON_CATEGORIES,iconOptionText} from '../src/icon-voting-rules.js';
import {seedBundleVote,completeBundleVote} from './helpers/icon-vote.js';
import {fixture} from './helpers/public-match.js';
const command=(action,category,extra={})=>({pollId:ICON_POLL_ID,action,category,...extra});
test('old nominations are closed and archived durably; their votes never satisfy the five new questions',async()=>{
 const dir=await mkdtemp(tmpdir()+'/bundle-migration-');try{const path=dir+'/poll.json',old={schema:1,candidates:[{id:'jim',first:'Jim',last:'McLaughlin',creator:'a'}],votes:{a:'jim'}};await writeFile(path,JSON.stringify(old));const v=new IconVoting({path});await v.ready;const s=v.summary('a');assert.equal(s.winner,ICON_WINNER);assert.equal(s.nominationClosed,true);assert.equal(s.completed,0);assert.equal(s.complete,false);assert.equal(s.closesAt,null);assert.deepEqual(s.categories.map(c=>c.id),['pickaxe','wrap','back','glider','trail']);const disk=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(disk.archive.votes,old.votes);assert.deepEqual(disk.archive.candidates,old.candidates);assert.equal(disk.archive.closed,true);assert.equal(new IconVoting({path}).summary('a').winner,'Jim McLaughlin');await assert.rejects(v.mutate('a',{action:'vote',candidate:'jim'}),/ended/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('bundle filter is lighter than chat without allowing severe language, threats or markup',()=>{
 for(const s of ['Hellfire glider','Damn cool gold wrap','Jim’s lucky #23 bat','Neon laser gun','Silly goose backpack 😂','Crap cannon','Assassin wings','Cockpit glider'])assert.equal(iconOptionText(s),s);
 for(const s of ['f u c k','sh1t trail','N1GG3R wrap','nudes of Jim','kill Jim','<img src=x>','www.example.com','a@b.com','xx'])assert.throws(()=>iconOptionText(s),s);
 assert.equal(iconOptionText('  Bright   sparks  '),'Bright sparks');assert.throws(()=>iconOptionText('x'.repeat(101)));
});
test('all five answers are required; one vote per category can be replaced and survives restart',async()=>{
 const dir=await mkdtemp(tmpdir()+'/bundle-ballot-');try{const path=dir+'/poll.json',v=new IconVoting({path});await seedBundleVote(v);for(const [i,c]of v.summary('a').categories.entries()){assert.throws(()=>v.assertCanPlay('a'),/five/);await v.mutate('a',command('vote',c.id,{candidate:c.options[0].id}));assert.equal(v.summary('a').completed,i+1);}v.assertCanPlay('a');await v.mutate('b',command('nominate','pickaxe',{text:'Golden baseball bat'}));const option=v.summary().categories[0].options[1];await v.mutate('a',command('vote','pickaxe',{candidate:option.id}));await v.mutate('a',command('vote','pickaxe',{candidate:option.id}));assert.deepEqual(v.summary().categories[0].options.map(o=>o.votes),[0,1]);assert.equal(new IconVoting({path}).summary('a').complete,true);assert.equal(v.summary('b').completed,0);assert.equal(v.summary('new').complete,false);}finally{await rm(dir,{recursive:true,force:true});}
});
test('add-and-vote is atomic, duplicate ideas normalize punctuation, and categories remain independent',async()=>{
 const v=new IconVoting({path:null});const results=await Promise.allSettled([v.mutate('a',command('nominate','pickaxe',{text:'Neon Bat!',vote:true})),v.mutate('b',command('nominate','pickaxe',{text:'neon-bat',vote:true}))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(v.summary().categories[0].options.length,1);assert.equal(Object.values(v.data.ballots).length,1);await v.mutate('b',command('nominate','back',{text:'Neon Bat!'}));await assert.rejects(v.mutate('a',command('vote','back',{candidate:v.summary().categories[0].options[0].id})),/category/);await assert.rejects(v.mutate('a',command('nominate','outfit',{text:'Cool suit'})),/five/);
});
test('owner edits preserve votes, stale revisions fail, and deletes invalidate only the affected category',async()=>{
 const v=new IconVoting({path:null});await completeBundleVote(v,'a');await completeBundleVote(v,'b');const o=v.summary().categories[0].options[0],edit=command('edit','pickaxe',{id:o.id,expectedRevision:o.revision,text:'Jim’s gold bat'});await assert.rejects(v.mutate('a',edit),/Unknown/);await v.mutate(null,edit,true);assert.equal(v.summary('a').complete,true);assert.equal(v.summary().categories[0].options[0].votes,2);await assert.rejects(v.mutate(null,edit,true),/changed/);await v.mutate(null,command('delete','pickaxe',{id:o.id,expectedRevision:2}),true);assert.equal(v.summary('a').completed,4);assert.equal(v.summary('b').completed,4);assert.equal(v.summary('a').answers.wrap,v.summary('b').answers.wrap);assert.throws(()=>v.assertCanPlay('a'),/five/);await v.mutate('a',command('nominate','pickaxe',{text:'New golden bat',vote:true}));v.assertCanPlay('a');assert.equal(v.summary('b').complete,false);
});
test('rejected and failed writes never change votes or unlock play',async()=>{
 const v=new IconVoting({path:null});await seedBundleVote(v);const before=JSON.stringify(v.data);v.persist=async()=>{throw Error('Disk unavailable');};await assert.rejects(v.mutate('a',command('nominate','trail',{text:'Neon mist',vote:true})),/Disk/);assert.equal(JSON.stringify(v.data),before);assert.equal(v.summary('a').completed,0);
});
test('nomination limits apply per player and category; owner can add further curated options',async()=>{
 const v=new IconVoting({path:null});for(let i=0;i<5;i++)await v.mutate('a',command('nominate','glider',{text:'Glider idea '+i}));await assert.rejects(v.mutate('a',command('nominate','glider',{text:'Sixth glider'})),/limit/);await v.mutate(null,command('nominate','glider',{text:'Owner curated glider'}),true);await v.mutate('a',command('nominate','wrap',{text:'Golden zigzag'}));
});
test('real social ready, queue and spectate entry require all five saved answers and identity cannot be spoofed',async()=>{
 const f=await fixture();try{const u=await f.user('Bundle Tester',{voted:false});await assert.rejects(u.ask('ready',{value:true}),/five/);await assert.rejects(u.ask('queue'),/five/);await assert.rejects(u.ask('spectate-friend',{id:'unknown'}),/five/);const c=f.app.relay.iconVoting.summary().categories[0];if(!c.options.length)await seedBundleVote(f.app.relay.iconVoting);const pick=f.app.relay.iconVoting.summary().categories[0].options[0];await u.ask('icon-voting',{body:command('vote','pickaxe',{candidate:pick.id,user:'spoofed'})});assert.equal(f.app.relay.iconVoting.summary(u.id).completed,1);assert.equal(f.app.relay.iconVoting.summary('spoofed').completed,0);await assert.rejects(u.ask('icon-voting',{body:command('delete','pickaxe',{id:pick.id,expectedRevision:1})}),/Unknown/);await completeBundleVote(f.app.relay.iconVoting,u.id);await u.ask('ready',{value:true});await u.ask('queue');assert.ok(u.launches.length);}finally{await f.close();}
});
test('owner HTTP endpoint authenticates and edits all five categories with audit records',async()=>{
 const origin='https://zl-2.github.io',code='89271406539284756012',f=await fixture({serverOptions:{ownerCode:code}});try{const url='http://127.0.0.1:'+f.app.server.address().port+'/owner/',post=async(path,body)=>{const r=await fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};assert.equal((await post('icon-voting',{action:'list'})).status,401);const token=(await post('login',{code})).data.token;
  for(const c of ICON_CATEGORIES){let r=await post('icon-voting',{token,...command('nominate',c.id,{text:'Owner '+c.label})});assert.equal(r.status,200);const o=r.data.categories.find(v=>v.id===c.id).options[0];r=await post('icon-voting',{token,...command('edit',c.id,{id:o.id,expectedRevision:o.revision,text:'Golden '+c.label})});assert.equal(r.status,200);assert.equal(r.data.categories.find(v=>v.id===c.id).options[0].text,'Golden '+c.label);}
  assert.ok(f.app.owner.db.all("SELECT * FROM events WHERE kind='icon-vote-edit'").length>=5);
 }finally{await f.close();}
});

test('Cup teams and Cup spectators cannot bypass the bundle prerequisite; stale unclaimed tickets cannot bypass deletion',async()=>{
 const {TOURNAMENT}=await import('../src/tournament.js'),E={...TOURNAMENT,id:'bundle-test-cup',code:'BNDLCUP2',teamSize:2,capacity:8};let now=E.opensAt;
 const f=await fixture({serverOptions:{tournamentOptions:{events:[E],now:()=>now,autoStart:false}}});try{
  const a=await f.user('Cup Vote Leader'),b=await f.user('Cup Vote Mate',{voted:false}),p=f.app.relay.parties;p.join(p.users.get(b.id),p.users.get(a.id).party);
  await assert.rejects(a.ask('tournament-join',{eventId:E.id}),/five/);assert.equal(p.tickets.size,0);await assert.rejects(b.ask('tournament-join',{eventId:E.id,spectate:true}),/five/);
  await completeBundleVote(f.app.relay.iconVoting,b.id);await a.ask('tournament-join',{eventId:E.id});assert.equal(f.app.relay.tournament.active.entryTeams.size,2);
  const v=f.app.relay.iconVoting,o=v.summary().categories[0].options[0],ticket=p.users.get(a.id).ticket;await v.mutate(null,command('delete','pickaxe',{id:o.id,expectedRevision:o.revision}),true);const {VERSION}=await import('../src/data.js');assert.equal(p.claim(ticket,'unclaimed-player','yolk-yard-v'+VERSION+'-'+E.code),null);assert.equal(v.summary(a.id).completed,4);
 }finally{await f.close();}
});
test('damaged voting data is not overwritten by migration',async()=>{
 const dir=await mkdtemp(tmpdir()+'/bundle-damage-');try{const path=dir+'/vote.json',raw=JSON.stringify({schema:2,pollId:ICON_POLL_ID,options:[],ballots:'invalid'});await writeFile(path,raw);const v=new IconVoting({path});await v.ready;assert.throws(()=>v.summary(),/recovery/);assert.equal(await readFile(path,'utf8'),raw);}finally{await rm(dir,{recursive:true,force:true});}
});
