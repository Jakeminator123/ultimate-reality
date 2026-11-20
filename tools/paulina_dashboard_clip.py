"""Överför en tidsstämplad del av Jakob-starts filmspår till den sittande Paulina V4."""

import argparse
import hashlib
import json
import subprocess
import zipfile
from fractions import Fraction
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import torch
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation, Slerp

from material_versions import json_bytes, put, sha
from paulina_blackjack_scene import table_cross_section
from paulina_deal_p4 import ContactSkin, Glb, Pose, read_exported_motion
from paulina_film_motion import (
    MODEL,
    V4,
    V4_SHA,
    dashboard_track,
    orient_wrist,
    static_signature,
)
from paulina_motion_trial import (
    compact,
    continuous,
    hierarchy,
    motion_channel,
    rotation_blocks,
)
from paulina_thumb_surface import OwnHandSkin
from paulina_waiting_hand import finger_crossings


def digest(data):
    return hashlib.sha256(data).hexdigest()


def video_clock(video):
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_frames",
        "-show_entries",
        "stream=time_base,width,height,avg_frame_rate,nb_frames,duration_ts:frame=best_effort_timestamp",
        "-of",
        "json",
        str(video),
    ]
    info = json.loads(subprocess.check_output(command))
    stream = info["streams"][0]
    ticks = np.array(
        [frame["best_effort_timestamp"] for frame in info["frames"]], dtype=np.int64
    )
    if len(ticks) < 2 or np.any(np.diff(ticks) <= 0):
        raise ValueError("MP4 saknar en strikt stigande tidslinje.")
    return ticks, Fraction(stream["time_base"]), stream


def source_files(path):
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            tracks = [f for f in archive.namelist() if Path(f).name == "rorelse.json"]
            if len(tracks) != 1:
                raise ValueError("Zippen ska innehålla en rorelse.json.")
            name = tracks[0]
            folder = name.rpartition("/")[0]
            prefix = folder + "/" if folder else ""
            raw = archive.read(name)
            first = json.loads(raw)["frames"][0]["frame_index"]
            mapping = {
                "overlay.mp4": "overlay.mp4",
                f"sam-ruta-{first:03d}.glb": f"meshes/ruta{first:06d}_person00.glb",
            }
            extra = {
                key: archive.read(prefix + file)
                for key, file in mapping.items()
                if prefix + file in archive.namelist()
            }
            hashes = {
                f.filename: digest(archive.read(f))
                for f in archive.infolist()
                if not f.is_dir()
            }
            return (
                raw,
                extra,
                {"archiveSha256": sha(path), "archiveMembersSha256": hashes},
            )
    raw = path.read_bytes()
    first = json.loads(raw)["frames"][0]["frame_index"]
    optional = {
        "overlay.mp4": path.with_name("overlay.mp4"),
        f"sam-ruta-{first:03d}.glb": path.parent
        / f"meshes/ruta{first:06d}_person00.glb",
    }
    return (
        raw,
        {key: file.read_bytes() for key, file in optional.items() if file.is_file()},
        {},
    )


def absolute_rotations(track, model, names, parents, starting):
    char = torch.jit.load(str(model), map_location="cpu")
    if list(char.get_joint_names()) != names or str(track["mhr_sha256"]) != sha(model):
        raise ValueError("MHR och V4 måste ha samma namngivna skelett och modell.")
    torch.set_num_threads(4)
    params = np.column_stack(
        (track["mhr_model_params"], np.zeros_like(track["shape_params"]))
    )
    with torch.no_grad():
        joint = char.character_torch.model_parameters_to_joint_parameters(
            torch.from_numpy(params)
        )
        state = char.character_torch.joint_parameters_to_skeleton_state(joint).numpy()
    residual = state[..., :3] @ np.diag([1, -1, -1]) / 100 - track["pred_joint_coords"]
    if np.max(np.abs(residual)) > 3e-6:
        raise ValueError("Återskapade MHR-leder avviker från dashboardens XYZ.")
    count = len(track["times"])
    world = (
        Rotation.from_quat(state[..., 3:7].reshape(-1, 4))
        .as_matrix()
        .reshape(count, len(names), 3, 3)
    )
    local = world.copy()
    for j, parent in enumerate(parents):
        if parent >= 0:
            local[:, j] = world[:, parent].transpose(0, 2, 1) @ world[:, j]
    pelvis, spine = names.index("root"), names.index("c_spine0")
    local[:, spine] = world[0, pelvis].T @ world[:, pelvis] @ local[:, spine]
    active = [
        i
        for i in range(spine, names.index("c_head") + 1)
        if not names[i].endswith("_null")
    ]
    angles = np.repeat(rotation_blocks(starting[:, :3, :3])[None], count, axis=0)
    angles[:, active] = local[:, active]
    return angles, active, float(np.linalg.norm(residual, axis=2).max() * 1000)


def interpolate(angles, active, source_times, display_times, first, names, parents):
    scale = np.linalg.norm(first[:, :3, :3], axis=1)
    local = np.repeat(first[None], len(display_times), axis=0)
    for i in active:
        sampled = Slerp(source_times, Rotation.from_matrix(angles[:, i]))(display_times)
        local[:, i, :3, :3] = sampled.as_matrix() * scale[i][None, None, :]
    return [Pose(names, parents, row) for row in local]


class TableObjects:
    """Vertical distance to the tabletop and to the solid shoe/chip surfaces underneath each skin vertex."""

    def __init__(self, glb):
        self.table = [table_cross_section(glb, n) for n in ("Spelyta", "Bordets kant")]
        self.objects = []
        for node in glb.doc["nodes"]:
            label = node.get("name", "")
            if not label.startswith(
                (
                    "Kortskons",
                    "Kortstock",
                    "Mynningens",
                    "Främre skokind",
                    "Skokindens",
                    "Nästa gula",
                    "Utdelat gult",
                    "Markerbricka",
                    "Markerstapel",
                )
            ):
                continue
            p = glb.doc["meshes"][node["mesh"]]["primitives"][0]
            pts = glb.read(p["attributes"]["POSITION"]).astype(float)
            rot = Rotation.from_quat(node.get("rotation", [0, 0, 0, 1])).as_matrix()
            if label == "Utdelat gult kort":
                self.card_centre = np.asarray(node["translation"])
                self.card_axis = rot
                self.card_half = np.max(np.abs(pts), axis=0)
            pts = (pts * node.get("scale", [1, 1, 1])) @ rot.T + node.get(
                "translation", [0, 0, 0]
            )
            hull = ConvexHull(pts)
            # Qhull triangulates coplanar box walls; each physical plane need only be tested once.
            planes = np.unique(hull.equations.round(9), axis=0)
            self.objects.append((pts.min(0)[[0, 2]], pts.max(0)[[0, 2]], planes))

    def clearance(self, skin, pose, side):
        return self.point_clearance(skin.points(pose, side, "all"))

    def point_clearance(self, points):
        nearest = np.inf
        x, y, z = points.T
        for xs, back, front, _, top in self.table:
            inside = (
                (x > xs[0])
                & (x < xs[-1])
                & (z > np.interp(x, xs, back))
                & (z < np.interp(x, xs, front))
            )
            if inside.any():
                nearest = min(nearest, float(np.min(y[inside]) - top))
        xy = points[:, [0, 2]]
        for lo, hi, planes in self.objects:
            candidates = np.all((xy >= lo) & (xy <= hi), axis=1)
            if not candidates.any():
                continue
            p = points[candidates]
            b = planes[:, 1]
            rhs = -(p[:, [0, 2]] @ planes[:, [0, 2]].T + planes[:, 3])
            vertical = abs(b) < 1e-7
            valid = np.all(rhs[:, vertical] >= -1e-7, axis=1)
            upper = np.min(rhs[:, b > 1e-7] / b[b > 1e-7], axis=1)
            lower = np.max(rhs[:, b < -1e-7] / b[b < -1e-7], axis=1)
            valid &= lower <= upper + 1e-7
            if valid.any():
                nearest = min(nearest, float(np.min(p[valid, 1] - upper[valid])))
        return nearest

    def card_gap(self, points):
        local = (points - self.card_centre) @ self.card_axis
        outside = np.maximum(np.abs(local) - self.card_half, 0)
        return float(np.linalg.norm(outside, axis=1).min())

    def fit_first_grip(self, skin, pose, offset):
        # Use one observed static contact from the first source image. A lateral
        # registration lets the two captured digits pass the solid shoe sidewall.
        hand = skin.points(pose, "l", "all")
        thumb = skin.points(pose, "l", "thumbPad")
        index = skin.points(pose, "l", "indexPad")
        best = offset.copy()
        best_score = np.inf
        for radius, step in ((0.055, 0.005), (0.005, 0.001)):
            centre = best.copy()
            for dx in np.arange(-radius, radius + step / 2, step):
                for dz in np.arange(-radius, radius + step / 2, step):
                    candidate = centre + np.array([dx, 0.0, dz])
                    safe = candidate.copy()
                    safe[1] += 0.0003 - self.point_clearance(hand + candidate)
                    a = self.card_gap(thumb + safe)
                    b = self.card_gap(index + safe)
                    # Prefer the visible fingertip on the card front; the thumb
                    # behind the edge can be partially occluded in the source.
                    score = (
                        b + 0.65 * a + 0.06 * np.linalg.norm((safe - offset)[[0, 2]])
                    )
                    if score < best_score:
                        best_score = score
                        best = candidate.copy()
                        best[1] = min(offset[1], safe[1])
        return best


def open_knuckle(pose, side, finger, neighbour, degrees):
    joint = f"{side}_{finger}1"
    base = pose.position(joint)
    shaft = pose.position(f"{side}_{finger}_null") - base
    outward = base - pose.position(f"{side}_{neighbour}1")
    axis = np.cross(shaft, outward)
    norm = np.linalg.norm(axis)
    if norm < 1e-8:
        raise ValueError("Fingerbenen saknar en säker utåtriktad rotationsaxel.")
    pose.rotate(
        joint, Rotation.from_rotvec(axis / norm * np.deg2rad(degrees)).as_matrix()
    )


def open_finger_group(pose, side, finger, neighbour, degrees):
    # The outside fingers follow the small sideways rotation together so that
    # freeing the middle finger from the index does not drive it into the ring.
    order = ("thumb", "index", "middle", "ring", "pinky")
    affected = order[order.index(finger) :]
    for digit in affected:
        inner = neighbour if digit == finger else order[order.index(digit) - 1]
        open_knuckle(pose, side, digit, inner, degrees)
    return affected


def separate_digits(poses, skin, display_frames):
    changes = {}
    for side in ("l", "r"):
        original = finger_crossings(poses, skin, side)["crossingFrames"]
        changes[side] = {}
        for pair, frames in original.items():
            # Keep the index contact direction; spread the neighbouring, more
            # lateral digit at its knuckle. Only the local rotation changes.
            neighbour, finger = pair.split("/")
            angles = np.zeros(len(poses))
            for i in frames:
                source = poses[i]
                for degree in (1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 27, 32):
                    trial = Pose(source.names, source.parents, source.local.copy())
                    open_finger_group(trial, side, finger, neighbour, degree)
                    if (
                        pair
                        not in finger_crossings([trial], skin, side)["crossingFrames"]
                    ):
                        angles[i] = degree
                        break
                else:
                    raise ValueError(
                        f"Det gick inte att separera {side} {pair} i källruta {display_frames[i]}."
                    )
            smooth = angles.copy()
            for shift in range(1, 5):
                weight = 1 - shift / 5
                smooth[shift:] = np.maximum(smooth[shift:], angles[:-shift] * weight)
                smooth[:-shift] = np.maximum(smooth[:-shift], angles[shift:] * weight)
            for i in np.flatnonzero(smooth):
                affected = open_finger_group(
                    poses[i], side, finger, neighbour, smooth[i]
                )
            changes[side][pair] = {
                "movedJoints": [f"{side}_{digit}1" for digit in affected],
                "rawIntersectingSourceFrames": display_frames[frames].tolist(),
                "maximumLocalAbductionDegrees": float(smooth.max()),
                "appliedDegreesPerDisplayFrame": smooth.tolist(),
            }
    return changes


def fit_scene(poses, anchors, skin, objects, mode):
    offsets = {s: np.zeros(3) for s in ("l", "r")}
    if mode == "shoe-left-table-right":
        # The original's first frame shows these two specific props/supports. Align
        # the captured digit positions without importing either anchor's finger rotations.
        for s, target in (("l", anchors[1]), ("r", anchors[0])):
            tip = s + "_index_null"
            offsets[s] = target.position(tip) - poses[0].position(tip)
        offsets["l"] = objects.fit_first_grip(skin, poses[0], offsets["l"])
    rows = []
    for i, pose in enumerate(poses):
        row = {"frame": i, "hands": {}}
        for s in ("l", "r"):
            wrist, elbow = s + "_wrist", s + "_lowarm"
            raw = pose.position(wrist).copy()
            initial_gap = objects.clearance(skin, pose, s)
            goal = raw + offsets[s]
            axis = rotation_blocks(pose.world[pose.names.index(wrist), :3, :3])
            guide = pose.position(elbow)
            if np.any(offsets[s]):
                orient_wrist(pose, s, goal, guide, axis)
            for _ in range(8):
                gap = objects.clearance(skin, pose, s)
                if gap >= 0.00012:
                    break
                goal[1] += 0.0003 - gap
                orient_wrist(pose, s, goal, guide, axis)
            gap = objects.clearance(skin, pose, s)
            if gap < -2e-6:
                raise ValueError(
                    f"V4:s hand skär ett bordsföremål i ruta {i}, sida {s}, {gap * 1000:.2f} mm."
                )
            row["hands"][s] = {
                "rawWristM": raw.tolist(),
                "wristM": pose.position(wrist).tolist(),
                "rawVerticalClearanceMm": float(initial_gap * 1000)
                if np.isfinite(initial_gap)
                else None,
                "correctedVerticalClearanceMm": float(gap * 1000)
                if np.isfinite(gap)
                else None,
                "extraVerticalFitMm": float((goal[1] - raw[1] - offsets[s][1]) * 1000),
            }
        rows.append(row)
    return rows, {s: offsets[s].tolist() for s in offsets}


def animation(glb, poses, clock, rest, nodes):
    acc = glb.accessor(clock.astype("<f4"), "SCALAR")
    glb.doc["accessors"][acc].update(min=[0.0], max=[float(np.float32(clock[-1]))])
    glb.doc["bufferViews"][glb.doc["accessors"][acc]["bufferView"]].pop("target", None)
    clip = {
        "name": "Paulina V4 · Jakob-start · uppmätta absoluta armposer",
        "samplers": [],
        "channels": [],
    }
    glb.doc["animations"] = [clip]
    local = np.stack([rotation_blocks(p.local[:, :3, :3]) for p in poses])
    bind = rotation_blocks(rest[:, :3, :3])
    for i, node in enumerate(nodes):
        if np.max(np.abs(local[:, i] - bind[i])) > 1e-6:
            q = continuous(Rotation.from_matrix(local[:, i]).as_quat())
            motion_channel(glb, clip, acc, node, "rotation", q)


def verify_export(glb, poses, clock, original):
    if static_signature(glb) != static_signature(original):
        raise ValueError("Scenens skinn, bindning eller material har ändrats.")
    names, nodes, parents, rest = hierarchy(glb)
    local = np.repeat(rest[None], len(clock), axis=0)
    clip = glb.doc["animations"][0]
    for ch in clip["channels"]:
        sampler = clip["samplers"][ch["sampler"]]
        i = nodes.index(ch["target"]["node"])
        if ch["target"]["path"] != "rotation" or not np.array_equal(
            glb.read(sampler["input"]).ravel(), clock.astype("<f4")
        ):
            raise ValueError(
                "Exporten innehåller fel klocka eller en animerad rekvisita."
            )
        local[:, i, :3, :3] = Rotation.from_quat(
            glb.read(sampler["output"])
        ).as_matrix() * np.linalg.norm(rest[i, :3, :3], axis=0)
    reread = [Pose(names, parents, row) for row in local]
    err = max(np.abs(a.world - b.world).max() for a, b in zip(poses, reread))
    if err > 2e-5:
        raise ValueError("Återöppnad GLB avviker från den exporterade rörelsen.")
    return reread, float(err)


def build(source, video, out, mode, model, pair):
    if sha(V4) != V4_SHA:
        raise ValueError("Grundmodellen Paulina V4 har ändrats.")
    raw, extra, origin = source_files(source)
    meta = json.loads(raw)
    video = video or Path(meta["source"])
    video_hash = sha(video)
    register = json.loads(pair.read_text("utf8")) if pair else None
    ticks, time_base, stream = video_clock(video)
    source_clock = ticks.astype(float) * float(time_base)
    indices = np.array([row["frame_index"] for row in meta["frames"]], dtype=int)
    if (
        len(indices) < 2
        or indices.min() < 0
        or indices.max() >= len(ticks)
        or np.any(np.diff(indices) <= 0)
    ):
        raise ValueError(
            "Spåret behöver minst två giltiga mättider i stigande ordning."
        )
    step = int(meta["frame_step"])
    if meta.get("source_frame_count", len(ticks)) != len(ticks):
        raise ValueError(
            f"Dashboardens original har {meta['source_frame_count']} rutor, MP4 har {len(ticks)}."
        )
    if step <= 0 or meta["processed_frames"] != len(indices):
        raise ValueError(
            "SAM:s faktiska rutnummer stämmer inte mot registrerat rutsteg eller antal."
        )
    planned = np.arange(indices[0], indices[-1] + 1, step)
    if not np.array_equal(planned, indices):
        raise ValueError(
            f"Avvikande SAM-rutsteg. Saknas {np.setdiff1d(planned, indices).tolist()}, extra {np.setdiff1d(indices, planned).tolist()}."
        )
    displayed = np.arange(indices[0], indices[-1] + 1)
    clock = (ticks[displayed] - ticks[indices[0]]).astype(float) * float(time_base)
    measured_times = clock[indices - indices[0]]
    with TemporaryDirectory(prefix="paulina-spartid-") as temp:
        path = Path(temp) / "rorelse.json"
        path.write_bytes(raw)
        track, binding = dashboard_track(
            path,
            model,
            video_hash,
            source_clock,
            float((int(ticks[0]) + int(stream["duration_ts"])) * time_base),
            (stream["width"], stream["height"]),
            register,
            expected_indices=indices,
        )
        g = Glb(V4)
        names, nodes, parents, rest = hierarchy(g)
        v4_register = json.loads(V4.with_name("givmatning.json").read_text("utf8"))
        support, _, _ = read_exported_motion(g, v4_register["cardNodeIndex"])
        first = support[0].local
        angles, active, mhr_error = absolute_rotations(
            track, model, names, parents, first
        )
        poses = interpolate(
            angles, active, measured_times, clock, first, names, parents
        )
        skin = ContactSkin(g, names)
        objects = TableObjects(g)
        digit_adjustments = separate_digits(poses, skin, displayed)
        rows, offsets = fit_scene(
            poses,
            (support[0], support[v4_register["keyframes"]["ready"]]),
            skin,
            objects,
            mode,
        )
        animation(g, poses, clock, rest, nodes)
        compact(g)
        file = Path(temp) / "filmrorelse.glb"
        g.save(file)
        reread, quantization = verify_export(Glb(file), poses, clock, Glb(V4))
        data = file.read_bytes()
    own = OwnHandSkin(g, names, skin)
    audit = {}
    for s in ("l", "r"):
        gaps = [objects.clearance(skin, p, s) for p in reread]
        if min(gaps) < -2e-6:
            raise ValueError("Exporterad hud skär ett bordsföremål.")
        audit[s] = {
            "closestVerticalSkinGapMm": float(min(gaps) * 1000)
            if np.isfinite(min(gaps))
            else None,
            "thumbOwnHandFrames": [
                int(displayed[i]) for i, p in enumerate(reread) if own.intersects(p, s)
            ],
            "intersectingFingerPairs": finger_crossings(reread, skin, s)[
                "crossingFrames"
            ],
            "maximumExtraVerticalFitMm": max(
                row["hands"][s]["extraVerticalFitMm"] for row in rows
            ),
        }
    static = [
        names.index(n) for n in ("root", "r_upleg", "l_upleg", "r_foot", "l_foot")
    ]
    fixed_error = max(
        float(np.abs(p.world[static] - support[0].world[static]).max()) for p in reread
    )
    if fixed_error > 2e-6:
        raise ValueError("Bäcken eller dolda ben har lämnat V4:s sittpose.")
    rate = Fraction(stream["avg_frame_rate"])
    marked = set(indices.tolist())
    for row, f in zip(rows, displayed.tolist()):
        row.update(sourceFrame=f, measured=f in marked)
    report = dict(
        sceneSha256=digest(data),
        sourceVideoSha256=video_hash,
        trackingSha256=digest(raw),
        inputSceneSha256=V4_SHA,
        sourceFilesSha256={k: digest(v) for k, v in extra.items()},
        **origin,
        frames=len(displayed),
        fps=float(rate),
        fpsRational=str(rate),
        startSourceFrame=int(indices[0]),
        endSourceFrame=int(indices[-1]),
        measuredSourceFrames=indices.tolist(),
        measuredSourceTimesSeconds=source_clock[indices].tolist(),
        sourceTimesSeconds=source_clock[displayed].tolist(),
        sourcePtsTicks=ticks[displayed].tolist(),
        measuredSourcePtsTicks=ticks[indices].tolist(),
        streamTimeBase=str(time_base),
        dashboardReportedTimesSeconds=[r["time_sec"] for r in meta["frames"]],
        originalFrameCount=len(ticks),
        originalDurationSeconds=float(Fraction(int(stream["duration_ts"])) * time_base),
        seconds=float(clock[-1]),
        frameStep=step,
        interpolatedFrames=len(displayed) - len(indices),
        poseMethod="Absoluta lokala MHR-rotationer i källans föräldraled. Källrutorna mellan mätningarna får kortaste sfäriska rotationsinterpolering. Ingen tid eller pose förlängs efter sista mätningen.",
        startPlacement=mode,
        fixedWristOffsetM=offsets,
        digitFit=digit_adjustments,
        firstFrameLeftToStaticYellowCardMm={
            finger: objects.card_gap(skin.points(reread[0], "l", finger + "Pad")) * 1000
            for finger in ("thumb", "index", "middle", "ring", "pinky")
        },
        remainingHandIntersections=audit,
        mhrToRecordedXYZMaxDistanceMm=mhr_error,
        pelvisFeetMaxMatrixDifference=fixed_error,
        reopenedPoseMaxMatrixDifference=quantization,
        bodyMeshes=len(g.doc["meshes"]),
        skinCount=len(g.doc["skins"]),
        jointCount=len(names),
        measuredJoints=[names[i] for i in active],
        objectTracks=[],
        sourceBinding=binding,
        samples=rows,
    )
    manifest = {
        k: report[k]
        for k in ("sourceVideoSha256", "trackingSha256", "sourceFilesSha256")
    }
    manifest.update(origin)
    files = {
        out / "kalla/original.mp4": (video, video_hash),
        out / "kalla/rorelse.json": (raw, digest(raw)),
    }
    files.update({out / "kalla" / n: (v, digest(v)) for n, v in extra.items()})
    for path, content in [
        (out / "kalla/kallregister.json", json_bytes(manifest)),
        (out / "rigg/filmrorelse.glb", data),
        (out / "rigg/rorelsematning.json", json_bytes(report)),
    ]:
        files[path] = (content, digest(content))
    for path, (_, expected) in files.items():
        if path.exists() and sha(path) != expected:
            raise ValueError(
                f"Välj en ny utmapp för den nya versionen. Konflikt i {path}."
            )
    for path, (content, expected) in files.items():
        put(path, content, expected)
    print(
        json.dumps(
            {
                k: report[k]
                for k in (
                    "sceneSha256",
                    "frames",
                    "fps",
                    "seconds",
                    "interpolatedFrames",
                    "fixedWristOffsetM",
                    "remainingHandIntersections",
                )
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument(
        "--source",
        required=True,
        type=Path,
        help="Jakob-starts zip eller rorelse.json.",
    )
    cli.add_argument(
        "--video",
        type=Path,
        help="Original-MP4. Som förval används dashboardens källsökväg.",
    )
    cli.add_argument(
        "--out-dir",
        required=True,
        type=Path,
        help="Utgåvans rot med underkatalogerna kalla och rigg.",
    )
    cli.add_argument(
        "--source-register",
        type=Path,
        help="Tidigare MP4/JSON-parkvitto om Gradio-cachen har rensats.",
    )
    cli.add_argument(
        "--start-anchors",
        choices=["absolute", "shoe-left-table-right"],
        default="absolute",
    )
    cli.add_argument("--model", type=Path, default=MODEL)
    args = cli.parse_args()
    build(
        args.source,
        args.video,
        args.out_dir,
        args.start_anchors,
        args.model,
        args.source_register,
    )
