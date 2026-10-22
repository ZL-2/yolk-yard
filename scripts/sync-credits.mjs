// Keep distributed notices synchronized with the installed, locked runtime tree.
import {readFile,readdir,writeFile,copyFile} from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8')),sections=[];
for(const [path,pkg]of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b))){
 if(!path||pkg.dev||pkg.link)continue;
 const manifest=JSON.parse(await readFile(path+'/package.json','utf8'));
 const names=(await readdir(path)).filter(n=>/^(licen[cs]e|copying|copyright|notice)(\.|$)/i.test(n));
 if(!names.length)throw Error('Missing license text: '+path);
 let notices=[];for(const n of names){try{notices.push((await readFile(path+'/'+n,'utf8')).trim());}catch(error){if(error.code!=='EISDIR')throw error;}}
 if(!notices.length)throw Error('Empty license text: '+path);
 sections.push(`## ${manifest.name} ${manifest.version}\n\nLicense: ${manifest.license||pkg.license||'See notice'}\n\n\`\`\`text\n${notices.join('\n\n')}\n\`\`\`\n`);
}
const text='# Third-party software notices\n\nLocked production dependencies, including browser and relay packages and their transitive dependencies. Original game assets and third-party media have separate credits in CREDITS.txt.\n\n'+sections.join('\n');
await writeFile('THIRD_PARTY.md',text);await writeFile('public/THIRD_PARTY.txt',text);await copyFile('LICENSE','public/LICENSE.txt');
console.log(`Updated notices for ${sections.length} runtime packages.`);
