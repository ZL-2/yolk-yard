// Relay UTC anchored to a monotonic timer. Device date/time/timezone never
// decides a calendar day, countdown, entry window or reward.
export function createTournamentClock(monotonic=()=>performance.now()){
 let stamp=null,received=0,valid=true;
 return {
  sync(serverNow){if(!Number.isFinite(serverNow)||serverNow<0||stamp!==null&&serverNow<stamp)return false;stamp=serverNow;received=monotonic();valid=true;return true;},
  now(){return stamp===null?null:stamp+Math.max(0,monotonic()-received);},
  get fresh(){return stamp!==null&&valid&&monotonic()-received<45000;},
  invalidate(){valid=false;}
 };
}
export const tournamentClock=createTournamentClock();
