// Shared presentation/configuration contract. The relay reserves admission and elects a browser host.
// That host owns the clock and simulation; public rules remain fixed.
export const PUBLIC_ROYALE=Object.freeze({code:'FRONTIER',capacity:48,difficulty:2,warmupSeconds:30,restartSeconds:10});
export const publicRoyaleOptions=()=>({mode:'royale',map:'sunnybreak',teamSize:1,teamFill:true,session:'online',capacity:PUBLIC_ROYALE.capacity,bots:PUBLIC_ROYALE.capacity-1,fill:true,difficulty:PUBLIC_ROYALE.difficulty,storm:'normal',recurring:true});
