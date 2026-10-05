import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {BOSS_VOICE_CLIPS} from '../src/boss-voice.js';
const source=process.argv[2];if(!source)throw Error('Supply the original 43-second screen recording path');
const output=new URL('../public/audio/boss-voices.mp3',import.meta.url);mkdirSync(new URL('../public/audio/',import.meta.url),{recursive:true});
const clips=Object.values(BOSS_VOICE_CLIPS),filters=clips.map((c,i)=>`[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS,highpass=f=130,lowpass=f=6500,afade=t=in:d=0.012,afade=t=out:st=${c.duration-.025}:d=0.025,apad=pad_dur=0.12[c${i}]`);
filters.push(clips.map((_,i)=>`[c${i}]`).join('')+`concat=n=${clips.length}:v=0:a=1,alimiter=limit=.7:level=false[out]`);
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',source,'-filter_complex',filters.join(';'),'-map','[out]','-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','64k',output.pathname],{stdio:'inherit'});
if(result.status)process.exit(result.status);console.log('Extracted '+clips.length+' action-matched clips into one lazy-loaded voice atlas.');
