import {Z_LOGS} from './zombies-map.js';
// Device narration is opt-in and never uses a paid/runtime AI service.
// The complete transcript remains visible if the browser has no speech voice.
export function stopBlacktideNarration(){globalThis.speechSynthesis?.cancel();}
export function narrateBlacktide(index,volume=.6){
 const synth=globalThis.speechSynthesis,text=Z_LOGS[index];
 if(!synth||!globalThis.SpeechSynthesisUtterance||!text)return false;
 synth.cancel();const utterance=new SpeechSynthesisUtterance(text.replace(' / ','. '));
 const voices=synth.getVoices(),english=voices.filter(v=>/^en[-_]/i.test(v.lang));
 utterance.voice=english.find(v=>v.localService)||english[0]||null;
 utterance.lang='en-US';utterance.rate=.92;utterance.pitch=.88;utterance.volume=Math.max(0,Math.min(1,volume));
 synth.speak(utterance);return true;
}
