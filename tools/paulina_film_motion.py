"""Lägg uppmätt filmrörelse relativt Paulinas sittande V4-startpose."""

import argparse
import hashlib
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import numpy as np
import torch
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, put, sha
from paulina_blackjack_scene import table_cross_section
from paulina_deal_p4 import ContactSkin, FINGERS, Glb, Pose, ROOT, read_exported_motion
from paulina_motion_trial import (
    compact,
    continuous,
    hierarchy,
    motion_channel,
    retarget,
    rotation_blocks,
    world_matrices,
)
from paulina_thumb_surface import OwnHandSkin
from paulina_waiting_hand import ExistingCard, finger_crossings, signatures
from sam_video_motion import frame_clock

V4 = ROOT / "avatars/paulina/giv-plats-4/v4/rigg/giv.glb"
V4_SHA = "3eee4c5579967fca5e7e0fb11a709b486d05f1568af9cdf802a0570fa32da954"
TRIAL = ROOT / "avatars/paulina/prov-70/v1"
OUTPUT = ROOT / "avatars/paulina/giv-plats-4/filmrorelse/v1/rigg"
MODEL = ROOT.parent / "sam-3d-body/checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt"
KLING_VIDEO = TRIAL / "runway/original.mp4"
KLING_TRACK = TRIAL / "rorelse/ledposer.npz"
KLING_SHA = "9e05f2799dac5fbb7b590adb7208884eb778efc609ea082600acb885825172b3"


def physical_surface(skin, pose, side, solids):
    points = skin.points(pose, side, "all")
    x, y, z = points.T
    nearest = []
    for xs, rear, far, _, top in solids:
        inside = (
            (x > xs.min())
            & (x < xs.max())
            & (z > np.interp(x, xs, rear))
            & (z < np.interp(x, xs, far))
        )
        if np.any(inside):
            nearest.append(float(np.min(y[inside] - top)))
    return min(nearest, default=np.inf)


def orient_wrist(p, side, goal, elbow, orient):
    index = p.names.index(side + "_wrist")
    p.arm(side, goal, elbow)
    p.rotate(side + "_wrist", orient @ rotation_blocks(p.world[index, :3, :3]).T)


def transfer(g, measured, model):
    names, nodes, parents, rest = hierarchy(g)
    v4 = json.loads(V4.with_name("givmatning.json").read_text(encoding="utf8"))
    old, card, card_axis = read_exported_motion(g, v4["cardNodeIndex"])
    initial = old[0]
    raw, active, _, basis, scale, band = retarget(measured, model, names, parents, rest)
    # Upper-body motion is applied in each identical parent's frame, relative to
    # the measured first frame. The film shares neither the target's absolute
    # starting hand pose nor its player's table.
    active = [i for i in active if i <= names.index("c_head")]
    original = (
        Rotation.from_quat(raw.reshape(-1, 4))
        .as_matrix()
        .reshape(len(raw), len(names), 3, 3)
    )
    delta = original @ original[0].transpose(0, 2, 1)
    first = rotation_blocks(initial.local[:, :3, :3])
    scales = np.linalg.norm(initial.local[:, :3, :3], axis=1)
    local = np.repeat(initial.local[None], len(raw), axis=0)
    local[:, active, :3, :3] = (delta[:, active] @ first[active]) * scales[
        None, active, None, :
    ]
    src = measured["pred_joint_coords"].astype(float)
    relative = src - src[:, names.index("root") : names.index("root") + 1]
    coordinate_motion = (relative - relative[0]) @ basis.T * scale
    t = measured["times"]
    k = np.exp(-0.5 * ((t[:, None] - t[None, :]) / band) ** 2)
    filtered = np.einsum(
        "ti,ijh->tjh", k / k.sum(axis=1, keepdims=True), coordinate_motion
    )
    filtered -= filtered[0].copy()
    skin = ContactSkin(g, names)
    own = OwnHandSkin(g, names, skin)
    solids = [table_cross_section(g, n) for n in ("Spelyta", "Bordets kant")]
    fingers = {
        s: [
            i
            for i, n in enumerate(names)
            if n.startswith(tuple(s + "_" + f for f in FINGERS))
        ]
        for s in ("l", "r")
    }
    poses = []
    rows = []
    for frame, candidate in enumerate(local):
        p = Pose(names, parents, candidate)
        row = {
            "frame": int(measured["frame_indices"][frame]),
            "time": float(t[frame]),
            "hands": {},
        }
        for s in ("l", "r"):
            w, e = names.index(s + "_wrist"), names.index(s + "_lowarm")
            goal = initial.position(s + "_wrist") + filtered[frame, w]
            elbow = initial.position(s + "_lowarm") + filtered[frame, e]
            wanted = goal.copy()
            raw_clear = physical_surface(skin, p, s, solids)
            finger_fraction = 1.0
            if frame:
                orient = rotation_blocks(p.world[w, :3, :3])
                orient_wrist(p, s, goal, elbow, orient)
                # Keep as much measured digit movement as the target's skinned
                # anatomy admits. Compare both the thumb/hand and distal digit surfaces.
                if (
                    own.intersects(p, s)
                    or finger_crossings([p], skin, s)["crossingFrames"]
                ):
                    for fraction in (0.75, 0.50, 0.25, 0.0):
                        ids = fingers[s]
                        rv = Rotation.from_matrix(delta[frame, ids]).as_rotvec()
                        p.local[ids, :3, :3] = (
                            Rotation.from_rotvec(rv * fraction).as_matrix() @ first[ids]
                        ) * scales[ids, None, :]
                        p.world = world_matrices(p.local, parents)
                        if (
                            not own.intersects(p, s)
                            and not finger_crossings([p], skin, s)["crossingFrames"]
                        ):
                            finger_fraction = fraction
                            break
                    else:
                        raise ValueError(
                            f"Tummens eller fingrarnas ytor korsar varandra i ruta {frame}."
                        )
                for _ in range(6):
                    clearance = physical_surface(skin, p, s, solids)
                    if clearance >= 0.00012:
                        break
                    goal[1] += 0.00020 - clearance
                    orient_wrist(p, s, goal, elbow, orient)
            wrist = p.position(s + "_wrist")
            clearance = physical_surface(skin, p, s, solids)
            row["hands"][s] = dict(
                wristM=wrist.tolist(),
                sourceRelativeWristMotionM=coordinate_motion[frame, w].tolist(),
                horizontalWristTargetErrorMm=float(
                    np.linalg.norm((wrist - wanted)[[0, 2]]) * 1000
                ),
                adaptedHeightMm=float((wrist[1] - wanted[1]) * 1000),
                rawRotationsOnlyFeltClearanceMm=None
                if not np.isfinite(raw_clear)
                else float(raw_clear * 1000),
                actualFeltClearanceMm=(
                    float(clearance * 1000) if np.isfinite(clearance) else None
                ),
                digitMotionFraction=finger_fraction,
            )
        poses.append(p)
        rows.append(row)
    return (
        poses,
        rows,
        dict(
            modelToSceneAxes=basis.tolist(),
            metresScale=scale,
            rotationFilterSigmaSeconds=band,
        ),
        old[0],
        nodes,
        rest,
        card[0],
        card_axis[0],
        v4,
    )


def store_clip(g, poses, nodes, rest, times, source_end, source_label):
    clock = np.r_[times, source_end].astype("<f4")
    acc = g.accessor(clock, "SCALAR")
    g.doc["accessors"][acc].update(min=[float(clock[0])], max=[float(clock[-1])])
    g.doc["bufferViews"][g.doc["accessors"][acc]["bufferView"]].pop("target", None)
    clip = {
        "name": f"Paulina V4 · {source_label} · filmrörelse",
        "channels": [],
        "samplers": [],
    }
    g.doc["animations"] = [clip]
    r = np.asarray([rotation_blocks(p.local[:, :3, :3]) for p in poses])
    q = continuous(
        Rotation.from_matrix(r.reshape(-1, 3, 3))
        .as_quat()
        .reshape(len(poses), len(nodes), 4)
    )
    bind = rotation_blocks(rest[:, :3, :3])
    changed = []
    for i, node in enumerate(nodes):
        if np.max(abs(r[:, i] - bind[i])) < 1e-6:
            continue
        motion_channel(g, clip, acc, node, "rotation", np.vstack((q[:, i], q[-1:, i])))
        changed.append(poses[0].names[i])
    return changed


def decode(g, times):
    names, nodes, parents, rest = hierarchy(g)
    p = np.repeat(rest[None], len(times), axis=0)
    a = g.doc["animations"][0]
    for channel in a["channels"]:
        s = a["samplers"][channel["sampler"]]
        target = channel["target"]
        assert target["path"] == "rotation" and target["node"] in nodes
        node = nodes.index(target["node"])
        assert np.array_equal(g.read(s["input"]).reshape(-1)[:-1], times.astype("<f4"))
        quat = g.read(s["output"])[:-1]
        p[:, node, :3, :3] = (
            Rotation.from_quat(quat).as_matrix()
            * np.linalg.norm(rest[node, :3, :3], axis=0)[None, None, :]
        )
    return [Pose(names, parents, row) for row in p]


def static_signature(g):
    sig = signatures(g, [])
    sig.pop("tracks")
    sk = g.doc["skins"][0]
    sig["inverseBindSha256"] = hashlib.sha256(
        g.read(sk["inverseBindMatrices"]).tobytes()
    ).hexdigest()
    sig["jointNodes"] = sk["joints"]
    sig["namesAndParentageSha256"] = hashlib.sha256(
        json_bytes([(n.get("name"), n.get("children", [])) for n in g.doc["nodes"]])
    ).hexdigest()
    return sig


def dashboard_track(json_file, model, video_hash, clock, end, size, register):
    meta = json.loads(json_file.read_text(encoding="utf8"))
    cached = Path(meta["source"])
    if cached.is_file():
        if sha(cached) != video_hash:
            raise ValueError(
                "Filmen skiljer sig från den källa som Jakob-start bearbetade."
            )
        binding = "SHA-256 av både vald MP4 och Gradio-källfilen."
    else:
        if (
            register is None
            or register.get("trackingSha256") != sha(json_file)
            or register.get("sourceVideoSha256") != video_hash
        ):
            raise ValueError(
                "Gradio-källfilen är borta. Ett sparat parkvitto med sourceVideoSha256 och trackingSha256 kan identifiera just denna film och JSON."
            )
        binding = "Verifierade SHA-256 för MP4 och rörelse-JSON enligt det sparade parkvittot."
    rows = meta["frames"]
    indices = np.asarray([row["frame_index"] for row in rows], dtype=int)
    if not np.array_equal(indices, np.arange(len(clock))):
        raise ValueError("Jakob-start behöver behandla hela filmen med rutsteg 1.")
    if any(len(row["people"]) != 1 for row in rows):
        raise ValueError(
            "Rörelseprovet behöver exakt en identifierad person i varje ruta."
        )
    people = [row["people"][0] for row in rows]

    def tensor(key):
        return torch.from_numpy(np.asarray([p[key] for p in people], dtype=np.float32))

    if str(model.parents[3]) not in sys.path:
        sys.path.insert(0, str(model.parents[3]))
    from sam_3d_body.models.heads.mhr_head import MHRHead

    ck = model.parent.parent / "model.ckpt"
    state = torch.load(ck, map_location="cpu", weights_only=True, mmap=True)

    def weight(key):
        return state["head_pose." + key]

    hand_keys = (
        "hand_joint_idxs_left",
        "hand_joint_idxs_right",
        "hand_pose_mean",
        "hand_pose_comps",
    )
    head = SimpleNamespace(
        num_hand_pose_comps=weight("hand_pose_comps").shape[0],
        **{k: weight(k) for k in hand_keys},
    )
    # Use the originating model's own PCA-to-MHR mapping. Jakob-start stores
    # these factors and independently measured XYZ, rather than the expanded 204-vector.
    rot = tensor("global_rot")
    full = torch.cat(
        (torch.zeros_like(rot), rot, tensor("body_pose_params")[:, :130]), dim=1
    )
    full = MHRHead.replace_hands_in_pose(head, full, tensor("hand_pose_params"))
    scale = weight("scale_mean")[None] + tensor("scale_params") @ weight("scale_comps")
    data = dict(
        source_clock=clock,
        source_end=end,
        frame_indices=indices,
        times=clock - clock[0],
        frame_size=np.asarray(size),
        video_sha256=video_hash,
        mhr_sha256=sha(model),
        mhr_model_params=torch.cat((full, scale), dim=1).numpy(),
        shape_params=tensor("shape_params").numpy(),
        pred_joint_coords=tensor("pred_joint_coords").numpy(),
    )
    return data, dict(
        kind="Jakob-start rorelse.json",
        sourceBinding=binding,
        actorCountPerFrame=1,
        frameStep=1,
        checkpoint=ck.parent.name,
    )


def build(out, model, video, trackfile, source_register, dashboard=False):
    assert sha(V4) == V4_SHA
    video_hash = sha(video)
    original = video_hash == KLING_SHA
    register_path = source_register or (
        TRIAL / "runway/filmregister.json" if original else None
    )
    register = (
        json.loads(register_path.read_text(encoding="utf8")) if register_path else None
    )
    if (
        register is not None
        and register.get("sourceVideoSha256", register.get("result", {}).get("sha256"))
        != video_hash
    ):
        raise ValueError("Filmens SHA-256 stämmer inte med källkvittot.")
    clock, end, size = frame_clock(video)
    # Preserve the stream's declared average rate (e.g. 24/1 or 30000/1001).
    # The timestamp table remains authoritative for variable-frame-rate clips.
    fps = (register or {}).get("result", {}).get("format", {}).get("fps")
    if not fps:
        rate = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=avg_frame_rate",
                "-of",
                "csv=p=0",
                str(video),
            ],
            text=True,
        ).strip()
        fps = (
            float(Fraction(rate))
            if rate not in ("", "0/0")
            else len(clock) / (end - clock[0])
        )
    old = Glb(V4)
    if dashboard:
        track, source_info = dashboard_track(
            trackfile, model, video_hash, clock, end, size, register
        )
    else:
        with np.load(trackfile, allow_pickle=False) as archive:
            required = {
                "video_sha256",
                "mhr_sha256",
                "mhr_model_params",
                "shape_params",
                "pred_joint_coords",
                "times",
                "source_clock",
                "source_end",
                "frame_indices",
                "frame_size",
            }
            if missing := required.difference(archive.files):
                raise ValueError(
                    "Spåret saknar "
                    + ", ".join(sorted(missing))
                    + ". Välj dashboardens rorelse.json med --dashboard-json om den är källan."
                )
            track = dict(archive)
        source_info = {
            "kind": "MHR NPZ",
            "sourceBinding": "NPZ-fältet video_sha256 och MP4-byte.",
        }
    if str(track["video_sha256"]) != video_hash or not np.array_equal(
        track["frame_size"], size
    ):
        raise ValueError("Spåret hör till en annan film eller bildstorlek.")
    if (
        not np.array_equal(track["source_clock"], clock)
        or not np.allclose(track["times"], clock - clock[0], atol=2e-6, rtol=0)
        or not np.isclose(end, track["source_end"], rtol=0, atol=2e-6)
    ):
        raise ValueError("Spår och MP4 har olika presentationstider.")
    provider = register.get("model") if register else None
    label = "Kling 4" if provider == "kling_4" else (provider or "SAM")
    n, nodes, parents, bind = hierarchy(old)
    donor = Glb(TRIAL / "modell/blackjack.glb")
    dn, _, dp, db = hierarchy(donor)
    if dn != n or not np.array_equal(dp, parents) or not np.array_equal(db, bind):
        raise ValueError("Källa och V4 har olika MHR-ledramar.")
    old_bind = old.read(old.doc["skins"][0]["inverseBindMatrices"])
    donor_bind = donor.read(donor.doc["skins"][0]["inverseBindMatrices"])
    if not np.array_equal(old_bind, donor_bind):
        raise ValueError("MHR-bindmatriser skiljer sig.")
    if not np.array_equal(
        track["frame_indices"], np.arange(len(track["source_clock"]))
    ):
        raise ValueError("Provet kräver samtliga tidsstämplade källrutor.")
    poses, rows, cal, first, nodes, rest, card0, r0, v4 = transfer(old, track, model)
    card_node = v4["cardNodeIndex"]
    node = old.doc["nodes"][card_node]
    assert np.allclose(node["translation"], card0, rtol=0, atol=2e-7) and np.allclose(
        Rotation.from_quat(node["rotation"]).as_matrix(), r0, rtol=0, atol=2e-7
    )
    changed = store_clip(
        old,
        poses,
        nodes,
        rest,
        track["times"],
        track["source_end"] - track["source_clock"][0],
        label,
    )
    compact(old)
    with TemporaryDirectory(prefix="paulina-filmrorelse-") as tmp:
        path = Path(tmp) / "filmrorelse.glb"
        old.save(path)
        g = Glb(path)
        data = path.read_bytes()
    after = decode(g, track["times"])
    static = static_signature(g)
    assert static == static_signature(Glb(V4))
    err = max(float(np.max(abs(a.world - b.world))) for a, b in zip(after, poses))
    first_delta = float(np.max(abs(after[0].world - first.world)))
    assert err < 2e-5 and first_delta < 2e-5
    skin = ContactSkin(g, n)
    own = OwnHandSkin(g, n, skin)
    solids = [table_cross_section(g, x) for x in ("Spelyta", "Bordets kant")]
    physics = {}
    for s in ("r", "l"):
        digs = finger_crossings(after, skin, s)["crossingFrames"]
        thumbs = [i for i, p in enumerate(after) if own.intersects(p, s)]
        gaps = np.array([physical_surface(skin, p, s, solids) for p in after])
        if digs or thumbs or gaps.min() < -2e-6:
            raise ValueError(
                f"Fysisk finger-/filtöverlapp: {s}, {digs}, {thumbs}, {gaps.min()}."
            )
        physics[s] = dict(
            minimumSkinAboveTableMm=(
                float(gaps.min() * 1000) if np.isfinite(gaps.min()) else None
            ),
            selfDigitCrossingFrames=digs,
            ownThumbCrossingFrames=thumbs,
            framesWithDigitClamping=sum(
                r["hands"][s]["digitMotionFraction"] < 1 for r in rows
            ),
            maxVerticalAdaptationMm=max(
                abs(r["hands"][s]["adaptedHeightMm"]) for r in rows
            ),
            maximumHorizontalWristTargetErrorMm=max(
                r["hands"][s]["horizontalWristTargetErrorMm"] for r in rows
            ),
        )
    game = ExistingCard(
        g,
        card_node,
        np.broadcast_to(card0, (len(after), 3)),
        np.broadcast_to(r0, (len(after), 3, 3)),
    )
    for i, p in enumerate(after):
        rows[i]["yellowCardMinDistalMm"] = {
            s: round(
                min(
                    game.nearest(skin.points(p, s, k + "Pad"), card0, r0)[0]
                    for k in FINGERS
                )
                * 1000,
                3,
            )
            for s in ("r", "l")
        }
    foot = [n.index(x) for x in ("root", "r_foot", "l_foot")]
    feet = max(float(np.max(abs(p.world[foot] - first.world[foot]))) for p in after)
    assert feet < 2e-6
    report = {
        "sceneSha256": hashlib.sha256(data).hexdigest(),
        "inputSceneSha256": V4_SHA,
        "sourceVideoSha256": video_hash,
        "trackingSha256": sha(trackfile),
        "mhrSha256": str(track["mhr_sha256"]),
        "providerModel": provider,
        "fps": fps,
        "frames": len(after),
        "seconds": float(track["source_end"] - track["source_clock"][0]),
        "keyframes": {
            "start": 0,
            "extended": 42,
            "sourceSetDown": 62,
            "sourceRelease": 73,
            "end": len(after) - 1,
        },
        "binding": {
            "jointCount": len(n),
            "jointNames": n,
            "matchingParentsAndLocalBind": True,
            "matchingInverseBind": True,
            "meshes": len(g.doc["meshes"]),
            "skins": len(g.doc["skins"]),
            "staticHashes": static,
            "clipChannels": changed,
            "firstPoseMaxMatrixDifference": first_delta,
            "exportedAllPosesMaxMatrixDifference": err,
            "pelvisFeetMaxMatrixDifference": feet,
        },
        "calibration": cal,
        "hands": physics,
        "samples": rows,
        "sourceFrameIndices": track["frame_indices"].tolist(),
        "sourceTimesSeconds": track["times"].tolist(),
        "card": {
            "node": node["name"],
            "centreM": card0.tolist(),
            "animated": False,
            "note": "Det gula V4-kortet ligger kvar i skon. Filmens röda kort och dess kontaktpunkter har ingen geometrisk motsvarighet i denna rörelseöverföring.",
        },
    }
    if not original:
        maximum = int(
            np.argmax(
                [
                    np.linalg.norm(row["hands"]["r"]["sourceRelativeWristMotionM"])
                    for row in rows
                ]
            )
        )
        report["keyframes"] = {
            "start": 0,
            "peakRightWristMotion": maximum,
            "end": len(after) - 1,
        }
        report["card"]["note"] = (
            "Det gula V4-kortet ligger kvar i skon. Källfilmens föremål och grepp har inte överförts."
        )
    if dashboard or not original:
        report["filmInput"] = source_info
    files = {
        out / "filmrorelse.glb": data,
        out / "rorelsematning.json": json_bytes(report),
    }
    for f, b in files.items():
        if f.exists() and sha(f) != hashlib.sha256(b).hexdigest():
            raise ValueError(f"Versionskonflikt för {f}.")
    for f, b in files.items():
        put(f, b, hashlib.sha256(b).hexdigest())
    print(
        json.dumps(
            dict(
                sha=report["sceneSha256"],
                frames=len(after),
                firstPoseError=first_delta,
                physics=physics,
            )
        ),
        flush=True,
    )


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--model", type=Path, default=MODEL)
    cli.add_argument("--video", type=Path, default=KLING_VIDEO, help="Lokal källfilm.")
    source = cli.add_mutually_exclusive_group()
    source.add_argument(
        "--tracking", type=Path, help="Fullständigt MHR-spår i NPZ-format."
    )
    source.add_argument(
        "--dashboard-json",
        type=Path,
        help="Jakob-starts rorelse.json, en person/ruta och rutsteg 1.",
    )
    cli.add_argument(
        "--source-register",
        type=Path,
        help="Valfritt filmregister eller MP4/JSON-parkvitto.",
    )
    cli.add_argument("--out-dir", type=Path)
    args = cli.parse_args()
    if (
        args.video.resolve() != KLING_VIDEO
        or args.dashboard_json
        or args.tracking
        and args.tracking.resolve() != KLING_TRACK
    ) and not args.out_dir:
        cli.error("Ange --out-dir för den nya utgåvan.")
    if args.video.resolve() != KLING_VIDEO and not (
        args.tracking or args.dashboard_json
    ):
        cli.error("Ange --dashboard-json eller --tracking för en annan källfilm.")
    build(
        args.out_dir or OUTPUT,
        args.model,
        args.video,
        args.dashboard_json or args.tracking or KLING_TRACK,
        args.source_register,
        args.dashboard_json is not None,
    )
