// Shared presentation/configuration contract. Admission and the clock are owned
// by the server; a browser cannot create or configure this match.
export const PUBLIC_ROYALE=Object.freeze({code:'FRONTIER',capacity:48,difficulty:2,warmupSeconds:45,restartSeconds:10});
export const publicRoyaleOptions=()=>({mode:'royale',map:'sunnybreak',teamSize:1,teamFill:true,session:'online',capacity:PUBLIC_ROYALE.capacity,bots:PUBLIC_ROYALE.capacity-1,fill:true,difficulty:PUBLIC_ROYALE.difficulty,storm:'normal',recurring:true});
