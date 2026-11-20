"""Bring the dealt card to Paulina's resting hand and verify the physical handoff across the full V3 clip."""

import argparse
import hashlib
import json
from itertools import combinations
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from scipy.spatial.distance import cdist
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, put, sha
from paulina_blackjack_scene import table_cross_section
from paulina_deal_p4 import (
    CARD_NAME,
    FINGERS,
    LANDMARKS,
    RATE,
    ROOT,
    UP,
    Cards,
    ContactSkin,
    Glb,
    Pose,
    blend,
    compact,
    continuous,
    hierarchy,
    measure,
    ramp,
    read_exported_motion,
    rotation_blocks,
    turn,
    unit,
)
from paulina_motion_trial import motion_channel, world_matrices
from paulina_sliding_deal import triangle_review

BASE = ROOT / "avatars/paulina/giv-plats-4/v2/rigg/giv.glb"
BASE_SHA = "f2605ffe6e47ab4b2ef89162a1d30c5d46692b8535d2108c9fcf34848d2df347"
OUT = ROOT / "avatars/paulina/giv-plats-4/v3/underlag/vilohand"
START_REACH = 76
GRIP = 85
RELEASE = 105
REST = 152
LEFT_START = 44
LEFT_END = 66


def palm_axes(p):
    wrist = p.position("r_wrist")
    forward = unit(p.position("r_middle1") - wrist)
    span = p.position("r_index1") - p.position("r_pinky1")
    across = unit(span - (span @ forward) * forward)
    return np.column_stack((forward, across, unit(np.cross(forward, across))))


def orientation(matrix):
    return Rotation.from_matrix(rotation_blocks(matrix)).as_matrix()


class ExistingCard(Cards):
    def __init__(self, glb, card_node, centres, bases):
        node = glb.doc["nodes"][card_node]
        prim = glb.doc["meshes"][node["mesh"]]["primitives"][0]
        points = glb.read(prim["attributes"]["POSITION"])
        self.half = np.ptp(points, axis=0).astype(float) / 2
        self.size = self.half * 2
        self.level = table_cross_section(glb, "Spelyta")[-1]
        self.start = centres[0]
        self.start_basis = bases[0]
        self.shoe = type("ShoePlane", (), {"normal": self.start_basis[:, 1]})()


class WaitingPose:
    def __init__(self, original, skin, card):
        self.skin = skin
        self.card = card
        self.base = original[0]
        self.wrist = self.base.names.index("r_wrist")
        self.digits = [
            i
            for i, joint in enumerate(self.base.names)
            if any(joint.startswith("r_" + f) for f in FINGERS)
        ]
        p = Pose(self.base.names, self.base.parents, self.base.local)
        original_axes = palm_axes(p)
        yaw, pitch = np.deg2rad([28, -4])
        forward = np.array(
            [np.sin(yaw) * np.cos(pitch), np.sin(pitch), np.cos(yaw) * np.cos(pitch)]
        )
        across = np.array([np.cos(yaw), 0, -np.sin(yaw)]) * np.sign(original_axes[0, 1])
        # Raise the radial (thumb) edge a little so the fleshy base of the thumb
        # can sit above the felt with a lower wrist and a relaxed ulnar edge.
        roll = np.deg2rad(15) * np.sign(np.cross(forward, across)[1])
        across = Rotation.from_rotvec(forward * roll).apply(across)
        desired = np.column_stack((forward, across, np.cross(forward, across)))
        self.direction = forward
        self.world_orientation = (
            desired @ original_axes.T @ orientation(p.world[self.wrist, :3, :3])
        )
        self.height = 0.041
        reference = np.array([0.018, card.level + self.height, 0.37])
        self.place(p, reference, p.local.copy())
        # The third seated photo shows fingers resting together. Adduct around the MCP
        # joints without shortening or displacing any bone. Targets are distances
        # across the palm from the middle ray, in metres.
        lateral = {
            "thumb": 0.047,
            "index": 0.018,
            "middle": 0.0003,
            "ring": -0.0165,
            "pinky": -0.032,
        }
        axes = palm_axes(p)
        for finger, target in lateral.items():
            proximal = "r_" + finger + "1"
            ray = (p.position("r_" + finger + "_null") - p.position(proximal)) @ axes
            base_lateral = (p.position(proximal) - p.position("r_wrist")) @ axes[:, 1]
            desired_angle = np.arcsin(
                np.clip((target - base_lateral) / np.linalg.norm(ray[:2]), -1, 1)
            )
            angle = desired_angle - np.arctan2(ray[1], ray[0])
            p.rotate(proximal, Rotation.from_rotvec(axes[:, 2] * angle).as_matrix())
        floor = np.array([0, card.level, 0])
        for finger in FINGERS:
            clearance = 0.0013 if finger == "thumb" else 0.00065
            skin.finger_plane(p, "r", finger, floor, UP, clearance)
            skin.seat_pad(p, "r", finger, floor, UP, clearance=clearance)
        self.shape = p.local.copy()
        pads = []
        for finger in ("index", "middle"):
            points = skin.points(p, "r", finger + "Pad")
            pads.append(points[points[:, 1].argmin()])
        self.pad_offset = np.mean(pads, axis=0) - p.position("r_wrist")
        # Wait beside the near side of the actual card path, with the forearm already pointing into the slide.
        parking_pads = np.array([-0.020, card.level + 0.0007, 0.463])
        self.park = parking_pads - self.pad_offset

    def place(self, p, goal, shape):
        length = np.linalg.norm(p.position("r_wrist") - p.position("r_lowarm"))
        # Two-bone IK chooses the physical elbow closest to the line continuing the palm.
        forearm = unit(self.direction + 0.03 * UP)
        pole = goal - length * forearm
        p.arm("r", goal, pole)
        p.rotate(
            "r_wrist",
            self.world_orientation @ orientation(p.world[self.wrist, :3, :3]).T,
        )
        p.local[self.digits, :3, :3] = shape[self.digits, :3, :3]
        p.world = world_matrices(p.local, p.parents)

    def prepare_fingers(self, p, frame):
        # Load the two pushing pads as the card flattens. Curl the unused digits a
        # little more, then let them open again independently as the card slides away.
        across = palm_axes(p)[:, 2]
        for digit, onset, proximal, middle, spread in (
            ("thumb", 77, 4.5, 0.0, -3.5),
            ("index", 78, 3.2, -5.8, 2.4),
            ("middle", 79, 4.4, -8.5, 0.8),
            ("ring", 78, 6.0, -6.0, -1.2),
            ("pinky", 77, 7.0, -8.0, -2.0),
        ):
            load = ramp(frame, onset, 86) * (1 - ramp(frame, 104, 116))
            release = ramp(frame, 104, 108) * (1 - ramp(frame, 108, 116))
            if not load and not release:
                continue
            pivot = "r_" + digit + "1"
            direction = p.position("r_" + digit + "_null") - p.position(pivot)
            lift = unit(np.cross(direction, UP))
            angles = (
                (
                    pivot,
                    lift * np.deg2rad(proximal * load + 1.7 * release)
                    + across * np.deg2rad(spread * load),
                ),
                ("r_" + digit + "2", lift * np.deg2rad(middle * load)),
            )
            for joint, rotvec in angles:
                p.rotate(joint, Rotation.from_rotvec(rotvec).as_matrix())

    def drive(self, frame, original, centres, bases, local_transfer=False):
        p = Pose(original.names, original.parents, original.local)
        held = min(RELEASE - 1, frame)
        center = centres[held] + bases[held] @ np.array(
            [-0.014, self.card.half[1] + 0.00018, -0.022]
        )
        wanted = center - self.pad_offset
        hold = 82 if local_transfer else START_REACH
        toward = (
            float(frame > hold) if local_transfer else ramp(frame, START_REACH, GRIP)
        )
        back = ramp(frame, RELEASE - 1, REST)
        goal = blend(blend(self.park, wanted, toward), self.park, back)
        goal[1] += (
            0.0025
            * ramp(frame, RELEASE - 1, RELEASE + 2)
            * (1 - ramp(frame, RELEASE + 2, RELEASE + 8))
        )
        self.place(p, goal, self.shape)
        # At the sloping outside edge use the actual triangular pads; thumb stays above the felt.
        if hold < frame < REST:
            self.prepare_fingers(
                p,
                frame
                if not local_transfer or frame > 91
                else 76 + (frame - hold) * 1.65,
            )
            for finger in FINGERS:
                if (
                    self.skin.points(p, "r", finger)[:, 1].min()
                    < self.card.level + 0.00006
                ):
                    self.skin.seat_pad(
                        p, "r", finger, [0, self.card.level, 0], UP, entire=True
                    )
                seats = (
                    hold + 1 if local_transfer else GRIP
                ) <= frame < RELEASE and finger in ("index", "middle")
                self.skin.clear_face(
                    p,
                    "r",
                    finger,
                    centres[frame],
                    bases[frame],
                    self.card.half,
                    1,
                    seats=seats,
                )
        return p


def bring_card_to_waiting_hand(hand, centres, bases):
    cc, bb = centres.copy(), bases.copy()
    transfer = 82
    pad_goal = hand.park + hand.pad_offset
    delta = pad_goal - (
        centres[transfer]
        + bases[transfer] @ np.array([-0.014, hand.card.half[1] + 0.00018, -0.022])
    )
    delta[1] = 0
    for f in range(67, RELEASE):
        weight = ramp(f, 66, transfer) * (1 - ramp(f, transfer, RELEASE))
        cc[f] += delta * weight
        if f < transfer:
            bb[f] = turn(bases[f], bases[transfer], ramp(f, 68, 77))
            cc[f, 1] += (abs(bb[f, 1]) - abs(bases[f, 1])) @ hand.card.half
    return cc, bb


def follow_presentation(p, donor, frame, skin, card, oc, ob, cc, bb):
    if not 66 < frame < 103:
        return
    w = donor.names.index("l_wrist")
    contact = min(frame, 82)
    rotate = bb[contact] @ ob[contact].T
    if frame <= 82:
        goal = cc[frame] + rotate @ (donor.position("l_wrist") - oc[frame])
    else:
        goal = donor.position("l_wrist") + (cc[82] - oc[82]) * (
            1 - ramp(frame, 82, 103)
        )
    elbow = donor.position("l_lowarm") + 0.48 * (goal - donor.position("l_wrist"))
    p.arm("l", goal, elbow)
    p.rotate(
        "l_wrist",
        rotate
        @ orientation(donor.world[w, :3, :3])
        @ orientation(p.world[w, :3, :3]).T,
    )
    for finger in FINGERS:
        skin.clear_face(p, "l", finger, cc[frame], bb[frame], card.half, 1)
        if skin.points(p, "l", finger)[:, 1].min() < card.level + 0.00004:
            skin.seat_pad(p, "l", finger, np.array([0, card.level, 0]), UP, entire=True)


def space_drawing_fingers(p, frame, skin, card, centre, basis):
    """Keep the two actual drawing pads in parallel lanes on the same face."""
    if not LEFT_START < frame < LEFT_END:
        return
    normal = basis[:, 1]
    across = p.position("l_middle1") - p.position("l_index1")
    across = unit(across - (across @ normal) * normal)
    current = (p.position("l_middle_null") - p.position("l_index_null")) @ across
    target = 0.0270 + (0.0266 - 0.0270) * ramp(frame, LEFT_START, LEFT_END)
    spread = max(0, target - current)
    # More of the correction belongs to the index finger. The middle finger is
    # already close to the card's near end at the beginning of the withdrawal.
    for digit, weight in (("index", -0.70), ("middle", 0.30)):
        joint = "l_" + digit + "1"
        tip = "l_" + digit + "_null"
        dest = p.position(tip) @ across + weight * spread
        for _ in range(4):
            tip_pos = p.position(tip)
            error = dest - tip_pos @ across
            if abs(error) < 0.000005:
                break
            derivative = np.cross(normal, tip_pos - p.position(joint)) @ across
            if abs(derivative) < 0.01:
                raise ValueError("Ingen separat fingerriktning på kortet.")
            p.rotate(
                joint,
                Rotation.from_rotvec(
                    normal * np.clip(error / derivative, -0.18, 0.18)
                ).as_matrix(),
            )
        skin.clear_face(p, "l", digit, centre, basis, card.half, 1)
        skin.clear_face(
            p,
            "l",
            digit,
            card.start - 0.00046 * card.shoe.normal,
            card.start_basis,
            card.half,
            1,
        )


def source_motion(glb, output, nodes, poses, rest, names, modified_card=None):
    """Replace the right arm and affected drawing digits; preserve other sampler bytes."""
    a = glb.doc["animations"][0]
    by_node = {
        ch["target"]["node"]: ch
        for ch in a["channels"]
        if ch["target"]["path"] == "rotation"
    }
    clock = a["samplers"][0]["input"]
    indices = [
        i
        for i, k in enumerate(names)
        if k in ("r_uparm", "r_lowarm", "r_wrist")
        or any(k.startswith("r_" + f) for f in FINGERS)
        or k
        in ("l_index1", "l_index2", "l_index3", "l_middle1", "l_middle2", "l_middle3")
        or (
            modified_card is not None
            and (
                k in ("l_uparm", "l_lowarm", "l_wrist")
                or any(k.startswith("l_" + f) for f in FINGERS)
            )
        )
    ]
    values = continuous(
        np.asarray(
            [
                Rotation.from_matrix(
                    rotation_blocks(p.local[indices, :3, :3])
                ).as_quat()
                for p in poses
            ]
        )
    )
    edits = []
    for j, i in enumerate(indices):
        rotations = values[:, j]
        node = nodes[i]
        if node in by_node:
            sampler = a["samplers"][by_node[node]["sampler"]]
            if names[i].startswith("l_"):
                original = glb.read(sampler["output"]).copy()
                # Retain exact bytes outside the correction, including quaternion signs.
                pairs = np.einsum("ij,ij->i", rotations, original)
                rotations = rotations * np.where(pairs < 0, -1.0, 1.0)[:, None]
                if modified_card is None:
                    mid = slice(LEFT_START + 1, LEFT_END)
                    if np.max(abs(rotations[mid] - original[mid])) < 1e-6:
                        continue
                else:
                    mid = np.max(abs(rotations - original), axis=1) > 1e-6
                    if not np.any(mid):
                        continue
                original[mid] = rotations[mid]
                rotations = original
            sampler["output"] = glb.accessor(np.asarray(rotations, dtype="<f4"), "VEC4")
            glb.doc["bufferViews"][
                glb.doc["accessors"][sampler["output"]]["bufferView"]
            ].pop("target", None)
        elif (
            np.min(
                abs(
                    rotations
                    @ Rotation.from_matrix(rotation_blocks(rest[i, :3, :3])).as_quat()
                )
            )
            < 1 - 1e-9
        ):
            motion_channel(glb, a, clock, node, "rotation", rotations)
        else:
            continue
        edits.append(names[i])
    if modified_card is not None:
        card_node, centres, bases = modified_card
        outputs = {
            "translation": (centres, "VEC3"),
            "rotation": (Rotation.from_matrix(bases).as_quat(), "VEC4"),
        }
        for channel in a["channels"]:
            if channel["target"]["node"] != card_node:
                continue
            path = channel["target"]["path"]
            values, kind = outputs[path]
            sampler = a["samplers"][channel["sampler"]]
            raw = glb.read(sampler["output"]).copy()
            if path == "rotation":
                values = (
                    values
                    * np.where(np.einsum("ij,ij->i", raw, values) < 0, -1, 1)[:, None]
                )
            raw[67:RELEASE] = values[67:RELEASE]
            sampler["output"] = glb.accessor(raw.astype("<f4"), kind)
            glb.doc["bufferViews"][
                glb.doc["accessors"][sampler["output"]]["bufferView"]
            ].pop("target", None)
    glb.doc["asset"].setdefault("extras", {})["waitingRightHand"] = {
        "sourceSceneSha256": BASE_SHA,
        "holdFrames": [0, 82 if modified_card is not None else START_REACH],
    }
    compact(glb)
    glb.save(output)
    return sorted(edits)


def signatures(glb, edited, modified_card=False):
    a = glb.doc["animations"][0]
    tracks = {}
    for ch in a["channels"]:
        node = glb.doc["nodes"][ch["target"]["node"]]["name"]
        path = ch["target"]["path"]
        if node in edited and path == "rotation" or modified_card and node == CARD_NAME:
            continue
        sampler = a["samplers"][ch["sampler"]]
        tracks[node + "/" + path] = hashlib.sha256(
            glb.read(sampler["input"]).tobytes() + glb.read(sampler["output"]).tobytes()
        ).hexdigest()
    images = []
    for image in glb.doc["images"]:
        view = glb.doc["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        images.append(
            hashlib.sha256(glb.data[start : start + view["byteLength"]]).hexdigest()
        )
    geometry = hashlib.sha256()
    for mesh in glb.doc["meshes"]:
        for primitive in mesh["primitives"]:
            for semantic, index in sorted(primitive["attributes"].items()):
                geometry.update(semantic.encode())
                geometry.update(glb.read(index).tobytes())
            geometry.update(glb.read(primitive["indices"]).tobytes())
    materials = hashlib.sha256(json_bytes(glb.doc["materials"])).hexdigest()
    return dict(
        tracks=tracks,
        embeddedImageSha256=images,
        vertexAndIndexSha256=geometry.hexdigest(),
        materialsSha256=materials,
    )


def dorsal_selection(skin, source):
    p = source[0]
    axes = palm_axes(p)
    surface = skin.points(p, "r", "all") - p.position("r_wrist")
    longitudinal, across, normal = (surface @ axes).T
    normal *= np.sign(axes[1, 2])
    central = (longitudinal > 0.028) & (longitudinal < 0.064) & (abs(across) < 0.025)
    return np.where(central & (normal >= np.quantile(normal[central], 0.65)))[0]


def crossing_edges(first, second):
    """Strict transverse segment/triangle tests; touching edges do not penetrate."""
    start = first
    vector = np.roll(first, -1, axis=1) - start
    edge_one = (second[:, 1] - second[:, 0])[:, None, :]
    edge_two = (second[:, 2] - second[:, 0])[:, None, :]
    relative = start - second[:, None, 0, :]
    cross_direction = np.cross(vector, edge_two)
    determinant = (edge_one * cross_direction).sum(axis=2)
    valid = abs(determinant) > 1e-12
    inv = np.divide(1, determinant, out=np.zeros_like(determinant), where=valid)
    u = inv * (relative * cross_direction).sum(axis=2)
    cross_origin = np.cross(relative, edge_one)
    v = inv * (vector * cross_origin).sum(axis=2)
    t = inv * (edge_two * cross_origin).sum(axis=2)
    eps = 0.00002
    return np.any(
        valid & (u > eps) & (v > eps) & (u + v < 1 - eps) & (t > eps) & (t < 1 - eps)
    )


def finger_crossings(poses, skin, side):
    """Check each pair beyond the first knuckle, avoiding the joined skin in the web of the hand."""
    faces = {}
    for finger in FINGERS:
        _, joints, weights = skin.groups[side, finger + "Mesh"]
        owner = np.asarray(poses[0].names)[
            joints[np.arange(len(joints)), weights.argmax(1)]
        ]
        labels = [side + "_" + finger + end for end in ("2", "3", "_null")]
        f = skin.faces[side, finger]
        faces[finger] = f[np.isin(owner[f], labels).all(1)]
    failures = {}
    for i, p in enumerate(poses):
        shapes = {}
        for finger in FINGERS:
            tri = skin.points(p, side, finger + "Mesh")[faces[finger]]
            shapes[finger] = (tri, tri.min(axis=1), tri.max(axis=1))
        for one, two in combinations(FINGERS, 2):
            a, lo, hi = shapes[one]
            b, blo, bhi = shapes[two]
            if (lo.min(0) > bhi.max(0)).any() or (blo.min(0) > hi.max(0)).any():
                continue
            ia, ib = np.where(
                np.all((lo[:, None] <= bhi) & (hi[:, None] >= blo), axis=2)
            )
            if len(ia) and (
                crossing_edges(a[ia], b[ib]) or crossing_edges(b[ib], a[ia])
            ):
                failures.setdefault(f"{one}/{two}", []).append(i)
    return dict(
        frames=len(poses),
        triangles={d: len(f) for d, f in faces.items()},
        crossingFrames=failures,
    )


def diagnose(poses, skin, back_indices, level):
    rows = []
    for i, p in enumerate(poses):
        a = palm_axes(p)
        forearm = unit(p.position("r_wrist") - p.position("r_lowarm"))
        forward, across, vertical = forearm @ a
        vertical *= np.sign(a[1, 2])
        back = skin.points(p, "r", "all")[back_indices]
        tips = {f: p.position("r_" + f + "_null") for f in FINGERS}
        right_pair = {
            f"{a}/{b}": round(float(np.linalg.norm(tips[a] - tips[b]) * 1000), 3)
            for a, b in combinations(FINGERS, 2)
        }
        pads = {f: skin.points(p, "r", f + "Pad") for f in FINGERS}
        spacing = {
            a + "/" + b: round(float(cdist(pads[a], pads[b]).min() * 1000), 3)
            for a, b in zip(FINGERS, FINGERS[1:])
        }
        rows.append(
            dict(
                frame=i,
                wristM=p.position("r_wrist").tolist(),
                distalSkinLowMm={
                    f: round(float((pads[f][:, 1].min() - level) * 1000), 3)
                    for f in FINGERS
                },
                adjacentDistalNearestVertexPairMm=spacing,
                rightAllTipPairMm=right_pair,
                rightMinusLeftWristDepthMm=round(
                    float((p.position("r_wrist")[2] - p.position("l_wrist")[2]) * 1000),
                    3,
                ),
                rightMinusLeftMiddleTipDepthMm=round(
                    float((tips["middle"][2] - p.position("l_middle_null")[2]) * 1000),
                    3,
                ),
                leftIndexMiddleTipMm=round(
                    float(
                        np.linalg.norm(
                            p.position("l_index_null") - p.position("l_middle_null")
                        )
                        * 1000
                    ),
                    3,
                ),
                backMedianHeightMm=round(
                    float((np.median(back[:, 1]) - level) * 1000), 3
                ),
                backHighestMm=round(float((back[:, 1].max() - level) * 1000), 3),
                wristSideDeviationDeg=round(
                    float(np.rad2deg(np.arctan2(across, forward))), 3
                ),
                forearmElevationFromHandPlaneDeg=round(
                    float(np.rad2deg(np.arctan2(vertical, np.hypot(forward, across)))),
                    3,
                ),
                forearmToMiddleHandAxisDeg=round(
                    float(np.rad2deg(np.arccos(np.clip(forward, -1, 1)))), 3
                ),
                indexToPinkySpreadMm=round(
                    float(np.linalg.norm(tips["index"] - tips["pinky"]) * 1000), 3
                ),
                thumbToIndexAcrossPalmMm=round(
                    float(abs((tips["thumb"] - tips["index"]) @ a[:, 1]) * 1000), 3
                ),
            )
        )
    windows = {}
    for start, stop in [
        (0, 44),
        (44, 76),
        (0, 76),
        (0, 82),
        (76, 82),
        (76, 85),
        (85, 104),
        (105, 152),
    ]:
        motion = {}
        for joint in ["r_wrist"] + ["r_" + f + "_null" for f in FINGERS]:
            v = np.asarray([p.position(joint)[[0, 2]] for p in poses[start : stop + 1]])
            ds = np.linalg.norm(np.diff(v, axis=0), axis=1) * 1000
            motion[joint] = dict(
                pathMm=round(float(ds.sum()), 4),
                netMm=round(float(np.linalg.norm(v[-1] - v[0]) * 1000), 4),
                maximumOffsetMm=round(
                    float(np.linalg.norm(v - v[0], axis=1).max() * 1000), 4
                ),
                largestStepMm=round(float(ds.max()), 4),
                largestStepEndingAtFrame=int(start + 1 + ds.argmax()),
            )
        selected = rows[start : stop + 1]

        def extent(key):
            return [min(x[key] for x in selected), max(x[key] for x in selected)]

        windows[f"{start}-{stop}"] = dict(
            horizontal=motion,
            backMedianHeightMm=extent("backMedianHeightMm"),
            wristSideDeviationDeg=extent("wristSideDeviationDeg"),
            forearmElevationFromHandPlaneDeg=extent("forearmElevationFromHandPlaneDeg"),
            indexToPinkySpreadMm=extent("indexToPinkySpreadMm"),
            distalSkinLowMm={
                d: [
                    min(r["distalSkinLowMm"][d] for r in selected),
                    max(r["distalSkinLowMm"][d] for r in selected),
                ]
                for d in FINGERS
            },
        )
    range_mm = {
        name: round(float(np.ptp([row["rightAllTipPairMm"][name] for row in rows])), 3)
        for name in rows[0]["rightAllTipPairMm"]
    }
    return dict(
        dorsalVertices=len(back_indices),
        frames=rows,
        windows=windows,
        rightTipPairRangeMm=range_mm,
    )


def motion_until_contact(poses, skin, mark, rows, source_card):
    """Measure both the first real touching pad and the physical hand from frame zero."""

    def earliest(digits):
        for row in rows:
            distances = {
                f: row["hands"]["r"]["fingers"][f]["distalPadGapMm"] for f in digits
            }
            finger = min(distances, key=distances.get)
            if distances[finger] <= 1:
                return dict(
                    frame=row["frame"],
                    finger=finger,
                    distalGapMm=distances[finger],
                    dealtCardFromShoeStartMm=round(
                        float(np.linalg.norm(row["cardCentreM"] - source_card) * 1000),
                        3,
                    ),
                    dealtCardToNextFixedCardMm=row["cardToNextFixedCardMm"],
                )
        raise ValueError("Den utdelade kortytan når ingen högerspets.")

    first = earliest(("index", "middle"))
    n = first["frame"]
    keep = poses[: n + 1]
    methods = {
        "handled": np.asarray([p.position("r_wrist") for p in keep])[:, None, :],
        "handrygg": np.asarray([skin.points(p, "r", "all")[mark] for p in keep]),
    }
    for d in FINGERS:
        methods[d] = np.asarray([skin.points(p, "r", d + "Pad") for p in keep])
    movements = {}
    for label, coords in methods.items():
        entry = {}
        for key, dimensions in (("xyz", [0, 1, 2]), ("xz", [0, 2])):
            x = coords[:, :, dimensions] * 1000
            path = np.linalg.norm(np.diff(x, axis=0), axis=2).sum(0)
            offsets = np.linalg.norm(x - x[0], axis=2)
            entry[key] = {
                "maxVertexPathMm": round(float(path.max()), 5),
                "maxVertexOffsetMm": round(float(offsets.max()), 5),
            }
        movements[label] = entry
    wrist = np.asarray([p.position("r_wrist") for p in poses[n:RELEASE]])
    following = {
        label: round(
            float(np.linalg.norm(np.diff(wrist[:, dim], axis=0), axis=1).sum() * 1000),
            5,
        )
        for label, dim in (("xyz", [0, 1, 2]), ("xz", [0, 2]))
    }
    return dict(
        dealtCardNode=CARD_NAME,
        thresholdMm=1,
        firstAnyDistalPad=earliest(FINGERS),
        firstActiveDistalPad=first,
        beforeAndIncludingFirstActiveContact=movements,
        remainingWristPathThroughFinalPushMm=following,
        nearestRightDistalPadGapAtFrameZeroMm=min(
            rows[0]["hands"]["r"]["fingers"][d]["distalPadGapMm"] for d in FINGERS
        ),
    )


def build(folder, provisional, local_transfer=True):
    assert sha(BASE) == BASE_SHA
    base_report = json.loads(
        BASE.with_name("givmatning.json").read_text(encoding="utf8")
    )
    glb = Glb(BASE)
    names, nodes, _, rest = hierarchy(glb)
    card_node = base_report["cardNodeIndex"]
    assert glb.doc["nodes"][card_node]["name"] == CARD_NAME
    before, centres, bases = read_exported_motion(glb, card_node)
    card = ExistingCard(glb, card_node, centres, bases)
    source_skin = ContactSkin(glb, names)
    mark = dorsal_selection(source_skin, before)
    old = diagnose(before, source_skin, mark, card.level)
    hand = WaitingPose(before, source_skin, card)
    cc, bb = (
        bring_card_to_waiting_hand(hand, centres, bases)
        if local_transfer
        else (centres, bases)
    )
    posed = [hand.drive(i, p, cc, bb, local_transfer) for i, p in enumerate(before)]
    for i, p in enumerate(posed):
        space_drawing_fingers(p, i, source_skin, card, centres[i], bases[i])
        if local_transfer:
            follow_presentation(
                p, before[i], i, source_skin, card, centres, bases, cc, bb
            )
    with TemporaryDirectory(prefix="paulina-vilohand-") as temp:
        target = Path(temp) / "giv.glb"
        edits = source_motion(
            glb,
            target,
            nodes,
            posed,
            rest,
            names,
            (card_node, cc, bb) if local_transfer else None,
        )
        actual = Glb(target)
        binary = target.read_bytes()
        proof, protocols = triangle_review(target)
    source_signature = signatures(Glb(BASE), edits, local_transfer)
    final_signature = signatures(actual, edits, local_transfer)
    assert final_signature == source_signature
    after, final_centres, final_bases = read_exported_motion(actual, card_node)
    assert np.allclose(final_centres, cc, atol=1e-7, rtol=0) and np.allclose(
        final_bases, bb, atol=2e-7, rtol=0
    )
    still = (
        np.r_[0:67, RELEASE : len(centres)]
        if local_transfer
        else np.arange(len(centres))
    )
    assert np.array_equal(final_centres[still], centres[still]) and np.array_equal(
        final_bases[still], bases[still]
    )
    skin = ContactSkin(actual, names)
    new = diagnose(after, skin, mark, card.level)
    digit_reviews = {side: finger_crossings(after, skin, side) for side in ("r", "l")}
    m = measure(
        actual,
        card,
        skin,
        after,
        final_centres,
        final_bases,
        np.array(base_report["mouthM"]),
        card.start,
    )
    for i, row in enumerate(m):
        prior = base_report["measuredFrames"][i]
        for key in (
            "gazeShoeDegrees",
            "spine3M",
            "headM",
            "crownM",
            "spineAxisForwardDegrees",
            "upperSpineForwardFromReadyDegrees",
        ):
            if key in prior:
                row[key] = prior[key]
        y = skin.points(after[i], "r", "all")[:, 1] - card.level
        row.update(
            rightLowestSkinToFeltMm=round(float(y.min() * 1000), 4),
            rightHighestSkinToFeltMm=round(float(y.max() * 1000), 3),
            rightWristToFeltMm=round(
                float((after[i].position("r_wrist")[1] - card.level) * 1000), 3
            ),
        )
    collisions = [
        r["frame"]
        for r in m
        if r["cardInsideShoeSolidsMm"]
        or any(
            h["solidIntersections"]
            or h["cardSurfaceIntersections"]
            or h["cardInteriorVertices"]
            for h in r["hands"].values()
        )
    ]
    approach = motion_until_contact(after, skin, mark, m, card.start)
    first = approach["firstActiveDistalPad"]["frame"]
    flat_frame = next(
        row["frame"]
        for row in m[base_report["keyframes"]["draw"] :]
        if max(abs(x) for x in row["cornerToFeltMm"]) < 0.08
    )
    takeover_frame = (
        next(
            row["frame"]
            for row in m[first:RELEASE]
            if min(
                row["hands"]["l"]["fingers"][d]["distalPadGapMm"]
                for d in ("index", "middle")
            )
            > 1
            and max(
                row["hands"]["r"]["fingers"][d]["distalPadGapMm"]
                for d in ("index", "middle")
            )
            <= 1
        )
        if local_transfer
        else GRIP
    )
    held = m[takeover_frame:RELEASE]
    pads = {
        d: [
            min(r["hands"]["r"]["fingers"][d]["distalPadGapMm"] for r in held),
            max(r["hands"]["r"]["fingers"][d]["distalPadGapMm"] for r in held),
        ]
        for d in ("index", "middle")
    }
    issues = []
    if (
        collisions
        or proof["opposingHandCrossingFrames"]
        or any(proof["skinThroughCardFaceFrames"].values())
    ):
        issues.append("Kollision.")
    if any(x["crossingFrames"] for x in digit_reviews.values()):
        issues.append("Samma hands fingrar korsar varandra.")
    waiting_end = 82 if local_transfer else START_REACH
    wait_motion = new["windows"][f"0-{waiting_end}"]["horizontal"]
    if any(d["pathMm"] > 1 for d in wait_motion.values()):
        issues.append("Stödhanden vandrar medan den väntar.")
    if local_transfer:
        contacts = approach["beforeAndIncludingFirstActiveContact"]
        if any(
            contacts[label][axis]["maxVertexOffsetMm"] > 0.20
            for label in ("handled", *FINGERS)
            for axis in ("xyz", "xz")
        ):
            issues.append(
                "Handled eller distala fingerhudspunkter flyttar sig före första verkliga kortkontakten."
            )
        if contacts["handrygg"]["xyz"]["maxVertexOffsetMm"] > 1:
            issues.append(
                "Den centrala handryggen flyttar sig mer än en millimeter före kortkontakt."
            )
        if (
            approach["firstAnyDistalPad"]["dealtCardToNextFixedCardMm"] < 5
            or approach["firstActiveDistalPad"]["dealtCardFromShoeStartMm"] < 30
        ):
            issues.append(
                "Registrerad fingertoppstryckning ligger fortfarande vid skomagasinet."
            )
        if max(abs(k) for row in m[flat_frame:] for k in row["cornerToFeltMm"]) > 0.20:
            issues.append(
                "Det utdelade kortet lämnar filten efter att det lagts plant."
            )
    waiting = m[: waiting_end + 1]
    if (
        max(r["rightLowestSkinToFeltMm"] for r in waiting) > 2
        or min(r["rightLowestSkinToFeltMm"] for r in waiting) < 0
    ):
        issues.append("Stödhanden lämnar filtens yta under väntan.")
    if max(v[1] for v in pads.values()) > 1.2:
        issues.append("Påskjutet saknar fingertoppskontakt.")
    left_gaps = {
        d: [
            r["hands"]["l"]["fingers"][d]["distalPadGapMm"]
            for r in m[LEFT_START : LEFT_END + 1]
        ]
        for d in ("index", "middle")
    }
    if max(max(series) for series in left_gaps.values()) > 1.2:
        issues.append("Utdragets pek- eller långfinger förlorar kortet.")
    takeover = [
        min(
            r["hands"][s]["fingers"][d]["distalPadGapMm"]
            for s in ("l", "r")
            for d in ("index", "middle")
        )
        for r in m[flat_frame : takeover_frame + 1]
    ]
    if max(takeover) > 1.2:
        issues.append(
            "Avståndet mellan det skjutna kortet och närmaste aktiva finger är för stort."
        )
    if min(new["rightTipPairRangeMm"].values()) < 0.3:
        issues.append("Något av högerhandens fingerpar är orörligt genom hela given.")
    if max(abs(n["wristSideDeviationDeg"]) for n in new["frames"][:RELEASE]) > 32:
        issues.append("Handleden avviker kraftigt i sidled.")
    if max(r["rightLowestSkinToFeltMm"] for r in m[RELEASE + 8 :]) > 2:
        issues.append("Högerhanden sätter inte ned fingertopparna under returen.")
    fingerprint = hashlib.sha256(binary).hexdigest()
    diagnostic = dict(
        sourceSceneSha256=BASE_SHA,
        sceneSha256=fingerprint,
        originalSeated03Sha256=sha(ROOT / "avatars/paulina/03_sittande_bakgrund.png"),
        method=f"Samma {len(mark)} punkter på ursprungliga handryggen spåras genom skinnet. Höjder mäts från filten. Sidoböj är underarmsaxelns vinkel i handflatans plan. XZ-bana är summan av stegen. Fingerbredd är ledspets till ledspets. Avståndet mellan distala hudvertexpar är en övre gräns för avståndet mellan hudytorna. Sittfotot 03 ger den kvalitativa förlagan för handens riktning och avslappning.",
        source=old,
        candidate=new,
        firstRightContact=approach,
        digitSurfaceReview=digit_reviews,
    )
    result = {
        k: v
        for k, v in base_report.items()
        if k
        not in (
            "sceneSha256",
            "sourceSceneSha256",
            "physics",
            "poses",
            "parentSceneSha256",
            "measuredFrames",
            "independentTriangleReview",
            "issues",
        )
    }
    result.update(
        sceneSha256=fingerprint,
        sourceSceneSha256=BASE_SHA,
        parentSceneSha256=BASE_SHA,
        poses={},
        measuredFrames=m,
        independentTriangleReview=proof,
        digitSurfaceReview=digit_reviews,
        unchangedSceneData=final_signature,
        rightRotationTracks=[x for x in edits if x.startswith("r_")],
        leftDrawingDigitTracks=[x for x in edits if x.startswith("l_")],
        issues=issues,
    )
    if local_transfer:
        result["keyframes"] = {
            **result["keyframes"],
            "flat": flat_frame,
            "present": first,
            "handoff": takeover_frame,
        }
        result["handTransfer"] = (
            "Vänster för det helt gula kortet till den vilande högra handen."
        )
    for phase, i in result["keyframes"].items():
        p = after[i]
        result["poses"][phase] = dict(
            frame=i,
            time=i / RATE,
            joints={name: np.round(p.position(name), 6).tolist() for name in LANDMARKS},
            poseSha256=hashlib.sha256(p.world.astype("<f4").tobytes()).hexdigest(),
            cardCentreM=final_centres[i].tolist(),
        )
    fixed = (
        "leftPresentationMaxDistalGapMm",
        "onFeltDistanceFromFlatToP4Mm",
        "freeSlideMm",
        "p4HorizontalErrorMm",
        "stationaryFrames",
        "stationaryCentreTravelMm",
        "stationaryMinimumSupportedCorners",
        "stationaryBottomToFeltMm",
        "spine3ForwardFromReadyMm",
        "headForwardFromReadyMm",
        "crownDropFromReadyMm",
        "maxSpineAxisForwardDegrees",
        "maxUpperSpineForwardFromReadyDegrees",
    )
    # Spine/head tracks, materials and skin are unchanged. Below, diagnostics for
    # the shifted handoff and the path on the felt are recomputed from exported data.
    physics = {k: base_report["physics"][k] for k in fixed}
    ready = result["keyframes"]["ready"]
    passive = [
        j
        for j, n in enumerate(names)
        if not n.startswith(
            tuple("r_" + k for k in ("uparm", "lowarm", "wrist", *FINGERS))
        )
    ]
    physics.update(
        waitingFrames=[0, waiting_end],
        beforeFirstRightContact=approach,
        leftPresentationMaxDistalGapMm={
            d: max(
                r["hands"]["l"]["fingers"][d]["distalPadGapMm"]
                for r in m[result["keyframes"]["draw"] : flat_frame + 1]
            )
            for d in ("index", "middle")
        },
        onFeltDistanceFromFlatToP4Mm=round(
            float(
                np.linalg.norm(
                    final_centres[flat_frame, [0, 2]]
                    - final_centres[result["keyframes"]["land"], [0, 2]]
                )
                * 1000
            ),
            3,
        ),
        onFeltPathFromFlatToP4Mm=round(
            float(
                np.linalg.norm(
                    np.diff(
                        final_centres[
                            flat_frame : result["keyframes"]["land"] + 1, [0, 2]
                        ],
                        axis=0,
                    ),
                    axis=1,
                ).sum()
                * 1000
            ),
            3,
        ),
        handoffCentreM=final_centres[takeover_frame].tolist(),
        trajectoryChangedFrames=[67, 104] if local_transfer else [],
        rightMinusLeftWristDepthAtStartMm=new["frames"][0][
            "rightMinusLeftWristDepthMm"
        ],
        rightMinusLeftMiddleTipDepthAtStartMm=new["frames"][0][
            "rightMinusLeftMiddleTipDepthMm"
        ],
        rightTipPairRangeMm=new["rightTipPairRangeMm"],
        leftMiddleIndexTipMm={
            str(i): new["frames"][i]["leftIndexMiddleTipMm"]
            for i in (44, 48, 54, 58, 62, 64, 65, 66, 68)
        },
        leftDrawingDistalGapRangeMm={f: [min(s), max(s)] for f, s in left_gaps.items()},
        nearestActivePadAtHandoffMm={
            str(flat_frame + i): v for i, v in enumerate(takeover)
        },
        rightWaitingHorizontalTravel=wait_motion,
        rightReadyShiftFromSourceMm={
            j: np.round(
                (after[ready].position(j) - before[ready].position(j)) * 1000, 3
            ).tolist()
            for j in wait_motion
        },
        rightReadyToWaitingEndLowestSkinRangeMm=[
            min(r["rightLowestSkinToFeltMm"] for r in waiting[ready:]),
            max(r["rightLowestSkinToFeltMm"] for r in waiting[ready:]),
        ],
        firstRightIndexOrMiddleWithin2MmAfterDraw=next(
            r["frame"]
            for r in m[result["keyframes"]["draw"] :]
            if min(
                r["hands"]["r"]["fingers"][d]["distalPadGapMm"]
                for d in ("index", "middle")
            )
            <= 2
        ),
        rightWaitingMaxLowestSkinToFeltMm=max(
            r["rightLowestSkinToFeltMm"] for r in waiting
        ),
        rightWaitingMaxHighestSkinToFeltMm=max(
            r["rightHighestSkinToFeltMm"] for r in waiting
        ),
        rightWaitingMaxWristToFeltMm=max(r["rightWristToFeltMm"] for r in waiting),
        rightIndexAndMiddleDistalGapRangeMm=pads,
        rightReleaseGapMm={
            d: m[RELEASE]["hands"]["r"]["fingers"][d]["distalPadGapMm"]
            for d in ("thumb", "index", "middle")
        },
        rightReturnFirstFrameBelowOneMm=next(
            r["frame"] for r in m[RELEASE + 3 :] if r["rightLowestSkinToFeltMm"] < 1
        ),
        rightReturnLowestSkinAtFramesMm={
            str(i): m[i]["rightLowestSkinToFeltMm"] for i in (108, 113, 120, 131, REST)
        },
        anchorMaxJointMatrixDifference={
            str(i): float(np.max(abs(after[i].world - before[i].world)))
            for i in (0, ready, REST)
        },
        leftAndBodySourceAnchorMaxJointMatrixDifference={
            str(i): float(
                np.max(abs(after[i].world[passive] - before[i].world[passive]))
            )
            for i in (0, ready, REST)
        },
        readyToReturnMaxJointMatrixDifference=float(
            np.max(abs(after[ready].world - after[REST].world))
        ),
        collisionFrames=collisions,
    )
    result["physics"] = physics
    print(
        json.dumps(
            dict(
                sha=fingerprint,
                issues=issues,
                collisions=collisions,
                hands=proof["opposingHandCrossingFrames"],
                faces=proof["skinThroughCardFaceFrames"],
                pads=pads,
                wait=new["windows"]["0-76"]["horizontal"]["r_wrist"],
                wrist82=new["windows"]["76-82"]["horizontal"]["r_wrist"],
                flat=new["windows"]["0-76"]["backMedianHeightMm"],
                angle=new["windows"]["85-104"]["wristSideDeviationDeg"],
            )
        ),
        flush=True,
    )
    if issues and not provisional:
        raise ValueError(" ".join(issues))
    files = {
        "giv.glb": binary,
        "handvila.json": json_bytes(diagnostic),
        **{"granskning/" + n: b for n, b in protocols.items()},
        "givmatning.json": json_bytes(result),
    }
    for name, data in files.items():
        if (folder / name).exists() and sha(folder / name) != hashlib.sha256(
            data
        ).hexdigest():
            raise ValueError(f"Versionskonflikt för {name}.")
    for name, data in files.items():
        put(folder / name, data, hashlib.sha256(data).hexdigest())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path)
    parser.add_argument("--arbetsprov", action="store_true")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument(
        "--lokaloverlamning",
        action="store_true",
        default=True,
        help="Vänster lämnar kortet där högerhanden redan vilar.",
    )
    modes.add_argument(
        "--referens-07",
        dest="lokaloverlamning",
        action="store_false",
        help="Återskapa reservprovet med V2:s äldre kortbana.",
    )
    arg = parser.parse_args()
    folder = arg.out_dir or (
        OUT / "kort-till-vilohand" if arg.lokaloverlamning else OUT
    )
    if arg.arbetsprov and folder.resolve() in (
        OUT.resolve(),
        (OUT / "kort-till-vilohand").resolve(),
    ):
        parser.error("Arbetsprov kräver en egen utgåvemapp.")
    build(folder, arg.arbetsprov, arg.lokaloverlamning)
