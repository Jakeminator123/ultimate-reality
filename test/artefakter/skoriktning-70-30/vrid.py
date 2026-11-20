"""Vrider kortbana och vänsterhand kring skons centrum i arbetskant-v4."""
import json
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import numpy as np
import trimesh
from scipy.spatial.transform import Rotation


here = Path(__file__).resolve().parent
base = here.parent / "skolage-v1/arbetskant-v4"
spec = spec_from_file_location("grundrigg", here.parent / "kasinorum-utdrag-100/handkandidat/rigg.py")
rig = module_from_spec(spec)
spec.loader.exec_module(rig)


def rotated_take():
    take = json.loads((base / "bana.json").read_text(encoding="utf8"))
    shoe = take["shoe"]
    yaw = float(np.degrees(np.arctan2(-.70, .30)))
    turn = Rotation.from_euler("Y", yaw - shoe["yawDegrees"], degrees=True)
    x, z = shoe["shoeCenterXZ"]
    center = np.array([x, 0., z])
    def swivel(point):
        return center + turn.apply(np.asarray(point) - center)
    take["take"] = "skoriktning-70-30-v1"
    shoe["yawDegrees"] = yaw
    take["outward_xyz"] = turn.apply(take["outward_xyz"]).round(8).tolist()
    take["mouth_xyz_m"] = swivel(take["mouth_xyz_m"]).round(8).tolist()
    for frame in take["frames"]:
        for finger in frame["contacts"].values():
            finger["pad_xyz_m"] = swivel(finger["pad_xyz_m"]).round(8).tolist()
            finger["surface_normal"] = turn.apply(finger["surface_normal"]).round(8).tolist()
    return take, turn, swivel


def retarget():
    take, turn, swivel = rotated_take()
    (here / "bana.json").write_text(json.dumps(take, indent=2)+"\n", encoding="utf8")
    rows = []
    source = json.loads((base / "matt-rigg.json").read_text(encoding="utf8"))
    for i, row in enumerate(source["frames"]):
        file = f"drag-{i:02d}.glb"
        mesh = trimesh.load(base/file, force="mesh", process=False)
        rig.verts = np.asarray(mesh.vertices)
        elbow = rig.eRest = np.asarray(row["elbow"])
        wrist = np.asarray(row["wrist"])
        dest = swivel(wrist)
        shoulder = rig.aRest
        upper, fore = np.linalg.norm(elbow-shoulder), np.linalg.norm(wrist-elbow)
        reach = np.linalg.norm(dest-shoulder)
        axis = (dest-shoulder)/reach
        along = (upper**2 - fore**2 + reach**2)/(2*reach)
        center = shoulder + along*axis
        pole = elbow-center
        pole -= (pole@axis)*axis
        bent_elbow = center + rig.unit(pole)*np.sqrt(upper**2-along**2)
        upper_rot = rig.rotated(elbow-shoulder, bent_elbow-shoulder)
        fore_rot = rig.rotated(wrist-elbow, dest-bent_elbow)
        fraction = ((rig.verts-elbow)@(wrist-elbow))/fore**2
        distal = np.clip((fraction-.55)/.38, 0., 1.)
        vertices = rig.blend_arm(upper_rot, fore_rot, turn, bent_elbow, wrist, dest, distal)
        result = trimesh.Trimesh(vertices=vertices, faces=mesh.faces, process=False)
        result.visual = mesh.visual.copy()
        result.export(here/file)
        rows.append({"frame": i+1, "elbow": bent_elbow.tolist(), "wrist": dest.tolist(),
                     "upper_fore_lengths_m": [upper, fore]})
    (here/"matt-rigg.json").write_text(json.dumps({
        "source": "skolage-v1/arbetskant-v4", "frames": rows
    },indent=2)+"\n",encoding="utf8")


if __name__ == "__main__":
    retarget()
