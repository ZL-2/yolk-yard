const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
// Metres per complete left/right cycle, not per step. Stance displacement
// must equal velocity * stance time or the boot visibly skates on the floor.
export function strideProfile(speed,{crouching=false,downed=false}={}){
 speed=Number.isFinite(speed)?Math.max(0,speed):0;
 const run=smooth((speed-2)/5),distance=downed?.85:crouching?1.05:1.12+run*2.65;
 return {distance,stance:downed||crouching?.64:Math.min(.60-run*.30,.88/distance),lift:downed?.035:crouching?.075:.085+run*.12,run,moving:smooth(speed/.65)};
}
export function strideFoot(phase,side,profile){
 const cycle=((phase/(Math.PI*2)+(side<0?.5:0))%1+1)%1,contact=cycle<profile.stance;
 const u=contact?cycle/profile.stance:(cycle-profile.stance)/(1-profile.stance);
 // Brief toe-off/touchdown arcs match stance velocity, without letting a
 // high-speed cubic overshoot beyond the anatomical reach of the leg.
 const tangent=-2*(1-profile.stance)/profile.stance;
 const travel=1-2*u;
 const edge=.035,over=-tangent*edge/2;
 const swing=u<edge?-1+tangent*(u-u*u/(2*edge)):u>1-edge?1-tangent*((1-u)-(1-u)**2/(2*edge)):-1-over+(2+2*over)*smooth((u-edge)/(1-2*edge));
 const stride=(contact?travel:swing)*profile.distance*profile.stance/2*profile.moving;
 const lift=contact?0:Math.sin(Math.PI*u)**2*profile.lift*profile.moving;
 const roll=contact?.14*(1-smooth(u/.17))-.19*smooth((u-.77)/.23):-.19*(1-u)+.14*u;
 return {cycle,contact,u,stride,lift,roll:roll*profile.moving};
}
export function pelvisTurn(forward,side,moving=1){
 // Local forward is -Z. A right strafe requires NEGATIVE yaw, not positive.
 return clamp(-Math.atan2(side,Math.max(.15,Math.abs(forward)))*.65,-.85,.85)*moving;
}
