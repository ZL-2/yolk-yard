export const JIM_NORMAL='outfit-jim-normal';
export const JIM_GOLF='outfit-jim-golf';
export const JIM_OUTFITS=[
 {id:JIM_NORMAL,name:'Jim McLaughlin',model:'jim-normal',styleLabel:'Sweatshirt',price:1500,color:'#49566c'},
 {id:JIM_GOLF,name:'Jim McLaughlin — Golf',model:'jim-golf',styleLabel:'Golf · Win to unlock',price:0,color:'#eceee8',winReward:true},
].map(i=>({...i,slot:'outfit',set:'jim-icon',tier:'epic',featured:true,styleRoot:JIM_NORMAL,accent:'#a6d885',skin:'#c49370',hair:'#593524',shape:31,profile:{color:i.color,accent:'#a6d885',hat:0,pattern:0,finish:0,eyewear:6},description:'Jim joins the Icon Series. Sweatshirt is the normal style. Win a completed online match while wearing Jim to permanently unlock Golf. Cosmetic only; no combat advantage.'}));
