export const ICON_CLOSES_AT=Date.parse('2026-10-27T15:15:00-04:00');
export function iconName(value){
 if(typeof value!=='string')throw Error('Enter a first and last name.');
 const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');
 if(!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(name)||[...name.replace(/[^\p{L}]/gu,'')].length<3||name.length>40)throw Error('First and last names must each contain at least three letters (40 characters maximum).');
 return name;
}
export const nameKey=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}]/gu,'');
function near(a,b){if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next[j+1]=Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]!==b[j]));row=next;}return row[b.length]<=1;}
export function duplicateCandidate(list,first,last){const f=nameKey(first),l=nameKey(last);return list.find(c=>{const a=nameKey(c.first),b=nameKey(c.last);return f+l===a+b||f===b&&l===a||near(f,a)&&near(l,b);});}
