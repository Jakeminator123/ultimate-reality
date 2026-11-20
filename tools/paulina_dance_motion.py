"""En fyra sekunder lång sidostegsdans på Paulinas egen ståpose och V4-skinn."""

import argparse
import copy
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import torch
from PIL import Image
from scipy.interpolate import PchipInterpolator
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, put, sha
from paulina_anchor_trial import unit
from paulina_deal_p4 import ContactSkin, Glb, Pose
from paulina_film_motion import MODEL, V4, V4_SHA
from paulina_motion_trial import (
    compact,
    continuous,
    hierarchy,
    motion_channel,
    rotation_blocks,
    world_matrices,
)
from paulina_thumb_surface import OwnHandSkin
from paulina_waiting_hand import finger_crossings

ROOT = V4.parents[5]
PHOTO = ROOT / "avatars/paulina/01_staende_bakgrund.png"
PHOTO_SHA = "c7f300cf7a41762bdf2b3371d7c7b9dc3b5f9d7cf4349d201044a696b9018e84"
OUT = ROOT / "avatars/paulina/rorelseprov-dans/v1/rigg"
RATE = 24
COUNT = 96
KEY = dict(
    start=0,
    blink=12,
    stepLeft=22,
    stepLeftPlanted=30,
    stepRight=38,
    stepRightPlanted=45,
    crouch=54,
    takeOff=60,
    apex=64,
    landing=68,
    absorb=72,
    settle=88,
    end=95,
)


def hash_bytes(data):
    return hashlib.sha256(data).hexdigest()


def recompose(pose):
    pose.world = world_matrices(pose.local, pose.parents)


def turn(pose, name, axis, angle):
    if abs(angle) > 1e-9:
        pose.rotate(
            name,
            Rotation.from_rotvec(
                unit(np.asarray(axis)) * np.deg2rad(angle)
            ).as_matrix(),
        )


def set_orientation(pose, name, goal):
    i = pose.names.index(name)
    pose.rotate(name, goal @ rotation_blocks(pose.world[i, :3, :3]).T)


def angle_degrees(a, b):
    return float(np.rad2deg(np.arccos(np.clip(unit(a) @ unit(b), -1, 1))))


def texture_refs(material):
    for layer in (material, material.get("pbrMetallicRoughness", {})):
        for key, value in layer.items():
            if key.endswith("Texture") and isinstance(value, dict) and "index" in value:
                yield value


def material_hash(g, material_id):
    value = copy.deepcopy(g.doc["materials"][material_id])
    for ref in texture_refs(value):
        texture = g.doc["textures"][ref.pop("index")]
        image = g.doc["images"][texture["source"]]
        view = g.doc["bufferViews"][image["bufferView"]]
        offset = view.get("byteOffset", 0)
        ref["imageSha256"] = hash_bytes(g.data[offset : offset + view["byteLength"]])
        if "sampler" in texture:
            ref["sampler"] = g.doc["samplers"][texture["sampler"]]
    return hash_bytes(json_bytes(value))


def actor_signature(g):
    primitives = []
    appearance = []
    for mesh in g.doc["meshes"][:2]:
        for prim in mesh["primitives"]:
            rows = {"indices": prim["indices"], **prim["attributes"]}
            appearance.append(material_hash(g, prim["material"]))
            primitives.append(
                {
                    field: hash_bytes(g.read(acc).tobytes())
                    for field, acc in rows.items()
                }
            )
    return {
        "primitives": primitives,
        "materialsAndTextures": appearance,
        "inverseBind": hash_bytes(
            g.read(g.doc["skins"][0]["inverseBindMatrices"]).tobytes()
        ),
    }


def actor_scene(g):
    sk = g.doc["skins"][0]
    keep = set(sk["joints"]) | {
        i
        for i, n in enumerate(g.doc["nodes"])
        if n.get("skin") == 0 and n.get("mesh") in (0, 1)
    }
    if keep != set(range(129)) or len(sk["joints"]) != 127:
        raise ValueError("V4:s ordnade kropp, hår och rigg har ändrats.")
    g.doc["nodes"] = g.doc["nodes"][:129]
    g.doc["meshes"] = g.doc["meshes"][:2]
    g.doc["nodes"][0]["name"] = "Paulina · stående helfigur"
    g.doc["meshes"][0]["name"] = "Paulina · kropp"
    primitives = [p for m in g.doc["meshes"] for p in m["primitives"]]
    mat_ids = sorted({p["material"] for p in primitives})
    for prim in primitives:
        prim["material"] = mat_ids.index(prim["material"])
    g.doc["materials"] = [g.doc["materials"][i] for i in mat_ids]
    refs = [ref for m in g.doc["materials"] for ref in texture_refs(m)]
    tex_ids = sorted({r["index"] for r in refs})
    for r in refs:
        r["index"] = tex_ids.index(r["index"])
    g.doc["textures"] = [g.doc["textures"][i] for i in tex_ids]
    image_ids = sorted({t["source"] for t in g.doc["textures"]})
    for tex in g.doc["textures"]:
        tex["source"] = image_ids.index(tex["source"])
    g.doc["images"] = [g.doc["images"][i] for i in image_ids]
    g.doc["scenes"] = [
        {
            "name": "Paulina · stående koreografi",
            "nodes": [
                i for i in g.doc["scenes"][g.doc.get("scene", 0)]["nodes"] if i in keep
            ],
        }
    ]
    g.doc["scene"] = 0
    g.doc.pop("extensions", None)
    g.doc.pop("extensionsUsed", None)
    g.doc["asset"].pop("extras", None)
    g.doc["asset"]["generator"] = "Ultimate Reality · Paulinas stående V4-skelett"


class BootSurface:
    def __init__(self, g, names):
        self.inverse = (
            g.read(g.doc["skins"][0]["inverseBindMatrices"])
            .reshape(-1, 4, 4)
            .transpose(0, 2, 1)
        )
        self.parts = {}
        for prim in g.doc["meshes"][0]["primitives"]:
            if g.doc["materials"][prim["material"]]["name"] != "Stövlarnas gummisula":
                continue
            ids = np.unique(g.read(prim["indices"]).reshape(-1))
            attrs = prim["attributes"]
            points = g.read(attrs["POSITION"])[ids].astype(float)
            joints = g.read(attrs["JOINTS_0"])[ids]
            weights = g.read(attrs["WEIGHTS_0"])[ids]
            joint = np.bincount(joints.ravel(), weights.ravel(), len(names)).argmax()
            side = names[joint].split("_", 1)[0]
            bottom = points[:, 1] < points[:, 1].min() + 0.0008
            hom = np.column_stack((points, np.ones(len(points))))
            self.parts[side] = (hom, joints, weights, bottom)
        if set(self.parts) != {"l", "r"}:
            raise ValueError("Båda skinnade stövelsulorna måste finnas på modellen.")

    def points(self, pose, side):
        hom, joints, weights, _ = self.parts[side]
        mat = (pose.world @ self.inverse)[joints, :3, :]
        return np.einsum("vkij,vj,vk->vi", mat, hom, weights)

    def marker(self, pose, side):
        xyz = self.points(pose, side)
        marker = xyz[self.parts[side][3]].mean(0)
        marker[1] = xyz[:, 1].min()
        return marker


def standing(g, path, soles):
    names, _, parents, rest = hierarchy(g)
    with np.load(path, allow_pickle=False) as a:
        if str(a["source_sha256"]) != PHOTO_SHA or sha(PHOTO) != PHOTO_SHA:
            raise ValueError("Ståskattningen tillhör en annan bild.")
        params = np.column_stack(
            (
                a["mhr_model_params"].reshape(1, -1),
                np.zeros((1, a["shape_params"].size), dtype=np.float32),
            )
        )
        source = a["pred_joint_coords"].reshape(-1, 3).astype(float)
        photo_size = a["source_size"].tolist()
        estimation_size = a["inference_size"].tolist()
    model = torch.jit.load(str(MODEL), map_location="cpu")
    torch.set_num_threads(4)
    if list(model.get_joint_names()) != names:
        raise ValueError("Ståbilden och V4 måste dela MHR:s 127 lednamn.")
    with torch.no_grad():
        joint = model.character_torch.model_parameters_to_joint_parameters(
            torch.from_numpy(params.astype(np.float32))
        )
        state = model.character_torch.joint_parameters_to_skeleton_state(joint).numpy()[
            0
        ]
    axes = np.diag([1.0, -1.0, -1.0])
    error = float(
        np.linalg.norm(state[:, :3] @ axes / 100 - source, axis=1).max() * 1000
    )
    if error > 0.003:
        raise ValueError("MHR:s ståpose stämmer inte med de skattade världslederna.")

    def p(name):
        return source[names.index(name)]

    x = unit((p("l_uparm") - p("r_uparm")) + (p("l_upleg") - p("r_upleg")))
    y = p("c_head_null") - (p("l_foot") + p("r_foot")) * 0.5
    y = unit(y - x * (y @ x))
    basis = np.stack((x, y, np.cross(x, y)))
    world = basis @ axes @ Rotation.from_quat(state[:, 3:7]).as_matrix()
    local = rest.copy()
    for j, parent in enumerate(parents):
        r = world[j] if parent < 0 else world[parent].T @ world[j]
        local[j, :3, :3] = r * np.linalg.norm(rest[j, :3, :3], axis=0)
    # The Chelsea boot is a stiff photographic shell. Match its flat bindsole
    # to the floor and keep its toe/heel articulation together.
    for side in ("l", "r"):
        for n in ("talocrural", "subtalar", "transversetarsal", "ball"):
            j = names.index(f"{side}_{n}")
            local[j, :3, :3] = rest[j, :3, :3]
    pose = Pose(names, parents, local)
    bind_world = world_matrices(rest, parents)
    foot_angles = {}
    for side in ("l", "r"):
        f = names.index(f"{side}_foot")
        foot_angles[side] = rotation_blocks(bind_world[f, :3, :3])
        set_orientation(pose, f"{side}_foot", foot_angles[side])
    left, right = (soles.marker(pose, s) for s in ("l", "r"))
    mid = (left + right) * 0.5
    pose.local[0, :3, 3] -= mid
    recompose(pose)
    return (
        pose,
        foot_angles,
        dict(
            xyzResidualMm=error,
            model="sam-3d-body-dinov3",
            mhrSha256=sha(MODEL),
            sourceSizePx=photo_size,
            inferenceSizePx=estimation_size,
            referenceCameraBasis=basis.tolist(),
            leftRightFootSpacingM=float(abs(left[0] - right[0])),
            floorOriginShiftM=(-mid).tolist(),
        ),
    )


def smooth(t, a, b):
    u = np.clip((t - a) / (b - a), 0.0, 1.0)
    return u * u * (3 - 2 * u)


def arch(frame, a, b, height):
    if frame <= a or frame >= b:
        return 0.0
    return height * np.sin(np.pi * (frame - a) / (b - a)) ** 1.45


def curve(key):
    return PchipInterpolator([p[0] for p in key], [p[1] for p in key])(np.arange(COUNT))


def foot_spacing_from_photo():
    with Image.open(PHOTO) as photo:
        image = np.asarray(photo.convert("RGB"))
    height, width = image.shape[:2]
    x = np.arange(width)
    dark = (
        (image.mean(2) < 145)
        & (x[None, :] > width * 0.26)
        & (x[None, :] < width * 0.75)
    )
    ys = np.flatnonzero(dark.sum(1) > 10)
    top, bottom = int(ys[0]), int(ys[-1])
    band = dark[int(bottom - 0.038 * (bottom - top)) : bottom + 1]
    xs = np.flatnonzero(band.sum(0) > 3)
    regions = [
        v for v in np.split(xs, np.flatnonzero(np.diff(xs) > 2) + 1) if len(v) > 8
    ]
    if len(regions) != 2:
        raise ValueError(
            "Ståoriginalets nedersta skosilhuetter gick inte att skilja åt."
        )
    centres = [float(r.mean()) for r in regions]
    return {
        "heightPx": bottom - top,
        "soleCentresXPx": centres,
        "fractionOfHeight": (centres[1] - centres[0]) / (bottom - top),
    }


def choreograph(stand, soles, foot_angles, photo_spacing):
    times = [0, 8, 17, 26, 36, 45, 54, 60, 64, 68, 72, 82, 90, 95]
    curves = {
        n: curve(list(zip(times, v)))
        for n, v in {
            "hipYaw": [0, 0, 4, 12, 21, 20, 10, 5, 2, 0, -4, -2, 0, 0],
            "chestYaw": [0, -2, -8, -8, 7, 11, 3, -7, -5, 3, 5, 2, 0, 0],
            "headYaw": [0, 3, 11, 20, 17, 6, -2, -7, -4, 5, 7, 3, 0, 0],
            "pitch": [0, 0, 2, 2, 4, 1, 12, 2, -1, 5, 12, 3, 0, 0],
            "roll": [0, -2, -4, -2, 3, 2, 0, 0, 0, 0, 1, 0, 0, 0],
            "pelvisX": [
                0,
                -0.025,
                -0.015,
                0.050,
                0.165,
                0.215,
                0.215,
                0.215,
                0.228,
                0.240,
                0.246,
                0.237,
                0.230,
                0.230,
            ],
            "pelvisY": [
                -0.010,
                -0.017,
                -0.035,
                -0.037,
                -0.040,
                -0.026,
                -0.125,
                -0.009,
                0.125,
                -0.010,
                -0.110,
                -0.025,
                -0.013,
                -0.013,
            ],
            "pelvisZ": [
                0,
                0,
                0.010,
                0.016,
                0.018,
                0.008,
                0.035,
                0.003,
                -0.010,
                0.000,
                0.027,
                0.007,
                0,
                0,
            ],
            "lX": [
                0,
                0.010,
                0.110,
                0.185,
                0.115,
                0.045,
                0.015,
                0.150,
                0.215,
                0.155,
                0.090,
                0.03,
                0,
                0,
            ],
            "rX": [
                0,
                0.010,
                0.065,
                0.040,
                0.110,
                0.160,
                0.005,
                0.155,
                0.215,
                0.160,
                0.085,
                0.025,
                0,
                0,
            ],
            "lY": [
                0,
                0.01,
                0.16,
                0.28,
                0.20,
                0.115,
                0.055,
                0.30,
                0.44,
                0.36,
                0.17,
                0.05,
                0,
                0,
            ],
            "rY": [
                0,
                0.04,
                0.200,
                0.285,
                0.13,
                0.08,
                0.055,
                0.34,
                0.41,
                0.32,
                0.16,
                0.04,
                0,
                0,
            ],
            "lZ": [
                0,
                -0.015,
                -0.085,
                -0.070,
                0.110,
                0.165,
                -0.100,
                0.115,
                0.135,
                0.12,
                0.00,
                0.02,
                0,
                0,
            ],
            "rZ": [
                0,
                0.025,
                0.150,
                0.110,
                -0.085,
                -0.140,
                -0.095,
                0.120,
                0.145,
                0.095,
                -0.020,
                0.022,
                0,
                0,
            ],
            "hand": [
                0,
                0.05,
                0.42,
                0.74,
                0.32,
                0.20,
                0.36,
                0.76,
                0.90,
                0.52,
                0.32,
                0.12,
                0,
                0,
            ],
        }.items()
    }
    names = stand.names
    base = {s: soles.marker(stand, s) for s in ("l", "r")}
    ankle = {s: stand.position(f"{s}_foot") - base[s] for s in ("l", "r")}
    # The two separate boot silhouettes in the source image give a directly
    # observable lateral distance, while ankle depth remains the SAM estimate.
    desired_spacing = (
        photo_spacing["fractionOfHeight"] * stand.position("c_head_null")[1]
    )
    centre = 0.5 * (base["l"][0] + base["r"][0])
    base["l"][0], base["r"][0] = (
        centre + desired_spacing * 0.5,
        centre - desired_spacing * 0.5,
    )
    photo_spacing["chosenSoleCentreDistanceM"] = float(desired_spacing)
    lens = {
        s: tuple(
            np.linalg.norm(stand.position(f"{s}_{a}") - stand.position(f"{s}_{b}"))
            for a, b in (("upleg", "lowleg"), ("lowleg", "foot"))
        )
        for s in ("l", "r")
    }
    poses = []
    wanted = []
    for i in range(COUNT):
        p = Pose(names, stand.parents, stand.local)
        p.local[0, :3, 3] += np.array(
            [curves["pelvisX"][i], curves["pelvisY"][i], curves["pelvisZ"][i]]
        )
        recompose(p)
        turn(p, "root", [0, 1, 0], curves["hipYaw"][i])
        turn(p, "root", [0, 0, 1], curves["roll"][i])
        for name, w in (
            ("c_spine0", 0.26),
            ("c_spine1", 0.24),
            ("c_spine2", 0.25),
            ("c_spine3", 0.25),
        ):
            turn(p, name, [1, 0, 0], curves["pitch"][i] * w)
            turn(p, name, [0, 1, 0], curves["chestYaw"][i] * w)
        for name, w in (("c_neck", 0.45), ("c_head", 0.55)):
            turn(p, name, [0, 1, 0], curves["headYaw"][i] * w)
        for s in ("l", "r"):
            turn(p, f"{s}_eye", [0, 1, 0], curves["headYaw"][i] * 0.22)
        u = np.clip((i - 60) / 8, 0.0, 1.0)
        flight = 0.136 * 4 * u * (1 - u) if 60 < i < 68 else 0.0
        targets = {}
        for s, move_a, move_b, lift in (("l", 13, 30, 0.074), ("r", 29, 45, 0.062)):
            step = smooth(i, move_a, move_b)
            targets[s] = base[s] + np.array(
                [0.23 * step + 0.015 * smooth(i, 60, 68), 0, -0.017 * step]
            )
            targets[s][1] = flight + arch(i, move_a, move_b, lift)
        # Limit the hip height with both real leg lengths; side stepping needs
        # a small natural drop even if both feet remain at the same floor level.
        drop = 0.0
        for s in ("l", "r"):
            d = (targets[s] + ankle[s]) - p.position(f"{s}_upleg")
            available = max(0.001, (sum(lens[s]) - 0.003) ** 2 - d[0] ** 2 - d[2] ** 2)
            drop = max(drop, -d[1] - np.sqrt(available))
        p.local[0, 1, 3] -= drop
        recompose(p)
        for s, aa, bb in (("l", 13, 30), ("r", 29, 45)):
            sign = 1 if s == "l" else -1
            step = smooth(i, aa, bb)
            ankle_goal = targets[s] + ankle[s]
            yaw = 9 * step - 6 * smooth(i, 60, 68)
            tilt = 11 * arch(i, aa, bb, 1) + 7 * (flight / 0.136)
            orient = (
                Rotation.from_euler("yx", [yaw, tilt], degrees=True).as_matrix()
                @ foot_angles[s]
            )
            for attempt in range(8):
                hip = p.position(f"{s}_upleg")
                direction = unit(ankle_goal - hip)
                distance = np.clip(
                    np.linalg.norm(ankle_goal - hip),
                    abs(lens[s][0] - lens[s][1]) + 0.001,
                    sum(lens[s]) - 0.0004,
                )
                axial = (lens[s][0] ** 2 + distance**2 - lens[s][1] ** 2) / (
                    2 * distance
                )
                pole = np.array(
                    [sign * 0.075 + np.sin(np.deg2rad(curves["hipYaw"][i])), 0, 0.97]
                )
                transverse = unit(pole - direction * (pole @ direction))
                knee = (
                    hip
                    + direction * axial
                    + transverse * np.sqrt(max(0.0, lens[s][0] ** 2 - axial**2))
                )
                p.point(f"{s}_upleg", f"{s}_lowleg", knee - hip)
                p.point(
                    f"{s}_lowleg", f"{s}_foot", ankle_goal - p.position(f"{s}_lowleg")
                )
                set_orientation(p, f"{s}_foot", orient)
                residual = targets[s] - soles.marker(p, s)
                if np.linalg.norm(residual) < 0.00004:
                    break
                ankle_goal += residual
            if np.linalg.norm(residual) > 0.0015:
                raise ValueError(
                    f"Sulan kunde inte nå avsedd punkt {s} r{i}, {residual * 1000} mm."
                )
        for s, sign in (("l", 1), ("r", -1)):
            delta = np.array(
                [sign * curves[s + "X"][i], curves[s + "Y"][i], curves[s + "Z"][i]]
            )
            wrist = p.position(f"{s}_wrist").copy()
            elbow = p.position(f"{s}_lowarm").copy()
            if np.linalg.norm(delta) > 0.0004:
                p.arm(s, wrist + delta, elbow + np.array([sign * 0.13, 0.016, -0.08]))
            opening = curves["hand"][i]
            width = unit(p.position(s + "_pinky1") - p.position(s + "_index1"))
            turn(
                p,
                s + "_wrist",
                width,
                sign
                * (11 * opening + 3 * np.sin(2 * np.pi * i / 26))
                * smooth(i, 0, 6)
                * (1 - smooth(i, 85, 95)),
            )
            for digit, coeff in (
                ("thumb", 0.40),
                ("index", 0.43),
                ("middle", 0.58),
                ("ring", 0.79),
                ("pinky", 1),
            ):
                for segment, k in (("1", 0.42), ("2", 0.64), ("3", 0.42)):
                    turn(
                        p,
                        f"{s}_{digit}{segment}",
                        width,
                        sign * 8 * coeff * k * opening,
                    )
        poses.append(p)
        wanted.append(targets)
    return poses, wanted


def export_clip(g, poses):
    n, nodes, parents, rest = hierarchy(g)
    clock = (np.arange(COUNT + 1) / RATE).astype("<f4")
    t = g.accessor(clock, "SCALAR")
    g.doc["accessors"][t].update(min=[0], max=[4])
    g.doc["bufferViews"][g.doc["accessors"][t]["bufferView"]].pop("target", None)
    a = {"name": "Sida, vändning och hopp · Paulina", "channels": [], "samplers": []}
    g.doc["animations"] = [a]
    mats = np.stack([rotation_blocks(p.local[:, :3, :3]) for p in poses])
    bind = rotation_blocks(rest[:, :3, :3])
    for j, node in enumerate(nodes):
        if np.max(abs(mats[:, j] - bind[j])) > 1e-6:
            q = continuous(Rotation.from_matrix(mats[:, j]).as_quat())
            motion_channel(g, a, t, node, "rotation", np.vstack((q, q[-1])))
    pos = np.stack([p.local[0, :3, 3] for p in poses])
    motion_channel(g, a, t, nodes[0], "translation", np.vstack((pos, pos[-1])))
    # Viewers which show the file before enabling its clip must also show the
    # photographed standing pose. The seated mesh's inverse binds stay intact.
    for i, node_id in enumerate(nodes):
        node = g.doc["nodes"][node_id]
        node["rotation"] = Rotation.from_matrix(mats[0, i]).as_quat().tolist()
        node["translation"] = poses[0].local[i, :3, 3].tolist()
    return clock


def read_clip(g, clock):
    names, nodes, parents, rest = hierarchy(g)
    state = np.repeat(rest[None], COUNT, axis=0)
    a = g.doc["animations"][0]
    for c in a["channels"]:
        s = a["samplers"][c["sampler"]]
        node = nodes.index(c["target"]["node"])
        target = c["target"]["path"]
        if not np.array_equal(g.read(s["input"]).ravel(), clock):
            raise ValueError("Olik tid i GLB.")
        values = g.read(s["output"])
        np.testing.assert_array_equal(values[-1], values[-2])
        if target == "rotation":
            state[:, node, :3, :3] = Rotation.from_quat(
                values[:-1]
            ).as_matrix() * np.linalg.norm(rest[node, :3, :3], axis=0)
        elif target == "translation" and node == 0:
            state[:, node, :3, 3] = values[:-1]
        else:
            raise ValueError("Okänd motionskanal på kroppen.")
    return [Pose(names, parents, row) for row in state]


def vertex_bounds(g, poses):
    inv = (
        g.read(g.doc["skins"][0]["inverseBindMatrices"])
        .reshape(-1, 4, 4)
        .transpose(0, 2, 1)
    )
    lows = np.full((COUNT, 3), np.inf)
    highs = np.full((COUNT, 3), -np.inf)
    for m in g.doc["meshes"]:
        for p in m["primitives"]:
            at = p["attributes"]
            ids = np.unique(g.read(p["indices"]))
            xyz = g.read(at["POSITION"])[ids]
            joint = g.read(at["JOINTS_0"])[ids]
            weight = g.read(at["WEIGHTS_0"])[ids]
            h = np.column_stack((xyz, np.ones(len(xyz))))
            for i, f in enumerate(poses):
                mat = (f.world @ inv)[joint, :3, :]
                points = np.einsum("vj,vkij,vk->vi", h, mat, weight)
                lows[i] = np.minimum(lows[i], points.min(0))
                highs[i] = np.maximum(highs[i], points.max(0))
    return lows, highs


def build(standing_track, out):
    if sha(V4) != V4_SHA:
        raise ValueError("Fel version av Paulinas V4.")
    g = Glb(V4)
    sig = actor_signature(g)
    actor_scene(g)
    n, _, _, _ = hierarchy(g)
    sole = BootSurface(g, n)
    stand, foot, source = standing(g, standing_track, sole)
    source["photoFootSpacing"] = foot_spacing_from_photo()
    poses, wanted = choreograph(stand, sole, foot, source["photoFootSpacing"])
    clock = export_clip(g, poses)
    compact(g)
    with TemporaryDirectory(prefix="paulina-dans-") as tmp:
        f = Path(tmp) / "kropp.glb"
        g.save(f)
        final = Glb(f)
        data = f.read_bytes()
    reread = read_clip(final, clock)
    if actor_signature(final) != sig:
        raise ValueError("V4:s hudyta, hår eller bindning har ändrats.")
    solids = BootSurface(final, n)
    lo, hi = vertex_bounds(final, reread)
    table = []
    worst = 0.0
    for i, p in enumerate(reread):
        soles = {s: solids.marker(p, s) for s in ("l", "r")}
        contact = {
            s: int((solids.points(p, s)[:, 1] <= 0.0005).sum()) for s in ("l", "r")
        }
        worst = max(worst, *[np.linalg.norm(soles[s] - wanted[i][s]) for s in soles])
        knees = {
            s: angle_degrees(
                p.position(s + "_upleg") - p.position(s + "_lowleg"),
                p.position(s + "_foot") - p.position(s + "_lowleg"),
            )
            for s in soles
        }
        table.append(
            dict(
                frame=i,
                seconds=i / RATE,
                solesM={s: v.tolist() for s, v in soles.items()},
                soleVerticesWithinHalfMillimetreOfFloor=contact,
                kneeInteriorDegrees=knees,
                pelvisM=p.position("root").tolist(),
                headM=p.position("c_head").tolist(),
                wristM={s: p.position(s + "_wrist").tolist() for s in soles},
                minM=lo[i].tolist(),
                maxM=hi[i].tolist(),
            )
        )
    floor = np.array([[r["solesM"][s][1] for s in ("l", "r")] for r in table])
    planted_drift = {}
    for s in ("l", "r"):
        position = np.array([r["solesM"][s] for r in table])
        goals = np.array([row[s] for row in wanted])
        planted = (np.linalg.norm(np.diff(goals, axis=0), axis=1) < 1e-8) & (
            goals[:-1, 1] < 1e-5
        )
        drift = np.linalg.norm(np.diff(position[:, [0, 2]], axis=0), axis=1)
        planted_drift[s] = float(drift[planted].max() * 1000)
    hand_skin = ContactSkin(final, n)
    own_hand = OwnHandSkin(final, n, hand_skin)
    fingers = {
        s: {
            "selfFingerPairFrames": finger_crossings(reread, hand_skin, s)[
                "crossingFrames"
            ],
            "thumbAgainstOwnHandFrames": [
                i for i, p in enumerate(reread) if own_hand.intersects(p, s)
            ],
        }
        for s in ("l", "r")
    }
    air = np.flatnonzero(floor.min(1) > 0.002)
    if (
        np.min(floor) < -0.0003
        or abs(floor[64].min() - 0.136) > 0.0015
        or not np.array_equal(air, np.arange(61, 68))
        or worst > 0.0015
    ):
        raise ValueError(
            f"Golv eller flygfas avviker: min {floor.min()}, båda över golv {air}, maxfel {worst}."
        )
    if (
        hi[0, 1] < 1.40
        or table[0]["pelvisM"][1] < 0.65
        or min(table[0]["kneeInteriorDegrees"].values()) < 145.0
    ):
        raise ValueError(
            f"Den fotograferade startställningen är inte upprätt: {table[0]['pelvisM']}, {table[0]['kneeInteriorDegrees']}, {hi[0, 1]}."
        )
    report = dict(
        sceneSha256=hash_bytes(data),
        sourceV4Sha256=V4_SHA,
        standingPhotoSha256=PHOTO_SHA,
        standingEstimateSha256=sha(standing_track),
        fps=RATE,
        frames=COUNT,
        seconds=4.0,
        lastPoseSeconds=(COUNT - 1) / RATE,
        keyframes=KEY,
        sourcePose=source,
        bodyMeshes=2,
        jointCount=len(n),
        staticActorGeometrySha256=sig,
        floorY=0.0,
        bothSolesFreeFrames=air.tolist(),
        jumpApexSoleHeightM=floor[64].tolist(),
        minSoleHeightM=float(floor.min()),
        maximumSoleMarkerTargetErrorMm=float(worst * 1000),
        maximumGroundedFootSlidingMmPerFrame=planted_drift,
        handSurfaceAudit=fingers,
        contentBoundsM={"min": lo.min(0).tolist(), "max": hi.max(0).tolist()},
        note="Original 01 bestämmer utgångsposen. Sidosteg, armföring, blick och hopp är lokalt koreograferade.",
        samples=table,
    )
    for f, raw in (
        (out / "staende01.npz", standing_track.read_bytes()),
        (out / "kropp.glb", data),
        (out / "dansmatning.json", json_bytes(report)),
    ):
        put(f, raw, hash_bytes(raw))
    print(
        json.dumps(
            {
                k: report[k]
                for k in (
                    "sceneSha256",
                    "bothSolesFreeFrames",
                    "jumpApexSoleHeightM",
                    "maximumSoleMarkerTargetErrorMm",
                    "contentBoundsM",
                )
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--standing-track", type=Path, default=OUT / "staende01.npz")
    cli.add_argument("--out-dir", type=Path, default=OUT)
    args = cli.parse_args()
    build(args.standing_track, args.out_dir)
