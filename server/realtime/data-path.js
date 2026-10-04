import {readFileSync} from 'node:fs';
import {dirname,resolve,sep} from 'node:path';

export const DATA_MOUNT='/var/data/ravelfront';
// A directory in an image is not durable. Verify a separate mounted filesystem.
export function persistentMount(path,mounts){
 if(!path)return false;
 try{mounts??=readFileSync('/proc/self/mountinfo','utf8');}catch{return false;}
 const target=resolve(path);
 return mounts.split('\n').some(line=>{const mount=line.split(' ')[4]?.replace(/\\([0-7]{3})/g,(_,oct)=>String.fromCharCode(parseInt(oct,8))),type=line.split(' - ')[1]?.split(' ')[0];return mount&&mount!=='/'&&type&&!['tmpfs','devtmpfs','overlay','proc','sysfs','cgroup','cgroup2'].includes(type)&&(target===mount||target.startsWith(mount+sep))&&!['/proc','/dev','/sys'].some(p=>mount===p||mount.startsWith(p+'/'));});
}
export function socialDataPath(){
 if(process.env.RAVEL_SOCIAL_DATA_PATH)return process.env.RAVEL_SOCIAL_DATA_PATH;
 if(persistentMount(DATA_MOUNT))return DATA_MOUNT+'/social.json';
 return process.env.YOLK_OWNER_DATA_PATH?dirname(process.env.YOLK_OWNER_DATA_PATH)+'/ravelfront-social.json':'/tmp/ravelfront-social.json';
}

export function progressionDataPath(){if(process.env.RAVEL_REWARD_DATA_PATH)return process.env.RAVEL_REWARD_DATA_PATH;if(persistentMount(DATA_MOUNT))return DATA_MOUNT+'/progress.json';return process.env.YOLK_OWNER_DATA_PATH?dirname(process.env.YOLK_OWNER_DATA_PATH)+'/ravelfront-progress.json':'/tmp/ravelfront-progress.json';}
