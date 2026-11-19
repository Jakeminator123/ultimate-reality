"""Prov av vänsterhandens räckvidd till kortskons yttre öppning."""
import json
import numpy as np
from scipy.optimize import least_squares
import trimesh
from mat import collisions, faces, joint, joints, lowered, model, new_shoe, opening, params, skeleton, source_mesh, store, vertices

ids = [i for i,n in enumerate(params) if n.startswith("l_") and any(k in n for k in
       ["clavicle_", "uparm_", "elbow_bend", "lowarm_", "wrist_"])]
neutral = lowered[ids].astype(float)
step = np.eye(len(ids)) * 0.0005
skin = model.character_torch.linear_blend_skinning
vi = skin.vert_indices_flattened.numpy()
ji = skin.skin_indices_flattened.numpy()
weights = skin.skin_weights_flattened.numpy()
tip_weights = np.isin(ji,[joints.index("l_index3"),joints.index("l_index_null")])
tip_region = np.bincount(vi[tip_weights],weights=weights[tip_weights],minlength=len(source_mesh.vertices)) >= 0.68

def fit(offset, desired_wrist, elbow_height):
    target = opening + offset
    def err(a):
        q = lowered.copy()
        q[ids] = a
        s = skeleton(q)
        return np.r_[(joint(s,"l","index_null")-target)*6,
                     (joint(s,"l","wrist")-desired_wrist)*0.4,
                     (joint(s,"l","lowarm")[1]-elbow_height)*1.6,
                     (a-neutral)*0.004]
    def jac(a):
        return np.column_stack([(err(a+c)-err(a-c))/.001 for c in step])
    result = least_squares(err,neutral,jac=jac,bounds=(neutral-1.35,neutral+1.35),max_nfev=80)
    q=lowered.copy()
    q[ids]=result.x
    return q

best = None
for elbow_height in [.12,.15,.18]:
    for wrist in [[.30,.08,-.18], [.31,.085,-.20], [.32,.085,-.08]]:
        for ahead in [.010,.018]:
            p=fit([0,.009,ahead],wrist,elbow_height)
            v=vertices(p)
            checks=collisions(v,new_shoe)
            distance=float(np.linalg.norm(v[tip_region]-opening,axis=1).min())
            if checks["shoe_hits"] == checks["table_hits"] == 0 and (best is None or distance<best[0]):
                best=distance,p,v,checks
    if best is not None and best[0]<.012:
        break
if best is None or best[0]>.035:
    raise RuntimeError("Inget verifierat räckprov inom 3,5 cm från öppningen.")
distance,p,v,checks=best
mesh=trimesh.Trimesh(vertices=v,faces=faces,process=False)
mesh.visual=source_mesh.visual.copy()
result={"left_index_surface_sample_to_opening_mm":round(1000*distance,2), "static_pose":checks,
        "left_elbow_cm_above_felt":round(100*float(joint(skeleton(p),"l","lowarm")[1]),2),
        "opening_xyz_cm":(opening*100).round(2).tolist(),"left_mhr_overrides":{params[i]:round(float(p[i]),8) for i in ids}}
store("rackvidd-lag.json",(json.dumps(result,indent=2)+"\n").encode())
store("vanster-hand-lag.glb",mesh.export(file_type="glb"))
print(json.dumps(result))
