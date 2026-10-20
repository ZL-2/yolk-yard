import {startRealtimeServer} from '../server/realtime/index.js';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import WebSocket from 'ws';
import {Network} from '../src/network.js';
import {VERSION,safeProfile} from '../src/data.js';

const out='test-results/public-match',origin='http://127.0.0.1:5262',temp=await mkdtemp(tmpdir()+'/ravel-public-ui-');
await mkdir(out,{recursive:true});
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';process.env.YOLK_OWNER_DATA_PATH=temp+'/owner.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]}),endpoint=`ws://127.0.0.1:${relay.server.address().port}`;
// Local-only ranking fixture makes unused row space and scrolling measurable.
relay.relay.progression.leaderboards=()=>{const rows=Array.from({length:25},(_,i)=>({rank:i+1,name:'Ranked Operator '+(i+1),kills:315-i*8,wins:25-i,you:i===0})),board={rows,total:76,offset:0,hasMore:true,self:rows[0]};return {kills:board,wins:board};};
const vite=await createServer({plugins:[{name:'public-match-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'${endpoint}/game'};`);});}}],server:{host:'127.0.0.1',port:5262,strictPort:true,watch:null}});await vite.listen();
const errors=[],checks={},pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const end=Date.now()+20000;while(!check()){assert.ok(Date.now()<end,label);await pause(25);}}
let browser,page,social,guest,guestState,launch,party,guestStates=0;
const trace=[];
const record=(stage,detail={})=>{const row={stage,at:new Date().toISOString(),...detail};trace.push(row);console.log(JSON.stringify(row));};
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 // Keep desktop CSS dimensions while limiting SwiftShader's pixel workload.
 page=await browser.newPage({bypassCSP:true,deviceScaleFactor:.5,viewport:{width:1280,height:720}});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ravelfront-season-1-update-150-dismissed','yes');localStorage.setItem('ravelfront-referrals-dismissed','yes');localStorage.setItem('ravelfront-perspective-157-dismissed','yes');localStorage.setItem('yolk-settings',JSON.stringify({quality:'low',volume:0,musicVolume:0}));localStorage.setItem('yolk-profile',JSON.stringify({name:'Public UI Host'}));});
 await page.goto(origin+'/?qa');await page.waitForFunction(()=>window.__yolkTest?.party().ready);await page.locator('#loading-screen').waitFor({state:'hidden'});
 relay.relay.parties.publishPublicMatch({...relay.relay.publicHost.summary(),joinSerial:1,lastJoin:{serial:1,name:'Arriving Friend',at:Date.now()}});
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#public-match-arrival').count(),0);
 assert.equal(await page.locator('.public-royale-card').count(),0);
 assert.equal(await page.locator('.lobby-news').isVisible(),true);
 assert.equal(await page.locator('.lobby-play').innerText(),'PLAY');
 assert.equal(await page.locator('.season-launch,.referral-briefing,.perspective-briefing').count(),0,'Information is in the carousel, not automatic blocking modals');
 await page.locator('[data-news-index="1"]').click();await page.locator('.lobby-news-story').click();await page.locator('.season-launch').waitFor();await page.locator('.season-close').click();
 await page.locator('[data-news-index="2"]').click();assert.match(await page.locator('.lobby-news-story').innerText(),/BRING YOUR CREW/);
 await page.locator('[data-news-pause]').click();assert.equal(await page.locator('[data-news-pause]').getAttribute('aria-pressed'),'true');
 const contrast=async()=>page.evaluate(()=>{const luminance=c=>{const a=c.match(/[\d.]+/g)?.slice(0,3).map(Number);return a?.reduce((n,v,i)=>{v/=255;return n+(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];},0);};return [...document.querySelectorAll('#dialog button:not(:disabled)')].filter(b=>b.offsetHeight&&!b.querySelector('img')&&getComputedStyle(b).backgroundColor!=='rgba(0, 0, 0, 0)').map(b=>{const c=getComputedStyle(b),a=luminance(c.color),z=luminance(c.backgroundColor);return {label:b.textContent.trim(),ratio:(Math.max(a,z)+.05)/(Math.min(a,z)+.05)};}).filter(r=>r.label&&r.ratio<4.5);});
 await page.locator('[data-action=choose-mode]').click();assert.equal(await page.locator('.lobby-discover .yard-mode-card').count(),6);assert.equal(await page.locator('.lobby-discover .coming-soon:disabled').count(),3);await page.waitForFunction(()=>[...document.querySelectorAll('.lobby-discover img')].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await page.locator('[data-mode-population]').count(),6);await page.screenshot({path:out+'/modes.png'});await page.locator('[data-experience=ffa]').click();
 await page.locator('[data-action=lobby-options]').click();assert.equal(await page.locator('#lobby-minutes').isDisabled(),true);await page.locator('#lobby-access').selectOption('private');await page.locator('#lobby-minutes').fill('7');await page.locator('#lobby-scoreLimit').fill('30');assert.deepEqual(await contrast(),[],'all enabled Match Options actions have readable text');await page.screenshot({path:out+'/private-options.png'});await page.locator('#lobby-options-form [data-action=close]').click();await page.waitForFunction(()=>window.__yolkTest.party().party.selection.minutes===7);assert.match(await page.locator('.lobby-mode-kicker').innerText(),/PRIVATE/);assert.match(await page.locator('.lobby-options-button').innerText(),/, Private/);
 await page.locator('[data-action=choose-mode]').click();await page.locator('[data-experience=royale]').click();await page.locator('[data-action=lobby-options]').click();await page.locator('#lobby-access').selectOption('public');await page.locator('#lobby-options-form [data-action=close]').click();
 const layout=async()=>page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {news:rect('.lobby-news'),play:rect('.lobby-deploy'),party:rect('.yard-party-stack'),nav:rect('.yard-nav'),footer:rect('.yard-footer'),width:innerWidth,height:innerHeight};});
 for(const [name,width,height] of [['desktop',1440,900],['laptop',1280,720]]){await page.setViewportSize({width,height});await page.waitForTimeout(120);const r=await layout();assert.ok(r.news.bottom<=r.play.y+1,`${name}: news and Play do not overlap`);assert.ok(r.party.y>=r.nav.bottom-1,`${name}: party below navigation`);assert.ok(r.play.bottom<=r.footer.y+1,`${name}: Play above footer`);assert.ok(r.play.x>=0&&r.play.right<=width,`${name}: Play in viewport`);const board=await page.locator('.frontier-board-ranks').evaluate(p=>{const r=p.getBoundingClientRect();return {height:r.height,wrapper:p.parentElement.clientHeight,visible:[...p.querySelectorAll('li')].filter(l=>{const a=l.getBoundingClientRect();return a.top>=r.top&&a.bottom<=r.bottom;}).length};});assert.ok(board.height>=board.wrapper-2,`${name}: ranks fill available height`);assert.ok(board.visible>=(height>800?6:4),`${name}: enough visible rows ${JSON.stringify(board)}`);await page.locator('.frontier-board-ranks').evaluate(p=>p.scrollTop=p.scrollHeight);assert.ok(await page.locator('.frontier-board-ranks').evaluate(p=>p.scrollTop>100));await page.locator('.frontier-board-ranks').evaluate(p=>p.scrollTop=0);await page.screenshot({path:out+'/'+name+'.png'});}
 checks.newsModeOptionsAndDesktopLayout=true;record('desktop-lobby');
 await page.setViewportSize({width:1280,height:720});
 // Add three real social members to inspect readiness above all four operators.
 const previewSockets=[];for(let i=0;i<3;i++){const u={name:'Preview Mate '+i,ws:new WebSocket(endpoint+'/social',{origin})};previewSockets.push(u);u.ws.on('open',()=>u.ws.send(JSON.stringify({type:'hello',version:VERSION,profile:safeProfile({name:u.name})})));u.ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='hello')u.id=m.id;if(m.type==='invite')u.invite=m.invite;});await until(()=>u.id,'Preview identity');if(i===0){u.ws.send(JSON.stringify({type:'presence',activity:'in-match',mode:'training'}));await page.locator('[data-action=choose-mode]').click();await page.waitForFunction(()=>document.querySelector('[data-mode-population=training] b')?.textContent==='1');u.ws.send(JSON.stringify({type:'presence',activity:'lobby'}));await page.waitForFunction(()=>document.querySelector('[data-mode-population=training] b')?.textContent==='0');await page.locator('#dialog [data-action=close]').first().click();checks.liveModeCounts=true;}const captain=await page.evaluate(()=>window.__yolkTest.party().id);const leader=relay.relay.parties.users.get(captain);relay.relay.parties.command(leader,{type:'invite',id:u.id});await until(()=>u.invite,'Preview invite');u.ws.send(JSON.stringify({type:'accept',id:u.invite.id}));await page.waitForFunction(n=>window.__yolkTest.party().party.members.length===n,i+2);if(i===0)u.ws.send(JSON.stringify({type:'ready',value:true}));}
 await page.waitForFunction(()=>document.querySelectorAll('[data-lobby-player]').length===4);await page.waitForTimeout(300);assert.equal(await page.locator('[data-lobby-player] span').count(),4);await page.screenshot({path:out+'/squad-readiness.png'});record('party-readiness');
 for(const u of previewSockets){u.ws.send(JSON.stringify({type:'leave'}));await pause(60);u.ws.terminate();}await page.waitForFunction(()=>window.__yolkTest.party().party.members.length===1);
 await page.locator('[data-action=lobby-options]').click();await page.locator('#lobby-teamSize').selectOption('1');await page.locator('#lobby-options-form [data-action=close]').click();
 await page.locator('[data-action=lobby-play]').click();
 await page.waitForFunction(()=>{const r=window.__yolkTest.read();return r.host&&r.screen==='game'&&r.state?.royale?.stage==='spawn-island';});
 await until(()=>relay.relay.publicHost.members.size===1,'Browser owns the public room');record('browser-host');
 // A real socket guest validates the actual browser host without a second GPU.
 globalThis.window={YOLK_NETWORK:{relay:endpoint+'/game'}};
 globalThis.WebSocket=class extends WebSocket{constructor(url){super(url,{origin});}};
 social=new globalThis.WebSocket(endpoint+'/social');
 social.on('open',()=>social.send(JSON.stringify({type:'hello',version:VERSION,profile:safeProfile({name:'Public UI Guest'})})));
 social.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='party')party=m.party;if(m.type==='launch')launch=m.launch;});
 await until(()=>party,'Guest lobby connected');social.send(JSON.stringify({type:'queue',publicRoyale:true,request:1}));await until(()=>launch,'Guest admitted to the same public room');assert.equal(launch.host,false);
 guest=new Network({onState:s=>{guestState=s;guestStates++;},onError:e=>errors.push(e),onStatus:s=>record('guest-status',{status:s})});await guest.join(launch.code,safeProfile({name:'Public UI Guest'}),launch.ticket);social.send(JSON.stringify({type:'joined',id:launch.id,request:2}));
 await until(()=>guestState?.players.some(p=>p.id===guest.id),'Browser sends guest state');
 const matchId=guestState.royale.matchId;assert.equal(await page.evaluate(()=>window.__yolkTest.read().state.royale.matchId),matchId);
 const before=guestState.time,beforeStates=guestStates;record('interrupt',{time:before,states:beforeStates,stage:guestState.royale.stage});guest.hostConnection.close();await until(()=>!guest.migrating&&guestStates>beforeStates&&guestState.time>before,'Guest reconnects to the browser host');record('reconnected',{time:guestState.time,states:guestStates});
 assert.equal(guestState.royale.matchId,matchId);assert.equal(guestState.players.find(p=>p.id===guest.id).lateSpectator,false);
 assert.equal(relay.relay.publicHost.members.size,2);assert.deepEqual(errors,[]);checks.actualBrowserHostAndGuest=true;checks.reconnectSameRound=true;
 await writeFile(out+'/result.json',JSON.stringify({result:'PASS',checks,errors,trace},null,2));console.log(JSON.stringify({result:'PASS',checks}));
}catch(error){record('failure',{error:String(error),states:guestStates,time:guestState?.time,migrating:guest?.migrating,closed:guest?.closed,peerClosed:guest?.peer?.destroyed,channelOpen:guest?.hostConnection?.open,public:relay.relay.publicHost.summary()});await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/result.json',JSON.stringify({error:String(error),checks,errors,trace},null,2));throw error;}
finally{guest?.destroy();social?.terminate();await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
