"""Export the room alone in glTF metres, using the studio's felt origin."""
from pathlib import Path
import trimesh
import numpy as np

out=Path(__file__).resolve().parent/"kasinosalong-blockout.glb"
scene=trimesh.Scene()
floor=-.75
height=3.60
def box(name,size,at,color=(160,163,155,255)):
    mesh=trimesh.creation.box(extents=size)
    mesh.visual.face_colors=color
    mesh.apply_translation(at)
    scene.add_geometry(mesh,node_name=name,geom_name=name)

box("Floor",[7.10,.08,7.0],[0,floor-.04,.50])
box("Ceiling",[7.10,.08,7.0],[0,floor+height+.04,.50])
box("Left wall",[.14,height,7.0],[-3.62,floor+height/2,.50])
box("Right wall",[.14,height,7.0],[3.62,floor+height/2,.50])
box("Wall behind players",[7.10,height,.14],[0,floor+height/2,4.07])
# Leave a real 1.2 × 2.2 m opening on the right side of the dealer wall.
for name,lo,hi in [("Rear wall left",-3.55,1.40),("Rear wall right",2.60,3.55)]:
    box(name,[hi-lo,height,.14],[(hi+lo)/2,floor+height/2,-3.07])
box("Door lintel",[1.20,height-2.20,.14],[2.00,floor+2.20+(height-2.20)/2,-3.07])
box("Foreground column",[.28,height,.28],[.76,floor+height/2,-1.35],(115,124,114,255))
content=scene.export(file_type="glb")
if out.exists() and out.read_bytes()!=content: raise FileExistsError(out)
out.write_bytes(content)
check=trimesh.load(out,force="scene")
assert len(check.geometry)==9
assert np.allclose(check.bounds,scene.bounds,atol=1e-5)
print(out,len(check.geometry),check.bounds.tolist())
