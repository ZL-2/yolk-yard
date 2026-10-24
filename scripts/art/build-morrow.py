from operator_builder import Builder
import math
C=300
j={'root':(C,975,0),'hips':(C,423,0),'spine':(C,318,0),'chest':(C,234,0),'neck':(C,156,0),'head':(C,100,0)}
for side,sign in [('L',-1),('R',1)]:
 for name,x,y,d in [('shoulder',94,192,0),('arm',112,220,0),('forearm',146,333,0),('hand',204,445,0),('thigh',51,428,0),('shin',94,675,-2),('foot',121,882,0),('toe',140,949,-72)]:j[name+side]=(C+sign*x,y,d)
b=Builder('morrow','Morrow',C,1235,765,975,1.84/962,j,side_direction=-1)
def weights(v):
 y=v[1]
 if y<270:return {'chest':1}
 if y<318:return {'chest':(318-y)/48,'spine':(y-270)/48}
 if y<375:return {'spine':(375-y)/57,'hips':(y-318)/57}
 return {'hips':1}
b.loft('Weathered leather tunic',[(168,C,37,31,0),(195,C,70,45,-3),(229,C,82,56,-5),(264,C,77,50,-3),(302,C,64,42,0),(339,C,63,39,0),(375,C,73,43,0),(414,C,78,43,0),(448,C,71,37,0),(469,C,39,25,0)],'hips','leather',weights=weights)
b.loft('Black sealed neck wrap',[(131,C,23,25,0),(151,C,31,30,0),(169,C,39,34,0),(180,C,37,30,0)],'neck','fabric')
b.loft('Ivory angular mask',[(53,C,10,22,0),(62,C,27,35,-2),(79,C,35,42,-3),(101,C,32,43,-4),(120,C,23,35,-4),(139,C,11,26,-3),(145,C,4,20,-3)],'head','skin',sides=32,steps=2)
b.plate('Ivory central beak',[(294,93),(305,92),(311,115),(304,139),(299,145),(292,130)],-48,'head',4,'skin',9)
b.plate('Left amber eye recess',[(272,77),(283,80),(293,91),(283,92),(275,86)],-45,'head',2,'glass',0)
b.plate('Right amber eye recess',[(307,91),(317,80),(329,77),(325,86),(316,92)],-45,'head',2,'glass',0)
b.loft('Olive hood crown',[(14,C,2,7,9),(25,C,15,25,8),(41,C,29,37,6),(53,C,39,45,5)],'head','fabric',sides=40,steps=3)
hoodrows=[(45,34,42,6),(63,44,49,6),(84,54,54,7),(108,65,57,8),(131,72,56,9),(148,68,48,8),(158,49,35,7)]
v=[];f=[];n=40
for y,rx,rz,d in hoodrows:
 for i in range(n+1):
  a=-2.25+i/n*4.5;v.append((C+rx*math.sin(a),y,d+rz*math.cos(a)))
for k in range(len(hoodrows)-1):
 for i in range(n):a=k*(n+1)+i;f.append((a,a+1,a+n+2,a+n+1))
hood=b.mesh('Open olive hood',v,f,'head','fabric',side_blend=False)
for sign in [-1,1]:
 v=[];f=[]
 for y,rx,rz,d in hoodrows:
  x=C+sign*rx*math.sin(2.25);depth=d+rz*math.cos(2.25)-1
  v.extend([(x-sign*1.8,y,depth),(x+sign*1.8,y,depth)])
 for k in range(len(hoodrows)-1):a=k*2;f.append((a,a+1,a+3,a+2))
 o=b.mesh('Tan hood piping',v,f,'head','leather',side_blend=False)
 for uv in o.data.uv_layers:
  for q in uv.data:q.uv=(239/1536,1-106/1024)
b.loft('Folded olive shoulder scarf',[(139,C,36,32,0),(152,C,66,40,0),(168,C,90,48,0),(185,C,87,51,-3),(202,C,76,48,-3)],'chest','fabric',steps=3)
b.silhouette('Diagonal leather harness',[(237,184),(250,183),(272,223),(291,276),(280,287),(261,235)],-60,'chest',5,'leather')
b.silhouette('Cross body leather strap',[(223,283),(276,257),(288,272),(226,309)],-54,'chest',5,'leather')
b.plate('Harness bronze buckle',[(263,262),(277,256),(284,272),(270,280)],-60,'chest',4,'metal',2)
b.loft('Wide brown belt',[(344,C,65,42,0),(358,C,80,46,0),(379,C,78,45,0),(389,C,70,40,0)],'hips','leather',steps=2)
b.plate('Bronze belt buckle',[(265,347),(289,348),(290,376),(265,376)],-51,'hips',6,'metal',2)
for side,sign in [('L',-1),('R',1)]:
 def mirror(p):return [(C+sign*(C-x),y) for x,y in p]
 def rows(r):return [(y,C+sign*(C-x),rx,rz,d) for y,x,rx,rz,d in r]
 def plate(name,p,depth,bone,thick=5,surface='metal',bulge=5):return b.plate(side+' '+name,mirror(p),depth,bone+side,thick,surface,bulge)
 x=lambda a:C+sign*a
 b.loft(side+' olive upper sleeve',rows([(184,210,29,32,0),(215,193,32,33,0),(248,181,30,31,0),(279,170,29,29,0),(307,160,27,27,0),(337,153,24,25,0)]),'arm'+side,weights=b.chain('arm'+side,'forearm'+side,184,337))
 b.loft(side+' leather forearm sleeve',rows([(325,156,24,25,0),(350,143,25,26,0),(377,130,23,24,0),(403,115,20,22,0),(428,103,17,18,0),(450,95,14,15,0)]),'forearm'+side,'leather',weights=b.chain('forearm'+side,'hand'+side,325,450))
 plate('Leaf bronze forearm guard',[(109,325),(136,347),(131,373),(118,395),(111,425),(76,439),(91,398),(99,363)],-25,'forearm',8,'metal',10)
 plate('Leaf glove guard',[(82,441),(106,450),(117,470),(97,485),(68,476)],-16,'hand',6,'metal',5)
 b.loft(side+' glove wrist',rows([(438,98,15,16,0),(454,94,15,14,0),(475,94,14,12,0)]),'hand'+side,'leather',steps=2)
 b.fingers(side,(x(206),480,-1),[(x(222),511),(x(218),524),(x(207),537),(x(197),530),(x(184),501)],size=1)
 b.loft(side+' brown trouser thigh',rows([(419,251,40,38,0),(451,247,42,39,0),(490,242,42,38,0),(530,235,41,36,0),(569,228,39,33,0),(608,220,37,31,0),(646,209,31,29,0),(676,206,29,28,0)]),'thigh'+side,'leather',weights=b.chain('thigh'+side,'shin'+side,419,676))
 b.loft(side+' olive wrapped calf',rows([(661,207,30,29,0),(691,201,31,30,0),(720,194,30,28,0),(754,187,28,26,0),(790,182,25,24,0),(824,181,23,23,0),(853,180,20,21,0),(882,179,19,20,0)]),'shin'+side,'fabric',weights=b.chain('shin'+side,'foot'+side,661,882))
 plate('Faceted green knee shield',[(180,655),(210,639),(228,652),(245,680),(211,712),(177,699),(166,675)],-33,'shin',8,'metal',9)
 plate('Leather thigh pouch',[(181,508),(220,505),(234,523),(223,604),(208,623),(169,620),(169,574)],-36,'thigh',14,'leather',3)
 plate('Thigh pouch flap',[(181,507),(220,506),(236,523),(220,536),(178,532),(171,525)],-52,'thigh',4,'leather',2)
 def boot_w(v):
  t=max(0,min(1,(v[1]-850)/32));return {'shin'+side:1-t,'foot'+side:t}
 b.loft(side+' brown expedition boot',rows([(820,180,27,27,0),(842,180,29,28,0),(868,178,24,25,-1),(889,174,26,29,-8),(916,165,31,44,-24),(944,156,38,64,-43),(964,154,41,70,-48),(975,154,42,71,-48)]),'foot'+side,'leather',weights=boot_w,sides=28,steps=2)
 plate('Boot shin lozenge',[(171,834),(189,851),(178,883),(157,861)],-30,'shin',4,'metal',5)
 plate('Boot upper belt',[(151,821),(204,821),(211,839),(202,852),(150,845)],-27,'shin',4,'leather',2)
 plate('Boot instep strap',[(150,893),(180,898),(203,917),(200,929),(171,913),(139,907)],-39,'foot',5,'leather',3)
# Asymmetric leaf armor and ragged shoulder flap on his right shoulder.
b.silhouette('Ragged shoulder cloth',[(192,149),(217,151),(242,174),(225,220),(203,254),(195,267),(183,269),(179,282),(168,278),(159,298),(148,297),(124,311),(135,286),(131,288),(147,250),(155,213)],-29,'armL',2,'fabric')
for name,p,d in [
 ('Upper leaf',[(193,146),(214,161),(193,187),(137,215),(164,180)],-38),
 ('Inner leaf',[(213,158),(233,176),(220,196),(192,218),(189,189)],-41),
 ('Lower leaf',[(164,194),(188,195),(181,226),(134,263),(149,228)],-42)]:
 b.plate(name+' bronze rim',p,d,'armL',6,'metal',9)
 cx=sum(x for x,y in p)/len(p);cy=sum(y for x,y in p)/len(p)
 b.plate(name+' olive inset',[(cx+(x-cx)*.82,cy+(y-cy)*.82) for x,y in p],d-7,'armL',2,'darkmetal',6)
b.sphere('Round leaf clasp',246,165,-57,14,14,6,'chest','metal',28,16)
# Dense cloth grids keep the diagonal poncho and the long waist sash articulated.
def cloth(name,rows,bone,back=False,root_hold=.8):
 v=[];f=[];n=40;top,bottom=rows[0][0],rows[-1][0]
 for k,(y,left,right,depth) in enumerate(rows):
  for q in range(n+1):
   t=q/n;px=left+(right-left)*t;xx=C-(px-b.bx) if back else px
   dd=depth+math.sin(t*math.pi*7)*(2+(y-top)/(bottom-top)*4)
   edge=(math.sin(k*9.3)*2 if q in [0,n] and k>1 else 0)
   v.append((xx,y+edge,dd))
 for k in range(len(rows)-1):
  for q in range(n):a=k*(n+1)+q;f.append((a,a+1,a+n+2,a+n+1))
 def w(v):
  t=max(0,min(1,(v[1]-top)/(bottom-top)));t=t*t*(3-2*t)*root_hold;return {bone:1-t,'root':t}
 return b.mesh(name,v,f,bone,'fabric',weights=w,side_blend=False)
cloth('Diagonal front leaf poncho',[(161,247,377,-49),(190,268,408,-62),(230,286,426,-65),(270,302,442,-61),(310,311,458,-56),(350,322,472,-51),(390,340,449,-48),(425,376,436,-44),(461,415,427,-41),(476,425,426,-39)],'chest',root_hold=.72)
cloth('Diagonal back poncho',[(150,1136,1304,48),(190,1101,1297,62),(230,1098,1274,67),(270,1108,1255,70),(320,1127,1236,72),(370,1147,1216,75),(420,1165,1196,77),(458,1179,1181,78)],'chest',True,.78)
cloth('Long front leaf waist sash',[(382,279,398,-48),(430,286,413,-51),(480,293,425,-54),(530,301,435,-57),(580,311,437,-60),(630,350,437,-62),(680,400,435,-64),(725,432,433,-65)],'hips',root_hold=.9)
cloth('Long back leaf waist sash',[(380,1133,1290,49),(430,1116,1280,53),(480,1110,1264,58),(530,1108,1242,62),(580,1104,1217,65),(630,1100,1189,68),(680,1097,1139,70),(724,1093,1094,71)],'hips',True,.9)
b.plate('Left belt pouch',[(210,346),(244,344),(249,366),(232,389),(207,387)],-50,'hips',15,'leather',3)
b.plate('Left side holster',[(188,398),(211,398),(230,409),(214,470),(183,471),(181,439)],-40,'hips',15,'leather',3)
for o in b.parts:
 if o.name.startswith('R '):
  for q in o.data.uv_layers['Reference'].data:
   if C<q.uv.x*1536<630:q.uv.x=(2*C-q.uv.x*1536)/1536
 if any(n in o.name.lower() for n in ['sleeve','finger','palm','glove wrist','hood']):
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if any(n in o.name.lower() for n in ['sleeve','finger','palm','glove wrist']):
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(C-abs(q.uv.x*1536-b.bx))/1536
 if 'trouser' in o.name:
  for q in o.data.uv_layers['Reference'].data:
   px=q.uv.x*1536
   if px>970:q.uv.x=(C-abs(px-b.bx)*.65)/1536
 if o.name=='Weathered leather tunic':
  for q in o.data.uv_layers['Reference'].data:
   if C<q.uv.x*1536<630:q.uv.x=(C-(q.uv.x*1536-C)*.6)/1536
 if 'boot' in o.name.lower():
  for q in o.data.uv_layers['Reference'].data:
   if q.uv.x*1536>970:q.uv.x=(b.bx+(q.uv.x*1536-b.bx)*.80)/1536
for o in b.parts:
 if 'hood' in o.name.lower() and 'piping' not in o.name.lower():
  for q in o.data.uv_layers['Reference'].data:
   cx=b.bx if q.uv.x*1536>970 else C;factor=.84 if cx==b.bx else .94;q.uv.x=(cx+(q.uv.x*1536-cx)*factor)/1536
 if 'calf' in o.name.lower() or 'boot' in o.name.lower():
  for a in o.data.attributes['SideBlend'].data:a.value=0
 if 'calf' in o.name.lower():
  for q in o.data.uv_layers['Reference'].data:
   px=q.uv.x*1536;y=(1-q.uv.y)*1024;px=C-abs(px-(b.bx if px>970 else C))
   center=207 if y<680 else 201-(min(824,y)-691)*.15
   q.uv.x=(center+(px-center)*.72)/1536
 if 'finger' in o.name.lower() or 'palm' in o.name.lower():
  for uv in o.data.uv_layers:
   for q in uv.data:q.uv=(94/1536,1-478/1024)
 if o.name=='R olive upper sleeve':
  for uv in o.data.uv_layers:
   for li,q in enumerate(uv.data):
    v=o.data.vertices[o.data.loops[li].vertex_index].co;y=b.floor-v.z/b.scale;sample=304+(y-184)/153*28;cx=172-(sample-304)*.45;q.uv=((cx+v.y/b.scale*.2)/1536,1-sample/1024)
for o in b.parts:
 if 'boot' not in o.name.lower():continue
 centers=[(820,180),(842,180),(868,178),(889,174),(916,165),(944,156),(975,154)]
 for uv in o.data.uv_layers:
  for li,q in enumerate(uv.data):
   v=o.data.vertices[o.data.loops[li].vertex_index].co;y=b.floor-v.z/b.scale;px=C-abs(v.x/b.scale);cx=180
   for (a,x),(z,zx) in zip(centers,centers[1:]):
    if a<=y<=z:cx=x+(zx-x)*(y-a)/(z-a);break
   q.uv=((cx+(px-cx)*.82)/1536,1-min(969,y)/1024)
b.finish()

