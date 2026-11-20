"""Styr två fingertoppar mot det utstickande kortet och pröva nio lägen på dragaxeln."""
import json
from pathlib import Path
import sys
import numpy as np
from scipy.optimize import least_squares
import trimesh

here = Path(__file__).resolve().parent
prev = here.parent / "kortsko-vanster-v1"
sys.path.insert(0, str(prev))
from mat import collisions, faces, hits_volume, joint, joints, lowered, model, params, skeleton, source_mesh, vertices

output_dir=here/"drag-mot-filt"
output_dir.mkdir(exist_ok=True)

cfg = json.loads((here / "scen.json").read_text())
yaw = np.deg2rad(cfg["yawDegrees"])
outward = np.array([np.sin(yaw), 0, np.cos(yaw)])
cross = np.array([np.cos(yaw), 0, -np.sin(yaw)])
up = np.array([0,1,0])
center = np.array([cfg["shoeCenterXZ"][0],0,cfg["shoeCenterXZ"][1]])
basis = np.column_stack((cross,up,outward))
def world(x,y,z):
    return center + x*cross + y*up + z*outward

def card_curve(travel):
    # The coordinate along the stock is arc length. The card keeps its length
    # while the unsupported leading edge bends from the outlet onto the felt.
    head=cfg["initialLeadZ"]+travel
    tail=head-cfg["cardLength"]
    settle=np.clip((tail-cfg["mouthZ"])/.011,0,1)
    settle=settle*settle*(3-2*settle)
    z=np.linspace(-.020,.205,1201)
    t=np.clip((z-cfg["mouthZ"]-.020)/.060,0,1)
    y=cfg["cardThickness"]+(cfg["cardTopY"]-cfg["cardThickness"])*(1-t*t*(3-2*t))*(1-settle)
    arc=np.r_[0,np.cumsum(np.hypot(np.diff(y),np.diff(z)))]+z[0]
    u=np.linspace(tail,head,33)
    return np.column_stack((np.interp(u,arc,z),np.interp(u,arc,y)))

skin = model.character_torch.linear_blend_skinning
vi,ji,weights = [a.numpy() for a in [skin.vert_indices_flattened,skin.skin_indices_flattened,skin.skin_weights_flattened]]
digits = ("index","middle")
def tip_mask(d):
    eligible = np.isin(ji,[joints.index("l_"+d+"3"),joints.index("l_"+d+"_null")])
    return np.bincount(vi[eligible],weights=weights[eligible],minlength=len(source_mesh.vertices)) >= .68
masks = [tip_mask(d) for d in digits]
indices = [i for i,n in enumerate(params) if n.startswith("l_") and any(k in n for k in
           ["clavicle_", "uparm_", "elbow_bend", "lowarm_", "wrist_", "index", "middle",
            "thumb0_", "thumb1_", "ring1_", "ring2_", "pinky1_", "pinky2_"])]
neutral = lowered[indices].astype(float)
start = lowered.copy()
for name,value in json.loads((prev/"rackvidd-lag.json").read_text())["left_mhr_overrides"].items():
    start[params.index(name)] = value
step = np.eye(len(indices))*.0005

def solve(seed, targets, offsets, table_guard):
    prev_values=seed[indices].astype(float)
    def residual(a):
        q=seed.copy(); q[indices]=a
        s=skeleton(q)
        points=np.array([joint(s,"l",d+"_null") for d in digits])
        midpoint=targets.mean(axis=0)
        guide_origin=midpoint.copy()
        guide_origin[1]=cfg["cardTopY"]+.0007
        aim_wrist=guide_origin+outward*.130+up*.055
        # Keep the thumb above the felt and the resting digits folded outside
        # the faceplate while the index and middle finger press the card.
        guides=[("index1",.014,.032,.067),("middle1",-.006,.035,.071),("pinky1",-.034,.034,.081),
                ("thumb_null",.044,.027,.062),("ring_null",-.020,.017,.028),("pinky_null",-.033,.022,.041)]
        guard=np.array([joint(s,"l",n)-(guide_origin+cross*x+up*y+outward*z) for n,x,y,z in guides])
        prevent=np.maximum(.00055-vertices(q)[table_guard,1],0)*2.5 if len(table_guard) else []
        return np.r_[((points+offsets-targets)*6).flatten(),
                     (joint(s,"l","wrist")-aim_wrist)*.55, guard.flatten()*.85,
                     (joint(s,"l","lowarm")[1]-.12)*.45,
                     (a-neutral)*.0025,(a-prev_values)*.0008,prevent]
    def jac(a):
        return np.column_stack([(residual(a+c)-residual(a-c))/.001 for c in step])
    limits=(neutral-1.60,neutral+1.60)
    opt=least_squares(residual,np.clip(prev_values,*limits),jac=jac,bounds=limits,
                      max_nfev=50,ftol=1e-7,xtol=1e-7)
    q=seed.copy(); q[indices]=opt.x
    return q

def clipped(v, low, high):
    tri=v[faces]
    lo,hi=tri.min(axis=1),tri.max(axis=1)
    possible=np.all((hi>=low)&(lo<=high),axis=1)
    planes=[]
    for axis,a,b in zip(np.eye(3),low,high):
        planes.extend([(-axis,-a),(axis,b)])
    return hits_volume(tri,planes,possible)

def check_frame(v, curve):
    loc=(v-center)@basis
    # Full bounding box is deliberately stricter than the open slot.
    body_shoe=clipped(loc,np.array([-.04,0,-.075]),np.array([.04,.085,.075]))
    tri=loc[faces]
    lo,hi=tri.min(axis=1),tri.max(axis=1)
    width=cfg["cardWidth"]/2
    thickness=cfg["cardThickness"]
    card=set()
    for (za,ya),(zb,yb) in zip(curve[:-1],curve[1:]):
        slope=(yb-ya)/(zb-za); b=ya-slope*za
        shapes=[([-1,0,0],width),([1,0,0],width),([0,0,-1],-za),([0,0,1],zb),
                ([0,1,-slope],b),([0,-1,slope],thickness-b)]
        candidate=(hi[:,0]>=-width)&(lo[:,0]<=width)&(hi[:,2]>=za)&(lo[:,2]<=zb)&(hi[:,1]>=min(ya,yb)-thickness)&(lo[:,1]<=max(ya,yb))
        card.update(hits_volume(tri,shapes,candidate))
    table=collisions(v,[10,10])["table_hits"]
    return len(body_shoe),np.array(sorted(card),dtype=int),table

frames=[]; outputs={}; poses=[]; q=start
for f, travel in enumerate(np.linspace(0,cfg["travel"],cfg["frames"])):
    curve=card_curve(travel)
    z=float(np.interp(cfg["cardLength"]-.008,np.linspace(0,cfg["cardLength"],len(curve)),curve[:,0]))
    top=np.interp(z,curve[:,0],curve[:,1])
    # Index and middle finger slide the first card from the front of the shoe.
    targets=np.array([world(x,top+.00070,z) for x in [.010,-.008]])
    offsets=np.tile([0,-.006,0],(2,1))
    pad_height=.0007
    table_guard=[]
    checkpoint=output_dir/f"pose-{f:02}.npz"
    if checkpoint.exists():
        q=np.load(checkpoint)["params"]
    elif len(poses)>=2:
        # Predict one equal-distance step. Accept it only if both pads are
        # over the card and all triangle and support checks pass for this frame.
        q=poses[-1]+(poses[-1]-poses[-2])
    for attempt in range(16):
        if attempt or (not checkpoint.exists() and len(poses)<2): q=solve(q,targets,offsets,table_guard)
        v=vertices(q); s=skeleton(q)
        pads=[]
        for mask, target in zip(masks,targets):
            pts=v[mask]; local=(pts-center)@basis
            above_card=(abs(local[:,0])<cfg["cardWidth"]/2-.001)&(local[:,2]>=curve[0,0])&(local[:,2]<=curve[-1,0])
            pool=pts[above_card] if above_card.any() else pts
            pool_z=((pool-center)@basis)[:,2]
            pads.append(pool[np.argmin(pool[:,1]-np.interp(pool_z,curve[:,0],curve[:,1]))])
        pads=np.array(pads)
        pad_local=(pads-center)@basis
        gaps=(pads[:,1]-np.interp(pad_local[:,2],curve[:,0],curve[:,1]))*1000
        shoe_hits,card_ix,table_hits=check_frame(v,curve)
        card_hits=len(card_ix)
        over_face=np.all((abs(pad_local[:,0])<cfg["cardWidth"]/2)&(pad_local[:,2]>=curve[0,0])&(pad_local[:,2]<=curve[-1,0]))
        if over_face and min(gaps)>=0 and max(gaps)<2.5 and max(shoe_hits,card_hits,table_hits)==0:
            break
        if card_hits and min(gaps)>.15:
            pad_height=min(.0021,pad_height+.00035)
        if table_hits:
            # Select the left arm vertices near the upper face of the tabletop.
            # The feet and thighs below it belong to the unchanged seated pose.
            pick=np.flatnonzero((v[:,0]>.01)&(v[:,2]>-.28)&(v[:,1]>-.024)&(v[:,1]<.006))
            table_guard=pick[np.argsort(v[pick,1])[:42]]
        # Preserve the contact point along the draw axis. Correct pad height
        # against the local bent surface, including any contact from its slope.
        offsets[:,1] += .85*(gaps/1000-pad_height)
    else:
        print({n:((joint(s,"l",n)-center)@basis*100).round(1).tolist() for n in
               ["lowarm","wrist","index1","index_null","middle1","middle_null","ring_null","pinky_null","thumb_null"]},flush=True)
        if card_hits:
            print("Skärning i kortets lokala millimeter:",(((v-center)@basis)[faces[card_ix]].mean(axis=1)*1000).round(1)[::max(1,card_hits//5)],flush=True)
        raise RuntimeError(f"Ruta {f}: fingertoppar {gaps}, träffar (sko,kort,skiva) {(shoe_hits,card_hits,table_hits)}")
    mesh=trimesh.Trimesh(vertices=v,faces=faces,process=False)
    mesh.visual=source_mesh.visual.copy()
    outputs[f"drag-{f:02}.glb"]=mesh.export(file_type="glb")
    poses.append(q.copy())
    if not checkpoint.exists(): np.savez_compressed(checkpoint,params=q)
    frames.append({"frame":f+1,"travel_mm":round(travel*1000,3),"pad_gaps_mm":gaps.round(3).tolist(),
                   "hits_shoe_card_table":[shoe_hits,card_hits,table_hits],"card_curve_zy_m":curve.round(8).tolist()})
    print(f"Ruta {f+1}, avstånd {gaps.round(3)}, träffar {shoe_hits,card_hits,table_hits}",flush=True)
tail=cfg["initialLeadZ"]+cfg["travel"]-cfg["cardLength"]
assert tail>cfg["mouthZ"]
report={"source":"kortsko-vanster-v1/sankt-arm.glb", "yaw_from_player_axis_deg":cfg["yawDegrees"],
        "exit_xyz_cm":(world(0,cfg["cardTopY"],cfg["mouthZ"])*100).round(2).tolist(),
        "final_tail_clearance_mm":round((tail-cfg["mouthZ"])*1000,2),"body_triangles":len(faces),"frames":frames}
outputs["matt-utdrag.json"]=(json.dumps(report,indent=2)+"\n").encode()
for name,content in outputs.items():
    path=output_dir/name
    if path.exists() and path.read_bytes()!=content: raise FileExistsError(path)
for name,content in outputs.items(): (output_dir/name).write_bytes(content)
