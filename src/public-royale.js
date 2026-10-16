// Shared presentation/configuration contract. The relay reserves admission and elects a browser host.
// That host owns the clock and simulation; public rules remain fixed.
export const PUBLIC_ROYALE=Object.freeze({code:'FRONTIER',capacity:48,difficulty:2,warmupSeconds:30,restartSeconds:10});
export const isPublicCode=code=>code===PUBLIC_ROYALE.code||/^RF[A-HJ-NP-Z2-9]{6}$/.test(code||'');
export const publicRoyaleOptions=(selection={})=>({mode:'royale',map:'sunnybreak',teamSize:[2,4].includes(selection.teamSize)?selection.teamSize:1,teamFill:true,session:'online',capacity:PUBLIC_ROYALE.capacity,bots:PUBLIC_ROYALE.capacity-1,fill:true,difficulty:PUBLIC_ROYALE.difficulty,storm:'normal',building:true,recurring:true});
export const publicMatchOptions=(selection={})=>selection.mode==='ffa'?{mode:'ffa',map:'yard',teamSize:1,teamFill:true,session:'online',capacity:8,bots:7,fill:true,difficulty:2,minutes:5,scoreLimit:25,weaponPool:'all',recurring:true}:publicRoyaleOptions(selection);
export const publicPoolKey=options=>`${options.mode}:${options.mode==='royale'?options.teamSize||1:1}`;
