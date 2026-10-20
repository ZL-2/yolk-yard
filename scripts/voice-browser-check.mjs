import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {startRealtimeServer} from '../server/realtime/index.js';
const temp=await mkdtemp('/tmp/ravel-voice-'),origin='http://127.0.0.1:5318',out='test-results/voice';
process.env.RAVEL_SOCIAL_DATA_PATH=temp+'/social.json';process.env.RAVEL_REWARD_DATA_PATH=temp+'/rewards.json';
let app,vite,browser;const errors=[],checks=[];checks.push=(label)=>{console.log('PASS',label);return Array.prototype.push.call(checks,label);};
try{
 await mkdir(out,{recursive:true});
 const rate=48000,samples=rate*8,wav=Buffer.alloc(44+samples*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*7000),44+i*2);await writeFile(temp+'/tone.wav',wav);
 app=await startRealtimeServer({port:0,host:'127.0.0.1',origins:[origin],publicRoyale:false,mapPath:temp+'/maps.json',recoveryPath:null});
 const relay=`ws://127.0.0.1:${app.server.address().port}/game`;
 vite=await createServer({server:{host:'127.0.0.1',port:5318,strictPort:true,watch:null}});await vite.listen();
 browser=await chromium.launch({headless:true,...(process.env.YOLK_TEST_CHROME?{executablePath:process.env.YOLK_TEST_CHROME}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${temp}/tone.wav`]});
 const pages=[];
 for(const name of ['Voice Alpha','Voice Bravo']){const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['microphone']});const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/tests/voice-preview.html?name='+encodeURIComponent(name)+'&relay='+encodeURIComponent(relay));await page.waitForFunction(()=>window.voiceTest?.party.ready);}
 const [a,b]=pages;await a.evaluate(()=>voiceTest.party.request('privacy',{value:'open'}));const partyId=await a.evaluate(()=>voiceTest.party.party.id);await b.evaluate(id=>voiceTest.party.request('join',{id}),partyId);
 for(const p of pages){await p.locator('#voice-open').click();await p.locator('[data-voice=enable]').click();}
 for(const p of pages)await p.waitForFunction(()=>voiceTest.voice.status==='Connected'&&voiceTest.voice.members().length===2);
 assert.equal(await a.evaluate(()=>!!voiceTest.voice.stream),false);checks.push('explicit enable joins party in listen-only mode');
 await a.locator('[data-voice=mic]').click();await a.waitForFunction(()=>!!voiceTest.voice.stream);
 const before=await b.evaluate(()=>voiceTest.played);await a.waitForTimeout(350);assert.equal(await b.evaluate(()=>voiceTest.played),before,'push to talk sends no microphone audio before key');
 await a.keyboard.down('Backquote');await b.waitForFunction(n=>voiceTest.played>n+4,before);await a.keyboard.up('Backquote');checks.push('real microphone capture, encoding, forwarding and decoding with push-to-talk');
 await b.evaluate(()=>{const v=voiceTest.voice;window.voiceAnalyser=v.context.createAnalyser();v.master.connect(voiceAnalyser);voiceAnalyser.fftSize=1024;});
 await a.locator('[data-setting=method]').selectOption('open');await b.waitForFunction(()=>{const data=new Float32Array(1024);voiceAnalyser.getFloatTimeDomainData(data);return data.some(x=>Math.abs(x)>.005);});checks.push('decoded audio reaches the listener output');
 const aid=await a.evaluate(()=>voiceTest.party.id);await b.evaluate(id=>voiceTest.voice.mutePlayer(id),aid);await b.waitForTimeout(250);const muted=await b.evaluate(()=>voiceTest.played);await b.waitForTimeout(350);assert.equal(await b.evaluate(()=>voiceTest.played),muted);await b.evaluate(id=>voiceTest.voice.mutePlayer(id),aid);await b.waitForFunction(n=>voiceTest.played>n,muted);checks.push('per-player mute stops audio and can be undone');
 await b.locator('[data-voice=deafen]').click();await b.waitForTimeout(250);const deaf=await b.evaluate(()=>voiceTest.played);await b.waitForTimeout(350);assert.equal(await b.evaluate(()=>voiceTest.played),deaf);await b.locator('[data-voice=deafen]').click();await b.waitForFunction(n=>voiceTest.played>n,deaf);checks.push('deafen stops playback and microphone');
 await a.evaluate(()=>voiceTest.host('VCAB2345'));await b.evaluate(()=>voiceTest.join('VCAB2345'));for(const p of pages)await p.waitForFunction(()=>voiceTest.voice.channels.find(c=>c.id==='game')?.available);
 for(const p of pages)await p.locator('[data-channel=game]').click();await b.waitForFunction(()=>voiceTest.voice.members().length===2);checks.push('private code join enables the exact game channel');
 await a.evaluate(()=>{voiceTest.voice.opus=false;voiceTest.voice.sendSettings();});await b.waitForTimeout(300);const fallback=await b.evaluate(()=>voiceTest.played);await b.waitForFunction(n=>voiceTest.played>n+4,fallback);checks.push('PCM compatibility fallback remains audible');
 const session=app.relay.voice.sessions.get(await b.evaluate(()=>voiceTest.party.id));session.ws.terminate();await b.waitForFunction(()=>voiceTest.voice.status==='Connected'&&voiceTest.voice.ws?.readyState===1);await b.waitForTimeout(1200);const reconnected=await b.evaluate(()=>voiceTest.played);await b.waitForFunction(n=>voiceTest.played>n,reconnected);checks.push('voice reconnect restores channel without replaying old audio');
 await b.screenshot({path:out+'/voice-panel.png'});assert.deepEqual(errors,[]);await writeFile(out+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS',JSON.stringify(checks));
}catch(error){console.error(error);if(browser)for(const [i,context]of browser.contexts().entries()){const p=context.pages()[0];if(p){console.error(await p.evaluate(()=>({status:window.voiceTest?.voice.status,error:window.voiceTest?.voice.error,channels:window.voiceTest?.voice.channels,played:window.voiceTest?.played,hidden:document.hidden})).catch(()=>null));await p.screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});}}throw error;}
finally{await browser?.close();await vite?.close();await app?.close();await rm(temp,{recursive:true,force:true});}
