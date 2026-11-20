"""Retarget a measured Runway performance onto one seated actor, in metres."""

import argparse
import json
import os
from pathlib import Path

import numpy as np
import torch
from scipy.spatial.transform import Rotation

from material_versions import save_version, sha
from paulina_blackjack_scene import measure_table_contact, seat_contact, surroundings
from paulina_trial_boots import fit_boots
from paulina_trial_grip import contact_pose
from paulina_trial_surface import bake_trial_views
from paulina_utseende import Glb
from sam_video_motion import front_card_texture, observed_card


def hierarchy(glb):
    joint_nodes = glb.doc["skins"][0]["joints"]
    names = [glb.doc["nodes"][index]["name"] for index in joint_nodes]
    parents = np.full(len(names), -1, dtype=int)
    local = np.tile(np.eye(4), (len(names), 1, 1))
    for i, index in enumerate(joint_nodes):
        node = glb.doc["nodes"][index]
        local[i, :3, 3] = node["translation"]
        local[i, :3, :3] = Rotation.from_quat(node["rotation"]).as_matrix() @ np.diag(node["scale"])
        for child in node.get("children", []):
            k = joint_nodes.index(child)
            if k <= i:
                raise ValueError("Expected a topologically sorted MHR skeleton.")
            parents[k] = i
    return names, joint_nodes, parents, local


def world_matrices(local, parents):
    result = local.copy()
    for i, parent in enumerate(parents):
        if parent >= 0:
            result[..., i, :, :] = result[..., parent, :, :] @ result[..., i, :, :]
    return result


def continuous(q):
    out = q.copy()
    for frame in range(1, len(q)):
        sign = np.where((out[frame] * out[frame - 1]).sum(-1) < 0, -1.0, 1.0)
        out[frame] *= sign[..., None]
    return out


def rotation_blocks(mat):
    return mat / np.maximum(np.linalg.norm(mat, axis=-2, keepdims=True), 1e-9)


def rig_pose(driven, rest, parents):
    n, count = driven.shape[:2]
    local = np.broadcast_to(rest, (n, *rest.shape)).copy()
    scales = np.linalg.norm(rest[:, :3, :3], axis=1)
    local[..., :3, :3] = (
        Rotation.from_quat(driven.reshape(-1, 4)).as_matrix().reshape(n, count, 3, 3)
        * scales[None, :, None, :]
    )
    return world_matrices(local, parents)


def retarget(track, model_path, names, parents, rest):
    char = torch.jit.load(str(model_path), map_location="cpu")
    if list(char.get_joint_names()) != names or sha(model_path) != str(track["mhr_sha256"]):
        raise ValueError("The tracking run and the mesh must share the MHR hierarchy and model.")
    params = np.column_stack((track["mhr_model_params"], np.zeros_like(track["shape_params"])))
    torch.set_num_threads(4)
    with torch.no_grad():
        joints = char.character_torch.model_parameters_to_joint_parameters(torch.from_numpy(params))
        state = char.character_torch.joint_parameters_to_skeleton_state(joints).numpy()
    camera_axes = np.diag([1.0, -1.0, -1.0])
    if np.max(np.abs(state[..., :3] @ camera_axes / 100 - track["pred_joint_coords"])) > 3e-6:
        raise ValueError("MHR and the recorded joint positions disagree.")
    n, count = state.shape[:2]
    source_world = Rotation.from_quat(state[..., 3:7].reshape(-1, 4)).as_matrix().reshape(n, count, 3, 3)
    source_local = source_world.copy()
    for j, parent in enumerate(parents):
        if parent >= 0:
            source_local[:, j] = source_world[:, parent].transpose(0, 2, 1) @ source_world[:, j]
    pelvis = names.index("root")
    spine = names.index("c_spine0")
    active = [i for i in range(spine, len(names)) if not names[i].endswith("_null")]
    # Anchor the seated pelvis and feet. Put the filmed pelvis's rotation
    # relative to frame zero into the torso so a genuine lean remains visible.
    neutral_world = world_matrices(rest, parents)
    source_local[:, spine] = source_world[0, pelvis].T @ source_world[:, pelvis] @ source_local[:, spine]
    raw_q = continuous(
        Rotation.from_matrix(source_local.reshape(-1, 3, 3)).as_quat().reshape(n, count, 4)
    )
    times = track["times"]
    bandwidth = min(0.052, float(np.median(np.diff(times))) * 0.65)
    kernel = np.exp(-0.5 * ((times[:, None] - times[None, :]) / bandwidth) ** 2)
    kernel /= kernel.sum(1, keepdims=True)
    smoothed = np.einsum("ft,tjq->fjq", kernel, raw_q)
    smoothed /= np.linalg.norm(smoothed, axis=2, keepdims=True)
    baseline = Rotation.from_matrix(rotation_blocks(rest[:, :3, :3])).as_quat()
    driven = np.tile(baseline, (n, 1, 1))
    driven[:, active] = smoothed[:, active]
    final = rig_pose(driven, rest, parents)
    # Fixed camera calibration from initial pelvis orientation and stable limb lengths.
    frame_basis = rotation_blocks(neutral_world[pelvis, :3, :3]) @ source_world[0, pelvis].T @ camera_axes
    main_bones = [("uparm", "lowarm"), ("lowarm", "wrist"), ("upleg", "lowleg"), ("lowleg", "foot")]
    pairs = [
        (names.index(side + "_" + start), names.index(side + "_" + end))
        for side in ("l", "r")
        for start, end in main_bones
    ]
    b = np.array([np.linalg.norm(neutral_world[j, :3, 3] - neutral_world[p, :3, 3]) for j, p in pairs])
    a = np.stack(
        [
            np.linalg.norm(track["pred_joint_coords"][:, j] - track["pred_joint_coords"][:, p], axis=1)
            for j, p in pairs
        ]
    )
    scale = float(np.median(b[:, None] / a))
    return driven, active, final, frame_basis, scale, bandwidth


def motion_channel(glb, animation, clock, node, path, values):
    kind = "VEC4" if path == "rotation" else "VEC3"
    acc = glb.accessor(np.asarray(values, dtype="<f4"), kind)
    glb.doc["bufferViews"][glb.doc["accessors"][acc]["bufferView"]].pop("target", None)
    sampler = len(animation["samplers"])
    animation["samplers"].append({"input": clock, "output": acc, "interpolation": "LINEAR"})
    animation["channels"].append({"sampler": sampler, "target": {"node": node, "path": path}})


def deformed_vertices(glb, palette, attrs, ids):
    """Apply the glTF skin's four normalized joint influences to selected vertices."""
    points = glb.read(attrs["POSITION"])[ids]
    points = np.column_stack((points, np.ones(len(points))))
    joints = glb.read(attrs["JOINTS_0"])[ids]
    weights = glb.read(attrs["WEIGHTS_0"])[ids]
    final = np.zeros((len(palette), len(points), palette.shape[-2]))
    for influence in range(weights.shape[1]):
        transformed = np.einsum("fvbc,vc->fvb", palette[:, joints[:, influence]], points)
        final += transformed * weights[None, :, influence, None]
    return final


def sole_clearance(glb, palette, names):
    """Measure the moving mesh against the viewer's physical ground plane, y=0."""
    result = {}
    for primitive in glb.doc["meshes"][0]["primitives"]:
        if glb.doc["materials"][primitive["material"]]["name"] != "Stövlarnas gummisula":
            continue
        ids = np.unique(glb.read(primitive["indices"]))
        attrs = primitive["attributes"]
        joints = glb.read(attrs["JOINTS_0"])[ids]
        weights = glb.read(attrs["WEIGHTS_0"])[ids]
        best = np.bincount(joints.ravel(), weights=weights.ravel(), minlength=len(names)).argmax()
        side = names[best].split("_", 1)[0]
        y = deformed_vertices(glb, palette[..., 1:2, :], attrs, ids)
        per_frame = y[..., 0].min(axis=1) * 1000
        result[side] = np.round([per_frame.min(), per_frame.max()], 3).tolist()
    if set(result) != {"l", "r"}:
        raise ValueError("Expected both animated boot soles.")
    return result


def skin_contacts(glb, palette, names, centres, rotations, seat):
    attrs = glb.doc["meshes"][0]["primitives"][0]["attributes"]
    joints, weights = glb.read(attrs["JOINTS_0"]), glb.read(attrs["WEIGHTS_0"])
    xyz = glb.read(attrs["POSITION"])
    seated = np.array(
        [n in ("root", "c_spine0", "l_upleg", "r_upleg") or "_upleg_twist" in n for n in names]
    )
    on_seat = (seated[joints] * weights).sum(axis=1) > 0.5
    on_seat &= (abs(xyz[:, 0]) < 0.20) & (xyz[:, 2] >= -0.1) & (xyz[:, 2] <= 0.27)
    seated_y = deformed_vertices(glb, palette[..., 1:2, :], attrs, np.flatnonzero(on_seat))[..., 0].min(
        axis=1
    )
    finger = np.array(
        [any(n.startswith("r_" + part) for part in ("thumb", "index", "middle")) for n in names]
    )
    sites = np.flatnonzero((finger[joints] * weights).sum(axis=1) > 0.5)
    skin = deformed_vertices(glb, palette[..., :3, :], attrs, sites)
    frame = Rotation.from_quat(rotations).as_matrix()
    local = np.einsum("fvc,fcd->fvd", skin - centres[:, None], frame)
    half = np.array([0.0315, 0.00035, 0.0445])
    distance = np.linalg.norm(local - np.clip(local, -half, half), axis=2)
    by_digit = {}
    for part in ("thumb", "index", "middle"):
        label = np.array([n.startswith("r_" + part) for n in names])
        belonging = (label[joints[sites]] * weights[sites]).sum(axis=1) > 0.5
        by_digit[part] = np.round(distance[:, belonging].min(axis=1) * 1000, 2).tolist()
    return {
        "soleToFloorRangeMm": sole_clearance(glb, palette, names),
        "seatSkinClearanceRangeMm": np.round(
            (np.array([seated_y.min(), seated_y.max()]) - seat) * 1000, 3
        ).tolist(),
        "nearestRightFingerSkinToCardMm": np.round(distance.min(axis=1) * 1000, 2).tolist(),
        "rightFingerSkinToCardMm": by_digit,
    }


def project(raw, t, focal, size):
    xyz = raw + t
    return xyz[..., :2] / xyz[..., 2:] * focal + size * 0.5


def card_path(track, names, final, basis, scale, release_frame):
    thumb, index = [names.index(n) for n in ("r_thumb_null", "r_index_null")]
    final_positions = final[..., :3, 3]
    grip = final_positions[:, [thumb, index]].mean(axis=1)
    raw = track["pred_joint_coords"]
    observed_grip = raw[:, [thumb, index]].mean(axis=1)
    t, focal, size = track["pred_cam_t"], track["focal_length"], track["frame_size"]
    quads = track["card_corners"]
    valid = np.isfinite(quads).all(axis=(1, 2))
    if valid.sum() < 3:
        raise ValueError("Insufficient observed red card corners in the Runway frames.")
    times = track["times"]
    # Interpolation covers short occlusions; the evidence retains all missing frame IDs.
    corners = np.stack(
        [
            np.column_stack([np.interp(times, times[valid], q[valid, i]) for i in (0, 1)])
            for q in quads.transpose(1, 0, 2)
        ],
        axis=1,
    )
    centres = corners.mean(axis=1)
    tips_2d = project(raw[:, [thumb, index]], t[:, None, :], focal[:, None, None], size)
    gap = np.linalg.norm(tips_2d - centres[:, None, :], axis=2).min(axis=1)
    radius = np.max(np.linalg.norm(corners - centres[:, None, :], axis=2), axis=1)
    far = (gap > radius + 0.026 * size[1]) & valid
    if release_frame is None:
        released = next(
            (i for i in range(2, len(times) - 2) if not far[:i].all() and far[i : i + 3].all()), None
        )
    else:
        released = int(np.searchsorted(track["frame_indices"], release_frame))
        if not 1 <= released < len(times):
            raise ValueError(
                "Release must occur after the first tracked pose and inside the source clip."
            )
    finger_depth = (observed_grip + t)[:, 2]
    camera_card = (
        np.column_stack(((centres - size * 0.5) / focal[:, None] * finger_depth[:, None], finger_depth))
        - t
    )
    position = grip + (camera_card - observed_grip) @ basis.T * scale
    # Infer face tilt from red rectangle foreshortening. The source camera
    # measures the card's 2D extent. Monocular depth and tilt remain estimates.
    edges = np.roll(corners, -1, axis=1) - corners
    lengths = np.linalg.norm(edges, axis=2)
    long_ids = np.argmax(lengths, axis=1)
    long_edge = edges[np.arange(len(times)), long_ids].copy()
    if long_edge[0, 1] < 0:
        long_edge[0] *= -1
    for i in range(1, len(times)):
        if long_edge[i] @ long_edge[i - 1] < 0:
            long_edge[i] *= -1
    aspect = lengths.min(1) / np.maximum(1, lengths.max(1))
    angle = np.clip(np.arcsin(np.clip(aspect / (0.063 / 0.089), 0, 1)), 0, np.pi / 2)
    yaw = np.arctan2(long_edge[:, 0], long_edge[:, 1])
    rotations = Rotation.from_euler("yx", np.column_stack((yaw, angle))).as_quat()
    frames = Rotation.from_quat(rotations).as_matrix()
    touch_ids = [names.index("r_" + finger + "_null") for finger in ("thumb", "index", "middle")]
    fingertips = final_positions[:, touch_ids]
    ray = np.column_stack(((centres - size * 0.5) / focal[:, None], np.ones(len(times)))) @ basis.T
    ray /= np.linalg.norm(ray, axis=1, keepdims=True)
    half_card = np.array([0.0315, 0.00035, 0.0445])
    depth_offsets = np.linspace(-0.06, 0.06, 81)
    for i in range(released if released is not None else len(times)):
        candidate = position[i] + depth_offsets[:, None] * ray[i]
        local_tip = (fingertips[i, None] - candidate[:, None]) @ frames[i]
        pinching = np.linalg.norm(
            local_tip[:, :2] - np.clip(local_tip[:, :2], -half_card, half_card), axis=2
        )
        nearest = pinching.max(axis=1)
        offset = depth_offsets[np.argmin(nearest + np.abs(depth_offsets) * 0.10)]
        position[i] += ray[i] * offset
    set_down = None
    if released is None:
        height = float(np.clip(np.min(position[:, 1]) - 0.025, 0.55, 0.76))
    else:
        last = max(0, released - 1)
        final_centre = np.median(centres[released:], axis=0)
        resting = (
            valid & (aspect < 0.11) & (np.linalg.norm(centres - final_centre, axis=1) < size[1] * 0.006)
        )
        set_down = next((i for i in range(1, max(1, released - 2)) if resting[i : i + 4].all()), last)
        landing = np.median(position[set_down:released], axis=0)
        height = float(np.clip(landing[1] - 0.00041, 0.51, 0.80))
        landing[1] = height + 0.00041
        position[set_down:] = landing
        final_yaw = np.median(np.unwrap(yaw)[set_down:released])
        rotations[set_down:] = Rotation.from_euler("y", final_yaw).as_quat()
        frames = Rotation.from_quat(rotations).as_matrix()
    back_edge = 0.316
    lowest = position[:, 1] - np.abs(frames[:, 1]) @ half_card
    above_felt = position[:, 2] >= back_edge
    raise_by = np.where(above_felt, np.maximum(0, height + 0.000025 - lowest), 0)
    position[:, 1] += raise_by
    return (
        position,
        continuous(rotations),
        height,
        back_edge,
        {
            "visibleSamples": int(valid.sum()),
            "missingSourceFrames": track["frame_indices"][~valid].tolist(),
            "releaseSourceFrame": None if released is None else int(track["frame_indices"][released]),
            "releaseSourceTime": None if released is None else round(float(times[released]), 4),
            "setDownSourceFrame": None if set_down is None else int(track["frame_indices"][set_down]),
            "setDownSourceTime": None if set_down is None else round(float(times[set_down]), 4),
            "releaseMethod": "reviewed source frame"
            if release_frame is not None
            else "three consecutive separated red-card detections",
            "cardDepthMethod": "Observed 2D centre and estimated hand depth with a bounded viewing-ray adjustment towards fingertips. Fixed on felt from the visually stationary edge-on interval.",
            "cardTiltMethod": "Continuous orientation and rectangle foreshortening, horizontal once set down.",
            "maxCardFeltPenetrationCorrectedMm": round(float(raise_by.max()) * 1000, 2),
            "redCardSpanPixels": np.round(np.ptp(centres, axis=0), 2).tolist(),
            "observedRedCardCentresPx": [
                np.round(quad.mean(axis=0), 2).tolist() if seen else None
                for quad, seen in zip(quads, valid)
            ],
            "feltTopM": round(height, 4),
            "cardThicknessM": 0.0007,
            "feltRearEdgeZ": round(back_edge, 4),
        },
    )


def compact(glb):
    """Keep accessors and binary views reachable by the exported scene."""
    doc = glb.doc
    refs = []
    for mesh in doc["meshes"]:
        for prim in mesh["primitives"]:
            refs.append((prim, "indices"))
            refs.extend((prim["attributes"], name) for name in prim["attributes"])
    refs.extend((skin, "inverseBindMatrices") for skin in doc["skins"])
    for animation in doc.get("animations", []):
        for sampler in animation["samplers"]:
            refs.extend([(sampler, "input"), (sampler, "output")])
    used = sorted({holder[key] for holder, key in refs})
    mapping = {old: new for new, old in enumerate(used)}
    doc["accessors"] = [doc["accessors"][i] for i in used]
    for holder, key in refs:
        holder[key] = mapping[holder[key]]
    items = [*doc["accessors"], *doc["images"]]
    used_views = sorted({obj["bufferView"] for obj in items})
    remap = {old: new for new, old in enumerate(used_views)}
    views, data = [], bytearray()
    for old in used_views:
        record = doc["bufferViews"][old].copy()
        offset = record.get("byteOffset", 0)
        data.extend(b"\0" * (-len(data) % 4))
        record["byteOffset"] = len(data)
        data.extend(glb.data[offset : offset + record["byteLength"]])
        views.append(record)
    for item in items:
        item["bufferView"] = remap[item["bufferView"]]
    doc["bufferViews"] = views
    glb.data = data


def make_surface(base, palms, back, back_run, output):
    glb = Glb(base)
    names, _, parents, local = hierarchy(glb)
    evidence = bake_trial_views(glb, names, world_matrices(local, parents), palms, back, back_run)
    evidence["bootFit"] = fit_boots(glb)
    evidence["baseAppearanceSha256"] = sha(base)
    glb.doc["asset"]["extras"]["trialSurface"] = evidence
    compact(glb)
    result = glb.save(output)
    print(result, json.dumps(evidence), flush=True)


def stage(base, card_image, output):
    actor = Glb(base)
    names, *_ = hierarchy(actor)
    seat = seat_contact(actor, names)
    # This compact companion contains only the room objects; the still viewer
    # loads the existing actor separately, avoiding a second copy of her skin.
    environment = object.__new__(Glb)
    environment.doc = {
        "asset": {"version": "2.0", "extras": {"actor": sha(base), "seatTopM": seat}},
        "scenes": [{"nodes": []}],
        "scene": 0,
        "nodes": [],
        "meshes": [],
        "materials": [],
        "buffers": [{"byteLength": 0}],
        "bufferViews": [],
        "accessors": [],
    }
    environment.data = bytearray()
    card = surroundings(environment, 0.654, 0.316, card_image, seat)
    environment.doc["nodes"][card]["translation"] = [-0.2, 0.65441, 0.502]
    print(environment.save(output), flush=True)


def animate(base, motion, video, model, card_image, output, report_path, release, proof_frame=None):
    glb = Glb(base)
    names, nodes, parents, rest = hierarchy(glb)
    with np.load(motion, allow_pickle=False) as data:
        track = dict(data)
    if str(track["video_sha256"]) != sha(video):
        raise ValueError("Source video and tracked motion receipt do not match.")
    track["card_corners"] = observed_card(video, track["frame_indices"], track["pred_keypoints_2d"])
    driven, active, world, basis, scale, smooth = retarget(track, model, names, parents, rest)
    translations, card_rotation, height, edge, card = card_path(
        track, names, world, basis, scale, release
    )

    def sample_for(source_frame):
        return (
            None
            if source_frame is None
            else int(np.flatnonzero(track["frame_indices"] == source_frame)[0])
        )

    driven, card["gripFit"] = contact_pose(
        glb,
        names,
        parents,
        rest,
        driven,
        translations,
        card_rotation,
        sample_for(card["setDownSourceFrame"]),
        sample_for(card["releaseSourceFrame"]),
    )
    driven = continuous(driven)
    world = rig_pose(driven, rest, parents)
    seat = seat_contact(glb, names)
    inverse = glb.read(glb.doc["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    contacts = skin_contacts(glb, world @ inverse, names, translations, card_rotation, seat)
    stock = front_card_texture(video, track["card_corners"][0]) if card_image is None else card_image
    card_node = surroundings(glb, height, edge, stock, seat)
    body_attrs = glb.doc["meshes"][0]["primitives"][0]["attributes"]
    limb_ids = glb.read(body_attrs["JOINTS_0"])
    dominant = limb_ids[np.arange(len(limb_ids)), glb.read(body_attrs["WEIGHTS_0"]).argmax(axis=1)]
    hands = {}
    for side in ("r", "l"):
        wrist_or_finger = np.array(
            [
                any(
                    n.startswith(side + "_" + part)
                    for part in ("wrist", "thumb", "index", "middle", "ring", "pinky")
                )
                for n in names
            ]
        )
        used = np.flatnonzero(wrist_or_finger[dominant])
        hands[side] = deformed_vertices(glb, (world @ inverse)[..., :3, :], body_attrs, used)
    contacts["tableContact"] = measure_table_contact(
        glb,
        hands,
        translations,
        Rotation.from_quat(card_rotation).as_matrix(),
        sample_for(card["setDownSourceFrame"]),
    )
    card["textureSourceFrame"] = 0 if card_image is None else None
    card["textureSource"] = (
        "Runway first frame with its finger-covered corner restored from the opposite edge"
        if card_image is None
        else sha(card_image)
    )
    times = track["times"]
    end = float(track["source_end"] - track["source_clock"][0])
    timeline = np.r_[times, end].astype("<f4")
    clock = glb.accessor(timeline, "SCALAR")
    acc = glb.doc["accessors"][clock]
    acc.update(min=[float(timeline[0])], max=[float(timeline[-1])])
    glb.doc["bufferViews"][acc["bufferView"]].pop("target", None)
    anim = {"name": "Runway · mätt giv", "channels": [], "samplers": []}
    glb.doc["animations"] = [anim]
    for i in active:
        values = driven[:, i]
        motion_channel(glb, anim, clock, nodes[i], "rotation", np.vstack([values, values[-1]]))
    for name, values in (("translation", translations), ("rotation", card_rotation)):
        motion_channel(glb, anim, clock, card_node, name, np.vstack([values, values[-1]]))

    raw = track["pred_joint_coords"]
    pelvis = names.index("root")
    world_xyz = world[..., :3, 3]
    # The target is filmed by a stationary camera. Calibrate its pelvis and
    # focal length once, so variation in the per-frame monocular camera estimates
    # cannot make a stationary joint appear to follow the source in the score.
    final_raw = (world_xyz - world_xyz[:, pelvis : pelvis + 1]) @ basis / scale + raw[0, pelvis]
    size = track["frame_size"]
    measured = project(raw, track["pred_cam_t"][:, None, :], track["focal_length"][:, None, None], size)
    replay = project(final_raw, track["pred_cam_t"][0], track["focal_length"][0], size)
    watch = ["r_wrist", "r_lowarm", "r_thumb_null", "r_index_null", "l_wrist", "l_lowarm", "c_head"]

    def rms(pixels):
        return round(float(np.sqrt(np.mean(np.sum(pixels**2, axis=1)))), 2)

    projected_card = project(
        (translations - world_xyz[:, pelvis]) @ basis / scale + raw[0, pelvis],
        track["pred_cam_t"][0],
        track["focal_length"][0],
        size,
    )
    visible_card = np.isfinite(track["card_corners"]).all(axis=(1, 2))
    measured_card = track["card_corners"][visible_card].mean(axis=1)
    rendered_card = projected_card[visible_card]
    card.update(
        calibratedScreenRmsPx=rms(rendered_card - measured_card),
        calibratedMotionRmsPx=rms(
            (rendered_card - rendered_card[0]) - (measured_card - measured_card[0])
        ),
        frozenMotionRmsPx=rms(measured_card - measured_card[0]),
    )
    scores = {}
    for name in watch:
        i = names.index(name)
        source_motion = measured[:, i] - measured[0, i]
        replay_motion = replay[:, i] - replay[0, i]
        scores[name] = {
            "screenRmsPx": rms(replay[:, i] - measured[:, i]),
            "motionRmsPx": rms(replay_motion - source_motion),
            "frozenMotionRmsPx": rms(source_motion),
            "sourceMaxExcursionPx": round(float(np.linalg.norm(source_motion, axis=1).max()), 2),
            "rigMaxExcursionPx": round(float(np.linalg.norm(replay_motion, axis=1).max()), 2),
            "rigMaxExcursionMm": round(
                float(np.linalg.norm(world_xyz[:, i] - world_xyz[0, i], axis=1).max()) * 1000, 1
            ),
            "rigMaxLocalRotationDegrees": round(
                float(
                    np.rad2deg(
                        (
                            Rotation.from_quat(driven[0, i]).inv() * Rotation.from_quat(driven[:, i])
                        ).magnitude()
                    ).max()
                ),
                2,
            ),
        }
    photographed = {}
    for side_index, side in enumerate(("r", "l")):
        if "photographed_hands_2d" not in track:
            break
        photo = track["photographed_hands_2d"][:, side_index]
        visible = np.isfinite(photo).all(1)
        # The 70-point MHR hand convention uses three finger joints, a
        # fingertip and a wrist. Average exactly those sites on the rig.
        sites = [
            names.index(f"{side}_{finger}{part}")
            for finger in ("thumb", "index", "middle", "ring", "pinky")
            for part in ("1", "2", "3", "_null")
        ]
        sites.append(names.index(side + "_wrist"))
        model_center = replay[:, sites].mean(axis=1)
        result = {"visibleSourceFrames": int(visible.sum())}
        if visible.sum() > 1:
            source_change = photo[visible] - photo[visible][0]
            model_change = model_center[visible] - model_center[visible][0]
            result.update(
                motionRmsPx=rms(model_change - source_change),
                frozenMotionRmsPx=rms(source_change),
            )
        photographed[side] = result
    wrist = names.index("r_wrist")
    peak_wrist = int(np.linalg.norm(measured[:, wrist] - measured[0, wrist], axis=1).argmax())
    key = peak_wrist
    if proof_frame is not None:
        found = np.flatnonzero(track["frame_indices"] == proof_frame)
        if len(found) != 1:
            raise ValueError("The proof frame must have a measured source pose.")
        key = int(found[0])
    body = glb.doc["meshes"][0]["primitives"]
    pts = np.vstack([glb.read(primitive["attributes"]["POSITION"]) for primitive in body])
    face_count = sum(glb.doc["accessors"][primitive["indices"]]["count"] // 3 for primitive in body)
    evidence = {
        "trial": "paulina/prov-70/v1",
        "sourceVideoSha256": sha(video),
        "trackingSha256": sha(motion),
        "surfaceSha256": sha(base),
        "samBodyRun": glb.doc["asset"]["extras"]["run"],
        "sourceFrameCount": len(track["source_clock"]),
        "trackedFrameCount": len(times),
        "timesSeconds": np.round(times, 5).tolist(),
        "sourceFrameIndices": track["frame_indices"].tolist(),
        "durationSeconds": round(end, 6),
        "sourceSizePx": size.tolist(),
        "sampleRateHz": float(track["sample_rate"]),
        "skeletonJoints": len(nodes),
        "drivenJointChannels": len(active),
        "bodySurfaceCount": 1,
        "distinctBodyPositions": len(np.unique(pts.round(6), axis=0)),
        "bodyTriangles": face_count,
        "bodyMaterialPrimitives": len(body),
        "neutralBoundsMetres": np.round(np.ptp(pts, axis=0), 4).tolist(),
        "seatTopMetres": round(seat, 5),
        "seatClearanceMm": 0.5,
        **contacts,
        "fixedBoneLengths": True,
        "anchoredPelvisAndFeet": True,
        "calibrationScale": round(scale, 5),
        "measuredPelvisDriftPx": round(
            float(np.linalg.norm(measured[:, pelvis] - measured[0, pelvis], axis=1).max()), 2
        ),
        "photographicHandComparison": photographed,
        "photographicHandMethod": "Visible skin centroid in a hand-local Runway search window versus the calibrated 3D hand's mean projected finger and wrist position. Overlap and empty detections are excluded.",
        "rotationSmoothingSeconds": round(smooth, 4),
        "card": card,
        "joints": scores,
        "poseTimeSeconds": float(times[key]),
        "poseSourceFrame": int(track["frame_indices"][key]),
        "peakWristSourceFrame": int(track["frame_indices"][peak_wrist]),
        "cameraYawDegrees": [0, 70],
        "side": "Paulina's anatomical left; nose points to viewer left",
        "comparison": "Fixed-camera reprojection of the skinned GLB versus monocular SAM estimates for each Runway frame. Depth and occluded joints are estimated.",
    }
    glb.doc["asset"]["extras"]["performance"] = {
        "video": sha(video),
        "motion": sha(motion),
        "sourceFrameIndices": evidence["sourceFrameIndices"],
    }
    compact(glb)
    dest = glb.save(output)
    evidence["sceneSha256"] = sha(dest)
    evidence["surfaceReferences"] = glb.doc["asset"]["extras"].get("trialSurface", {})
    print(
        save_version(
            report_path,
            (json.dumps(evidence, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode(),
        ),
        flush=True,
    )
    print(dest, json.dumps(scores), flush=True)


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parents[1]
    trial = project_root / "avatars/paulina/prov-70/v1"
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    surf = sub.add_parser("surface")
    surf.add_argument("--base", type=Path, default=trial / "modell/sittande.glb")
    surf.add_argument("--palms", type=Path, default=trial / "referenser/handflator-och-fingerblommor.png")
    surf.add_argument("--back", type=Path, default=trial / "referenser/sittande-bakre-vy.png")
    surf.add_argument("--back-run", type=Path, required=True)
    surf.add_argument("--output", type=Path, default=trial / "modell/fotoyta-slut.glb")
    static = sub.add_parser("stage")
    static.add_argument("--base", type=Path, default=trial / "modell/fotoyta-slut.glb")
    static.add_argument(
        "--card", type=Path, default=project_root / "studio/public/fotomall/kort/referenskort-x-v1.png"
    )
    static.add_argument("--output", type=Path, default=trial / "modell/bord-och-stol-spelkant.glb")
    ani = sub.add_parser("animate")
    ani.add_argument("--base", type=Path, default=trial / "modell/fotoyta-slut.glb")
    ani.add_argument("--motion", type=Path, default=trial / "rorelse/ledposer.npz")
    ani.add_argument("--video", type=Path, default=trial / "runway/original.mp4")
    sam = Path(os.environ.get("SAM3D_ROOT", project_root.parent / "sam-3d-body"))
    ani.add_argument(
        "--model", type=Path, default=sam / "checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt"
    )
    ani.add_argument(
        "--card",
        type=Path,
        help="Optional replacement texture. Defaults to the photographed Runway card.",
    )
    ani.add_argument("--release-frame", type=int)
    ani.add_argument("--proof-frame", type=int)
    ani.add_argument("--output", type=Path, default=trial / "modell/blackjack.glb")
    ani.add_argument("--report", type=Path, default=trial / "visning/matning.json")
    args = parser.parse_args()
    if args.command == "surface":
        make_surface(args.base, args.palms, args.back, args.back_run, args.output)
    elif args.command == "stage":
        stage(args.base, args.card, args.output)
    else:
        animate(
            args.base,
            args.motion,
            args.video,
            args.model,
            args.card,
            args.output,
            args.report,
            args.release_frame,
            args.proof_frame,
        )
