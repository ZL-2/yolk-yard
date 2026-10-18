export const RANKING_MODES=Object.freeze({royale:'Frontier Royale',boxfight:'Box Fights',zonewars:'Zone Wars',zombies:'Zombies',ffa:'Free For All',training:'Training'});
export const rankingMode=value=>Object.hasOwn(RANKING_MODES,value)?value:'royale';

// A manual filter is shared by both statistics until Play changes mode.
export function syncRankingSelection(selection,playMode){
 if(!playMode)return selection;
 const mode=rankingMode(playMode);
 return selection.playMode===mode?selection:{playMode:mode,mode};
}
