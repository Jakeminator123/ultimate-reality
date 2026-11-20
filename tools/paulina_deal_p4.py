"""Ge ett fysiskt kort till plats 4 med Paulinas låsta A1- och A2.3-rigg."""

import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation, Slerp
import trimesh

from material_versions import put, sha
from paulina_anchor_trial import Equipment, HandSurfaces, Pose as AnchorPose, between, unit
from paulina_blackjack_scene import add_mesh, material, table_cross_section
from paulina_motion_trial import (
    Glb,
    compact,
    continuous,
    hierarchy,
    motion_channel,
    rotation_blocks,
    world_matrices,
)

ROOT = Path(__file__).resolve().parents[1]
ANCHOR = ROOT / "avatars/paulina/prov-ankare/v1/rigg/ankare.glb"
ANCHOR_SHA = "ae129ea1cb0abc01bfcda3b1740e9a440467f88d2cad0e4a0f8aaa002b4c29e6"
OUT = ROOT / "avatars/paulina/giv-plats-4/v1/rigg"
RATE = 24
KEY = dict(a1=0, ready=44, draw=68, handoff=78, land=112, flat=120, release=123, rest=152)
LAST = 154
CAMERA = np.array([0.072, 1.400, 1.853])
UP = np.array([0.0, 1.0, 0.0])
FORWARD = np.array([0.0, 0.0, 1.0])
CARD_NAME = "Utdelat gult kort"
FINGERS = ("thumb", "index", "middle", "ring", "pinky")
HANDOFF_XZ = np.array([0.122, 0.514])
LANDMARKS = tuple(
    s + "_" + j
    for s in ("l", "r")
    for j in ("eye", "eye_null", "uparm", "lowarm", "wrist", "thumb_null", "index_null", "middle_null")
)


def ramp(frame, start, end):
    t = np.clip((frame - start) / (end - start), 0.0, 1.0)
    return float(t * t * (3 - 2 * t))


def blend(first, second, t):
    return first + (second - first) * t


def turn(first, second, t):
    if t <= 0:
        return first.copy()
    if t >= 1:
        return second.copy()
    origin = Rotation.from_matrix(rotation_blocks(first)).as_matrix()
    target = Rotation.from_matrix(rotation_blocks(second)).as_matrix()
    delta = Rotation.from_matrix(target @ origin.T).as_rotvec()
    return Rotation.from_rotvec(t * delta).as_matrix() @ first


class Pose(AnchorPose):
    def __init__(self, names, parents, rest):
        super().__init__(names, parents, rest)
        self.bone_scales = np.linalg.norm(rest[:, :3, :3], axis=1)

    def rotate(self, name, delta):
        # glTF stores each bone as rotation plus its original scale, never as an arbitrary shear matrix.
        index = self.names.index(name)
        parent = self.parents[index]
        basis = Rotation.from_matrix(rotation_blocks(self.world[parent, :3, :3])).as_matrix()
        rotation = Rotation.from_matrix(rotation_blocks(self.local[index, :3, :3])).as_matrix()
        change = Rotation.from_matrix(delta).as_matrix()
        self.local[index, :3, :3] = (basis.T @ change @ basis @ rotation) * self.bone_scales[index][None, :]
        self.world = world_matrices(self.local, self.parents)


def primitive_points(glb, node):
    primitive = glb.doc["meshes"][node["mesh"]]["primitives"][0]
    return glb.read(primitive["attributes"]["POSITION"]).astype(float) + np.array(
        node.get("translation", [0, 0, 0])
    )


class ShoeSolid:
    def __init__(self, points):
        hull = ConvexHull(points)
        faces = hull.simplices
        edges = points[faces[:, [1, 2, 0]]] - points[faces]
        edges = edges.reshape(-1, 3)
        self.edges = edges / np.maximum(np.linalg.norm(edges, axis=1, keepdims=True), 1e-9)
        self.planes = hull.equations
        self.points = points[hull.vertices]

    def separation(self, centre, basis, half):
        # Complete separating-axis test between a convex equipment part and the real oriented card box.
        axes = np.vstack(
            (self.planes[:, :3], basis.T, np.cross(self.edges[:, None], basis.T[None]).reshape(-1, 3))
        )
        lengths = np.linalg.norm(axes, axis=1)
        axes = axes[lengths > 1e-7] / lengths[lengths > 1e-7, None]
        static = (self.points - centre) @ axes.T
        radius = abs(axes @ basis) @ half
        return float(np.max(np.maximum(static.min(0) - radius, -static.max(0) - radius)))


class Cards:
    def __init__(self, glb, shoe):
        spec = shoe.spec
        self.size = np.array([spec["cardWidth"], spec["cardThickness"], spec["cardLength"]])
        self.half = self.size * 0.5
        self.shoe = shoe
        self.start_basis = shoe.yaw @ Rotation.from_euler("x", shoe.pitch).as_matrix()
        self.start_tail = spec["initialLeadZ"] - self.size[2] * np.cos(shoe.pitch)
        self.start = shoe.spot(0, self.start_tail) + self.start_basis @ np.array(
            [0, -self.half[1], self.half[2]]
        )
        rings = [
            (i, primitive_points(glb, n))
            for i, n in enumerate(glb.doc["nodes"])
            if n["name"] == "Satsningscirkel"
        ]
        centres = [(i, (points.max(0) + points.min(0)) / 2) for i, points in rings]
        assert len(centres) == 3
        self.ring_node, self.p4 = min(centres, key=lambda pair: abs(pair[1][0]))
        assert abs(self.p4[0]) < 1e-6 and self.p4[2] > max(p[2] for i, p in centres if i != self.ring_node)
        self.level = float(table_cross_section(glb, "Spelyta")[-1])
        self.p4 = self.p4.copy()
        self.p4[1] = self.level
        # The former inset decal leaves a white frame. Replace it with one entire rigid card.
        old = glb.doc["nodes"][-1]
        assert old["name"] == "Gult skokorts synliga rygg" and old["mesh"] == len(glb.doc["meshes"]) - 1
        glb.doc["scenes"][0]["nodes"].remove(len(glb.doc["nodes"]) - 1)
        glb.doc["nodes"].pop()
        glb.doc["meshes"].pop()
        next_card = next(n for n in glb.doc["nodes"] if n["name"] == "Översta kortet i skon")
        next_card["name"] = "Nästa gula kort i skon"
        next_card["translation"] = (-0.00046 * shoe.normal).tolist()
        yellow = material(glb, "Helgul spelyta ända ut till kortets kant", [1.0, 0.81, 0.006], 0.69)
        glb.doc["meshes"][next_card["mesh"]]["primitives"][0]["material"] = yellow
        self.node = add_mesh(glb, CARD_NAME, trimesh.creation.box(extents=self.size), yellow)
        glb.doc["nodes"][self.node].update(
            translation=self.start.tolist(),
            rotation=Rotation.from_matrix(self.start_basis).as_quat().tolist(),
        )
        self.travel = max(spec["travel"] + 0.016, spec["mouthZ"] - self.start_tail + 0.012)

    def drawn(self, u):
        tail = self.shoe.spot(0, self.start_tail + self.travel * u)
        tail[1] = max(tail[1], self.level + 0.036 * u * u)
        # The yielding real cards at the shoe mouth permit a shallower angle as the leading edge nears the felt.
        length, thickness = self.size[2], self.size[1]
        pitch = min(
            self.shoe.pitch,
            np.arcsin(np.clip((tail[1] - self.level - 0.00005) / np.hypot(length, thickness), 0, 1))
            - np.arctan2(thickness, length),
        )
        basis = self.shoe.yaw @ Rotation.from_euler("x", pitch).as_matrix()
        return tail + basis @ np.array([0, -self.half[1], self.half[2]]), basis

    def at(self, frame):
        if frame <= KEY["ready"]:
            return self.start.copy(), self.start_basis.copy()
        if frame <= KEY["draw"]:
            return self.drawn(ramp(frame, KEY["ready"], KEY["draw"]))
        carried = (
            Rotation.from_euler("y", -25, degrees=True).as_matrix()
            @ Rotation.from_euler("x", 20, degrees=True).as_matrix()
        )
        handoff = np.array([HANDOFF_XZ[0], self.level + abs(carried[1]) @ self.half + 0.00005, HANDOFF_XZ[1]])
        if frame <= KEY["handoff"]:
            u = ramp(frame, KEY["draw"], KEY["handoff"])
            centre, basis = self.drawn(1)
            centre = blend(centre, handoff, u)
            basis = turn(basis, carried, u)
            centre[1] = self.level + abs(basis[1]) @ self.half + 0.00005
            return centre, basis
        carry = ramp(frame, KEY["handoff"], KEY["land"])
        flatten = ramp(frame, KEY["land"] + 4, KEY["flat"])
        pitch = np.deg2rad(blend(20, 17, carry) * (1 - flatten))
        yaw = np.deg2rad(-25 * (1 - carry))
        basis = Rotation.from_euler("y", yaw).as_matrix() @ Rotation.from_euler("x", pitch).as_matrix()
        edge_z = self.p4[2] + self.half[2] * (1 - np.cos(pitch))
        edge = 0.00005 + 0.047 * np.sin(np.pi * carry)
        centre = np.array(
            [
                blend(handoff[0], self.p4[0], carry),
                self.level + edge + self.half[2] * np.sin(pitch) + self.half[1] * np.cos(pitch),
                blend(handoff[2], edge_z, carry),
            ]
        )
        return centre, basis

    def nearest(self, points, centre, basis):
        local = (points - centre) @ basis
        distances = np.linalg.norm(local - np.clip(local, -self.half, self.half), axis=1)
        index = distances.argmin()
        return float(distances[index]), local[index]


def source_poses(glb, nodes, rest):
    animation = glb.doc["animations"][0]
    rest_scale = np.linalg.norm(rest[:, :3, :3], axis=1)
    all_local = np.repeat(rest[None], KEY["ready"] + 1, 0)
    for channel in animation["channels"]:
        assert channel["target"]["path"] == "rotation"
        joint = nodes.index(channel["target"]["node"])
        sampler = animation["samplers"][channel["sampler"]]
        time = glb.read(sampler["input"]).reshape(-1)
        q = glb.read(sampler["output"])
        sampled = Slerp(time, Rotation.from_quat(q))(np.linspace(time[0], time[-1], KEY["ready"] + 1))
        all_local[:, joint, :3, :3] = sampled.as_matrix() * rest_scale[joint][None, None, :]
    return all_local


def align_gaze(pose, point, head_fraction):
    def ray():
        return unit(sum(pose.position(s + "_eye_null") - pose.position(s + "_eye") for s in ("l", "r")))

    eye = (pose.position("l_eye") + pose.position("r_eye")) / 2
    target = unit(point - eye)
    for name, scale in (("c_neck", 0.38), ("c_head", 0.62)):
        delta = Rotation.from_matrix(between(ray(), target)).as_rotvec()
        pose.rotate(name, Rotation.from_rotvec(scale * head_fraction * delta).as_matrix())
    for s in ("r", "l"):
        name = s + "_eye"
        pose.point(name, name + "_null", point - pose.position(name))


def aim_tip(pose, side, finger, target):
    stem = side + "_" + finger
    end = stem + "_null"
    for _ in range(26):
        if np.linalg.norm(pose.position(end) - target) < 0.00012:
            break
        for segment in ("3", "2", "1"):
            name = stem + segment
            pivot = pose.position(name)
            delta = Rotation.from_matrix(between(pose.position(end) - pivot, target - pivot)).as_rotvec()
            magnitude = np.linalg.norm(delta)
            if magnitude > 1e-10:
                pose.rotate(name, Rotation.from_rotvec(delta * min(1, 0.17 / magnitude)).as_matrix())


def clipped_skin(triangles, half):
    """Clip real skin triangles to the card footprint and return all polygon vertices in card space."""
    keep = np.all(
        (triangles.max(1)[:, [0, 2]] >= -half[[0, 2]]) & (triangles.min(1)[:, [0, 2]] <= half[[0, 2]]), axis=1
    )
    triangles = triangles[keep]
    if not len(triangles):
        return np.empty((0, 3))
    p = triangles.reshape(-1, 3)
    candidates = [p[np.all(abs(p[:, [0, 2]]) <= half[[0, 2]], axis=1)]]
    q = triangles[:, [1, 2, 0]].reshape(-1, 3)
    direction = q - p
    for axis, other in ((0, 2), (2, 0)):
        for side in (-1, 1):
            t = np.divide(
                side * half[axis] - p[:, axis],
                direction[:, axis],
                out=np.full(len(p), np.inf),
                where=abs(direction[:, axis]) > 1e-12,
            )
            valid = (t >= 0) & (t <= 1)
            points = p[valid] + t[valid, None] * direction[valid]
            candidates.append(points[abs(points[:, other]) <= half[other]])
    a, b, c = triangles.transpose(1, 0, 2)
    v, w = b - a, c - a
    det = v[:, 0] * w[:, 2] - v[:, 2] * w[:, 0]
    active = abs(det) > 1e-12
    for sx in (-1, 1):
        for sz in (-1, 1):
            dx, dz = sx * half[0] - a[:, 0], sz * half[2] - a[:, 2]
            u = np.divide(dx * w[:, 2] - dz * w[:, 0], det, out=np.zeros_like(det), where=active)
            z = np.divide(v[:, 0] * dz - v[:, 2] * dx, det, out=np.zeros_like(det), where=active)
            inside = active & (u >= 0) & (z >= 0) & (u + z <= 1)
            candidates.append(a[inside] + u[inside, None] * v[inside] + z[inside, None] * w[inside])
    return np.vstack(candidates)


class ContactSkin(HandSurfaces):
    def __init__(self, glb, names):
        super().__init__(glb, names)
        bone_names = np.array(names)
        primitive = glb.doc["meshes"][0]["primitives"][0]
        attrs = primitive["attributes"]
        pos = glb.read(attrs["POSITION"])
        joint = glb.read(attrs["JOINTS_0"])
        weights = glb.read(attrs["WEIGHTS_0"])
        owner = bone_names[joint[np.arange(len(joint)), weights.argmax(1)]]
        faces = glb.read(primitive["indices"]).reshape(-1, 3)
        self.faces = {}
        for side in ("l", "r"):
            for finger in FINGERS:
                skin_faces = faces[np.any(np.char.startswith(owner[faces], side + "_" + finger), axis=1)]
                ids, local_faces = np.unique(skin_faces.ravel(), return_inverse=True)
                self.faces[side, finger] = local_faces.reshape(-1, 3)
                self.groups[side, finger + "Mesh"] = (
                    np.column_stack((pos[ids], np.ones(len(ids)))),
                    joint[ids],
                    weights[ids],
                )
                xyz, ids, weight = self.groups[side, finger]
                primary = bone_names[ids[np.arange(len(ids)), weight.argmax(axis=1)]]
                pad = np.array([joint.endswith(("3", "_null")) for joint in primary])
                self.groups[side, finger + "Pad"] = xyz[pad], ids[pad], weight[pad]

    def patch(self, pose, side, finger, centre, basis, half):
        pts = (self.points(pose, side, finger + "Mesh") - centre) @ basis
        return clipped_skin(pts[self.faces[side, finger]], half)

    def clear_face(self, pose, side, finger, centre, basis, half, sign, seats=False):
        # Rotate the whole digit around a real anatomical pivot. The extremum may be on a triangle edge.
        target = sign * (half[1] + 0.00014)

        def error():
            vertices = self.patch(pose, side, finger, centre, basis, half)
            if not len(vertices):
                return None, 0.0
            v = vertices[np.argmin(sign * vertices[:, 1])]
            return centre + basis @ v, target - v[1]

        for _ in range(6):
            for segment in ("1", "2", "3"):
                point, change = error()
                if point is None or abs(change) < 0.00008 or (not seats and sign * change <= 0):
                    return
                name = side + "_" + finger + segment
                index = pose.names.index(name)
                pivot = pose.position(name)
                delta = Rotation.from_matrix(
                    between(point - pivot, point - pivot + basis[:, 1] * change)
                ).as_rotvec()
                old = pose.local[index, :3, :3].copy()
                pose.rotate(
                    name,
                    Rotation.from_rotvec(delta * min(1, 0.17 / max(1e-9, np.linalg.norm(delta)))).as_matrix(),
                )
                _, updated = error()
                if abs(updated) > abs(change):
                    pose.local[index, :3, :3] = old
                    pose.world = world_matrices(pose.local, pose.parents)

    def seat_pad(self, pose, side, finger, point, normal, *, entire=False, clearance=0.00023):
        group = finger if entire else finger + "Pad"
        segments = ("1", "2", "3") if entire else ("3", "2")
        for _ in range(4):
            for segment in segments:
                pts = self.points(pose, side, group)
                signed = (pts - point) @ normal
                vertex = pts[signed.argmin()]
                error = clearance - signed.min()
                if abs(error) < 0.00013 or (entire and error <= 0):
                    return
                joint = side + "_" + finger + segment
                pivot = pose.position(joint)
                delta = Rotation.from_matrix(
                    between(vertex - pivot, vertex + normal * error - pivot)
                ).as_rotvec()
                magnitude = np.linalg.norm(delta)
                if magnitude > 1e-9:
                    pose.rotate(joint, Rotation.from_rotvec(delta * min(1, 0.20 / magnitude)).as_matrix())


class Gesture:
    def __init__(self, ready, surfaces, cards):
        self.ready = ready
        self.surfaces = surfaces
        self.cards = cards
        self.names = ready.names
        self.hand_joints = {
            side: [
                i
                for i, name in enumerate(self.names)
                if any(name.startswith(side + "_" + finger) for finger in FINGERS)
            ]
            for side in ("l", "r")
        }
        self.centre = np.array([0.10, 0.76, 0.48])
        flat = self.copy_ready()
        pole = np.array([-0.24, 0.70, 0.18])
        wrist = self.centre + [-0.042, 0.046, -0.139]
        for _ in range(3):
            flat.arm("r", wrist, pole)
            flat.hand("r", FORWARD, UP, 0.56)
            tips = (flat.position("r_index_null") + flat.position("r_middle_null")) / 2
            wrist[[0, 2]] += (self.centre + [-0.006, 0, 0.029] - tips)[[0, 2]]
        for finger in FINGERS:
            surfaces.finger_plane(
                flat,
                "r",
                finger,
                self.centre + [0, cards.half[1], 0],
                UP,
                0.00022 if finger in ("index", "middle") else 0.004,
            )
        aim_tip(flat, "r", "thumb", flat.position("r_thumb_null") + [0, 0.012, 0])
        for finger in ("index", "middle"):
            surfaces.seat_pad(flat, "r", finger, self.centre + cards.half[1] * UP, UP)
        self.flat = flat
        # The thumb wraps under the near edge only while the card is free in the air.
        pinch = Pose(self.names, ready.parents, flat.local)
        for finger, spot in (("index", [0.006, 0.007, -0.020]), ("middle", [-0.014, 0.006, -0.004])):
            aim_tip(pinch, "r", finger, self.centre + spot)
            surfaces.finger_plane(pinch, "r", finger, self.centre + [0, cards.half[1], 0], UP, 0.00024)
            surfaces.seat_pad(pinch, "r", finger, self.centre + cards.half[1] * UP, UP)
        goal = self.centre + [0.012, -0.007, -0.037]
        for _ in range(9):
            aim_tip(pinch, "r", "thumb", goal)
            skin = surfaces.points(pinch, "r", "thumb") - self.centre
            inside = (abs(skin[:, 0]) < cards.half[0] - 0.0001) & (abs(skin[:, 2]) < cards.half[2] - 0.0001)
            if not np.any(inside):
                goal[2] += 0.002
                continue
            error = -cards.half[1] - 0.00022 - skin[inside, 1].max()
            if abs(error) < 0.0002:
                break
            goal[1] += np.clip(error, -0.008, 0.008)
        self.pinch = pinch
        surfaces.clear_face(pinch, "r", "thumb", self.centre, np.eye(3), cards.half, -1, seats=True)
        outside = Pose(self.names, ready.parents, pinch.local)
        aim_tip(outside, "r", "thumb", self.centre + [0.025, -0.005, -0.057])
        self.outside = outside

    def copy_ready(self):
        return Pose(self.ready.names, self.ready.parents, self.ready.local)

    def opt_hand(self, pose, side, point, orientation, finger_local, pole):
        pose.arm(side, point, pole)
        i = self.names.index(side + "_wrist")
        present = rotation_blocks(pose.world[i, :3, :3])
        pose.rotate(side + "_wrist", rotation_blocks(orientation) @ present.T)
        ids = self.hand_joints[side]
        pose.local[ids, :3, :3] = finger_local[ids, :3, :3]
        pose.world = world_matrices(pose.local, pose.parents)

    def interpolation(self, one, two, t, side):
        if t == 0:
            return one.local
        if t == 1:
            return two.local
        result = one.local.copy()
        for i in self.hand_joints[side]:
            result[i, :3, :3] = turn(one.local[i, :3, :3], two.local[i, :3, :3], t)
        return result

    def after_ready(self, frame, centre, basis, focus):
        pose = self.copy_ready()
        carry = ramp(frame, 74, 107)
        return_body = ramp(frame, 123, KEY["rest"])
        reach = carry * (1 - return_body)
        # Lean forward from the seated pelvis while both feet keep their original supports.
        for name, portion in (("c_spine0", 0.30), ("c_spine1", 0.30), ("c_spine2", 0.25), ("c_spine3", 0.15)):
            delta = Rotation.from_euler("yx", [-15 * reach * portion, 45 * reach * portion], degrees=True)
            pose.rotate(name, delta.as_matrix())
        l_wrist = self.names.index("l_wrist")
        r_wrist = self.names.index("r_wrist")
        back_l = ramp(frame, 79, 106)
        # The extracting hand moves to the player's half of the card; the receiving thumb enters the near edge.
        exchange = ramp(frame, 63, 75)
        pivot = np.array([0.0035, 0.004, -0.0162])
        delta = (
            basis
            @ Rotation.from_euler("y", -108 * exchange, degrees=True).as_matrix()
            @ self.cards.start_basis.T
        )
        anchor_pivot = self.cards.start + self.cards.start_basis @ pivot
        left_pivot = centre + basis @ (pivot + np.array([0.003, 0, 0.043]) * exchange)
        l_position = blend(
            left_pivot + delta @ (self.ready.position("l_wrist") - anchor_pivot),
            self.ready.position("l_wrist"),
            back_l,
        )
        l_position += np.array([0.043, 0.057, -0.018]) * np.sin(np.pi * back_l)
        around_wall = ramp(frame, 44, 52) * (1 - ramp(frame, 61, 71))
        l_position += (0.031 * UP + 0.008 * basis[:, 0]) * around_wall
        l_basis = turn(delta @ self.ready.world[l_wrist, :3, :3], self.ready.world[l_wrist, :3, :3], back_l)
        left_pole = blend(
            self.ready.position("l_lowarm"),
            np.array([0.28, 0.65, 0.13 + 0.11 * reach]),
            ramp(frame, 44, 60) * (1 - back_l),
        )
        self.opt_hand(pose, "l", l_position, l_basis, self.ready.local, left_pole)
        free_thumb = ramp(frame, 60, 68) * (1 - ramp(frame, 85, 96))
        if free_thumb > 0:
            guard = pose.position("l_thumb1") + basis @ np.array([0.008, 0.035, 0.036])
            aim_tip(pose, "l", "thumb", blend(pose.position("l_thumb_null"), guard, free_thumb))
        if frame < 80:
            for finger in ("index", "middle"):
                if finger == "middle" and around_wall > 0 and exchange < 0.1:
                    local_tip = (
                        self.ready.position("l_middle_null") - self.cards.start
                    ) @ self.cards.start_basis
                    local_tip[2] += 0.024 * around_wall
                    aim_tip(pose, "l", finger, centre + basis @ local_tip)
                self.surfaces.finger_plane(
                    pose, "l", finger, centre + self.cards.half[1] * basis[:, 1], basis[:, 1], 0.00023
                )
        track_r = ramp(frame, 53, 76)
        back_r = ramp(frame, KEY["flat"] + 1, KEY["rest"])
        wrist = centre + basis @ (self.flat.position("r_wrist") - self.centre)
        natural = self.ready.position("r_wrist")
        r_position = blend(blend(natural, wrist, track_r), natural, back_r)
        r_position += np.array([-0.012, 0.018, 0.005]) * np.sin(np.pi * track_r)
        withdraw = ramp(frame, 44, 53) * (1 - ramp(frame, 64, 76))
        r_position += np.array([-0.045, 0.034, 0.065]) * withdraw
        near_edge = ramp(frame, 64, 69) * (1 - ramp(frame, 74, 78))
        r_position += basis @ np.array([-0.049, 0.010, -0.068]) * near_edge
        pass_arm = ramp(frame, 61, 68) * (1 - ramp(frame, 72, 77))
        r_position += np.array([-0.083, 0.062, 0.053]) * pass_arm
        r_position += np.array([-0.030, 0.075, -0.014]) * np.sin(np.pi * back_r)
        r_basis = turn(
            self.ready.world[r_wrist, :3, :3],
            basis @ self.flat.world[r_wrist, :3, :3],
            track_r * (1 - back_r),
        )
        if frame < 74:
            right_shape = self.interpolation(self.flat, self.outside, ramp(frame, 61, 72), "r")
        elif frame < KEY["land"]:
            right_shape = self.interpolation(self.outside, self.pinch, ramp(frame, 74, 78), "r")
        elif frame < KEY["land"] + 4:
            right_shape = self.interpolation(
                self.pinch, self.outside, ramp(frame, KEY["land"], KEY["land"] + 4), "r"
            )
        else:
            right_shape = self.interpolation(
                self.outside, self.flat, ramp(frame, KEY["land"] + 4, KEY["flat"]), "r"
            )
        phase_hand = Pose(self.names, pose.parents, right_shape)
        finger_local = self.interpolation(self.ready, phase_hand, track_r * (1 - back_r), "r")
        right_pole = blend(
            self.ready.position("r_lowarm"),
            np.array([-0.24, 0.67, 0.16 + 0.23 * reach]),
            max(track_r * (1 - back_r), reach),
        )
        self.opt_hand(pose, "r", r_position, r_basis, finger_local, right_pole)
        if 72 <= frame <= KEY["land"] + 4:
            for _ in range(4):
                palm = (self.surfaces.points(pose, "r", "thumb") - centre) @ basis
                overlap = (abs(palm[:, 0]) <= self.cards.half[0]) & (abs(palm[:, 2]) <= self.cards.half[2])
                if not np.any(overlap):
                    break
                error = palm[overlap, 1].max() + self.cards.half[1] + 0.00013
                if error < 0.00008:
                    break
                aim_tip(pose, "r", "thumb", pose.position("r_thumb_null") - min(0.009, error) * basis[:, 1])
        if 75 <= frame <= KEY["flat"] + 1:
            for finger in ("index", "middle"):
                self.surfaces.finger_plane(
                    pose, "r", finger, centre + self.cards.half[1] * basis[:, 1], basis[:, 1], 0.00024
                )
                self.surfaces.seat_pad(
                    pose, "r", finger, centre + self.cards.half[1] * basis[:, 1], basis[:, 1]
                )
        for side, fingers in (("l", ("thumb", "ring", "pinky")), ("r", FINGERS)):
            for finger in fingers:
                pts = self.surfaces.points(pose, side, finger)
                if pts[:, 1].min() < self.cards.level + 0.00005:
                    self.surfaces.seat_pad(pose, side, finger, [0, self.cards.level, 0], UP, entire=True)
        if frame < 81:
            for finger in ("index", "middle"):
                self.surfaces.clear_face(pose, "l", finger, centre, basis, self.cards.half, 1)
                self.surfaces.clear_face(
                    pose,
                    "l",
                    finger,
                    self.cards.start - 0.00046 * self.cards.shoe.normal,
                    self.cards.start_basis,
                    self.cards.half,
                    1,
                )
        if 72 <= frame <= KEY["land"] + 4:
            self.surfaces.clear_face(
                pose,
                "r",
                "thumb",
                centre,
                basis,
                self.cards.half,
                -1,
                seats=KEY["handoff"] <= frame <= KEY["land"],
            )
        track_eye = ramp(frame, 45, 61) * (1 - ramp(frame, 120, KEY["rest"]))
        if track_eye > 0 or reach > 0:
            align_gaze(pose, blend(focus, centre, track_eye), 0.81)
        return pose


def measure(glb, cards, surfaces, poses, centres, rotations, mouth, focus):
    solids = {name: table_cross_section(glb, name) for name in ("Spelyta", "Bordets kant")}
    hulls = {}
    for node in glb.doc["nodes"]:
        if node["name"] in (
            "Kortskons botten",
            "Mynningens tröskel",
            "Kortskons sidovägg",
            "Främre skokind",
            "Skokindens beslag",
            "Kortskons bakstycke",
            "Kortstockens följare",
            "Kortstock",
            "Nästa gula kort i skon",
        ):
            hulls[str(len(hulls)) + " " + node["name"]] = ShoeSolid(primitive_points(glb, node))
    results = []
    half = cards.half
    base = np.array([[sx * half[0], -half[1], sz * half[2]] for sx in (-1, 1) for sz in (-1, 1)])
    x, back, front, _, height = solids["Spelyta"]
    for nframe, (p, c, basis) in enumerate(zip(poses, centres, rotations)):
        corners = c + base @ basis.T
        margin = np.minimum(
            corners[:, 2] - np.interp(corners[:, 0], x, back),
            np.interp(corners[:, 0], x, front) - corners[:, 2],
        )
        row = {
            "frame": nframe,
            "time": nframe / RATE,
            "cardCentreM": c.tolist(),
            "cardRotation": Rotation.from_matrix(basis).as_quat().tolist(),
            "cornerToFeltMm": np.round((corners[:, 1] - height) * 1000, 3).tolist(),
            "cornerMarginMm": np.round(margin * 1000, 2).tolist(),
            "hands": {},
        }
        separation = {name: solid.separation(c, basis, half) for name, solid in hulls.items()}
        row["cardInsideShoeSolidsMm"] = {
            name: round(-value * 1000, 3) for name, value in separation.items() if value < -0.00002
        }
        row["cardToNextFixedCardMm"] = round(
            max(
                0,
                next(value for name, value in separation.items() if name.endswith("Nästa gula kort i skon")),
            )
            * 1000,
            3,
        )
        for side in ("l", "r"):
            all_skin = surfaces.points(p, side, "all")
            penetration = {}
            inner = (all_skin - c) @ basis
            in_card = np.all(abs(inner) < half - 0.00002, axis=1)
            for name, (xs, rear, far, low, top) in solids.items():
                horiz, y, z = all_skin.T
                inside = (
                    (horiz > xs.min())
                    & (horiz < xs.max())
                    & (z > np.interp(horiz, xs, rear) + 1e-6)
                    & (z < np.interp(horiz, xs, far) - 1e-6)
                    & (y > low + 1e-6)
                    & (y < top - 1e-6)
                )
                if np.any(inside):
                    penetration[name] = int(inside.sum())
            for name, solid in hulls.items():
                plane = solid.planes
                bounds = all_skin @ plane[:, :3].T + plane[:, 3]
                count = int(np.sum(np.max(bounds, axis=1) < -0.00002))
                if count:
                    penetration[name] = count
            digits = {}
            crossing = {}
            for finger in FINGERS:
                points = surfaces.points(p, side, finger)
                distance, local = cards.nearest(points, c, basis)
                pad, pad_point = cards.nearest(surfaces.points(p, side, finger + "Pad"), c, basis)
                digits[finger] = {
                    "gapMm": round(distance * 1000, 3),
                    "nearestCardLocalMm": np.round(local * 1000, 3).tolist(),
                    "distalPadGapMm": round(pad * 1000, 3),
                    "distalPadCardLocalMm": np.round(pad_point * 1000, 3).tolist(),
                }
                for name, centre, orientation in (
                    ("dealt", c, basis),
                    ("next", cards.start - 0.00046 * cards.shoe.normal, cards.start_basis),
                ):
                    section = surfaces.patch(p, side, finger, centre, orientation, half)
                    if len(section):
                        bounds = np.array([section[:, 1].min(), section[:, 1].max()])
                        digits[finger][name + "ClippedSkinRangeMm"] = np.round(bounds * 1000, 3).tolist()
                        if bounds[0] < half[1] - 0.00005 and bounds[1] > -half[1] + 0.00005:
                            crossing[name + "-" + finger] = np.round(bounds * 1000, 3).tolist()
            row["hands"][side] = {
                "fingers": digits,
                "cardInteriorVertices": int(in_card.sum()),
                "solidIntersections": penetration,
                "cardSurfaceIntersections": crossing,
                "mouthMm": round(float(np.min(np.linalg.norm(all_skin - mouth, axis=1))) * 1000, 3),
            }
        eyes = np.array([p.position(s + "_eye") for s in ("l", "r")])
        rays = np.array([unit(p.position(s + "_eye_null") - p.position(s + "_eye")) for s in ("l", "r")])
        for label, point in (("Front", CAMERA), ("Shoe", focus), ("Card", c)):
            directions = np.array([unit(point - eye) for eye in eyes])
            row["gaze" + label + "Degrees"] = np.round(
                np.rad2deg(np.arccos(np.clip(np.sum(rays * directions, 1), -1, 1))), 3
            ).tolist()
        row["gazePitchDegrees"] = round(float(np.rad2deg(np.arcsin(unit(rays.mean(0))[1]))), 3)
        results.append(row)
    return results


def write_animation(glb, poses, centres, rotations, card, nodes, rest):
    times = np.arange(len(poses)) / RATE
    clock = glb.accessor(np.asarray(times, dtype="<f4"), "SCALAR")
    glb.doc["accessors"][clock].update(min=[0.0], max=[float(times[-1])])
    glb.doc["bufferViews"][glb.doc["accessors"][clock]["bufferView"]].pop("target", None)
    anim = {"name": "Paulina ger ett gult kort till plats 4", "samplers": [], "channels": []}
    glb.doc["animations"] = [anim]
    driven = continuous(
        np.array([Rotation.from_matrix(rotation_blocks(p.local[:, :3, :3])).as_quat() for p in poses])
    )
    neutral = Rotation.from_matrix(rotation_blocks(rest[:, :3, :3])).as_quat()
    for i, node in enumerate(nodes):
        if np.min(np.abs(driven[:, i] @ neutral[i])) < 1 - 1e-9:
            motion_channel(glb, anim, clock, node, "rotation", driven[:, i])
    motion_channel(glb, anim, clock, card, "translation", centres)
    motion_channel(
        glb,
        anim,
        clock,
        card,
        "rotation",
        continuous(Rotation.from_matrix(rotations).as_quat()[:, None, :])[:, 0],
    )


def read_exported_motion(glb, card_node):
    names, nodes, parents, rest = hierarchy(glb)
    joint_for_node = {node: i for i, node in enumerate(nodes)}
    local = np.repeat(rest[None], LAST + 1, axis=0)
    clock = np.arange(LAST + 1) / RATE
    card = {}
    clip = glb.doc["animations"][0]
    for channel in clip["channels"]:
        sampler = clip["samplers"][channel["sampler"]]
        np.testing.assert_allclose(glb.read(sampler["input"]).reshape(-1), clock, rtol=0, atol=3e-7)
        values = glb.read(sampler["output"])
        path = channel["target"]["path"]
        node = channel["target"]["node"]
        if node == card_node:
            card[path] = values
        else:
            assert path == "rotation"
            i = joint_for_node[node]
            scale = np.asarray(glb.doc["nodes"][node]["scale"])
            local[:, i, :3, :3] = Rotation.from_quat(values).as_matrix() * scale[None, None, :]
    poses = [Pose(names, parents, row) for row in local]
    return poses, card["translation"].astype(float), Rotation.from_quat(card["rotation"]).as_matrix()


def build(folder):
    assert sha(ANCHOR) == ANCHOR_SHA
    source = json.loads(ANCHOR.with_name("posematning.json").read_text(encoding="utf8"))
    assert source["sceneSha256"] == ANCHOR_SHA
    glb = Glb(ANCHOR)
    names, nodes, parents, rest = hierarchy(glb)
    assert len(nodes) == 127 and len(glb.doc["skins"]) == 1
    anchor_frames = source_poses(glb, nodes, rest)
    ready = Pose(names, parents, anchor_frames[-1])
    surfaces = ContactSkin(glb, names)
    shoe = Equipment()
    cards = Cards(glb, shoe)
    gesture = Gesture(ready, surfaces, cards)
    mouth = np.array(source["mouthM"])
    focus = np.array(source["gazeTargetM"])
    centres, rotations, poses = [], [], []
    for frame in range(LAST + 1):
        centre, basis = cards.at(frame)
        if frame <= KEY["ready"]:
            p = Pose(names, parents, anchor_frames[frame])
            if frame == 0:
                align_gaze(p, CAMERA, 0.81)
            elif frame < KEY["ready"]:
                eye = (p.position("l_eye") + p.position("r_eye")) / 2
                old_ray = unit(sum(p.position(s + "_eye_null") - p.position(s + "_eye") for s in ("l", "r")))
                old_camera = np.array([0.072, 1.792, 1.853])
                correction = unit(CAMERA - eye) - unit(old_camera - eye)
                weight = 1 - ramp(frame, 0, KEY["ready"])
                gaze_distance = blend(np.linalg.norm(CAMERA - eye), np.linalg.norm(focus - eye), 1 - weight)
                align_gaze(p, eye + unit(old_ray + weight * correction) * gaze_distance, 0.81)
        elif frame >= KEY["rest"]:
            p = gesture.copy_ready()
        else:
            p = gesture.after_ready(frame, centre, basis, focus)
        centres.append(centre)
        rotations.append(basis)
        poses.append(p)
    centres, rotations = np.array(centres), np.array(rotations)
    write_animation(glb, poses, centres, rotations, cards.node, nodes, rest)
    glb.doc["asset"]["extras"]["physicalDeal"] = {
        "targetSeat": 4,
        "anchorSha256": ANCHOR_SHA,
        "fps": RATE,
        "keyframes": KEY,
    }
    compact(glb)
    with TemporaryDirectory(prefix="paulina-giv-p4-") as stage:
        actual_file = glb.save(Path(stage) / "giv.glb")
        emitted = Glb(actual_file)
        scene_bytes = actual_file.read_bytes()
    poses, centres, rotations = read_exported_motion(emitted, cards.node)
    measurements = measure(
        emitted, cards, ContactSkin(emitted, names), poses, centres, rotations, mouth, focus
    )
    output = {
        "sceneSha256": hashlib.sha256(scene_bytes).hexdigest(),
        "bodySha256": source["bodySha256"],
        "anchorSha256": ANCHOR_SHA,
        "anchorFile": str(ANCHOR.relative_to(ROOT)).replace("\\", "/"),
        "cardNode": CARD_NAME,
        "cardNodeIndex": cards.node,
        "cardDimensionsM": cards.size.tolist(),
        "shoeSourceSha256": source["shoeSpecSha256"],
        "nextCardNode": "Nästa gula kort i skon",
        "mouthM": mouth.tolist(),
        "p4M": cards.p4.tolist(),
        "targetSeat": 4,
        "targetRingNodeIndex": cards.ring_node,
        "tableHeightM": cards.level,
        "cameraM": CAMERA.tolist(),
        "fps": RATE,
        "seconds": LAST / RATE,
        "animationFrames": LAST + 1,
        "keyframes": KEY,
        "joints": len(names),
        "skins": len(glb.doc["skins"]),
        "poses": {},
        "measuredFrames": measurements,
        "measurementSource": "Decoded exported GLB rotations, original joint scales, inverse bind matrices, weighted skin triangles and the actual two card footprints.",
    }
    for name, frame in KEY.items():
        p = poses[frame]
        output["poses"][name] = {
            "frame": frame,
            "time": frame / RATE,
            "joints": {key: np.round(p.position(key), 6).tolist() for key in LANDMARKS},
            "poseSha256": hashlib.sha256(p.world.astype("<f4").tobytes()).hexdigest(),
            "cardCentreM": centres[frame].tolist(),
        }
    stable = centres[KEY["flat"] :]
    floor_gaps = np.asarray([row["cornerToFeltMm"] for row in measurements[KEY["flat"] :]])
    flight = measurements[KEY["handoff"] : KEY["land"] + 1]
    half_mm = cards.half[1] * 1000
    face_gaps = {}
    for digit, sign in (("thumb", -1), ("index", 1), ("middle", 1)):
        values = [row["hands"]["r"]["fingers"][digit]["dealtClippedSkinRangeMm"] for row in flight]
        distances = np.asarray([low if sign == 1 else -high for low, high in values]) - half_mm
        face_gaps[digit] = np.round([distances.min(), distances.max()], 3).tolist()
    output["physics"] = {
        "stationaryFrames": len(stable),
        "stationaryCentreTravelMm": float(np.max(np.linalg.norm(stable - stable[0], axis=1)) * 1000),
        "stationaryRotationTravelDegrees": float(
            np.rad2deg(
                Rotation.from_matrix(rotations[KEY["flat"] :] @ rotations[KEY["flat"]].T).magnitude().max()
            )
        ),
        "p4HorizontalErrorMm": float(np.linalg.norm(stable[-1, [0, 2]] - cards.p4[[0, 2]]) * 1000),
        "stationaryMinimumSupportedCorners": int(np.min(np.sum(abs(floor_gaps) < 0.25, axis=1))),
        "stationaryBottomToFeltMm": [float(floor_gaps.min()), float(floor_gaps.max())],
        "maxAirborneDistalSkinGapMm": {
            digit: max(row["hands"]["r"]["fingers"][digit]["distalPadGapMm"] for row in flight)
            for digit in ("thumb", "index", "middle")
        },
        "airborneClippedFingerSurfaceGapRangeMm": face_gaps,
        "cardSkinTriangleIntersectionFrames": [
            row["frame"]
            for row in measurements
            if any(hand["cardSurfaceIntersections"] for hand in row["hands"].values())
        ],
        "handShoeOrTableIntersectionFrames": [
            row["frame"]
            for row in measurements
            if any(hand["solidIntersections"] for hand in row["hands"].values())
        ],
        "handCardInteriorFrames": [
            row["frame"]
            for row in measurements
            if any(hand["cardInteriorVertices"] for hand in row["hands"].values())
        ],
        "cardShoeIntersectionFrames": [row["frame"] for row in measurements if row["cardInsideShoeSolidsMm"]],
        "readyReturnMaxJointMatrixDifference": float(
            np.max(abs(poses[KEY["ready"]].world - poses[KEY["rest"]].world))
        ),
    }
    physics = output["physics"]
    for check in (
        "handShoeOrTableIntersectionFrames",
        "handCardInteriorFrames",
        "cardSkinTriangleIntersectionFrames",
        "cardShoeIntersectionFrames",
    ):
        if physics[check]:
            raise ValueError(f"{check} i rutor {physics[check]}")
    if (
        physics["p4HorizontalErrorMm"] > 0.01
        or physics["stationaryMinimumSupportedCorners"] != 4
        or physics["stationaryCentreTravelMm"] > 0.01
        or physics["stationaryRotationTravelDegrees"] > 0.01
    ):
        raise ValueError("Det utdelade kortet stannar inte plant i plats 4:s spelmål.")
    if any(low < 0 or high > 0.8 for low, high in face_gaps.values()):
        raise ValueError("Kortets bärfas saknar fingerkontakt mot de två motsatta ytorna.")
    if (
        max(measurements[0]["gazeFrontDegrees"]) > 0.1
        or physics["readyReturnMaxJointMatrixDifference"] > 1e-6
    ):
        raise ValueError("Blickriktningen i vila eller återgången till A2.3 avviker från sitt ankare.")
    report = (json.dumps(output, indent=2, allow_nan=False, ensure_ascii=False) + "\n").encode()
    destination = folder / "giv.glb"
    publications = [
        (destination, scene_bytes, output["sceneSha256"]),
        (folder / "givmatning.json", report, hashlib.sha256(report).hexdigest()),
    ]
    for filename, _, digest in publications:
        if filename.exists() and sha(filename) != digest:
            raise FileExistsError(f"{filename} tillhör en annan utgåva. Välj en ny mapp med --out-dir.")
    for filename, data, digest in publications:
        put(filename, data, digest)
    print(destination, output["sceneSha256"], flush=True)
    print(
        "P4",
        output["p4M"],
        "rutor",
        len(poses),
        "undre/övre fingeryta (mm)",
        face_gaps,
        flush=True,
    )
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", default=OUT, type=Path)
    build(parser.parse_args().out_dir)
