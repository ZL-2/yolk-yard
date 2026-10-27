import {JIM_NORMAL,JIM_GOLF} from '../../src/jim-catalog.js';
export function jimStyleRecord(relay,id){const identity=relay.parties?.store?.identities.get(id);return {identity:id,unlocked:!!identity?.jimGolfUnlocked,pending:!!identity?.jimGolfUnlocked&&!identity.jimGolfSeen,owned:identity?.jimGolfUnlocked?[JIM_GOLF]:[]};}
export function syncJimStyle(relay,id){const record=jimStyleRecord(relay,id);relay.parties?.send?.(relay.parties.users?.get(id),{type:'jim-style',record});return record;}
export function grantJimStyle(relay,id,{won,outfit,afkRemoved=false,spectator=false}={}){if(!id||!won||afkRemoved||spectator||![JIM_NORMAL,JIM_GOLF].includes(outfit))return false;const store=relay.parties?.store,identity=store?.identities.get(id);if(!identity)return false;if(!identity.jimGolfUnlocked){identity.jimGolfUnlocked={at:Date.now()};store.save?.();}syncJimStyle(relay,id);return true;}
export function sanitizeJimStyle(relay,profile,id){return profile?.outfit===JIM_GOLF&&!jimStyleRecord(relay,id).unlocked?{...profile,outfit:JIM_NORMAL}:profile;}

export function acknowledgeJimStyle(relay,id){const identity=relay.parties?.store?.identities.get(id);if(identity?.jimGolfUnlocked){identity.jimGolfSeen=true;relay.parties.store.save();}return syncJimStyle(relay,id);}
