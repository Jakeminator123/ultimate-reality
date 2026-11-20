"""Fit the filmed two-finger grasp and the final fingertip contact to the skinned card."""

import numpy as np
from scipy.spatial.transform import Rotation


def contact_pose(glb, names, parents, rest, driven, card_centres, card_rotations, set_down, release):
    if release is None:
        return driven, {}
    # The contact constraints use the vertices of the two distal phalanges.
    attrs = glb.doc["meshes"][0]["primitives"][0]["attributes"]
    points = glb.read(attrs["POSITION"])
    joints = glb.read(attrs["JOINTS_0"])
    weights = glb.read(attrs["WEIGHTS_0"])
    fingers = {}
    for name in ("thumb", "index", "middle"):
        distal = np.array([joint in (f"r_{name}2", f"r_{name}3", f"r_{name}_null") for joint in names])
        ids = np.flatnonzero((distal[joints] * weights).sum(axis=1) > 0.55)
        fingers[name] = (np.column_stack((points[ids], np.ones(len(ids)))), joints[ids], weights[ids])
    inverse = glb.read(glb.doc["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    card_basis = Rotation.from_quat(card_rotations).as_matrix()
    scales = np.linalg.norm(rest[:, :3, :3], axis=1)
    output = driven.copy()
    corrections = {}

    def pose(local):
        absolute = local.copy()
        for bone, parent in enumerate(parents):
            if parent >= 0:
                absolute[bone] = absolute[parent] @ absolute[bone]
        return absolute

    def nearest(absolute, digit, basis, centre, top):
        xyz, indices, factors = fingers[digit]
        skin = (absolute @ inverse)[:, :3]
        surface = sum(
            np.einsum("vbc,vc->vb", skin[indices[:, slot]], xyz) * factors[:, slot, None]
            for slot in range(factors.shape[1])
        )
        relative = (surface - centre) @ basis
        contact = np.clip(relative, [-0.0314, -0.00035, -0.0444], [0.0314, 0.00035, 0.0444])
        contact[:, 1] = 0.00045 if top else -0.00045
        gaps = np.linalg.norm(contact - relative, axis=1)
        closest = gaps.argmin()
        return surface[closest], centre + contact[closest] @ basis.T, gaps[closest]

    for f in range(release):
        filmed = Rotation.from_quat(driven[f]).as_matrix()
        local = rest.copy()
        local[:, :3, :3] = filmed * scales[:, None, :]
        absolute = pose(local)
        settled = set_down is not None and f >= set_down
        digits = (("index", True), ("middle", True)) if settled else (("thumb", True), ("index", False))
        for name, top in digits:
            chain = [names.index(f"r_{name}{k}") for k in (2, 1, 3)]
            if name == "thumb":
                chain.append(names.index("r_thumb0"))
            if name == digits[0][0]:
                chain.extend([names.index("r_wrist"), names.index("r_lowarm"), names.index("r_uparm")])
            for _ in range(7):
                changed = False
                for bone in chain:
                    point, target, gap = nearest(absolute, name, card_basis[f], card_centres[f], top)
                    if gap < 0.00065:
                        break
                    origin = absolute[bone, :3, 3]
                    old, new = point - origin, target - origin
                    cross = np.cross(old, new)
                    length = np.linalg.norm(cross)
                    if length < 1e-10:
                        continue
                    turn = np.arctan2(length, old @ new)
                    delta = Rotation.from_rotvec(
                        cross / length * min(turn * 0.85, np.deg2rad(9))
                    ).as_matrix()
                    parent = absolute[parents[bone], :3, :3]
                    parent = parent / np.linalg.norm(parent, axis=0, keepdims=True)
                    old_local = local[bone, :3, :3].copy()
                    new_rot = parent.T @ delta @ parent @ (old_local / scales[bone][None, :])
                    relative = Rotation.from_matrix(filmed[bone].T @ new_rot).as_rotvec()
                    limit = np.deg2rad({"r_wrist": 9, "r_lowarm": 5, "r_uparm": 3}.get(names[bone], 32))
                    bounded = relative * min(1.0, limit / max(np.linalg.norm(relative), 1e-10))
                    new_rot = filmed[bone] @ Rotation.from_rotvec(bounded).as_matrix()
                    local[bone, :3, :3] = new_rot * scales[bone][None, :]
                    proposed = pose(local)
                    new_gap = nearest(proposed, name, card_basis[f], card_centres[f], top)[2]
                    if new_gap < gap - 0.00001:
                        absolute = proposed
                        output[f, bone] = Rotation.from_matrix(new_rot).as_quat()
                        changed = True
                        amount = float(np.rad2deg(np.linalg.norm(bounded)))
                        corrections[names[bone]] = max(amount, corrections.get(names[bone], 0.0))
                    else:
                        local[bone, :3, :3] = old_local
                if not changed or gap < 0.00065:
                    break
    # The visible gap opens over several source frames. Fade the final
    # articulation into the independently captured return, preserving its timing.
    for bone_name in corrections:
        bone = names.index(bone_name)
        residual = (
            Rotation.from_quat(driven[release - 1, bone]).inv()
            * Rotation.from_quat(output[release - 1, bone])
        ).as_rotvec()
        for step in range(min(4, len(output) - release)):
            weight = (4 - step) / 5
            output[release + step, bone] = (
                Rotation.from_quat(driven[release + step, bone]) * Rotation.from_rotvec(residual * weight)
            ).as_quat()
    return output, {
        "maxAdjustmentDegreesByJoint": {name: round(degrees, 2) for name, degrees in corrections.items()},
        "method": "Distal skin on opposite card faces during the pinch, then index and middle fingertips on the stationary upper surface. Captured return resumes after release.",
    }
