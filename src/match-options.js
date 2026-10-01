import {MAX_CONTESTANTS,DEFAULT_CONTESTANTS} from './royale-phases.js';
import {mode} from './data.js';
import {getMap} from './maps.js';
const integer=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
export function matchOptions(options={}) {
 const m=mode(options.mode);
 if(m.id==='royale') return {map:'sunnybreak',mode:'royale',teamSize:[2,4].includes(options.teamSize)?options.teamSize:1,teamFill:(options.teamFill??options.duoFill)!==false,duoFill:(options.teamFill??options.duoFill)!==false,session:options.session==='offline'?'offline':'online',bots:integer(options.bots,DEFAULT_CONTESTANTS-1,options.session==='offline'?1:0,MAX_CONTESTANTS-1),difficulty:integer(options.difficulty,2,1,4),minutes:0,scoreLimit:1,capacity:integer(options.capacity,DEFAULT_CONTESTANTS,2,MAX_CONTESTANTS),storm:options.storm==='quick'?'quick':'normal',fill:!!options.fill,recurring:options.recurring===true};
 return {map:getMap(options.map==='sunnybreak'?'yard':options.map).id,mode:m.id,teamSize:1,bots:integer(options.bots,0,0,7),difficulty:integer(options.difficulty,2,1,4),minutes:integer(options.minutes,5,1,60),scoreLimit:integer(options.scoreLimit,m.limit,1,1000),capacity:8,fill:!!options.fill};
}
export const targetLabel=()=> 'Eliminations to win';
