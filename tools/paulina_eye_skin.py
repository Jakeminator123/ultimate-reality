"""Bind the photographed irises to Paulina's existing eye joints inside the eyelids."""

import argparse
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json

import cv2
import numpy as np

from material_versions import json_bytes, put, sha
from paulina_deal_p4 import Glb, Pose, compact, read_exported_motion
from paulina_face_fit import BASELINE, body_data, to_view
from paulina_original_portrait import projected
from paulina_utseende import mix, rgb_at, unit

# Opening inside each eyelid in original photograph 03. The eyelashes lie outside it.
OPENINGS = {
    "r_eye": [
        (663, 219),
        (670, 215),
        (677, 211),
        (682, 210.5),
        (687, 211.5),
        (694, 215),
        (702, 222),
        (694, 222),
        (687, 224),
        (681, 224.2),
        (674, 223),
        (668, 221.5),
    ],
    "l_eye": [
        (745, 220),
        (749, 214),
        (754, 209),
        (760, 206.2),
        (765, 206),
        (771, 206.8),
        (777, 210),
        (781.5, 213.7),
        (777, 216),
        (771, 219.4),
        (764, 221),
        (756, 220),
        (750, 219.6),
    ],
}


def matrices(glb, pose, joints, weights):
    inv = (
        glb.read(glb.doc["skins"][0]["inverseBindMatrices"])
        .reshape(-1, 4, 4)
        .transpose(0, 2, 1)
    )
    return ((pose.world @ inv)[joints] * weights[:, :, None, None]).sum(1)


def skin_xyz(m, v):
    return np.einsum("nij,nj->ni", m[:, :3, :3], v) + m[:, :3, 3]


def skin_photo_eyes(glb, pose, camera, gain):
    primitive, a, original_skin, world, head = body_data(glb, pose)
    uv = to_view(projected(world, camera), inverse=True)
    joints = a["JOINTS_0"].copy()
    weights = a["WEIGHTS_0"].copy()
    owner = np.zeros(len(joints), dtype=bool)
    by_eye = {}
    for joint_name, polygon in OPENINGS.items():
        index = pose.names.index(joint_name)
        pivot = pose.position(joint_name)
        if ((weights > 1e-6) & (joints == index)).any():
            raise ValueError("Ögonleden styr redan en del av denna kropp.")
        # Supersample the signed distance to the photographed rim. The transition
        # ends inside a narrow strip at each lid, so the brows and lashes stay put.
        poly = np.asarray(polygon, float)
        offset = np.floor(poly.min(0)) - 8
        scale = 5
        shape = np.ceil((poly.max(0) - offset + 8) * scale).astype(int)
        mask = np.zeros((shape[1], shape[0]), np.uint8)
        cv2.fillPoly(mask, [np.rint((poly - offset) * scale).astype(np.int32)], 1)
        distance = (
            cv2.distanceTransform(mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
            - cv2.distanceTransform(1 - mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        ) / scale
        alpha = gain * mix(
            -1.5, 5, rgb_at(distance[..., None], (uv - offset) * scale)[:, 0]
        )
        eyelid = (
            (alpha > 0.0005)
            & (head > 0.9)
            & (np.linalg.norm(world - pivot, axis=1) < 0.027)
            & (world[:, 2] > pivot[2] + 0.006)
        )
        if (
            np.count_nonzero(eyelid) < 12
            or np.max(alpha[eyelid]) < 0.75 * gain
            or owner[eyelid].any()
        ):
            raise ValueError(
                "Den fotograferade irisen går inte att knyta till ögats hudyta."
            )
        owner |= eyelid
        # glTF supports four influences here. Keep the three strongest existing
        # weights in their original proportions, and dedicate the fourth to this eye.
        rank = np.argsort(-weights[eyelid], axis=1, kind="stable")[:, :3]
        original = np.take_along_axis(weights[eyelid], rank, axis=1)
        original /= original.sum(1, keepdims=True)
        amount = alpha[eyelid]
        joints[eyelid] = np.column_stack(
            [
                np.take_along_axis(joints[eyelid], rank, axis=1),
                np.full(len(amount), index),
            ]
        )
        weights[eyelid] = np.column_stack([original * (1 - amount[:, None]), amount])
        by_eye[joint_name] = {
            "surfaceVertices": int(eyelid.sum()),
            "maxWeight": float(amount.max()),
        }
    new_skin = matrices(glb, pose, joints[owner], weights[owner])
    vertices = a["POSITION"].copy()
    normals = a["NORMAL"].copy()
    # Rebind at frame zero, including the model's non-identity initial eye rotations.
    vertices[owner] = np.linalg.solve(
        new_skin[:, :3, :3], (world[owner] - new_skin[:, :3, 3])[:, :, None]
    )[:, :, 0]
    n = np.einsum("nij,nj->ni", original_skin[owner, :3, :3], normals[owner])
    normals[owner] = unit(np.linalg.solve(new_skin[:, :3, :3], n[:, :, None])[:, :, 0])
    start_error = np.linalg.norm(
        skin_xyz(new_skin, vertices[owner]) - world[owner], axis=1
    ).max()
    if start_error > 1e-6 or np.abs(weights.sum(1) - 1).max() > 2e-6:
        raise ValueError("Viloposen eller hudvikterna avvek vid ögonpassningen.")
    for name, data, kind in [
        ("POSITION", vertices, "VEC3"),
        ("NORMAL", normals, "VEC3"),
        ("JOINTS_0", joints, "VEC4"),
        ("WEIGHTS_0", weights, "VEC4"),
    ]:
        primitive["attributes"][name] = glb.accessor(data, kind)
    return by_eye, owner, world, vertices, joints, weights, float(start_error)


def check_eye_motion(
    glb, poses, camera, owner, base, vertices, joints, weights, by_eye
):
    p = glb.doc["meshes"][0]["primitives"][0]
    faces = glb.read(p["indices"]).reshape(-1, 3)
    faces = faces[owner[faces].any(1)]
    use, remap = np.unique(faces, return_inverse=True)
    faces = remap.reshape(-1, 3)
    baseline = base[use][faces]
    triangles = unit(
        np.cross(baseline[:, 1] - baseline[:, 0], baseline[:, 2] - baseline[:, 0])
    )
    proof = {}
    worst = 1.0
    for frame, driven in enumerate(poses):
        local = poses[0].local.copy()
        for joint_name in OPENINGS:
            idx = driven.names.index(joint_name)
            local[idx] = driven.local[idx]
        isolated = Pose(driven.names, driven.parents, local)
        live = skin_xyz(
            matrices(glb, isolated, joints[use], weights[use]), vertices[use]
        )
        corners = live[faces]
        now = unit(
            np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
        )
        valid = (np.linalg.norm(triangles, axis=1) > 0.95) & (
            np.linalg.norm(now, axis=1) > 0.95
        )
        worst = min(worst, float((triangles[valid] * now[valid]).sum(1).min()))
        if frame not in (44, 68, 92, 123):
            continue
        proof[frame] = {}
        px = projected(live, camera) - projected(base[use], camera)
        for joint_name, metrics in by_eye.items():
            idx = driven.names.index(joint_name)
            iris = ((joints[use] == idx) * weights[use]).sum(1) > 0.65 * metrics[
                "maxWeight"
            ]
            proof[frame][joint_name] = {
                "medianMotionPx": np.median(px[iris], axis=0).round(3).tolist(),
                "maxMotionMm": float(
                    np.linalg.norm(live[iris] - base[use][iris], axis=1).max() * 1000
                ),
            }
    if worst < 0.1 or any(v["maxMotionMm"] < 0.25 for v in proof[44].values()):
        raise ValueError(
            f"Ögonvridningen ger ett veck eller för liten rörelse. Lägsta cos {worst:.3f}, ruta 44 {proof[44]}."
        )
    return proof, worst


def build(source, out, gain):
    receipt = json.loads(source.with_name("givmatning.json").read_bytes())
    source_hash = sha(source)
    if receipt["sceneSha256"] != source_hash or "portraitSurface03" not in receipt:
        raise ValueError(
            "Ögonen kräver den fotograferade ansiktsytan i spelarens skala."
        )
    glb = Glb(source)
    poses = read_exported_motion(glb, receipt["cardNodeIndex"])[0]
    camera = json.loads((BASELINE / "ljus.json").read_bytes())["cameras"]["0"]
    by_eye, owner, base, vertices, joints, weights, error = skin_photo_eyes(
        glb, poses[0], camera, gain
    )
    proof, worst = check_eye_motion(
        glb, poses, camera, owner, base, vertices, joints, weights, by_eye
    )
    result = {
        "sourceSceneSha256": source_hash,
        "eyes": by_eye,
        "maxRestDifferenceMm": error * 1000,
        "isolatedGazePixelsAndMm": proof,
        "framesCheckedForFolding": len(poses),
        "minNormalDot": worst,
    }
    glb.doc["asset"]["extras"]["eyeSkin03"] = result
    compact(glb)
    with TemporaryDirectory(prefix="paulina-ogon-") as t:
        data = glb.save(Path(t) / "giv.glb").read_bytes()
    scene_id = hashlib.sha256(data).hexdigest()
    report = json_bytes(
        {
            **receipt,
            "parentSceneSha256": source_hash,
            "sceneSha256": scene_id,
            "eyeSkin03": result,
        }
    )
    products = [
        (out / "giv.glb", data, scene_id),
        (out / "givmatning.json", report, hashlib.sha256(report).hexdigest()),
    ]
    for f, _, h in products:
        if f.exists() and sha(f) != h:
            raise FileExistsError("Välj en ny utgåvemapp: " + str(f))
    for f, b, h in products:
        put(f, b, h)
    print(json.dumps({"sceneSha256": scene_id, **result}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--gain", type=float, default=0.34)
    args = parser.parse_args()
    if not 0.1 <= args.gain <= 0.85:
        parser.error("Ögonvikten måste ligga mellan 0,1 och 0,85.")
    build(args.source, args.out, args.gain)
