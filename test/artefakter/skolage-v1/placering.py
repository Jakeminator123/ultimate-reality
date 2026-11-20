"""Flytta SKO-03 och rödryggade kort 1. Anpassa endast dragarmens rigg."""
from copy import deepcopy
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation
import trimesh

here = Path(__file__).resolve().parent
source = here.parent / "kasinorum-utdrag-100"
spec = spec_from_file_location("grundrigg", source / "handkandidat/rigg.py")
rig = module_from_spec(spec)
spec.loader.exec_module(rig)
baseline = json.loads((source / "bana.json").read_text())
rest_frames = json.loads((source / "handkandidat/mhr-arm/matt-rigg.json").read_text())["frames"]


def palm_angles():
    # Recover the original hand orientation from the saved wrist and two pad
    # sites, since the GLB exports contain vertices rather than rig controls.
    grip = baseline["frames"][0]["contacts"]
    target = (np.array(grip["index"]["pad_xyz_m"]) + grip["middle"]["pad_xyz_m"]) / 2
    local_wrist = rig.wRest - (rig.pads["index"] + rig.pads["middle"]) / 2
    actual = np.array(rest_frames[0]["wrist"]) - target
    def residual(angles):
        return Rotation.from_euler("YX", angles, degrees=True).apply(local_wrist) - actual
    solution = least_squares(residual, [47., 28.], gtol=1e-13, xtol=1e-13)
    if np.linalg.norm(residual(solution.x)) > 1e-6:
        raise ValueError("Grundtagningens handvinkel kunde inte återskapas.")
    return solution.x


def translated_take(label, offset):
    path = deepcopy(baseline)
    path["take"] = "skolage-v1-" + label
    path["shoe"]["shoeCenterXZ"] = (np.array(path["shoe"]["shoeCenterXZ"]) + offset[[0, 2]]).round(8).tolist()
    path["mouth_xyz_m"] = (path["mouth_xyz_m"] + offset).round(8).tolist()
    for frame in path["frames"]:
        for contact in frame["contacts"].values():
            contact["pad_xyz_m"] = (contact["pad_xyz_m"] + offset).round(8).tolist()
    return path


def adjust_saved_arm():
    """Keep the selected pose's torso, shoulder, fingers and bone lengths."""
    output = here/"arbetskant-v4"
    output.mkdir(exist_ok=True)
    offset = np.array([0.,0.,-.10])
    path = translated_take("arbetskant-v4", offset)
    (output/"bana.json").write_text(json.dumps(path,indent=2)+"\n",encoding="utf8")
    shoulder = rig.aRest
    rows = []
    initial_verts, initial_elbow = rig.verts, rig.eRest
    for index,ref in enumerate(rest_frames):
        posed = trimesh.load(source/f"handkandidat/mhr-arm/drag-{index:02d}.glb",force="mesh",process=False)
        rig.verts = np.asarray(posed.vertices)
        elbow, wrist = np.asarray(ref["elbow"]), np.asarray(ref["wrist"])
        rig.eRest = elbow
        dest = wrist+offset
        axis = rig.unit(dest-shoulder)
        distance = np.linalg.norm(dest-shoulder)
        upper, fore = np.linalg.norm(elbow-shoulder), np.linalg.norm(wrist-elbow)
        along = (upper**2-fore**2+distance**2)/(2*distance)
        center = shoulder+along*axis
        pole = elbow-center
        pole -= (pole@axis)*axis
        new_elbow = center+rig.unit(pole)*np.sqrt(upper**2-along**2)
        upper_rot = rig.rotated(elbow-shoulder,new_elbow-shoulder)
        fore_rot = rig.rotated(wrist-elbow,dest-new_elbow)
        fraction = ((rig.verts-elbow)@(wrist-elbow))/fore**2
        distal = np.clip((fraction-.55)/.38,0.,1.)
        vertices = rig.blend_arm(upper_rot,fore_rot,Rotation.identity(),new_elbow,wrist,dest,distal)
        mesh = trimesh.Trimesh(vertices=vertices,faces=posed.faces,process=False)
        mesh.visual=posed.visual.copy()
        mesh.export(output/f"drag-{index:02d}.glb")
        rows.append({"frame":index+1,"elbow":new_elbow.tolist(),"wrist":dest.tolist(),
            "upper_fore_lengths_m":[upper,fore]})
    rig.verts,rig.eRest = initial_verts,initial_elbow
    (output/"matt-rigg.json").write_text(json.dumps({"source":"kasinorum-utdrag-100/handkandidat/mhr-arm","frames":rows},indent=2)+"\n",encoding="utf8")


def retarget(label, delta, angles, warm_start=False, lateral_elbow=False):
    output = here / label
    output.mkdir(exist_ok=True)
    offset = np.array(delta)
    path = translated_take(label,offset)
    (output / "bana.json").write_text(json.dumps(path, indent=2) + "\n", encoding="utf8")
    rig.path = path
    x,z = baseline["shoe"]["shoeCenterXZ"]
    base_origin = np.array([x, 0., z])
    rig.origin = base_origin + offset
    arm_model = rig.mhr_arm
    arm_model.cache_clear()
    if lateral_elbow:
        # A two-link arm can reach this wrist with its elbow either behind
        # the torso or beside it. Prefer Paulina's anatomical left side.
        solve = arm_model()
        def guide(hand, skin, elbow):
            axis = rig.unit(hand(rig.wRest)-rig.aRest)
            side = rig.unit(np.cross(axis,rig.up))
            alternate = elbow-2*np.dot(elbow-rig.aRest,side)*side
            return solve(hand,skin,max([elbow,alternate],key=lambda p:p[0]))
        rig.mhr_arm = lambda: guide
    if warm_start:
        # Approach the new grip continuously from the collision-tested base
        # pose. Starting this IK solve cold can choose a raised elbow.
        for fraction in np.linspace(0., 1., 11)[:-1]:
            initial = deepcopy(baseline["frames"][0])
            for site in initial["contacts"].values():
                site["pad_xyz_m"] = site["pad_xyz_m"] + offset*fraction
            rig.origin = base_origin + offset*fraction
            rig.create(initial, *angles, gap_goal=.00002, mode="mhr-arm")
        rig.origin = base_origin + offset
    rows = []
    for index, frame in enumerate(path["frames"]):
        vertices, gap, elbow, wrist = rig.create(frame, *angles, gap_goal=.00002, mode="mhr-arm")
        mesh = trimesh.Trimesh(vertices=vertices, faces=rig.mesh.faces, process=False)
        mesh.visual = rig.mesh.visual.copy()
        mesh.export(output / f"drag-{index:02d}.glb")
        rows.append(dict(frame=index+1, pad_gap_mm=gap, elbow=elbow.tolist(), wrist=wrist.tolist()))
    (output / "matt-rigg.json").write_text(json.dumps(dict(source=str(rig.source.relative_to(rig.root)),
        hand_yaw_pitch_deg=angles.tolist(), target_gap_mm=.02, frames=rows), indent=2) + "\n", encoding="utf8")
    rig.mhr_arm = arm_model
    print(label, angles.round(3), len(rows), flush=True)


if __name__ == "__main__":
    angles = palm_angles()
    adjust_saved_arm()
    retarget("vanster", [.10, 0., 0.], angles)
