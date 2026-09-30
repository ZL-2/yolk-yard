import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {socialDataPath} from './data-path.js';
// Persist the update latch across the disk-backed service's mandatory restart.
// Recovery requires both the frontend and this exact relay build to be ready.
export class DeploymentStatus{
 constructor(relay,{build=process.env.RENDER_GIT_COMMIT,version,path=process.env.RENDER_GIT_COMMIT?dirname(socialDataPath())+'/deployment.json':null,fetcher=fetch}={}){
  Object.assign(this,{relay,build,version,path,fetcher});this.state={updating:false,build,version};this.ready=this.restore();
 }
 async restore(){if(this.path)try{this.state={...JSON.parse(await readFile(this.path,'utf8')),build:this.build,version:this.version};}catch{}return this;}
 snapshot(){return {...this.state,build:this.build||null,version:this.version,at:Date.now()};}
 async set(updating,targetVersion=this.version){
  const changed=this.state.updating!==updating||this.state.targetVersion!==targetVersion;
  this.state={...this.state,updating,targetVersion,startedAt:updating?(this.state.startedAt||Date.now()):null,build:this.build,version:this.version};
  if(!changed)return;
  const message={type:'deployment',deployment:this.snapshot()};for(const peer of this.relay.peers.values())this.relay.send(peer,message);for(const u of this.relay.parties.users.values())this.relay.parties.send(u,message);
  if(this.path){const content=JSON.stringify(this.state);this.writeQueue=(this.writeQueue||Promise.resolve()).catch(()=>{}).then(async()=>{await mkdir(dirname(this.path),{recursive:true});await writeFile(this.path+'.tmp',content,{mode:0o600});await rename(this.path+'.tmp',this.path);});await this.writeQueue;}
 }
 async check(){
  if(!this.build||this.checking)return;this.checking=true;
  try{
   const get=async url=>{const r=await this.fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Publishing unavailable');return r.json();};
   const latest=await get('https://raw.githubusercontent.com/ZL-2/yolk-yard/main/package.json?t='+Date.now());
   if(latest.version!==this.version){await this.set(true,latest.version);return;}
   const front=await get('https://zl-2.github.io/yolk-yard/version.json?t='+Date.now());
   if(front.build!==this.build||front.appVersion!==this.version){await this.set(true,latest.version);return;}
   if(this.relay.parties.store.storage().available)await this.set(false,this.version);
  }catch{ /* A failed probe never clears a previously announced update. */ }
  finally{this.checking=false;}
 }
 start(){if(!this.build)return;void this.check();this.timer=setInterval(()=>void this.check(),10000);this.timer.unref?.();}
 close(){clearInterval(this.timer);}
}
