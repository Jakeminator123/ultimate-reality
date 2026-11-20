"""Mät skons placering och passa en separat högerarm mot den befintliga vilohanden."""
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares
import torch
import trimesh

here = Path(__file__).resolve().parent
root = here.parents[2]
source = root / "test/dealer/paulina/filtdjup-v1-sits406"
source_pose = json.loads((source / "pose.json").read_text(encoding="utf8"))
layout = json.loads((root / "test/bord/filtdjup-v1/layout-v1.json").read_text(encoding="utf8"))
npz_path = next(Path(k) for k in source_pose["sources_sha256"] if "sidoprofil" in k)
assert hashlib.sha256(npz_path.read_bytes()).hexdigest() == source_pose["sources_sha256"][npz_path.as_posix()]
source_mesh = trimesh.load(source / "paulina-sits406.glb", force="mesh", process=False)
data = np.load(npz_path)
faces = data["faces"]
assert np.array_equal(faces, source_mesh.faces)

torch.set_num_threads(4)
torch.set_grad_enabled(False)
model = torch.jit.load(str(root.parent / "sam-3d-body/checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt"),map_location="cpu").eval()
character = model.character_torch
params = model.get_parameter_names()
joints = model.get_joint_names()
shape = torch.tensor(data["shape_params"][None])
expr = torch.zeros(1, model.get_num_face_expression_blendshapes())
original = data["mhr_model_params"].copy()
pose = original.copy()
for name, value in source_pose["mhr_parameter_changes"].items():
    pose[params.index(name)] = value
keypoints = data["pred_keypoints_3d"] * [1, -1, -1]
hip = keypoints[[9, 10]].mean(axis=0)
side = keypoints[9] - keypoints[10]
side[1] = 0
side /= np.linalg.norm(side)
up = np.array([0, 1, 0])
basis = np.column_stack((side, up, np.cross(side, up)))
reference = (data["pred_vertices"] * [1,-1,-1] - hip) @ basis
seat_mask = (np.abs(reference[:,0]) <= 0.16) & (np.abs(reference[:,2]) <= 0.135)
shift = np.array([0, -0.344 - reference[seat_mask, 1].min(), -0.39])

def tensor(p):
    return torch.from_numpy(p[None].astype(np.float32))

def surface(p):
    verts = model(shape, tensor(p), expr)[0][0].numpy() / 100
    return verts

base = surface(original)

def vertices(p):
    return reference + shift + (surface(p) - base) @ basis

def skeleton(p):
    jp = character.model_parameters_to_joint_parameters(torch.cat((tensor(p), torch.zeros_like(shape)), 1))
    return (character.joint_parameters_to_skeleton_state(jp)[0,:,:3].numpy()/100 - hip) @ basis + shift

def joint(skel, side, name):
    return skel[joints.index(side + "_" + name)]

old_verts = vertices(pose)
assert np.max(np.abs(old_verts - source_mesh.vertices)) < 0.00001
old_skel = skeleton(pose)
right_hand_ids = [joints.index("r_" + n) for n in ["wrist","index1","pinky1","middle_null","thumb_null"]]
elbow_id = joints.index("r_lowarm")
free = [i for i,n in enumerate(params) if n.startswith("r_") and any(k in n for k in ["clavicle_", "uparm_", "elbow_bend", "lowarm_", "wrist_"])]
neutral = pose[free].astype(float)
step = np.eye(len(free)) * 0.0005

def fit(target_y):
    def residual(a):
        q = pose.copy()
        q[free] = a
        s = skeleton(q)
        elbow = s[elbow_id] - old_skel[elbow_id]
        pin = (s[right_hand_ids] - old_skel[right_hand_ids]) * 8
        return np.r_[pin.flatten(), (s[elbow_id,1] - target_y) * 2,
                     elbow[[0,2]] * 0.18, (a - neutral) * 0.002]
    def jac(a):
        return np.column_stack([(residual(a+c)-residual(a-c)) / .001 for c in step])
    result = least_squares(residual, neutral, jac=jac, bounds=(neutral-0.9,neutral+0.9),
                           max_nfev=75, ftol=1e-8, xtol=1e-8)
    p = pose.copy()
    p[free] = result.x
    return p

def hits_volume(triangles, planes, candidates):
    """Clip candidate triangles against the convex volume's half-spaces."""
    found = []
    for index in np.flatnonzero(candidates):
        polygon = triangles[index]
        for normal, limit in planes:
            signs = polygon @ normal - limit
            result = []
            for i, b in enumerate(polygon):
                a, sa, sb = polygon[i-1], signs[i-1], signs[i]
                if (sa < 0) != (sb < 0):
                    result.append(a + (b-a) * sa/(sa-sb))
                if sb <= 0:
                    result.append(b)
            if not result:
                break
            polygon = np.array(result)
        else:
            found.append(index)
    return found

def collisions(v, shoe):
    tri = v[faces]
    lo, hi = tri.min(axis=1), tri.max(axis=1)
    sx, sz = shoe
    z0, z1 = sz-.075, sz+.075
    slope = (.018-.078)/(.075+.032)
    planes = [([-1,0,0],-sx+.04), ([1,0,0],sx+.04), ([0,0,-1],-z0), ([0,0,1],z1),
              ([0,-1,0],0), ([0,1,0],.078), ([0,1,-slope],.018-z1*slope)]
    candidates = ((hi[:,1]>=0) & (lo[:,1]<=.078) & (hi[:,0]>=sx-.04) & (lo[:,0]<=sx+.04)
                  & (hi[:,2]>=z0) & (lo[:,2]<=z1))
    shoe_hits = hits_volume(tri, planes, candidates)
    assert abs(v[:,0]).max()<.49 and v[:,2].max()<.36
    t=np.linspace(0,1,41)
    xs=3*(1-t)**2*t*.25+3*(1-t)*t**2*.31+t**3*.50
    zs=(1-t)**3*(-.28)+3*(1-t)**2*t*(-.28)+3*(1-t)*t**2*(-.52)+t**3*(-.52)
    xs, zs = np.r_[-xs[:0:-1],xs], np.r_[zs[:0:-1],zs]
    table_hits = set()
    for a,b,za,zb in zip(xs[:-1],xs[1:],zs[:-1],zs[1:]):
        m=(zb-za)/(b-a)
        planes=[([-1,0,0],-a),([1,0,0],b),([0,-1,0],.085),([0,1,0],0),([m,0,-1],a*m-za)]
        consider=(hi[:,1]>=-.085)&(lo[:,1]<=0)&(lo[:,0]<=b)&(hi[:,0]>=a)&(hi[:,2]>=min(za,zb))
        table_hits.update(hits_volume(tri,planes,consider))
    return {"shoe_hits":len(shoe_hits),"table_hits":len(table_hits)}

old_shoe = [layout["shoe"]["x"], layout["shoe"]["z"]]
mirror_shoe = [-old_shoe[0], old_shoe[1]]
new_shoe = [.42, old_shoe[1]]
report = {"source": "filtdjup-v1-sits406", "triangles": len(faces), "old_shoe_xz": old_shoe, "new_shoe_xz":new_shoe,
          "old_pose_old_shoe": collisions(old_verts,old_shoe), "old_pose_mirrored_shoe":collisions(old_verts,mirror_shoe),
          "old_pose_new_shoe":collisions(old_verts,new_shoe)}
for height in [.07, .08, .09, .10, .11, .12]:
    lowered = fit(height)
    v = vertices(lowered)
    tested = collisions(v,new_shoe)
    if tested["table_hits"] == tested["shoe_hits"] == 0:
        break
else:
    raise ValueError("Ingen sänkt provpose går fri")
s = skeleton(lowered)
report["lowered_pose_new_shoe"] = tested
report["lowered_pose_old_shoe"] = collisions(v,old_shoe)
report["old_right_elbow_xyz_cm"] = (old_skel[elbow_id]*100).round(3).tolist()
report["new_right_elbow_xyz_cm"] = (s[elbow_id]*100).round(3).tolist()
report["max_5_right_hand_joint_displacement_mm"] = round(float(np.linalg.norm(s[right_hand_ids]-old_skel[right_hand_ids],axis=1).max()*1000),3)
report["whole_body_lateral_gap_lower_bound_cm"] = round(float((new_shoe[0]-.04-max(v[:,0].max(),old_verts[:,0].max()))*100),3)
report["opening_xyz_cm"] = [new_shoe[0]*100,1.55,round((new_shoe[1]+.071)*100,2)]
opening = np.array(report["opening_xyz_cm"])/100
report["reach"] = {}
for side in ("l","r"):
    shoulder,elbow,wrist,index = [joint(s,side,n) for n in ("uparm","lowarm","wrist","index_null")]
    arm = np.linalg.norm(shoulder-elbow)+np.linalg.norm(elbow-wrist)
    tip_span = np.linalg.norm(wrist-index)
    distance = np.linalg.norm(shoulder-opening)
    report["reach"][side] = {k:round(float(val*100),2) for k,val in {
        "shoulder_to_opening_cm":distance,"shoulder_elbow_wrist_chain_cm":arm,"wrist_to_index_tip_cm":tip_span,
        "geometric_reach_margin_cm":arm+tip_span-distance,"resting_index_to_opening_cm":np.linalg.norm(index-opening)
    }.items()}
report["right_mhr_overrides"] = {params[i]:round(float(lowered[i]),8) for i in free}
report["source_glb_sha256"] = hashlib.sha256((source/"paulina-sits406.glb").read_bytes()).hexdigest()
mesh = trimesh.Trimesh(vertices=v,faces=faces,process=False)
mesh.visual = source_mesh.visual.copy()
def store(name, content):
    dst = here / name
    if dst.exists() and dst.read_bytes()!=content:
        raise FileExistsError(dst)
    dst.write_bytes(content)

if __name__ == "__main__":
    store("matt.json",(json.dumps(report,indent=2)+"\n").encode())
    store("sankt-arm.glb",mesh.export(file_type="glb"))
    print(json.dumps({k:v for k,v in report.items() if k!="right_mhr_overrides"},indent=1))
