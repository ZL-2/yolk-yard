import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,open,rename} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {socialDataPath} from './data-path.js';
import {ICON_POLL_ID,ICON_WINNER,ICON_CATEGORIES,iconOptionText,iconOptionKey} from '../../src/icon-voting-rules.js';
export class IconVoting{
 constructor({path=join(dirname(socialDataPath()),'icon-vote-2026-10.json'),now=()=>Date.now()}={}){
  this.path=path;this.now=now;this.chain=Promise.resolve();this.limits=new Map();let old=null;
  if(path)try{old=JSON.parse(readFileSync(path,'utf8'));if(![1,2].includes(old.schema))throw Error('Invalid voting data');}catch(e){if(e.code!=='ENOENT')this.error=Error('Voting storage needs recovery.');}
  if(old?.schema===2){if(old.pollId!==ICON_POLL_ID||!Array.isArray(old.options)||!old.ballots||typeof old.ballots!=='object'||Array.isArray(old.ballots)||!Object.values(old.ballots).every(b=>b&&typeof b==='object'&&!Array.isArray(b))||!old.options.every(o=>o&&typeof o.id==='string'&&typeof o.text==='string'&&Number.isSafeInteger(o.revision)&&ICON_CATEGORIES.some(c=>c.id===o.category)))this.error=Error('Voting storage needs recovery.');this.data=old;}
  else{if(old&&(!Array.isArray(old.candidates)||!old.votes||typeof old.votes!=='object'||Array.isArray(old.votes)))this.error=Error('Voting storage needs recovery.');this.data={schema:2,pollId:ICON_POLL_ID,openedAt:this.now(),archive:{...(old||{schema:1,candidates:[],votes:{}}),closed:true,winner:ICON_WINNER,closedAt:this.now()},options:[],ballots:{}};}
  this.ready=this.chain=!this.error&&old?.schema!==2?this.persist(this.data).catch(()=>{this.error=Error('Voting storage needs recovery.');}):Promise.resolve();
 }
 async persist(data){if(!this.path)return;await mkdir(dirname(this.path),{recursive:true});const tmp=this.path+'.tmp',file=await open(tmp,'w',0o600);try{await file.writeFile(JSON.stringify(data));await file.sync();}finally{await file.close();}await rename(tmp,this.path);}
 summary(user){
  if(this.error)throw this.error;const counts=new Map(),valid=new Map(this.data.options.map(o=>[o.id,o.category])),ballot=this.data.ballots[user]||{},answers={},categories=ICON_CATEGORIES.map(category=>{const options=this.data.options.filter(o=>o.category===category.id);if(options.some(o=>o.id===ballot[category.id]))answers[category.id]=ballot[category.id];return {...category,options};});
  for(const votes of Object.values(this.data.ballots))for(const [category,id]of Object.entries(votes))if(valid.get(id)===category)counts.set(id,(counts.get(id)||0)+1);
  return {pollId:ICON_POLL_ID,phase:'bundle',winner:ICON_WINNER,nominationClosed:true,serverNow:this.now(),closesAt:null,closed:false,answers,completed:Object.keys(answers).length,total:ICON_CATEGORIES.length,complete:ICON_CATEGORIES.every(c=>!!answers[c.id]),categories:categories.map(c=>({...c,options:c.options.map(({id,text,revision})=>({id,text,revision,votes:counts.get(id)||0}))})),// Legacy clients must refresh; never reinterpret an old nominee vote as a bundle ballot.
   vote:null,candidates:[]};
 }
 assertCanPlay(user){if(!this.summary(user).complete)throw Error('Complete all five Jim McLaughlin bundle votes before playing. Open ICON SERIES in the lobby.');}
 mutate(user,body,owner=false){
  const task=this.chain.then(async()=>{
   if(this.error)throw this.error;if(!body||body.pollId!==ICON_POLL_ID)throw Error('The original Icon Series vote has ended. Jim McLaughlin won. Refresh to vote on his bundle.');
   if(!ICON_CATEGORIES.some(c=>c.id===body.category))throw Error('Choose one of the five bundle categories.');
   const next=structuredClone(this.data),category=body.category;
   if(owner&&['edit','delete'].includes(body.action)){
    const option=next.options.find(o=>o.id===body.id&&o.category===category);if(!option)throw Error('This option no longer exists. Refresh the list.');
    if(option.revision!==body.expectedRevision)throw Error('This option changed. Refresh before editing it.');
    if(body.action==='edit'){const text=iconOptionText(body.text);if(next.options.some(o=>o.id!==option.id&&o.category===category&&iconOptionKey(o.text)===iconOptionKey(text)))throw Error('That idea already exists in this category.');option.text=text;option.revision++;}
    else{next.options=next.options.filter(o=>o.id!==option.id);for(const answers of Object.values(next.ballots))if(answers[category]===option.id)delete answers[category];}
   }else if(body.action==='nominate'){
    const text=iconOptionText(body.text),options=next.options.filter(o=>o.category===category);
    if(options.some(o=>iconOptionKey(o.text)===iconOptionKey(text)))throw Error('That idea already exists in this category. Vote for it instead.');
    if(options.length>=200||!owner&&options.filter(o=>o.creator===user).length>=5)throw Error('Option limit reached for this category. Choose an existing idea.');
    const option={id:randomUUID(),category,text,revision:1,creator:owner?'owner':user};next.options.push(option);
    if(!owner&&body.vote===true){next.ballots[user]??={};next.ballots[user][category]=option.id;}
   }else if(!owner&&body.action==='vote'){
    if(!next.options.some(o=>o.id===body.candidate&&o.category===category))throw Error('Select an existing idea in this category.');
    next.ballots[user]??={};next.ballots[user][category]=body.candidate;
   }else throw Error('Unknown voting action.');
   await this.persist(next);this.data=next;return this.summary(user);
  });this.chain=task.catch(()=>{});return task;
 }
 async handle(req,res,{origins,store}){const origin=req.headers.origin;const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});const send=(status,data)=>{res.writeHead(status,headers);res.end(JSON.stringify(data));};if(!origins.includes(origin))return send(403,{error:'Origin not allowed.'});if(req.method==='OPTIONS')return send(204,{});if(!['GET','POST'].includes(req.method))return send(405,{error:'Method not allowed.'});const token=(req.headers.authorization||'').replace(/^Bearer /,'');const user=/^[a-f0-9]{64}$/.test(token)&&store.tokens.get(createHash('sha256').update(token).digest('hex'));if(!user)return send(401,{error:'Connecting your player identity. Please retry.'});try{await this.ready;store.available();if(req.method==='GET')return send(200,this.summary(user));const now=this.now(),previous=(this.limits.get(user)||[]).filter(at=>now-at<10000);if(previous.length>=10)return send(429,{error:'Please wait a moment before trying again.'});previous.push(now);this.limits.set(user,previous);if(this.limits.size>10000)this.limits.delete(this.limits.keys().next().value);let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2048)return send(413,{error:'Request too large.'});}return send(200,await this.mutate(user,JSON.parse(text)));}catch(e){send(400,{error:e instanceof SyntaxError?'Invalid request.':e.message});}}
}
