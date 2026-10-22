// Layered original rotor, turbine, airflow and cabin warning design. No
// commercial-game recordings; a single audible helicopter bounds the cost.
export function updateHelicopterAudio(sound,royale,listener){
 const nearest=(royale?.vehicles||[]).filter(v=>v.type==='helicopter'&&!v.wrecked&&(v.rotor>0||v.loudspeaker)).sort((a,b)=>Math.hypot(a.x-listener.x,a.y-listener.y,a.z-listener.z)-Math.hypot(b.x-listener.x,b.y-listener.y,b.z-listener.z))[0];
 const distance=nearest?Math.hypot(nearest.x-listener.x,nearest.y-listener.y,nearest.z-listener.z):Infinity;
 const inside=!!nearest&&nearest.id===listener.vehicleId,attenuation=inside?1:Math.max(0,1-distance/140)**1.6,rpm=nearest?.rotor||0,t=sound.clock;
 const pan=nearest&&!inside?Math.max(-1,Math.min(1,((nearest.x-listener.x)*Math.cos(listener.yaw||0)-(nearest.z-listener.z)*Math.sin(listener.yaw||0))/Math.max(1,distance))):0;
 sound.loop('helicopter-blades',attenuation*rpm,{freq:90+rpm*100,volume:.24,pulse:4+rpm*16,pan});
 sound.loop('helicopter-turbine',attenuation*rpm,{freq:220+rpm*980+(nearest?.boosting?270:0),volume:.045,noise:false,pan});
 sound.loop('helicopter-wash',attenuation*rpm*(.25+(nearest?.speed||0)/35),{freq:420+rpm*300,volume:.09,pan});
 sound.loop('helicopter-alarm',inside&&(nearest.falling||nearest.health<300||nearest.fuel<15)?(.5+.5*Math.sin(t*10)):0,{freq:640+(Math.floor(t*3)%2)*210,volume:.09,noise:false});
 // Original four-note identification call, deliberately not a sampled song.
 sound.loop('helicopter-speaker',nearest?.loudspeaker?attenuation*(.5+.5*Math.sin(t*5)**2):0,{freq:[392,493.88,587.33,783.99][Math.floor(t*2)%4],volume:.19,noise:false,wave:'triangle',category:'effects',pan});
}
