"""Restore Paulina's lifted thumbs from a clean local pose and check the actual animated skin."""

import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, put, sha
from paulina_deal_p4 import (
    LANDMARKS,
    RATE,
    ROOT,
    ContactSkin,
    Glb,
    Pose,
    compact,
    hierarchy,
    measure,
    ramp,
    read_exported_motion,
    rotation_blocks,
    unit,
)
from paulina_motion_trial import world_matrices
from paulina_sliding_deal import triangle_review
from paulina_waiting_hand import (
    ExistingCard,
    crossing_edges,
    diagnose,
    dorsal_selection,
    finger_crossings,
    motion_until_contact,
    signatures,
)

TRIAL = ROOT / "avatars/paulina/giv-plats-4"
SOURCE = TRIAL / "v3/rigg/giv.glb"
SOURCE_SHA = "e0d5bc34b879397cfab41e527869b90202d8d35fcbadddca9adee4798c8d20ba"
EDITION = TRIAL / "v4"
REVIEW = EDITION / "granskning/tumme"


def palm_frame(p, side):
    w = p.position(side + "_wrist")
    forward = unit(p.position(side + "_middle1") - w)
    width = p.position(side + "_index1") - p.position(side + "_pinky1")
    radial = unit(width - forward * (width @ forward))
    dorsal = unit(np.cross(forward, radial)) * (1 if side == "r" else -1)
    return w, np.column_stack((forward, radial, dorsal))


def thumb_chain(side):
    return [side + "_thumb" + part for part in ("1", "2", "3", "_null")]


def anatomical_ray(yaw, pitch):
    y, p = np.deg2rad([yaw, pitch])
    return np.array([np.cos(y) * np.cos(p), np.sin(y) * np.cos(p), np.sin(p)])


def thumb_pose(original, frame, left_clear):
    p = Pose(original.names, original.parents, original.local)
    for side in ("l", "r"):
        if side == "l":
            if not 60 < frame < 101:
                continue
            clean = left_clear
            mix = ramp(frame, 60, 68) * (1 - ramp(frame, 86, 101))
            angles = ((34, -2), (31, -5), (25, -13))
        else:
            mix = ramp(frame, 82, 87) * (1 - ramp(frame, 108, 116))
            if mix == 0:
                continue
            clean = original
            angles = ((31, 1), (28, -6), (22, -14))
        chain = thumb_chain(side)
        joints = [p.names.index(n) for n in chain[:3]]
        p.local[joints, :3, :3] = clean.local[joints, :3, :3]
        p.world = world_matrices(p.local, p.parents)
        _, axes = palm_frame(p, side)
        # Read all three donor rays before rotating their parent, preserving the donor's nail roll.
        donor = [unit(p.position(b) - p.position(a)) for a, b in zip(chain, chain[1:])]
        for (a, b), ref, (yaw, pitch) in zip(zip(chain, chain[1:]), donor, angles):
            goal = unit((1 - mix) * ref + mix * (axes @ anatomical_ray(yaw, pitch)))
            p.point(a, b, goal)
    return p


def replace_tracks(glb, target, poses):
    names, nodes, _, _ = hierarchy(glb)
    a = glb.doc["animations"][0]
    sources = {
        c["target"]["node"]: a["samplers"][c["sampler"]]
        for c in a["channels"]
        if c["target"]["path"] == "rotation"
    }
    edited = []
    for side in ("l", "r"):
        for name in thumb_chain(side)[:3]:
            i = names.index(name)
            sample = sources[nodes[i]]
            old = glb.read(sample["output"]).copy()
            new = Rotation.from_matrix(
                rotation_blocks(np.asarray([p.local[i, :3, :3] for p in poses]))
            ).as_quat()
            new *= np.where(np.einsum("ij,ij->i", old, new) < 0, -1, 1)[:, None]
            changed = np.max(abs(new - old), axis=1) > 1e-6
            if not changed.any():
                continue
            old[changed] = new[changed]
            sample["output"] = glb.accessor(old.astype("<f4"), "VEC4")
            view = glb.doc["accessors"][sample["output"]]["bufferView"]
            glb.doc["bufferViews"][view].pop("target", None)
            edited.append(name)
    glb.doc["asset"].setdefault("extras", {})["thumbSurfaceSourceSha256"] = SOURCE_SHA
    compact(glb)
    glb.save(target)
    return edited


class OwnHandSkin:
    """Two separate regions of the actual skin, excluding the connected web at the thumb base."""

    def __init__(self, glb, names, skin):
        prim = glb.doc["meshes"][0]["primitives"][0]
        at = prim["attributes"]
        p = glb.read(at["POSITION"])
        j = glb.read(at["JOINTS_0"])
        w = glb.read(at["WEIGHTS_0"])
        owner = np.asarray(names)[j[np.arange(len(j)), w.argmax(1)]]
        tris = glb.read(prim["indices"]).reshape(-1, 3)
        self.faces = {}
        for side in ("l", "r"):
            for mark, suffixes in (
                ("distalThumb", ("thumb2", "thumb3", "thumb_null")),
                ("hand", ("wrist", "index1", "middle1", "ring1", "pinky1", "lowarm")),
            ):
                faces = tris[
                    np.isin(owner[tris], [side + "_" + s for s in suffixes]).all(1)
                ]
                ids, local = np.unique(faces.ravel(), return_inverse=True)
                self.faces[side, mark] = local.reshape(-1, 3)
                skin.groups[side, mark] = (
                    np.column_stack((p[ids], np.ones(len(ids)))),
                    j[ids],
                    w[ids],
                )
        self.skin = skin

    def intersects(self, p, side):
        first = self.skin.points(p, side, "distalThumb")[
            self.faces[side, "distalThumb"]
        ]
        second = self.skin.points(p, side, "hand")[self.faces[side, "hand"]]
        centre = second.mean(1)
        radius = np.linalg.norm(second - centre[:, None, :], axis=2).max(1)
        pc = first.mean(1)
        pr = np.linalg.norm(first - pc[:, None, :], axis=2).max(1)
        hits = cKDTree(centre).query_ball_point(pc, pr + radius.max())
        lengths = np.array([len(h) for h in hits])
        if not lengths.sum():
            return False
        a = np.repeat(np.arange(len(first)), lengths)
        b = np.concatenate([h for h in hits if len(h)]).astype(int)
        pair = (
            (np.linalg.norm(pc[a] - centre[b], axis=1) <= pr[a] + radius[b])
            & np.all(first[a].min(1) <= second[b].max(1), axis=1)
            & np.all(first[a].max(1) >= second[b].min(1), axis=1)
        )
        a, b = a[pair], b[pair]
        return bool(
            len(a)
            and (
                crossing_edges(first[a], second[b])
                or crossing_edges(second[b], first[a])
            )
        )


def anatomy(poses, mesh):
    result = {}
    for side in ("l", "r"):
        rows = []
        for frame, p in enumerate(poses):
            wrist, axes = palm_frame(p, side)
            points = np.asarray([p.position(k) for k in thumb_chain(side)])
            tip = (points[-1] - wrist) @ axes * 1000
            v = np.diff(points, axis=0)
            v /= np.linalg.norm(v, axis=1)[:, None]
            bend = np.degrees(np.arccos(np.clip((v[:-1] * v[1:]).sum(1), -1, 1)))
            rows.append(
                dict(
                    frame=frame,
                    tipPalmForwardRadialDorsalMm=np.round(tip, 3).tolist(),
                    middleAndOuterBoneBendDeg=np.round(bend, 3).tolist(),
                    intersectsOwnHand=mesh.intersects(p, side),
                )
            )
        result[side] = dict(
            frames=rows,
            crossingFrames=[r["frame"] for r in rows if r["intersectsOwnHand"]],
            distalThumbTriangles=len(mesh.faces[side, "distalThumb"]),
            ownHandTriangles=len(mesh.faces[side, "hand"]),
        )
    return result


def build(probe):
    if sha(SOURCE) != SOURCE_SHA:
        raise ValueError("Oväntad V3-scen.")
    old_report = json.loads(
        SOURCE.with_name("givmatning.json").read_text(encoding="utf8")
    )
    source = Glb(SOURCE)
    names, _, _, _ = hierarchy(source)
    node = old_report["cardNodeIndex"]
    poses, cc, bb = read_exported_motion(source, node)
    skin = ContactSkin(source, names)
    original_anatomy = anatomy(poses, OwnHandSkin(source, names, skin))
    proposal = [thumb_pose(p, i, poses[60]) for i, p in enumerate(poses)]
    with TemporaryDirectory(prefix="paulina-tumme-") as temp:
        candidate = Path(temp) / "giv.glb"
        edited = replace_tracks(source, candidate, proposal)
        scene = Glb(candidate)
        data = candidate.read_bytes()
        check, protocols = triangle_review(candidate)
    after, centres, bases = read_exported_motion(scene, node)
    assert np.array_equal(cc, centres) and np.array_equal(bb, bases)
    unchanged = signatures(Glb(SOURCE), edited)
    assert signatures(scene, edited) == unchanged
    skin = ContactSkin(scene, names)
    geometry = anatomy(after, OwnHandSkin(scene, names, skin))
    pairs = {s: finger_crossings(after, skin, s) for s in ("l", "r")}
    card = ExistingCard(scene, node, cc, bb)
    m = measure(
        scene, card, skin, after, cc, bb, np.array(old_report["mouthM"]), card.start
    )
    active_errors = []
    for i, row in enumerate(m):
        for key, value in old_report["measuredFrames"][i].items():
            if key not in row:
                row[key] = value
        heights = (skin.points(after[i], "r", "all")[:, 1] - card.level) * 1000
        row["rightLowestSkinToFeltMm"] = round(float(heights.min()), 4)
        row["rightHighestSkinToFeltMm"] = round(float(heights.max()), 3)
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
    issues = []
    if any(geometry[s]["crossingFrames"] for s in ("l", "r")):
        issues.append("Tumhud korsar egen hand.")
    if (
        collisions
        or check["opposingHandCrossingFrames"]
        or any(check["skinThroughCardFaceFrames"].values())
    ):
        issues.append("Hud eller kort korsar en motyta.")
    if any(p["crossingFrames"] for p in pairs.values()):
        issues.append("Två fingrar på samma hand korsar varandra.")
    for s in ("l", "r"):
        if any(
            r["tipPalmForwardRadialDorsalMm"][1] < 25
            and r["tipPalmForwardRadialDorsalMm"][2] > 0
            for r in geometry[s]["frames"]
        ):
            issues.append("Tumspetsen över handryggen.")
    # Pressure and timing of the active fingertips must be exactly the measured V3 gesture.
    for i, row in enumerate(m):
        for s in ("l", "r"):
            for finger in ("index", "middle"):
                new_gap = row["hands"][s]["fingers"][finger]["distalPadGapMm"]
                old_gap = old_report["measuredFrames"][i]["hands"][s]["fingers"][
                    finger
                ]["distalPadGapMm"]
                if abs(new_gap - old_gap) > 0.002:
                    active_errors.append((i, s, finger, old_gap, new_gap))
    if active_errors:
        issues.append("Arbetsfingrarnas distala avstånd har ändrats.")
    scene_hash = hashlib.sha256(data).hexdigest()
    review = dict(
        sourceSceneSha256=SOURCE_SHA,
        sceneSha256=scene_hash,
        method="Gemensam skinnmesh, primitiv 0. Dominant led per vertex. Distal tumhud mot samma hands handled, underarm och fyra fingerbaser. Transversell kant genom triangelns inre i bägge riktningar. Tumspets anges framåt, ut mot tumsidan och mot handryggen i handens egen ram.",
        source=original_anatomy,
        candidate=geometry,
        activePadChanges=active_errors,
    )
    info = {
        **old_report,
        "sceneSha256": scene_hash,
        "parentSceneSha256": SOURCE_SHA,
        "sourceSceneSha256": SOURCE_SHA,
        "poses": {},
        "independentTriangleReview": check,
        "digitSurfaceReview": pairs,
        "unchangedSceneData": unchanged,
        "thumbRotationTracks": edited,
        "thumbSelfIntersections": {
            s: geometry[s]["crossingFrames"] for s in ("l", "r")
        },
        "measuredFrames": m,
        "issues": issues,
    }
    state = info["physics"].copy()
    mark = dorsal_selection(skin, after)
    hand = diagnose(after, skin, mark, card.level)
    actual_contact = motion_until_contact(after, skin, mark, m, card.start)
    state.update(
        collisionFrames=collisions,
        beforeFirstRightContact=actual_contact,
        rightTipPairRangeMm=hand["rightTipPairRangeMm"],
        rightWaitingHorizontalTravel=hand["windows"]["0-82"]["horizontal"],
        rightReturnLowestSkinAtFramesMm={
            str(i): m[i]["rightLowestSkinToFeltMm"] for i in (108, 113, 120, 131, 152)
        },
    )
    if (
        max(
            x["maximumOffsetMm"] for x in state["rightWaitingHorizontalTravel"].values()
        )
        > 0.20
    ):
        issues.append(
            "Höger hand rör sig från sin vilopunkt före avslutad överlämning."
        )
    state["rightReleaseGapMm"] = {
        d: m[info["keyframes"]["release"]]["hands"]["r"]["fingers"][d]["distalPadGapMm"]
        for d in ("thumb", "index", "middle")
    }
    if (
        actual_contact["firstActiveDistalPad"]
        != old_report["physics"]["beforeFirstRightContact"]["firstActiveDistalPad"]
    ):
        issues.append("Första högra fingerkontakten har ändrats.")
    info["physics"] = state
    for phase, i in info["keyframes"].items():
        p = after[i]
        info["poses"][phase] = dict(
            frame=i,
            time=i / RATE,
            joints={k: np.round(p.position(k), 6).tolist() for k in LANDMARKS},
            poseSha256=hashlib.sha256(p.world.astype("<f4").tobytes()).hexdigest(),
            cardCentreM=centres[i].tolist(),
        )
    print(
        json.dumps(
            dict(
                sha=scene_hash,
                issues=issues,
                own={s: geometry[s]["crossingFrames"] for s in ("l", "r")},
                solids=collisions,
                hands=check["opposingHandCrossingFrames"],
                cards=check["skinThroughCardFaceFrames"],
                fingers={s: x["crossingFrames"] for s, x in pairs.items()},
            )
        ),
        flush=True,
    )
    if issues and probe is None:
        raise ValueError(" ".join(issues))
    folder = REVIEW / probe if probe else EDITION / "rigg"
    qa = folder if probe else REVIEW
    files = {
        folder / "giv.glb": data,
        folder / "givmatning.json": json_bytes(info),
        qa / "tumgranskning.json": json_bytes(review),
    }
    files.update({qa / name: contents for name, contents in protocols.items()})
    for file, raw in files.items():
        if file.exists() and sha(file) != hashlib.sha256(raw).hexdigest():
            raise ValueError(f"Versionskonflikt för {file}")
    for file, raw in files.items():
        put(file, raw, hashlib.sha256(raw).hexdigest())


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument(
        "--arbetsprov", help="Spara en separat kandidat under granskning/tumme."
    )
    args = cli.parse_args()
    if args.arbetsprov and not args.arbetsprov.isalnum():
        cli.error("Ange ett enkelt provnamn.")
    build(args.arbetsprov)
