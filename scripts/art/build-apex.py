from operator_builder import Builder
import math
import numpy as np
C=315
j={'root':(C,950,0),'hips':(C,415,0),'spine':(C,313,0),'chest':(C,231,0),'neck':(C,168,0),'head':(C,113,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',95,207,0),('arm',121,224,0),('forearm',166,345,0),('hand',207,458,0),('thigh',50,416,0),('shin',81,624,-4),('foot',113,840,0),('toe',132,919,-72)]:j[name+side]=(C+sign*x,y,d)
b=Builder('rank-1','Apex Sovereign',C,1238,752,950,1.82/884,j)
def weights(v):
 y=v[1]
 if y<275:return {'chest':1}
 if y<313:return {'chest':(313-y)/38,'spine':(y-275)/38}
 if y<385:return {'spine':(385-y)/72,'hips':(y-313)/72}
 return {'hips':1}
b.loft('Fitted navy sovereign torso',[(177,C,40,33,0),(201,C,67,46,-2),(236,C,76,57,-5),(270,C,66,47,-3),(308,C,53,36,0),(341,C,55,36,0),(379,C,68,41,0),(414,C,73,40,0),(443,C,62,33,0),(456,C,37,24,0)],'hips',weights=weights)
b.loft('High navy collar',[(143,C,26,27,0),(157,C,39,33,0),(177,C,54,39,0),(194,C,46,35,0),(204,C,36,29,0)],'neck','leather')
b.loft('Ivory segmented helmet',[(66,C,5,13,0),(70,C,22,28,0),(80,C,33,35,0),(96,C,38,41,-2),(116,C,37,42,-3),(136,C,30,35,-3),(151,C,20,28,-3),(163,C,8,18,-3)],'head','metal',sides=40,steps=2)
b.plate('Ivory jaw left',[(285,122),(308,131),(308,160),(292,146)],-42,'head',5,'metal',5)
b.plate('Ivory jaw right',[(322,131),(345,122),(338,146),(322,160)],-42,'head',5,'metal',5)
b.silhouette('Sovereign visor',[(282,103),(315,113),(347,103),(342,115),(315,126),(286,114)],-48,'head',2,'glow')
b.plate('Helmet gold crest',[(308,68),(315,64),(322,68),(320,91),(315,103),(310,91)],-40,'head',4,'metal',4)
def gold(o):
 for uv in o.data.uv_layers:
  for p in uv.data:p.uv=(232/1536,1-212/1024)
 return o
# A real open toroidal crown, with six modeled diamond spear ornaments.
verts=[];faces=[];n=64;ring=8
for a in range(n):
 t=a/n*math.tau
 for q in range(ring):
  v=q/ring*math.tau;verts.append((C+(56+2*math.cos(v))*math.sin(t),56+2*math.sin(v),(49+2*math.cos(v))*math.cos(t)))
for a in range(n):
 for q in range(ring):faces.append((a*ring+q,((a+1)%n)*ring+q,((a+1)%n)*ring+(q+1)%ring,a*ring+(q+1)%ring))
gold(b.mesh('Suspended gold circlet',verts,faces,'head','metal',side_blend=False))
for k in range(6):
 a=k*math.tau/6;x=C+56*math.sin(a);d=49*math.cos(a);height=34 if k%3 else 47
 v=[(x,56,d),(x-6,43,d),(x,56-height,d),(x+6,43,d),(x,43,d-5),(x,43,d+5)]
 gold(b.mesh('Crown diamond '+str(k),v,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)],'head','metal',smooth=False,side_blend=False))
for sign in [-1,1]:
 def p(points):return [(C+sign*(C-x),y) for x,y in points]
 b.sphere('Golden helmet bearing',C+sign*39,113,0,9,17,22,'head','metal',24,16)
 b.plate('Ivory sculpted breastplate',p([(254,204),(282,196),(299,215),(291,234),(303,248),(287,274),(260,264),(242,238)]),-59,'chest',7,'metal',7)
 b.plate('Ivory rib plate',p([(271,266),(296,278),(309,301),(299,328),(284,321),(279,292)]),-44,'spine',5,'metal',3)
b.plate('Ivory abdomen keel',[(302,291),(315,303),(328,291),(337,315),(332,343),(315,359),(298,343),(293,315)],-43,'spine',6,'metal',5)
b.sphere('Stellar reactor gold housing',C,232,-70,26,26,10,'chest','metal',32,16)
b.sphere('Sovereign star core',C,232,-81,19,19,4,'chest','glow',32,16)
for k in range(8):
 a=k*math.tau/8;x=C+math.sin(a)*25;y=232+math.cos(a)*25
 b.silhouette('Stellar ray '+str(k),[(x+math.cos(a)*3,y-math.sin(a)*3),(C+math.sin(a)*40,232+math.cos(a)*40),(x-math.cos(a)*3,y+math.sin(a)*3)],-72,'chest',3)
b.loft('Sovereign utility belt',[(351,C,62,38,0),(365,C,77,43,0),(383,C,74,42,0),(391,C,64,37,0)],'hips','leather',steps=2)
b.plate('Ivory gold belt centerpiece',[(296,358),(315,371),(334,358),(340,381),(315,418),(290,381)],-48,'hips',7,'metal',5)
b.silhouette('Compass star ivory tabard',[(289,392),(341,392),(350,537),(318,566),(281,536)],-49,'hips',3,'fabric')
for side,sign in [('L',-1),('R',1)]:
 def mirror(points):return [(C+sign*(C-x),y) for x,y in points]
 def rows(data):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in data]
 def plate(name,p,depth,bone,thick=6,surface='metal',bulge=6):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' navy upper sleeve',rows([(204,211,31,34,0),(229,193,32,34,0),(261,179,28,30,0),(290,164,26,28,0),(320,153,24,26,0),(347,147,22,23,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,204,347))
 b.loft(side+' navy forearm sleeve',rows([(337,150,23,24,0),(363,137,23,24,0),(389,124,21,22,0),(418,116,18,19,0),(444,108,15,16,0),(463,107,13,14,0)]),'forearm'+side,weights=b.chain('forearm'+side,'hand'+side,337,463))
 feathers=[[(256,184),(226,145),(239,179),(261,209)],[(229,177),(180,166),(203,180),(237,194)],[(224,184),(157,181),(181,192),(225,203)],[(214,193),(141,199),(174,208),(221,216)],[(207,206),(130,229),(168,232),(216,224)],[(198,221),(116,262),(159,253),(207,237)],[(202,235),(122,299),(159,275),(213,245)],[(218,244),(144,315),(177,291),(225,254)],[(232,245),(168,322),(195,302),(241,253)],[(239,225),(195,284),(214,275),(247,245)]]
 for i,p in enumerate(feathers):plate('Ivory feather plate '+str(i),p,-28-i*.5,'arm',6,'metal',5)
 b.sphere(side+' pauldron pivot',x(77),202,-42,19,21,9,'arm'+side,'metal',28,16)
 plate('Ivory forearm guard',[(132,333),(148,350),(155,366),(143,388),(126,413),(109,430),(102,410),(111,377),(119,352)],-24,'forearm',8,'metal',9)
 plate('Gold wrist cuff',[(99,422),(120,425),(132,443),(100,454),(92,444)],-19,'forearm',6,'metal',4)
 b.loft(side+' navy trouser thigh',rows([(409,265,43,39,0),(445,258,43,39,0),(482,250,39,36,0),(520,242,36,33,0),(557,238,34,31,0),(592,234,31,29,0),(624,234,28,27,0)]),'thigh'+side,weights=b.chain('thigh'+side,'shin'+side,409,624))
 b.loft(side+' navy trouser calf',rows([(610,234,28,28,0),(648,228,28,28,0),(686,220,26,26,0),(722,213,24,24,0),(761,206,23,22,0),(802,202,20,21,0),(840,202,19,19,0)]),'shin'+side,weights=b.chain('shin'+side,'foot'+side,610,840))
 plate('Upper thigh feather',[(228,388),(253,389),(243,417),(224,438),(209,457),(204,443),(213,412)],-37,'thigh',7,'metal',6)
 plate('Middle thigh feather',[(216,434),(241,420),(230,452),(212,482),(193,506),(197,477)],-38,'thigh',7,'metal',5)
 plate('Lower thigh feather',[(208,477),(231,460),(218,501),(198,535),(184,564),(183,543)],-38,'thigh',7,'metal',5)
 b.plate(side+' hip gold mechanism',mirror([(231,348),(249,344),(264,354),(264,369),(245,381),(229,368)]),-44,'hips',8,'metal',7)
 plate('Ivory knee shield',[(217,586),(241,583),(261,597),(268,624),(254,654),(237,675),(216,668),(203,635),(205,604)],-33,'shin',9,'metal',11)
 plate('Ivory shin plate',[(194,670),(216,697),(231,714),(254,681),(258,712),(244,748),(227,778),(220,813),(191,819),(177,787),(175,750),(179,710)],-28,'shin',8,'metal',10)
 b.loft(side+' ivory armored boot',rows([(814,202,21,23,0),(840,202,23,25,0),(865,199,25,31,-8),(887,192,29,45,-22),(910,184,33,61,-37),(930,179,35,69,-44),(944,178,36,70,-44),(950,178,36,70,-44)]),'foot'+side,'leather',sides=28,steps=2)
 plate('Ivory ankle cuff',[(176,830),(202,826),(216,846),(207,862),(182,865),(169,852)],-27,'foot',7,'metal',5)
 b.fingers(side,(x(207),481,-1),[(x(225),513),(x(216),527),(x(204),536),(x(196),528),(x(180),503)])
rows=[(177,132,49),(220,181,64),(310,237,73),(410,294,82),(520,352,91),(630,410,101),(728,490,109),(798,508,116)]
outer=b.cape(rows,columns=128);outer.name='Navy sovereign star cape'
inner=b.cape([(y,w,d-1) for y,w,d in rows],columns=128);inner.name='Ivory woven cape lining'
pixels=np.empty(len(b.image.pixels),dtype=np.float32);b.image.pixels.foreach_get(pixels)
for mesh in [outer,inner]:
 for v in list(mesh.data.vertices)[-129:]:
  px=round(b.bx-v.co.x/b.scale);edge=700
  for y in range(680,841):
   k=((1023-y)*1536+px)*4;r,g,blue=pixels[k:k+3]
   if (blue>r*1.2 and blue>g*1.08) or (r>.3 and r-blue>.1) or (r>.65 and g>.6 and blue>.5):edge=y
  v.co.z=(b.floor-edge)*b.scale
 for loop in mesh.data.loops:
  v=mesh.data.vertices[loop.vertex_index].co;px=b.bx-v.x/b.scale;y=b.floor-v.z/b.scale
  for uv in mesh.data.uv_layers:uv.data[loop.index].uv=(px/1536,1-y/1024)
for loop in inner.data.loops:
 v=inner.data.vertices[loop.vertex_index].co;y=b.floor-v.z/b.scale;t=(v.x/b.scale+260)/520
 for uv in inner.data.uv_layers:uv.data[loop.index].uv=((288+t*52)/1536,1-(570+(y-177)/650*230)/1024)
# Reference poses have slightly different wrist spacing. The right geometry is
# symmetric; use the fitted left front texture to avoid backdrop at its edges.
for o in b.parts:
 if 'feather plate' in o.name:
  uv=o.data.uv_layers['Reference'];centre=sum((p.uv for p in uv.data),uv.data[0].uv.copy()*0)/len(uv.data)
  for p in uv.data:p.uv=centre+(p.uv-centre)*.9
 if o.name.startswith('R '):
  for p in o.data.uv_layers['Reference'].data:
   if C<p.uv.x*1536<630:p.uv.x=(2*C-p.uv.x*1536)/1536
 if any(n in o.name for n in ['upper sleeve','forearm sleeve','finger','palm']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if 'boot' in o.name or 'ankle cuff' in o.name:
  for p in o.data.uv_layers['Reference'].data:
   if p.uv.x*1536>970:p.uv.x=(b.bx+(p.uv.x*1536-b.bx)*.71)/1536
b.finish()

