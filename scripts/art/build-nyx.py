from operator_builder import Builder
import math
import numpy as np
C=303
j={'root':(C,968,0),'hips':(C,402,0),'spine':(C,301,0),'chest':(C,223,0),'neck':(C,157,0),'head':(C,94,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',93,189,0),('arm',102,215,0),('forearm',137,323,0),('hand',205,441,0),('thigh',48,407,0),('shin',76,637,-2),('foot',104,868,0),('toe',119,937,-64)]:j[name+side]=(C+sign*x,y,d)
b=Builder('nyx','Lieutenant Nyx',C,1237,749,968,1.78/958,j)
def weights(v):
 y=v[1]
 if y<260:return {'chest':1}
 if y<300:return {'chest':(300-y)/40,'spine':(y-260)/40}
 if y<350:return {'spine':(350-y)/50,'hips':(y-300)/50}
 return {'hips':1}
b.loft('Tailored stealth torso',[(164,C,34,30,0),(187,C,62,37,-3),(214,C,69,44,-6),(241,C,68,48,-8),(267,C,59,39,-5),(297,C,51,32,-1),(324,C,54,33,0),(352,C,66,38,0),(387,C,75,42,0),(421,C,76,42,0),(449,C,61,33,0),(464,C,35,25,0)],'hips',weights=weights)
b.loft('Folded violet scarf',[(125,C,31,27,0),(139,C,43,34,-1),(155,C,51,39,-4),(171,C,45,37,-4),(184,C,38,30,-2),(193,C,28,24,0)],'neck',steps=3)
b.loft('Faceted closed graphite mask',[(55,C,7,20,0),(64,C,25,34,0),(80,C,34,41,-4),(104,C,33,42,-5),(124,C,22,33,-4),(140,C,8,20,-3)],'head','darkmetal',sides=32,steps=2)
b.silhouette('Violet left mask stroke',[(275,83),(286,94),(298,102),(303,123),(295,111),(282,101)],-48,'head',2,'glow')
b.silhouette('Violet right mask stroke',[(330,83),(320,95),(309,102),(303,123),(311,111),(323,102)],-48,'head',2,'glow')
b.loft('Pointed violet hood crown',[(10,C,1,5,9),(24,C,16,24,8),(42,C,29,35,6),(56,C,40,44,5)],'head',sides=40,steps=3)
rows=[(49,35,42,5),(65,45,49,5),(85,54,53,7),(106,68,56,8),(126,80,55,9),(139,80,51,9),(153,59,39,8)]
v=[];f=[];n=40
for y,rx,rz,d in rows:
 for i in range(n+1):
  a=-2.2+i/n*4.4;v.append((C+rx*math.sin(a),y,d+rz*math.cos(a)))
for r in range(len(rows)-1):
 for i in range(n):a=r*(n+1)+i;f.append((a,a+1,a+n+2,a+n+1))
b.mesh('Open pointed violet hood',v,f,'head')
b.plate('Sternum armor',[(282,255),(303,247),(325,260),(318,292),(303,325),(287,309)],-41,'spine',5,'darkmetal',5)
b.silhouette('Diagonal violet sash',[(267,191),(285,187),(330,228),(363,275),(352,290),(315,242)],-55,'chest',3,'fabric')
for sign in [-1,1]:
 def m(pts):return [(C+sign*(C-x),y) for x,y in pts]
 b.silhouette('Chest harness strap',m([(242,190),(255,194),(237,224),(244,250),(272,268),(265,278),(233,259),(225,225)]),-49,'chest',4,'leather')
b.loft('Black utility belt',[(329,C,59,36,0),(343,C,72,41,0),(362,C,70,40,0),(373,C,65,37,0)],'hips','leather',steps=2)
b.plate('Silver bevel belt buckle',[(287,338),(316,338),(326,355),(314,367),(284,362)],-46,'hips',5,'metal',3)
for side,sign in [('L',-1),('R',1)]:
 def mirror(p):return [(C+sign*(C-x),y) for x,y in p]
 def rows(r):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in r]
 def plate(name,p,depth,bone,thick=5,surface='darkmetal',bulge=5):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' shoulder sleeve',rows([(184,212,27,29,0),(211,202,25,29,0),(241,199,24,27,0),(270,190,24,26,0),(296,178,22,23,0),(323,166,20,21,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,184,323))
 b.loft(side+' forearm sleeve',rows([(314,169,22,23,0),(337,157,21,23,0),(365,145,20,21,0),(393,130,18,19,0),(420,113,15,16,0),(443,98,12,13,0)]),'forearm'+side,weights=b.chain('forearm'+side,'hand'+side,314,443))
 plate('Angular pauldron',[(186,159),(211,166),(239,151),(247,183),(232,205),(213,210),(175,225),(181,195)],-29,'arm',9,'darkmetal',11)
 plate('Violet shoulder shard',[(192,168),(208,176),(204,200)],-42,'arm',3,'glow',1)
 plate('Upper sleeve scale',[(188,216),(209,233),(199,251),(175,254),(169,265),(173,243)],-24,'arm',4)
 plate('Lower sleeve scale',[(176,241),(198,256),(188,273),(163,285),(162,273)],-23,'arm',4)
 plate('Long gauntlet',[(128,309),(153,331),(144,355),(124,394),(110,420),(86,433),(101,391),(113,347)],-21,'forearm',6,'darkmetal',8)
 plate('Violet gauntlet blade',[(122,342),(132,356),(111,403),(97,418),(107,382)],-29,'forearm',2,'glow',0)
 plate('Glove cuff',[(85,423),(111,420),(123,435),(94,446),(81,440)],-15,'forearm',4)
 plate('Glove plates',[(89,447),(108,449),(119,465),(110,481),(91,478),(80,461)],-11,'hand',3)
 b.loft(side+' fitted trouser thigh',rows([(397,257,43,37,0),(430,252,44,39,0),(465,248,43,38,0),(503,242,41,35,0),(542,236,36,33,0),(579,231,32,31,0),(610,228,28,27,0),(637,227,25,25,0)]),'thigh'+side,weights=b.chain('thigh'+side,'shin'+side,397,637))
 b.loft(side+' fitted trouser calf',rows([(623,227,26,27,0),(650,226,28,28,0),(688,219,29,27,0),(723,212,28,25,0),(757,205,25,23,0),(790,199,23,22,0),(830,198,19,19,0),(868,199,17,18,0)]),'shin'+side,weights=b.chain('shin'+side,'foot'+side,623,868))
 plate('Faceted knee guard',[(210,608),(235,604),(256,625),(246,657),(225,686),(204,673),(198,641)],-30,'shin',8,'darkmetal',9)
 plate('Lower knee chevron',[(195,670),(219,693),(246,667),(244,688),(217,726),(195,705)],-27,'shin',5)
 def boot_w(v):
  t=max(0,min(1,(v[1]-836)/32));return {'shin'+side:1-t,'foot'+side:t}
 b.loft(side+' buckled black boot',rows([(788,199,25,26,0),(811,198,25,26,0),(840,198,21,22,0),(868,198,20,23,-2),(895,195,24,31,-12),(918,188,30,45,-26),(941,184,34,58,-38),(959,184,36,60,-39),(968,184,36,60,-39)]),'foot'+side,'leather',weights=boot_w,sides=28,steps=2)
 plate('Violet boot collar',[(174,790),(196,802),(220,788),(218,822),(200,851),(176,831)],-26,'shin',5,'darkmetal',5)
 plate('Boot buckle',[(173,869),(202,871),(217,880),(213,893),(178,888)],-30,'foot',5,'metal',2)
 b.fingers(side,(x(206),470,-1),[(x(222),502),(x(218),515),(x(208),528),(x(198),520),(x(188),498)],size=.9)
 # Tail wraps from front hip around each side to the back; upper anchors follow hips,
 # while the long lower hem stays stable in crouch rather than passing through legs.
 v=[];f=[];rr=[(354,240,254,34),(370,218,252,38),(400,198,232,44),(450,185,206,52),(500,168,190,60),(550,150,189,67),(600,127,200,75),(620,117,200,79),(650,102,195,85),(680,91,145,90),(700,80,134,94),(740,91,127,98),(780,109,126,101),(804,126,127,102)];n=24
 for y,outer,inner,depth in rr:
  for q in range(n+1):
   t=q/n;xx=outer+(inner-outer)*t;dd=-28+depth*t+5*math.sin(t*math.pi*4);v.append((C+sign*(C-xx),y,dd))
 for k in range(len(rr)-1):
  for q in range(n):a=k*(n+1)+q;f.append((a,a+1,a+n+2,a+n+1))
 def cloth_w(v):
  t=max(0,min(1,(v[1]-351)/461));t=t*t*(3-2*t)*.9;return {'hips':1-t,'root':t}
 o=b.mesh(side+' long split violet coat',v,f,'hips','fabric',weights=cloth_w,side_blend=False)
 # The front-facing entire wing maps to the same visible cover-panel silhouette.
 for li,l in enumerate(o.data.loops):
  xx,y,dd=v[l.vertex_index]
  for uv in o.data.uv_layers:uv.data[li].uv=(xx/1536,1-y/1024)
# Asymmetric left thigh pouch from the cover.
b.plate('Left thigh holster',[(187,467),(212,462),(221,478),(214,550),(191,555),(180,527)],-38,'thighL',14,'leather',3)
b.plate('Left holster flap',[(190,462),(213,461),(213,497),(187,512),(182,494)],-53,'thighL',3,'leather',2)
for o in b.parts:
 if o.name.startswith('R '):
  for p in o.data.uv_layers['Reference'].data:
   if C<p.uv.x*1536<630:p.uv.x=(2*C-p.uv.x*1536)/1536
 if any(n in o.name for n in ['sleeve','forearm','finger','palm','hood']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if 'sleeve' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(C-abs(q.uv.x*1536-b.bx))/1536
 if 'hood crown' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   cx=b.bx if q.uv.x*1536>970 else C;q.uv=((cx+(q.uv.x*1536-cx)*.85)/1536,q.uv.y-3/1024)
 if 'trouser' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv=(251/1536,1-(480+((1-q.uv.y)*1024-400)*.18)/1024)
 if 'finger' in o.name or 'palm' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(C-abs(q.uv.x*1536-b.bx))/1536
 if 'boot' in o.name:
  for p in o.data.uv_layers['Reference'].data:
   if p.uv.x*1536>970:p.uv.x=(b.bx+(p.uv.x*1536-b.bx)*.85)/1536
# Keep the narrow hood tangent seam inside violet fabric, away from the gray sheet.
pixels=np.empty(len(b.image.pixels),dtype=np.float32);b.image.pixels.foreach_get(pixels);pixels=pixels.reshape((1024,1536,4))
for o in b.parts:
 if 'hood' not in o.name:continue
 for uv in o.data.uv_layers:
  for q in uv.data:
   x=max(0,min(1535,round(q.uv.x*1536)));y=max(0,min(1023,round(q.uv.y*1024)));rgb=pixels[y,x,:3]
   if max(rgb)-min(rgb)<.075 and max(rgb)>.26:
    lo=max(0,x-50);hi=min(1536,x+51);r=pixels[y,lo:hi,:3];valid=np.where((r[:,2]-r[:,0]>.035)&(r[:,0]-r[:,1]>.035))[0]+lo
    if len(valid):q.uv.x=(valid[np.argmin(abs(valid-x))]+.5)/1536
b.finish()

