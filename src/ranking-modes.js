export const RANKING_MODES=Object.freeze({royale:'Frontier Royale',boxfight:'Box Fights',zonewars:'Zone Wars',zombies:'Zombies',ffa:'Free For All',training:'Training'});
export const rankingMode=value=>Object.hasOwn(RANKING_MODES,value)?value:'royale';
