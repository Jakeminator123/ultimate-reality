"""Create Paulina's seated gaze trial from the released V4, with measured skin and eye joints."""

import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from scipy.spatial.transform import Rotation

from material_versions import sha
from paulina_deal_p4 import Glb, Pose, ROOT, hierarchy, read_exported_motion, rotation_blocks
from paulina_face_expression import freeze_original
from paulina_face_fit import BASELINE, body_data
from paulina_eye_skin import matrices, skin_xyz
from paulina_hand_material import json_bytes, publish
from paulina_motion_trial import continuous, motion_channel
from paulina_original_portrait import projected
from paulina_utseende import unit

BASE = ROOT / "avatars/paulina/giv-plats-4/v4/rigg/giv.glb"
BASE_HASH = "3eee4c5579967fca5e7e0fb11a709b486d05f1568af9cdf802a0570fa32da954"
OUT = BASE.parent.parent.parent / "blick/v1"
NAMES = ("c_neck", "c_head", "r_eye", "l_eye")
TIMES = np.array([0, 0.75, 1.5, 2.25, 3, 4, 5, 6, 7], dtype="<f4")
LABELS = (
    "vila",
    "ogon-hoger",
    "ogon-mitten",
    "ogon-vanster",
    "mellanvila",
    "huvud-hoger",
    "huvud-mitten",
    "huvud-vanster",
    "slutvila",
)


def rotated(rest, head_degrees, eye_degrees):
    pose = Pose(rest.names, rest.parents, rest.local.copy())
    for name, yaw in zip(NAMES, (head_degrees * 0.28, head_degrees * 0.72, eye_degrees, eye_degrees)):
        if yaw:
            pose.rotate(name, Rotation.from_euler("y", yaw, degrees=True).as_matrix())
    return pose


def angle_delta(before, after):
    first, last = [np.degrees(np.arctan2(a[0], a[2])) for a in (before, after)]
    return float((last - first + 180) % 360 - 180)


def inspect(glb, poses):
    p, a, _, neutral_world, _ = body_data(glb, poses[0])
    ids = a["_SAM_INDEX"].ravel()
    eye_indices = {name: poses[0].names.index(name) for name in NAMES[-2:]}
    owners = {name: ((a["JOINTS_0"] == index) * a["WEIGHTS_0"]).sum(1) for name, index in eye_indices.items()}
    skin_eye = np.logical_or.reduce([w > 0 for w in owners.values()])
    eyes_faces = glb.read(p["indices"]).reshape(-1, 3)
    eyes_faces = eyes_faces[skin_eye[eyes_faces].any(1)]
    mats0 = poses[0].world[poses[0].names.index("c_head")]
    base_dir = {key: unit(poses[0].position(key + "_null") - poses[0].position(key)) for key in eye_indices}
    camera = json.loads((BASELINE / "ljus.json").read_text(encoding="utf8"))["cameras"]["0"]
    names = np.array(poses[0].names)
    fixed = np.array(
        [
            n.startswith(
                (
                    "l_wrist",
                    "r_wrist",
                    "r_thumb",
                    "l_thumb",
                    "r_index",
                    "l_index",
                    "r_middle",
                    "l_middle",
                    "r_ring",
                    "l_ring",
                    "r_pinky",
                    "l_pinky",
                )
            )
            for n in names
        ]
    )
    hands = (fixed[a["JOINTS_0"]] * a["WEIGHTS_0"]).sum(1) > 0
    normal0 = np.cross(
        neutral_world[eyes_faces[:, 1]] - neutral_world[eyes_faces[:, 0]],
        neutral_world[eyes_faces[:, 2]] - neutral_world[eyes_faces[:, 0]],
    )
    valid = np.linalg.norm(normal0, axis=1) > 1e-10
    data = {}
    for tag, pose in zip(LABELS, poses):
        head = pose.world[pose.names.index("c_head")]
        into_neutral = mats0 @ np.linalg.inv(head)
        world = skin_xyz(matrices(glb, pose, a["JOINTS_0"], a["WEIGHTS_0"]), a["POSITION"])
        stabilized = world @ into_neutral[:3, :3].T + into_neutral[:3, 3]
        linked = angle_delta([0, 0, 1], (head[:3, :3] @ np.linalg.inv(mats0[:3, :3])) @ [0, 0, 1])
        entry = {"headYawChangeDeg": round(linked, 4), "eyes": {}}
        for name, w in owners.items():
            dir1 = unit(pose.position(name + "_null") - pose.position(name))
            iris = w >= 0.65 * w.max()
            displacement = stabilized[iris] - neutral_world[iris]
            proof = projected(stabilized[iris], camera) - projected(neutral_world[iris], camera)
            iris_landmark = 4383 if name == "r_eye" else 1497
            i = int(np.flatnonzero(ids == iris_landmark)[0])
            entry["eyes"][name] = {
                "weightedSkinVertices": int((w > 0).sum()),
                "innerIrisSampleCount": int(iris.sum()),
                "rayYawChangeDeg": round(angle_delta(base_dir[name], dir1), 4),
                "rayYawRelativeToHeadDeg": round(angle_delta(base_dir[name], into_neutral[:3, :3] @ dir1), 4),
                "skinMedianDxMmRelativeToHead": round(float(np.median(displacement[:, 0]) * 1000), 4),
                "innerIrisMedianDxPxFixedHeadAt1280": round(float(np.median(proof[:, 0])), 4),
                "irisLandmarkDeltaMmRelativeToHead": ((stabilized[i] - neutral_world[i]) * 1000)
                .round(4)
                .tolist(),
            }
        n1 = np.cross(
            stabilized[eyes_faces[:, 1]] - stabilized[eyes_faces[:, 0]],
            stabilized[eyes_faces[:, 2]] - stabilized[eyes_faces[:, 0]],
        )
        entry["minimumEyelidTriangleNormalCosine"] = float(
            (unit(normal0[valid]) * unit(n1[valid])).sum(1).min()
        )
        entry["handMovementMm"] = float(
            np.linalg.norm(world[hands] - neutral_world[hands], axis=1).max() * 1000
        )
        data[tag] = entry
    return data


def generate(out, standalone, head, accompanied_eye):
    if sha(BASE) != BASE_HASH:
        raise ValueError("Giv V4 motsvarar inte blickprovets registrerade vilopose.")
    glb = Glb(BASE)
    receipt = json.loads(BASE.with_name("givmatning.json").read_text(encoding="utf8"))
    rest = read_exported_motion(glb, receipt["cardNodeIndex"])[0][0]
    _, joint_nodes, _, _ = hierarchy(glb)
    yaw = [
        (0, 0),
        (0, -standalone),
        (0, 0),
        (0, standalone),
        (0, 0),
        (-head, -accompanied_eye),
        (0, 0),
        (head, accompanied_eye),
        (0, 0),
    ]
    poses = [rotated(rest, h, e) for h, e in yaw]
    metrics = inspect(glb, poses)
    worst = min(s["minimumEyelidTriangleNormalCosine"] for s in metrics.values())
    if worst < 0.05 or any(x["handMovementMm"] > 1e-6 for x in metrics.values()):
        raise ValueError(f"Ett hudveck eller en handrörelse uppstod, lägsta cos {worst:.4f}.")
    freeze_original(glb)
    clock = glb.accessor(TIMES.reshape(-1, 1), "SCALAR")
    glb.doc["accessors"][clock].update(min=[0], max=[7])
    glb.doc["bufferViews"][glb.doc["accessors"][clock]["bufferView"]].pop("target", None)
    clip = {"name": "Paulinas blick · ögon och huvud", "samplers": [], "channels": []}
    for name in NAMES:
        idx = rest.names.index(name)
        q = continuous(
            Rotation.from_matrix(np.stack([rotation_blocks(p.local[idx, :3, :3]) for p in poses])).as_quat()
        )
        motion_channel(glb, clip, clock, joint_nodes[idx], "rotation", q)
    glb.doc["animations"] = [clip]
    proof = {
        "sourceSha256": BASE_HASH,
        "sourceFrame": 0,
        "clip": clip["name"],
        "fps": 24,
        "seconds": TIMES.tolist(),
        "labels": LABELS,
        "eyeOnlyYawDeg": standalone,
        "headAndEyes": {"headDeg": head, "additionalEyeDeg": accompanied_eye},
        "samples": metrics,
        "frameKeys": dict(zip(LABELS, np.rint(TIMES * 24).astype(int).tolist())),
    }
    glb.doc["asset"].setdefault("extras", {})["gazeTrial"] = proof
    with TemporaryDirectory(prefix="paulina-blick-") as temp:
        binary = glb.save(Path(temp) / "blick.glb").read_bytes()
    proof["sceneSha256"] = hashlib.sha256(binary).hexdigest()
    publish(out, {"blick.glb": binary, "blick.json": json_bytes(proof)})
    print(proof["sceneSha256"], worst, json.dumps(metrics["ogon-vanster"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    c = argparse.ArgumentParser(description=__doc__)
    c.add_argument("--out-dir", type=Path, default=OUT)
    c.add_argument("--eye-only", type=float, default=24.0)
    c.add_argument("--head", type=float, default=23.0)
    c.add_argument("--accompanied-eye", type=float, default=11.0)
    o = c.parse_args()
    generate(o.out_dir, o.eye_only, o.head, o.accompanied_eye)
