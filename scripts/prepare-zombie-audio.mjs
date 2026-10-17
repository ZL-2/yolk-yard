import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=process.argv[2];if(!root)throw Error('Pass the artisticdude CC0 recording directory.');
mkdirSync('public/audio/blacktide',{recursive:true});
for(let i=1;i<=12;i++)execFileSync('ffmpeg',['-y','-v','error','-i',root+'/zombie-'+i+'.wav','-ac','1','-ar','24000','-af','loudnorm=I=-22:TP=-3:LRA=8','-c:a','libvorbis','-q:a','2','public/audio/blacktide/voice-'+i+'.ogg']);
