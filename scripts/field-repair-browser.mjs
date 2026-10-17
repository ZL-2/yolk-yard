import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {startRealtimeServer} from '../server/realtime/index.js';
const out='test-results/field-repair',origin='http://127.0.0.1:5283',temp=await mkdtemp(tmpdir()+'/field-repair-');await mkdir(out,{recursive:true});
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/progress.json';
const relay=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin]}),vite=await createServer({plugins:[{name:'repair-local-relay',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/network-config.js')return next();res.setHeader('Content-Type','text/javascript');res.end(`window.YOLK_NETWORK={relay:'ws://127.0.0.1:${relay.server.address().port}/game'};`);});}}],server:{host:'127.0.0.1',port:5283,strictPort:true,watch:null}});await vite.listen();
let browser;const pages=[],errors=[],checks={};
async function player(name){const p=await browser.newPage({bypassCSP:true,viewport:{width:1440,height:900}});pages.push(p);p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.stack||e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|Shader Error|INVALID_OPERATION/.test(m.text()))errors.push(m.text());});await p.addInitScript(name=>{localStorage.setItem('yolk-profile',JSON.stringify({name}));localStorage.setItem('yolk-settings',JSON.stringify({quality:'high',volume:0,musicVolume:0,perspective:'third'}));},name);await p.goto(origin+'/?qa');await p.waitForFunction(()=>window.__yolkTest?.party().ready);await p.locator('#loading-screen').waitFor({state:'hidden'});return p;}
const shot=(p,name)=>p.screenshot({path:out+'/'+name+'.png',animations:'disabled',fullPage:name==='reloads-and-terrain'});
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const host=await player('Repair Captain'),guest=await player('Repair Partner');
 await host.locator('.lobby-chat-toggle').click();await guest.locator('.lobby-chat-toggle').click();await host.locator('.lobby-chat-form input').fill('Welcome to the lobby');await host.locator('.lobby-chat-form button').click();await guest.getByText('Welcome to the lobby',{exact:true}).waitFor();
 const hostId=await host.evaluate(()=>window.__yolkTest.party().id),guestId=await guest.evaluate(()=>window.__yolkTest.party().id);
 await host.evaluate(()=>window.__yolkTest.social('privacy',{value:'open'}));const partyId=await host.evaluate(()=>window.__yolkTest.party().party.id);await guest.evaluate(id=>window.__yolkTest.social('join',{id}),partyId);
 await host.waitForFunction(id=>[...document.querySelector('.lobby-chat-panel select').options].some(o=>o.value==='private:'+id),guestId);await host.locator('.lobby-chat-panel select').selectOption('private:'+guestId);await guest.locator('.lobby-chat-panel select').selectOption('private:'+hostId);
 await host.locator('.lobby-chat-form input').fill('Ready for arena');await host.locator('.lobby-chat-form button').click();await guest.getByText('Ready for arena',{exact:true}).waitFor();await shot(host,'lobby-chat');checks.privateChat=true;
 const store=relay.relay.parties.store,request=store.featureRequest(hostId,'Please fix the Arena camera');store.featureInbox('reply',request.id,false,'The Arena camera now uses the correct map. Thank you for the report.');store.featureInbox('completed',request.id);await store.flush();relay.relay.parties.send(relay.relay.parties.users.get(hostId),{type:'feature-updates',updates:store.featureUpdates(hostId)});
 await host.locator('.feature-update').waitFor({state:'visible'});await shot(host,'feature-response');await host.locator('.feature-update button').click();await host.getByText('YOUR REQUEST IS COMPLETE',{exact:true}).waitFor();await host.locator('.feature-update button').click();await host.locator('.feature-update').waitFor({state:'hidden'});checks.replyAndCompletion=true;
 await guest.close();await host.evaluate(()=>window.__yolkTest.startFixture({mode:'ffa',map:'yard',capacity:8,bots:1,fill:false,minutes:10}));await host.locator('#loading-screen').waitFor({state:'hidden'});
 await host.evaluate(()=>window.__yolkTest.fixture(s=>{for(const p of s.players.values()){p.x=-34;p.z=-34;p.y=0;p.yaw=0;p.pitch=0;p.shieldUntil=s.time+1000;p.nextShot=s.time+1000;}s.options.training=true;}));
 await host.waitForFunction(()=>window.__yolkTest.perspective().active&&window.__yolkTest.repairView().third>2.5);await shot(host,'arena-third-person');checks.arenaThirdPerson=await host.evaluate(()=>window.__yolkTest.repairView());
 await host.evaluate(()=>{const s=window.__yolkTest.read().state,k=s.players.find(p=>p.id!==window.__yolkTest.read().localId);window.__yolkTest.watch(k.id);});await host.waitForFunction(()=>window.__yolkTest.repairView().boom>2.8);await shot(host,'arena-spectator');checks.arenaSpectator=await host.evaluate(()=>window.__yolkTest.repairView());
 await host.goto(origin+'/tests/field-repair-preview.html');await host.waitForFunction(()=>window.ready,null,{timeout:90000});await shot(host,'reloads-and-terrain');checks.preview=await host.evaluate(()=>window.checks);assert.deepEqual(errors,[]);
 await writeFile(out+'/browser.json',JSON.stringify({checks,errors,note:'Desktop Chromium; software GPU rendering checks, not hardware FPS estimates.'},null,2));console.log('PASS desktop chat, saved notifications, Arena cameras, reload mechanisms, terrain shaders and loading artwork');
}finally{await browser?.close();await vite.close();await relay.close();await rm(temp,{recursive:true,force:true});}
