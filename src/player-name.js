import {moderateText,NAME_LIMIT} from './moderation.js';
export const NAME_MESSAGES=Object.freeze({
 empty:'Enter a name with at least one letter or number.',
 length:`Use ${NAME_LIMIT} characters or fewer.`,
 format:'Use letters, numbers, spaces, underscores or hyphens.',
 privacy:'Names cannot contain contact details, links or long number sequences.',
 language:'This name contains language that is not allowed. Try another name.',
 context:'Choose a different name that follows the name rules.',
 unavailable:'Name checking is unavailable. Please try again.',
 reserved:'Choose a name other than Player.',
 duplicate:'That name is already in this match. Choose a different name.'
});
export function validatePlayerName(value,{nickname=false}={}){
 const checked=moderateText(value,{kind:'name'});
 const reason=checked.ok?(!nickname&&needsPlayerName(checked.text)?'reserved':null):checked.reason;
 return {ok:!reason,name:checked.text,message:reason?NAME_MESSAGES[reason]||NAME_MESSAGES.unavailable:'',reason};
}
// Keep the placeholder out of public identities without changing saved cosmetics.
export function needsPlayerName(name) {
  const key=String(name??'').normalize('NFKC').trim().toLowerCase();
  return !key || key==='player';
}
