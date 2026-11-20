"""Pose one seated Paulina for A1 and A2.3 and build the working card shoe in metres."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation
import trimesh

from material_versions import sha, save_version
from paulina_blackjack_scene import add_mesh, material, seat_contact, surroundings, table_cross_section
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
BASE = ROOT / "avatars/paulina/prov-70/v1/modell/fotoyta-slut.glb"
SHOE = ROOT / "test/artefakter/skoriktning-70-30/bana.json"
OUT = ROOT / "avatars/paulina/prov-ankare/v1/rigg"
TABLE_Y = 0.655
SHOE_CENTRE = np.array([0.305, TABLE_Y, 0.421])
RATE = 24
DURATION = 2.25
FRONT_CAMERA = np.array([0.072, 0.862 + 0.93, 0.233 + 1.62])


def unit(v):
    return v / max(np.linalg.norm(v), 1e-12)


def between(a, b):
    a, b = unit(a), unit(b)
    axis = np.cross(a, b)
    length = np.linalg.norm(axis)
    if length < 1e-10:
        return (
            np.eye(3)
            if a @ b > 0
            else Rotation.from_rotvec(np.pi * unit(np.cross(a, [0, 1, 0]))).as_matrix()
        )
    return Rotation.from_rotvec(axis / length * np.arctan2(length, a @ b)).as_matrix()


def palm_basis(forward, across):
    forward = unit(forward)
    across = unit(across - forward * (across @ forward))
    return np.column_stack((forward, across, np.cross(forward, across)))


class Pose:
    def __init__(self, names, parents, rest):
        self.names = names
        self.parents = parents
        self.local = rest.copy()
        self.world = world_matrices(self.local, parents)

    def position(self, joint):
        return self.world[self.names.index(joint), :3, 3]

    def rotate(self, name, delta):
        j = self.names.index(name)
        parent = self.parents[j]
        basis = rotation_blocks(self.world[parent, :3, :3])
        self.local[j, :3, :3] = basis.T @ delta @ basis @ self.local[j, :3, :3]
        self.world = world_matrices(self.local, self.parents)

    def point(self, name, child, direction):
        self.rotate(name, between(self.position(child) - self.position(name), direction))

    def arm(self, side, wrist, pole):
        a, b, c = (side + "_" + joint for joint in ("uparm", "lowarm", "wrist"))
        shoulder = self.position(a)
        lengths = [
            np.linalg.norm(self.position(b) - shoulder),
            np.linalg.norm(self.position(c) - self.position(b)),
        ]
        forward = unit(wrist - shoulder)
        distance = np.clip(
            np.linalg.norm(wrist - shoulder), abs(lengths[0] - lengths[1]) + 0.001, sum(lengths) - 0.001
        )
        projection = (lengths[0] ** 2 + distance**2 - lengths[1] ** 2) / (2 * distance)
        side_axis = unit(pole - shoulder - forward * ((pole - shoulder) @ forward))
        elbow = (
            shoulder + forward * projection + side_axis * np.sqrt(max(0, lengths[0] ** 2 - projection**2))
        )
        self.point(a, b, elbow - shoulder)
        self.point(b, c, wrist - self.position(b))

    def hand(self, side, forward, normal, spread):
        wrist = side + "_wrist"
        old = palm_basis(
            self.position(side + "_middle1") - self.position(wrist),
            self.position(side + "_index1") - self.position(side + "_pinky1"),
        )
        forward = unit(forward - normal * (forward @ normal))
        across = unit(np.cross(normal, forward)) * (-1 if side == "l" else 1)
        new = palm_basis(unit(forward - 0.16 * normal), across)
        self.rotate(wrist, new @ old.T)
        for finger, splay in (("index", 0.065), ("middle", 0.005), ("ring", -0.034), ("pinky", -0.085)):
            for segment, drop in ((1, 0.092), (2, 0.052), (3, 0.018)):
                bone = side + "_" + finger + str(segment)
                child = side + "_" + finger + (str(segment + 1) if segment < 3 else "_null")
                self.point(bone, child, forward + splay * spread * across - drop * normal)
        # The thumb lies free on the inside of the pause hand and opens beside the shoe.
        for segment, inclination in ((1, 0.14), (2, 0.12), (3, 0.055)):
            child = side + "_thumb" + (str(segment + 1) if segment < 3 else "_null")
            self.point(
                side + "_thumb" + str(segment),
                child,
                0.73 * forward + 0.58 * across - 0.52 * inclination * normal,
            )


class HandSurfaces:
    def __init__(self, glb, names):
        attrs = glb.doc["meshes"][0]["primitives"][0]["attributes"]
        weights = glb.read(attrs["WEIGHTS_0"])
        joints = glb.read(attrs["JOINTS_0"])
        xyz = glb.read(attrs["POSITION"])
        primary = np.array(names)[joints[np.arange(len(joints)), weights.argmax(1)]]
        self.inverse = (
            glb.read(glb.doc["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        )
        self.groups = {}
        for side in ("l", "r"):
            hand = np.array(
                [
                    any(
                        name.startswith(f"{side}_{d}")
                        for d in ("wrist", "thumb", "index", "middle", "ring", "pinky")
                    )
                    for name in primary
                ]
            )
            groups = {
                "all": hand,
                "proximal": hand
                & np.array([n.endswith(("0", "1", "wrist", "wrist_twist")) for n in primary]),
            }
            for finger in ("thumb", "index", "middle", "ring", "pinky"):
                mask = np.array([name.startswith(f"{side}_{finger}") for name in primary])
                groups[finger] = mask
                groups[finger + "Tip"] = mask & np.array(
                    [name.endswith(("2", "3", "_null")) for name in primary]
                )
            for group, mask in groups.items():
                ids = np.flatnonzero(mask)
                signature = np.column_stack((xyz[ids], joints[ids], weights[ids]))
                ids = ids[np.unique(signature, axis=0, return_index=True)[1]]
                self.groups[side, group] = (
                    np.column_stack((xyz[ids], np.ones(len(ids)))),
                    joints[ids],
                    weights[ids],
                )

    def points(self, pose, side, group):
        p, j, w = self.groups[side, group]
        palette = (pose.world @ self.inverse)[:, :3, :]
        return sum(
            np.einsum("vbc,vc->vb", palette[j[:, k]], p) * w[:, k, None] for k in range(w.shape[1])
        )

    def finger_plane(self, pose, side, finger, point, normal, clearance):
        def lowest():
            pts = self.points(pose, side, finger + "Tip")
            signed = (pts - point) @ normal
            i = signed.argmin()
            return pts[i], signed[i]

        for _ in range(4):
            for segment in ("1", "2", "3"):
                vertex, distance = lowest()
                off = clearance - distance
                if abs(off) < 0.00017:
                    return
                bone = f"{side}_{finger}{segment}"
                pivot = pose.position(bone)
                delta = Rotation.from_matrix(
                    between(vertex - pivot, vertex + normal * off - pivot)
                ).as_rotvec()
                turn = np.linalg.norm(delta)
                if turn < 1e-8:
                    continue
                old = pose.local[pose.names.index(bone), :3, :3].copy()
                pose.rotate(bone, Rotation.from_rotvec(delta * min(1, 0.16 / turn)).as_matrix())
                if abs(lowest()[1] - clearance) > abs(off):
                    pose.local[pose.names.index(bone), :3, :3] = old
                    pose.world = world_matrices(pose.local, pose.parents)


class Equipment:
    def __init__(self):
        self.spec = json.loads(SHOE.read_text(encoding="utf8"))["shoe"]
        self.yaw = Rotation.from_euler("y", self.spec["yawDegrees"], degrees=True).as_matrix()
        self.pitch = np.deg2rad(self.spec["feedAngleDegrees"])
        self.normal = self.yaw @ np.array([0, np.cos(self.pitch), np.sin(self.pitch)])

    def spot(self, x, z):
        y = self.spec["cardTopY"] + (self.spec["mouthZ"] - z) * np.tan(self.pitch)
        return SHOE_CENTRE + self.yaw @ np.array([x, y, z])

    def build(self, g):
        cfg = self.spec
        wood = material(g, "Kortskons grafitsvarta hölje", [0.024, 0.029, 0.034], 0.48)
        brass = material(g, "Skofönstrets mässing", [0.57, 0.36, 0.095], 0.40, 0.48)
        dark = material(g, "Matningsslits", [0.016, 0.019, 0.020], 0.56)
        paper = material(g, "Kortstock och papperskant", [0.87, 0.83, 0.70], 0.87)
        yellow = material(g, "Gul kortbaksida i skofönstret", [1, 0.81, 0.006], 0.69)
        indices = []

        def place(label, mesh, mat):
            mesh.apply_transform(
                trimesh.transformations.translation_matrix(SHOE_CENTRE)
                @ trimesh.transformations.rotation_matrix(np.deg2rad(cfg["yawDegrees"]), [0, 1, 0])
            )
            indices.append(add_mesh(g, label, mesh, mat))

        def box(label, origin, size, mat, tilt=0):
            mesh = trimesh.creation.box(extents=size)
            if tilt:
                mesh.apply_transform(trimesh.transformations.rotation_matrix(tilt, [1, 0, 0]))
            mesh.apply_translation(origin)
            place(label, mesh, mat)

        box("Kortskons botten", [0, 0.005, 0], [cfg["width"], 0.010, cfg["depth"]], wood)
        box("Mynningens tröskel", [0, 0.0126, 0.061], [0.068, 0.003, 0.028], brass)
        profile = np.array(
            [
                [-0.075, 0.009],
                [0.075, 0.009],
                [0.075, 0.034],
                [0.053, 0.053],
                [-0.035, 0.080],
                [-0.075, 0.080],
            ]
        )
        for sign in (-1, 1):
            verts = np.vstack(
                [
                    np.column_stack((np.full(6, sign * v), profile[:, 1], profile[:, 0]))
                    for v in (0.034, 0.040)
                ]
            )
            faces = [[0, i, i + 1] for i in range(1, 5)] + [[6, 6 + i + 1, 6 + i] for i in range(1, 5)]
            for i in range(6):
                j = (i + 1) % 6
                faces.extend([[i, j, 6 + j], [i, 6 + j, 6 + i]])
            mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
            mesh.fix_normals()
            place("Kortskons sidovägg", mesh, wood)
            box("Främre skokind", [sign * 0.035, 0.030, 0.068], [0.004, 0.018, 0.009], dark)
            box("Skokindens beslag", [sign * 0.035, 0.039, 0.068], [0.004, 0.0014, 0.009], brass)
        box("Kortskons bakstycke", [0, 0.044, -0.071], [0.068, 0.070, 0.008], wood)
        box("Kortstockens följare", [0, 0.058, -0.043], [0.068, 0.009, 0.055], dark)
        width, length = cfg["cardWidth"], cfg["cardLength"]
        center = self.spot(0, cfg["initialLeadZ"] - 0.5 * length * np.cos(self.pitch))
        local = self.yaw.T @ (center - SHOE_CENTRE)
        n = np.array([0, np.cos(self.pitch), np.sin(self.pitch)])
        box("Kortstock", local - n * 0.004, [width, 0.007, length], paper, self.pitch)
        box(
            "Översta kortet i skon",
            local - n * cfg["cardThickness"] / 2,
            [width, cfg["cardThickness"], length],
            paper,
            self.pitch,
        )
        # One coloured top face and one physical card. Keep the white cut edges and underside.
        x = width * 0.48
        z = length * 0.485
        corners = np.array([[-x, 0, -z], [-x, 0, z], [x, 0, z], [x, 0, -z]])
        corners = corners @ Rotation.from_euler("x", self.pitch).as_matrix().T + local + n * 0.00004
        face = trimesh.Trimesh(corners, [[0, 1, 2], [0, 2, 3]], process=False)
        place("Gult skokorts synliga rygg", face, yellow)
        return indices


def ease(s):
    return s * s * (3 - 2 * s)


def make_pose(names, parents, rest, equipment, surfaces, t):
    pose = Pose(names, parents, rest)
    sideway = Rotation.from_euler("zyx", [-4.5, 12, 9], degrees=True).as_rotvec()
    for joint, portion in (
        ("c_spine0", 0.25),
        ("c_spine1", 0.30),
        ("c_spine2", 0.27),
        ("c_spine3", 0.18),
    ):
        pose.rotate(joint, Rotation.from_rotvec(sideway * portion * t).as_matrix())
    focus = equipment.spot(-0.004, 0.044)
    start_wrist = {
        "l": np.array([0.118, TABLE_Y + 0.049, 0.312]),
        "r": np.array([-0.121, TABLE_Y + 0.049, 0.312]),
    }
    # Working fingers follow the slope of the card; the other hand waits on the felt just outside the slot.
    end_wrist = {
        "l": np.array([0.2435, TABLE_Y + 0.082, 0.2915]),
        "r": np.array([0.066, TABLE_Y + 0.049, 0.413]),
    }
    initial = {"l": np.array([-0.22, 0, 0.975]), "r": np.array([0.22, 0, 0.975])}
    destination = {"l": np.array([0.27, -0.16, 0.97]), "r": np.array([0.91, 0, 0.412])}
    for side, sign in (("l", 1), ("r", -1)):
        wrist = (1 - t) * start_wrist[side] + t * end_wrist[side]
        wrist[1] += (0.051 if side == "l" else 0.037) * np.sin(np.pi * t)
        pole = np.array([sign * (0.26 if side == "l" else 0.24), 0.64, 0.098 + 0.045 * t])
        pose.arm(side, wrist, pole)
        normal = unit(
            (1 - t) * np.array([0.0, 1, 0])
            + t * (equipment.normal if side == "l" else np.array([0.0, 1, 0]))
        )
        heading = (1 - t) * initial[side] + t * destination[side]
        spread = 1 - 0.52 * t
        pose.hand(side, heading, normal, spread)
        lift = (0.061 if side == "l" else 0.028) * np.sin(np.pi * t)
        start_plane = np.array([sign * 0.10, TABLE_Y, 0.389])
        plane = start_plane + (focus - start_plane) * t if side == "l" else start_plane
        plane = plane + np.array([0, lift, 0])
        signed = (surfaces.points(pose, side, "proximal") - plane) @ normal
        adjust = (0.0012 + 0.007 * t * (side == "l") - signed.min()) / normal[1]
        wrist[1] += np.clip(adjust, -0.045, 0.055)
        pose.arm(side, wrist, pole)
        pose.hand(side, heading, normal, spread)
        for digit in ("index", "middle", "ring", "pinky", "thumb"):
            limit = 0.00035
            if side == "l" and digit in ("ring", "pinky"):
                limit += 0.010 * t
            if side == "l" and digit == "thumb":
                thumb_plane = np.array([0, TABLE_Y + lift * 0.78 + 0.013 * t, 0])
                surfaces.finger_plane(pose, side, digit, thumb_plane, np.array([0, 1.0, 0]), limit)
            else:
                surfaces.finger_plane(pose, side, digit, plane, normal, limit)
    focus = working_target(surfaces, pose, equipment)
    eye = (pose.position("l_eye") + pose.position("r_eye")) * 0.5
    forward = unit(
        (pose.position("l_eye_null") - pose.position("l_eye"))
        + (pose.position("r_eye_null") - pose.position("r_eye"))
    )
    gaze = unit((1 - t) * unit(FRONT_CAMERA - eye) + t * unit(focus - eye))
    for joint, portion in (("c_neck", 0.36 - 0.13 * t), ("c_head", 0.46 - 0.17 * t)):
        delta = Rotation.from_matrix(between(forward, gaze)).as_rotvec()
        pose.rotate(joint, Rotation.from_rotvec(delta * portion).as_matrix())
        forward = unit(
            (pose.position("l_eye_null") - pose.position("l_eye"))
            + (pose.position("r_eye_null") - pose.position("r_eye"))
        )
    for side in ("l", "r"):
        eye_name = side + "_eye"
        target = unit(
            (1 - t) * unit(FRONT_CAMERA - pose.position(eye_name))
            + t * unit(focus - pose.position(eye_name))
        )
        pose.point(eye_name, eye_name + "_null", target)
    return pose


def working_target(surfaces, pose, shoe):
    width = shoe.spec["cardWidth"]
    length = shoe.spec["cardLength"]
    center = shoe.spot(0, shoe.spec["initialLeadZ"] - 0.5 * length * np.cos(shoe.pitch))
    basis = shoe.yaw @ Rotation.from_euler("x", shoe.pitch).as_matrix()
    tips = []
    for digit in ("index", "middle"):
        points = surfaces.points(pose, "l", digit + "Tip")
        local = (points - center) @ basis
        nearby = np.clip(local, [-width / 2, 0, -length / 2], [width / 2, 0, length / 2])
        tips.append(points[np.linalg.norm(local - nearby, axis=1).argmin()])
    return np.mean(tips, axis=0)


def measurements(g, surfaces, poses, shoe, shoe_nodes):
    x, rear, front, _, top = table_cross_section(g, "Spelyta")
    shoe_hulls = {}
    for i in shoe_nodes:
        name = g.doc["nodes"][i]["name"]
        if name.startswith("Gult "):
            continue
        primitive = g.doc["meshes"][g.doc["nodes"][i]["mesh"]]["primitives"][0]
        points = g.read(primitive["attributes"]["POSITION"])
        shoe_hulls[str(i) + " " + name] = ConvexHull(points).equations
    spec = shoe.spec
    card = shoe.spot(0, spec["initialLeadZ"] - 0.5 * spec["cardLength"] * np.cos(shoe.pitch))
    basis = shoe.yaw @ Rotation.from_euler("x", shoe.pitch).as_matrix()
    half = np.array([spec["cardWidth"] / 2, 0.0002, spec["cardLength"] / 2])
    mouth = shoe.spot(0, shoe.spec["mouthZ"])
    result = []
    for frame, p in enumerate(poses):
        sample = {"frame": frame, "time": frame / RATE, "hands": {}}
        for side in ("l", "r"):
            pts = surfaces.points(p, side, "all")
            over = (pts[:, 2] >= np.interp(pts[:, 0], x, rear)) & (
                pts[:, 2] <= np.interp(pts[:, 0], x, front)
            )
            to_felt = pts[over, 1] - top
            hand = {
                "lowestSkinOverFeltMm": round(float(to_felt.min()) * 1000, 2),
                "verticesBelowFelt": int(np.count_nonzero(to_felt < -0.00005)),
                "nearestSkinToMouthMm": round(float(np.linalg.norm(pts - mouth, axis=1).min()) * 1000, 2),
                "shoeCollisions": {},
                "fingers": {},
            }
            for name, hull in shoe_hulls.items():
                inside = (pts @ hull[:, :3].T + hull[:, 3] < -0.00006).all(axis=1)
                if inside.any():
                    hand["shoeCollisions"][name] = int(inside.sum())
            for digit in ("thumb", "index", "middle", "ring", "pinky"):
                skin = surfaces.points(p, side, digit + "Tip")
                local = (skin - card) @ basis
                nearest = np.linalg.norm(local - np.clip(local, -half, half), axis=1).argmin()
                hand["fingers"][digit] = {
                    "skinToCardMm": round(
                        float(np.linalg.norm(local[nearest] - np.clip(local[nearest], -half, half)))
                        * 1000,
                        2,
                    ),
                    "lowestSkinToFeltMm": round(float((skin[:, 1] - top).min()) * 1000, 2),
                    "nearestCardCoordinateMm": np.round(local[nearest] * 1000, 1).tolist(),
                }
            sample["hands"][side] = hand
        focus = working_target(surfaces, p, shoe)
        eye = np.mean([p.position("l_eye"), p.position("r_eye")], axis=0)
        ray = unit(
            np.mean([p.position(k + "_eye_null") - p.position(k + "_eye") for k in ("l", "r")], axis=0)
        )
        sample["gazeToShoeDegrees"] = round(
            float(np.rad2deg(np.arccos(np.clip(ray @ unit(focus - eye), -1, 1)))), 2
        )
        sample["gazeToFrontCameraDegrees"] = round(
            float(np.rad2deg(np.arccos(np.clip(ray @ unit(FRONT_CAMERA - eye), -1, 1)))), 2
        )
        sample["gazeDownDegrees"] = round(float(np.rad2deg(np.arcsin(-ray[1]))), 2)
        result.append(sample)
    return result


def build(output, receipt):
    g = Glb(BASE)
    names, nodes, parents, rest = hierarchy(g)
    shoe = Equipment()
    seat = seat_contact(g, names)
    loose = surroundings(g, TABLE_Y, 0.30, np.zeros((4, 4, 3), np.uint8), seat)
    g.doc["scenes"][0]["nodes"].remove(loose)
    assert loose == len(g.doc["nodes"]) - 1
    g.doc["nodes"].pop()
    g.doc["meshes"].pop()
    shoe_nodes = shoe.build(g)
    times = np.arange(round(DURATION * RATE) + 1) / RATE
    surfaces = HandSurfaces(g, names)
    poses = [make_pose(names, parents, rest, shoe, surfaces, ease(float(t / DURATION))) for t in times]
    contact = measurements(g, surfaces, poses, shoe, shoe_nodes)
    driven = continuous(
        np.array([Rotation.from_matrix(rotation_blocks(p.local[:, :3, :3])).as_quat() for p in poses])
    )
    clock = g.accessor(np.asarray(times, dtype="<f4"), "SCALAR")
    g.doc["accessors"][clock].update(min=[0], max=[DURATION])
    g.doc["bufferViews"][g.doc["accessors"][clock]["bufferView"]].pop("target", None)
    anim = {"name": "A1 till A2.3", "samplers": [], "channels": []}
    g.doc["animations"] = [anim]
    rq = Rotation.from_matrix(rotation_blocks(rest[:, :3, :3])).as_quat()
    for i, node in enumerate(nodes):
        if np.min(np.abs(driven[:, i] @ rq[i])) < 1 - 1e-9:
            motion_channel(g, anim, clock, node, "rotation", driven[:, i])
    mouth = shoe.spot(0, shoe.spec["mouthZ"])
    details = {}
    for label, p in (("A1", poses[0]), ("A2.3", poses[-1])):
        dots = {
            joint: p.position(joint).round(6).tolist()
            for joint in (
                "l_eye",
                "r_eye",
                "l_eye_null",
                "r_eye_null",
                "l_wrist",
                "r_wrist",
                "l_index_null",
                "l_middle_null",
                "r_index_null",
                "r_middle_null",
            )
        }
        details[label] = {
            "time": 0 if label == "A1" else DURATION,
            "joints": dots,
            "poseSha256": hashlib.sha256(p.world.astype("<f4").tobytes()).hexdigest(),
            "contact": contact[0 if label == "A1" else -1],
        }
    report = {
        "bodySha256": sha(BASE),
        "shoeSource": str(SHOE.relative_to(ROOT)),
        "shoeSpecSha256": sha(SHOE),
        "shoe": shoe.spec,
        "shoeCentreM": SHOE_CENTRE.tolist(),
        "mouthM": mouth.tolist(),
        "gazeTargetM": working_target(surfaces, poses[-1], shoe).tolist(),
        "shoeComponents": len(shoe_nodes),
        "tableHeightM": TABLE_Y,
        "seatHeightM": seat,
        "joints": len(names),
        "skins": len(g.doc["skins"]),
        "animationFrames": len(times),
        "fps": RATE,
        "seconds": DURATION,
        "poses": details,
        "measuredFrames": contact,
        "anatomicalLeft": "+X; player front screen right",
    }
    g.doc["asset"]["extras"]["anchorTrial"] = {
        "body": sha(BASE),
        "anchors": {"A1": 0, "A2.3": DURATION},
        "shoeMouthM": mouth.tolist(),
    }
    compact(g)
    dest = g.save(output)
    report["sceneSha256"] = sha(dest)
    dest_report = save_version(
        receipt, (json.dumps(report, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode()
    )
    print(dest, dest_report, report["sceneSha256"], flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUT / "ankare.glb")
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()
    build(args.output, args.receipt or args.output.with_name("posematning.json"))
