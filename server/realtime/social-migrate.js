import {existsSync} from 'node:fs';
import {mkdir,open} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SocialStore} from './social-store.js';
import {persistentMount} from './data-path.js';

export async function migrateSocialFile(source,destination,{requireMount=true}={}){
 if(resolve(source)===resolve(destination))throw Error('Source and destination must differ.');
 if(!existsSync(source)&&!existsSync(source+'.bak'))throw Error('No saved social data found.');
 if(existsSync(destination)||existsSync(destination+'.bak'))throw Error('Destination already contains social data; refusing to overwrite it.');
 if(requireMount&&!persistentMount(destination))throw Error('Destination is not on a persistent filesystem mount.');
 const store=new SocialStore(source),snapshot=store.snapshot(),json=JSON.stringify(snapshot);
 await mkdir(dirname(destination),{recursive:true});
 for(const path of [destination,destination+'.bak']){const file=await open(path,'wx',0o600);try{await file.writeFile(json);await file.sync();}finally{await file.close();}}
 const dir=await open(dirname(destination),'r');try{await dir.sync();}finally{await dir.close();}
 const restored=new SocialStore(destination);if(!restored.storage().available||restored.identities.size!==store.identities.size)throw Error('Migration verification failed. Original data is intact.');
 return {identities:restored.identities.size,friendships:snapshot.friends.reduce((n,[,list])=>n+list.length,0)/2,requests:restored.requests.size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [source,destination]=process.argv.slice(2);
 if(!source||!destination){console.error('Usage: node server/realtime/social-migrate.js SOURCE DESTINATION');process.exitCode=1;}
 else try{console.log('Social migration verified:',JSON.stringify(await migrateSocialFile(source,destination)));}catch(e){console.error(e.message);process.exitCode=1;}
}
