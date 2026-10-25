"""Seat the crown of a hood on its open lower shell without overlapping rims."""
import math
from mathutils import Vector

def repair_hood(body, operator):
 parent=list(range(len(body.data.vertices)))
 def find(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for e in body.data.edges:
  a,b=map(find,e.vertices)
  if a!=b:parent[a]=b
 parts={}
 for v in body.data.vertices:parts.setdefault(find(v.index),[]).append(v)
 head=[vs for vs in parts.values() if all(all(body.vertex_groups[g.group].name=='head' for g in v.groups if g.weight>.001) for v in vs)]
 crown_count,hood_count,angle=(520,259,2.45) if operator=='rank-10' else (400,287,2.25 if operator=='morrow' else 2.2)
 crown=max((vs for vs in head if len(vs)==crown_count),key=lambda vs:max(v.co.z for v in vs))
 hood=next(vs for vs in head if len(vs)==hood_count)
 bottom=min(v.co.z for v in crown);top=max(v.co.z for v in crown)
 join=max(v.co.z for v in hood)
 rim=[v for v in crown if abs(v.co.z-bottom)<1e-5]
 upper=[v for v in hood if abs(v.co.z-join)<1e-5]
 rx=max(abs(v.co.x) for v in upper)
 radius=(max(v.co.y for v in upper)-min(v.co.y for v in upper))/(1-math.cos(angle))
 cy=max(v.co.y for v in upper)-radius
 old_cy=(max(v.co.y for v in rim)+min(v.co.y for v in rim))/2
 sx=rx/max(abs(v.co.x) for v in rim)
 sy=radius/((max(v.co.y for v in rim)-min(v.co.y for v in rim))/2)
 for v in crown:
  t=(top-v.co.z)/(top-bottom)
  v.co.x*=1+(sx-1)*t
  v.co.y+=t*((v.co.y-old_cy)*(sy-1)+cy-old_cy)
  v.co.z+=(join-bottom)*t
 # The two pieces have different angular tessellation. Put the upper shell
 # exactly on the polygonal crown edge instead of leaving intersecting hems.
 ring=sorted((v.co.copy() for v in rim),key=lambda p:math.atan2(p.y-cy,p.x))
 for v in upper:
  closest=None;distance=float('inf')
  for a,b in zip(ring,ring[1:]+ring[:1]):
   d=b-a;t=max(0,min(1,(v.co-a).dot(d)/d.length_squared));q=a+d*t
   if (v.co-q).length_squared<distance:closest=q;distance=(v.co-q).length_squared
  v.co=closest
 body.data.update()
