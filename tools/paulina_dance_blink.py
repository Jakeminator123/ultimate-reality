"""Transfer MHR's two eyelid expressions to Paulina's registered dancing body."""

import argparse
import hashlib
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"
os.environ["OPENBLAS_NUM_THREADS"] = "4"

import numpy as np
from scipy.spatial.transform import Rotation
import torch

from material_versions import json_bytes, put, sha
from paulina_deal_p4 import Glb, ROOT, read_exported_motion
from paulina_face_fit import body_data, geometric_normals

V4 = ROOT / "avatars/paulina/giv-plats-4/v4/rigg/giv.glb"
V4_SHA = "3eee4c5579967fca5e7e0fb11a709b486d05f1568af9cdf802a0570fa32da954"
BASE = ROOT / "avatars/paulina/rorelseprov-dans/v1/rigg"
MODEL = ROOT.parent / "sam-3d-body/checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt"
CONSTRUCTION = ROOT / "avatars/paulina/prov-70/v1/modell/kropp.json"
LIDS = {
    "r_eye": {"basis": 13, "upper": [4815, 4433, 5504], "lower": [4229, 4228, 5585]},
    "l_eye": {"basis": 12, "upper": [2618, 1929, 1547], "lower": [1445, 1397, 2604]},
}
FRAMES = [0, 10, 11, 12, 13, 14, 15, 16, 95]
WEIGHTS = [0, 0, 0.34, 1, 1, 0.64, 0.19, 0, 0]
RATE = 24


def native_eyelids(model_path, lab, naming):
    recipe = json.loads(CONSTRUCTION.read_bytes())
    view = recipe["sourceViews"][0]
    estimate = lab / recipe["run"] / view["estimate"]
    if (
        sha(estimate) != view["estimateSha256"]
        or sha(model_path) != recipe["mhrModelSha256"]
    ):
        raise ValueError(
            "MHR-vikterna eller sittfotots passning skiljer sig från källutgåvan."
        )
    with np.load(estimate, allow_pickle=False) as recorded:
        shape = torch.from_numpy(recorded["shape_params"].astype("float32")).reshape(
            1, -1
        )
        pose = torch.from_numpy(recorded["mhr_model_params"].astype("float32")).reshape(
            1, -1
        )
    model = torch.jit.load(str(model_path), map_location="cpu").eval()
    head = list(model.get_joint_names()).index("c_head")
    zero = torch.zeros((1, 72), dtype=shape.dtype)
    with torch.inference_mode():
        base, skeleton = model(shape, pose, zero)
        basis = {}
        for side, landmark in naming.items():
            active = zero.clone()
            active[0, landmark["basis"]] = 1
            displaced, same_skeleton = model(shape, pose, active)
            np.testing.assert_allclose(
                skeleton.numpy(), same_skeleton.numpy(), atol=1e-6
            )
            basis[side] = (displaced[0] - base[0]).numpy().astype(float) / 100
    joint = skeleton[0, head].numpy()
    return basis, Rotation.from_quat(joint[3:7]).as_matrix() * joint[7], recipe


def smoothstep(low, high, value):
    t = np.clip((value - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def transfer(reference, model, lab):
    receipt = json.loads(V4.with_name("givmatning.json").read_bytes())
    pose = read_exported_motion(reference, receipt["cardNodeIndex"])[0][0]
    primitive, attrs, skin, world, head_weights = body_data(reference, pose)
    sam = attrs["_SAM_INDEX"].ravel().astype(int)
    bind = (
        reference.read(reference.doc["skins"][0]["inverseBindMatrices"])
        .reshape(-1, 4, 4)
        .transpose(0, 2, 1)
    )
    head = pose.names.index("c_head")
    basis, native_head, recipe = native_eyelids(model, lab, LIDS)
    to_bind = np.linalg.inv(bind[head])[:3, :3] @ np.linalg.inv(native_head)
    displacement = np.zeros_like(attrs["POSITION"], dtype=float)
    metrics = {}
    for side, landmarks in LIDS.items():
        distance = np.linalg.norm(world - pose.position(side), axis=1)
        feather = (1 - smoothstep(0.027, 0.038, distance)) * smoothstep(
            0.7, 0.98, head_weights
        )
        delta = basis[side][sam] @ to_bind.T * feather[:, None]
        world_delta = np.einsum("nij,nj->ni", skin[:, :3, :3], delta)
        upper = np.array([np.flatnonzero(sam == idx)[0] for idx in landmarks["upper"]])
        lower = np.array([np.flatnonzero(sam == idx)[0] for idx in landmarks["lower"]])
        gap = world[upper, 1].mean() - world[lower, 1].mean()
        closure = world_delta[lower, 1].mean() - world_delta[upper, 1].mean()
        if gap < 0.004 or closure < 0.003:
            raise ValueError(
                f"Fel riktning eller öppning för MHR:s ögonlock vid {side}."
            )
        gain = gap / closure
        if not 0.55 < gain < 2.6:
            raise ValueError(
                f"Ögonlockens passning i {side} skulle kräva {gain:.3f} gånger källrörelsen."
            )
        delta *= gain
        displacement += delta
        metrics[side] = {
            "basisIndex": landmarks["basis"],
            "pairedSAMUpper": landmarks["upper"],
            "pairedSAMLower": landmarks["lower"],
            "sourceLidGapMm": float(gap * 1000),
            "unitBasisClosureMm": float(closure * 1000),
            "gain": float(gain),
            "closedLandmarkVerticalGapMm": float((gap - closure * gain) * 1000),
        }
    active = np.linalg.norm(displacement, axis=1) > 1e-7
    faces = reference.read(primitive["indices"]).reshape(-1, 3)
    vertices = attrs["POSITION"].astype(float)
    original, _ = geometric_normals(vertices, faces, sam)
    modified, _ = geometric_normals(vertices + displacement, faces, sam)
    normals = modified - original
    # The original GLB already supplies authored normals over seams and clothing.
    # Add only the change in surface normal around the active eye triangles.
    local = np.zeros(len(vertices), dtype=bool)
    local[np.unique(faces[active[faces].any(1)])] = True
    normals[~local] = 0
    return (
        displacement.astype("<f4"),
        normals.astype("<f4"),
        {
            "sourceModelSha256": recipe["mhrModelSha256"],
            "sourceEstimateSha256": recipe["sourceViews"][0]["estimateSha256"],
            "surfaceVerticesOver0_01Mm": int(
                (np.linalg.norm(displacement, axis=1) > 0.00001).sum()
            ),
            "largestSurfaceDisplacementMm": float(
                np.linalg.norm(displacement, axis=1).max() * 1000
            ),
            "eyes": metrics,
        },
    )


def add_blink(source, out, model, lab):
    if sha(V4) != V4_SHA:
        raise ValueError("V4-föräldern till dansprovet har ändrats.")
    source_hash = sha(source)
    body_record = None
    if source.resolve() != V4.resolve():
        body_record = json.loads(source.with_name("dansmatning.json").read_bytes())
        if (
            body_record["sceneSha256"] != source_hash
            or body_record["sourceV4Sha256"] != V4_SHA
            or body_record["fps"] != RATE
            or body_record["frames"] != 96
            or body_record["seconds"] != 4
        ):
            raise ValueError(
                "Kropp och tidsregister måste vara samma fyrasekunders dansutgåva."
            )
    elif out.resolve() == BASE.resolve():
        raise ValueError(
            "Sittande V4 är en kalibrering. Slutfilen måste byggas från stående dans."
        )
    donor, glb = Glb(V4), Glb(source)
    primary = donor.doc["meshes"][0]["primitives"][0]
    (mesh_id,) = (
        i
        for i, mesh in enumerate(glb.doc["meshes"])
        if "_SAM_INDEX" in mesh["primitives"][0]["attributes"]
        and mesh.get("extras", {}).get("appearancePart") == "body"
    )
    mesh = glb.doc["meshes"][mesh_id]
    body = mesh["primitives"][0]
    for key in ("POSITION", "NORMAL", "JOINTS_0", "WEIGHTS_0", "_SAM_INDEX"):
        np.testing.assert_array_equal(
            glb.read(body["attributes"][key]), donor.read(primary["attributes"][key])
        )
    delta, normal, details = transfer(donor, model, lab)
    if any(p.get("targets") for p in mesh["primitives"]):
        raise ValueError("Den valda rörelsekällan har redan ett ansiktsmål.")
    for part in mesh["primitives"]:
        if part is body:
            move, tilt = glb.accessor(delta, "VEC3"), glb.accessor(normal, "VEC3")
        else:
            empty = np.zeros_like(glb.read(part["attributes"]["POSITION"]))
            move = tilt = glb.accessor(empty, "VEC3")
        part["targets"] = [{"POSITION": move, "NORMAL": tilt}]
    mesh["weights"] = [0]
    mesh.setdefault("extras", {})["targetNames"] = ["Blinka med båda ögonlocken"]
    node = next(i for i, n in enumerate(glb.doc["nodes"]) if n.get("mesh") == mesh_id)
    glb.doc["nodes"][node]["weights"] = [0]
    clip = glb.doc["animations"][0]
    seconds = (np.array(FRAMES, dtype=float) / RATE).astype("<f4")
    values = np.array(WEIGHTS, dtype="<f4")
    time_accessor = glb.accessor(seconds, "SCALAR")
    value_accessor = glb.accessor(values, "SCALAR")
    for acc, data in ((time_accessor, seconds), (value_accessor, values)):
        glb.doc["accessors"][acc].update(
            min=[float(data.min())], max=[float(data.max())]
        )
        glb.doc["bufferViews"][glb.doc["accessors"][acc]["bufferView"]].pop(
            "target", None
        )
    clip["channels"].append(
        {"sampler": len(clip["samplers"]), "target": {"node": node, "path": "weights"}}
    )
    clip["samplers"].append(
        {"input": time_accessor, "output": value_accessor, "interpolation": "LINEAR"}
    )
    record = {
        "sourceBodySha256": source_hash,
        "registeredAvatarSha256": V4_SHA,
        "fps": RATE,
        "frames": 96,
        "exposureSeconds": 4,
        "blinkSourceFrames": FRAMES,
        "blinkWeights": WEIGHTS,
        **details,
    }
    if body_record:
        record["sourceMotionReceiptSha256"] = sha(source.with_name("dansmatning.json"))
    glb.doc["asset"].setdefault("extras", {})["danceBlink"] = record
    with TemporaryDirectory(prefix="paulina-dansblink-") as tmp:
        data = glb.save(Path(tmp) / "dans-med-blink.glb").read_bytes()
    record["sceneSha256"] = hashlib.sha256(data).hexdigest()
    payloads = {"dans-med-blink.glb": data, "blinkmatning.json": json_bytes(record)}
    for name, blob in payloads.items():
        put(out / name, blob, hashlib.sha256(blob).hexdigest())
    print(json.dumps(record, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=BASE / "kropp.glb")
    parser.add_argument("--out-dir", type=Path, default=BASE)
    parser.add_argument("--model", type=Path, default=MODEL)
    parser.add_argument(
        "--lab", type=Path, default=Path("D:/ultimate-reality-lab/saved")
    )
    args = parser.parse_args()
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    add_blink(args.source, args.out_dir, args.model, args.lab)
