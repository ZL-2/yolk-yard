import * as T from 'three';
// The apron decal and fixtures sit on the same authored collision deck.
export function dressHelipad(world,site,kit){
 if(!site)return;const {x,y,z}=site,g=new T.Group();g.name='Kestrel Forward Station';
 const c=document.createElement('canvas');c.width=c.height=1024;const a=c.getContext('2d');
 a.fillStyle='#35444a';a.fillRect(0,0,1024,1024);a.strokeStyle='#718087';a.lineWidth=2;
 for(let i=0;i<=8;i++){a.beginPath();a.moveTo(i*128,0);a.lineTo(i*128,1024);a.moveTo(0,i*128);a.lineTo(1024,i*128);a.stroke();}
 a.strokeStyle='#e8e5ce';a.lineWidth=15;a.beginPath();a.arc(512,512,360,0,Math.PI*2);a.stroke();a.lineWidth=4;a.beginPath();a.arc(512,512,386,0,Math.PI*2);a.stroke();
 a.font='900 410px sans-serif';a.textAlign='center';a.textBaseline='middle';a.fillStyle='#eee7d1';a.fillText('H',512,525);
 a.fillStyle='#e4bd62';for(let i=0;i<16;i++){a.save();a.translate(512,512);a.rotate(i*Math.PI/8);a.fillRect(-12,-472,24,40);a.restore();}
 a.font='700 38px sans-serif';a.fillStyle='#e7e4cd';a.fillText('KESTREL  /  H–05',512,952);a.font='600 22px sans-serif';a.fillText('KEEP CLEAR  •  ACTIVE FLIGHT DECK',512,80);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
 const deck=new T.Mesh(new T.PlaneGeometry(32,32),new T.MeshStandardMaterial({map:tex,roughness:.87,polygonOffset:true,polygonOffsetFactor:-2}));deck.rotation.x=-Math.PI/2;deck.position.set(x,y+.012,z);deck.receiveShadow=true;g.add(deck);
 for(let i=0;i<12;i++){const angle=i*Math.PI/6,lx=x+Math.cos(angle)*16.5,lz=z+Math.sin(angle)*16.5;kit.cylinder(g,lx,y+.12,lz,.20,.24,0x25333b);kit.cylinder(g,lx,y+.28,lz,.115,.12,0xffd888);}
 // Recessed apron drains, cable channels, striped barriers and fueling equipment.
 for(const side of [-1,1]){kit.block(g,x+side*17,y+.035,z,.16,.04,34,0x121f27);for(let n=-7;n<=7;n++)kit.block(g,x+side*17,y+.06,z+n*2,.23,.025,.06,0x8c9c9e);}
 for(const dx of [-10,-4,4,10]){kit.block(g,x+dx,y+.34,z+20,3.6,.68,.7,0x535f60);for(let n=0;n<5;n++)kit.block(g,x+dx-1.5+n*.6,y+.45,z+20.36,.28,.37,.02,0xd7b267);}
 for(const [dx,dz]of [[-19,-19],[19,-19],[-19,19],[19,19]]){kit.cylinder(g,x+dx,y+2.6,z+dz,.075,5.2,0x718482);kit.block(g,x+dx,y+5.12,z+dz,.92,.28,.42,0x26363b);kit.block(g,x+dx,y+4.96,z+dz,.72,.03,.34,0xffedbd);}
 // Windsock and a marked fuel cabinet beside a walkable service path.
 kit.cylinder(g,x+20,y+3.5,z-11,.07,7,0x91a3a3);const sock=kit.cylinder(g,x+21,y+6.85,z-11,.28,1.9,0xe89446);sock.rotation.z=-Math.PI/2;
 for(let i=0;i<3;i++){const stripe=kit.cylinder(g,x+20.45+i*.65,y+6.85,z-11,.286,.22,0xe9e4cc);stripe.rotation.z=-Math.PI/2;}
 for(const dx of [20,23]){kit.block(g,x+dx,y+.92,z+3,1.6,1.84,1.1,0x647a71);kit.block(g,x+dx,y+1.46,z+3.57,1.15,.26,.04,0xe2c36f);kit.block(g,x+dx,y+.78,z+3.57,.55,.65,.04,0x22363d);}
 const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256;const sc=signCanvas.getContext('2d');sc.fillStyle='#172d37';sc.fillRect(0,0,1024,256);sc.fillStyle='#dfc079';sc.font='900 74px sans-serif';sc.fillText('KESTREL',38,96);sc.fillStyle='#e1e6e0';sc.font='600 40px sans-serif';sc.fillText('FORWARD STATION / 05',38,171);sc.font='500 25px sans-serif';sc.fillText('FLIGHT OPERATIONS   •   ASTER — BREAKWATER',38,222);
 const signTex=new T.CanvasTexture(signCanvas);signTex.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(10,2.5),new T.MeshStandardMaterial({map:signTex,roughness:.8}));sign.position.set(190,site.hangarY+3.1,65.23);g.add(sign);
 world.add(g);return g;
}
