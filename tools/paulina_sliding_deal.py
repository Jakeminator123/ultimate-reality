"""Paulinas P4-giv med vänster kortdrag, låg höger stödhand och ett glidande kort."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory

import numpy as np
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, put, sha
from paulina_motion_trial import deformed_vertices
from paulina_deal_p4 import (
    ANCHOR,
    CARD_NAME,
    FINGERS,
    LANDMARKS,
    LAST,
    RATE,
    ROOT,
    UP,
    Cards,
    ContactSkin,
    Equipment,
    Glb,
    Pose,
    align_gaze,
    between,
    blend,
    compact,
    hierarchy,
    measure,
    ramp,
    read_exported_motion,
    rotation_blocks,
    turn,
    world_matrices,
    write_animation,
)

SOURCE = ROOT / "avatars/paulina/giv-plats-4/v1/rigg/giv.glb"
SOURCE_SHA = "7b9691a5665f174da939ea545a6f6f90edf7c3c7f70c85fe40121c1ef51e034a"
OUT = ROOT / "avatars/paulina/giv-plats-4/v2/underlag/glidgiv/vilohand-v2"
KEY = dict(
    a1=0,
    ready=44,
    draw=68,
    present=78,
    flat=82,
    handoff=85,
    release=105,
    land=122,
    rest=152,
)
WAIT_END = 76


def triangle_review(filename):
    """Execute the visual reviewer's unchanged, independent sweep against the exported bytes."""
    source = SOURCE.parent.parent / "granskning/kontrollera-giv.py"
    folder = filename.parent / "granskning"
    folder.mkdir()
    script = folder / source.name
    shutil.copyfile(source, script)
    subprocess.run(
        [sys.executable, "-B", str(script), str(filename)],
        check=True,
        capture_output=True,
    )
    files = {}
    reports = {}
    scene_hash = sha(filename)
    for key in ("hand-mot-hand", "fingertoppar"):
        name = key + "-" + scene_hash[:8] + ".json"
        files[name] = (folder / name).read_bytes()
        reports[key] = json.loads(files[name])
        assert (
            reports[key]["sceneSha256"] == scene_hash
            and reports[key]["frames"] == LAST + 1
        )
    hands = [
        row["frame"]
        for row in reports["hand-mot-hand"]["intersectionsOrReviewFrames"]
        if row["intersectingSurfaceTrianglePairs"] > 0
    ]
    card = {
        name: sorted(map(int, frames))
        for name, frames in reports["fingertoppar"]["openCardFaceCrossings"].items()
    }
    return dict(
        frames=LAST + 1,
        checkScriptSha256=sha(source),
        opposingHandCrossingFrames=hands,
        skinThroughCardFaceFrames=card,
        protocols={n: hashlib.sha256(b).hexdigest() for n, b in files.items()},
    ), files


def card_path(cards, old_centres, old_basis):
    exchange_xz = np.array([0.118, 0.533])
    to_flat = Rotation.from_euler("y", -22, degrees=True).as_matrix()
    presentation = to_flat @ Rotation.from_euler("x", 6, degrees=True).as_matrix()
    centres = old_centres.copy()
    axes = old_basis.copy()
    for frame in range(KEY["draw"] + 1, LAST + 1):
        if frame <= KEY["present"]:
            w = ramp(frame, KEY["draw"], KEY["present"])
            axes[frame] = turn(old_basis[KEY["draw"]], presentation, w)
            xz = blend(old_centres[KEY["draw"], [0, 2]], exchange_xz, w)
        elif frame <= KEY["flat"]:
            w = ramp(frame, KEY["present"], KEY["flat"])
            axes[frame] = turn(presentation, to_flat, w)
            xz = exchange_xz
        else:
            w = ramp(frame, KEY["flat"], KEY["land"])
            axes[frame] = turn(to_flat, np.eye(3), w)
            xz = blend(exchange_xz, cards.p4[[0, 2]], w)
        # The lowest physical corner stays on the felt while the angle opens.
        centres[frame] = [
            xz[0],
            cards.level + abs(axes[frame][1]) @ cards.half + 0.00005,
            xz[1],
        ]
    return centres, axes


class SlidingHands:
    def __init__(self, old, old_centres, old_axes, cards, skin):
        self.old = old
        self.old_centres = old_centres
        self.old_axes = old_axes
        self.cards = cards
        self.skin = skin
        self.ready = old[KEY["ready"]]
        self.flat = old[120]
        self.names = self.ready.names
        self.wrists = {side: self.names.index(side + "_wrist") for side in ("l", "r")}
        self.digits = {
            side: [
                i
                for i, name in enumerate(self.names)
                if any(name.startswith(side + "_" + f) for f in FINGERS)
            ]
            for side in ("l", "r")
        }
        # Reuse the real flat r120 palm. Its pads press the dealer's half of the moving card.
        self.offset = (
            self.flat.position("r_wrist") - old_centres[120] + [-0.003, 0.00035, -0.039]
        )
        self.wait = Pose(self.names, self.ready.parents, self.ready.local)
        wrist = self.wrists["r"]
        orient = turn(
            self.ready.world[wrist, :3, :3], self.flat.world[wrist, :3, :3], 0.49
        )
        shape = self.digit_shape("r", self.ready, self.flat, 0.25)
        goal = np.array([-0.008, 0.703, 0.332])
        pole = np.array([-0.145, 0.70, 0.187])
        self.place(self.wait, "r", goal, orient, shape, pole)
        self.seat_waiting(self.wait, goal, orient, shape, pole, 0.00078)

    def digit_shape(self, side, first, second, weight):
        if weight <= 0:
            return first.local
        if weight >= 1:
            return second.local
        result = first.local.copy()
        for i in self.digits[side]:
            result[i, :3, :3] = turn(
                first.local[i, :3, :3], second.local[i, :3, :3], weight
            )
        return result

    def place(self, p, side, goal, orientation, shape, pole):
        p.arm(side, goal, pole)
        i = self.wrists[side]
        desired = Rotation.from_matrix(rotation_blocks(orientation)).as_matrix()
        present = Rotation.from_matrix(rotation_blocks(p.world[i, :3, :3])).as_matrix()
        p.rotate(side + "_wrist", desired @ present.T)
        ids = self.digits[side]
        p.local[ids, :3, :3] = shape[ids, :3, :3]
        p.world = world_matrices(p.local, p.parents)

    def seat_waiting(self, p, goal, orientation, shape, pole, clearance):
        for _ in range(3):
            minimum = self.skin.points(p, "r", "all")[:, 1].min()
            correction = self.cards.level + clearance - minimum
            if abs(correction) < 0.00007:
                break
            goal = goal + correction * UP
            self.place(p, "r", goal, orientation, shape, pole)

    def left(self, p, frame, centre, basis):
        donor_frame = min(frame, KEY["present"])
        donor = self.old[donor_frame]
        back = ramp(frame, KEY["flat"], 101)
        delta = basis @ self.old_axes[donor_frame].T
        wrist = self.wrists["l"]
        goal = blend(
            centre
            + delta @ (donor.position("l_wrist") - self.old_centres[donor_frame]),
            self.ready.position("l_wrist"),
            back,
        )
        goal += np.sin(np.pi * back) * np.array([0.046, 0.043, -0.018])
        orient = turn(
            delta @ donor.world[wrist, :3, :3], self.ready.world[wrist, :3, :3], back
        )
        # Raise the palm around the working fingertips to clear the actual high side wall.
        pivot = centre + basis @ np.array([0.003, self.cards.half[1], 0.027])
        arch = 0.083 * ramp(frame, 73, 81) * (1 - ramp(frame, 84, 96))
        radial = goal - pivot
        opening = between(radial, radial + arch * UP)
        goal = pivot + opening @ radial
        orient = opening @ orient
        goal += 0.017 * ramp(frame, 87, 95) * (1 - ramp(frame, 98, 101)) * UP
        shape = self.digit_shape("l", donor, self.ready, back)
        pole = blend(donor.position("l_lowarm"), self.ready.position("l_lowarm"), back)
        self.place(p, "l", goal, orient, shape, pole)
        for finger in FINGERS:
            if self.skin.points(p, "l", finger)[:, 1].min() < self.cards.level + 0.0001:
                self.skin.seat_pad(
                    p, "l", finger, [0, self.cards.level, 0], UP, entire=True
                )
            self.skin.clear_face(
                p,
                "l",
                finger,
                centre,
                basis,
                self.cards.half,
                1,
                seats=(finger in ("index", "middle") and frame <= KEY["flat"]),
            )
            self.skin.clear_face(
                p,
                "l",
                finger,
                self.cards.start - 0.00046 * self.cards.shoe.normal,
                self.cards.start_basis,
                self.cards.half,
                1,
            )

    def right(self, p, frame, centres, axes):
        w = self.wrists["r"]
        if frame <= KEY["ready"]:
            donor = self.old[frame]
            prep = ramp(frame, 3, KEY["ready"])
            goal = blend(donor.position("r_wrist"), self.wait.position("r_wrist"), prep)
            orient = turn(donor.world[w, :3, :3], self.wait.world[w, :3, :3], prep)
            shape = self.digit_shape("r", donor, self.wait, prep)
            pole = blend(
                donor.position("r_lowarm"), self.wait.position("r_lowarm"), prep
            )
            self.place(p, "r", goal, orient, shape, pole)
            self.seat_waiting(p, goal, orient, shape, pole, 0.0006)
            return
        join = ramp(frame, WAIT_END, KEY["handoff"])
        back = ramp(frame, KEY["release"] - 1, KEY["rest"])
        active = min(KEY["release"] - 1, frame)
        centre, axis = centres[active], axes[active]
        # Approach from outside the shoe/left hand, with an open thumb and fingertips on the felt.
        basic = self.wait.world[w, :3, :3]
        orient = turn(turn(basic, axis @ self.flat.world[w, :3, :3], join), basic, back)
        goal = blend(self.wait.position("r_wrist"), centre + axis @ self.offset, join)
        goal = blend(goal, self.wait.position("r_wrist"), back)
        lift = (
            0.012
            * ramp(frame, KEY["release"] - 1, KEY["release"] + 3)
            * (1 - ramp(frame, 131, KEY["rest"]))
        )
        goal += np.array(
            [-0.015 * np.sin(np.pi * back), lift, -0.026 * np.sin(np.pi * back)]
        )
        shape = self.digit_shape("r", self.wait, self.flat, join * (1 - back))
        pole = blend(
            self.wait.position("r_lowarm"),
            np.array([-0.20, 0.699, 0.22 + 0.13 * join]),
            join * (1 - back),
        )
        self.place(p, "r", goal, orient, shape, pole)
        if frame < KEY["handoff"]:
            self.seat_waiting(p, goal, orient, shape, pole, 0.00078)
        for finger in FINGERS:
            if self.skin.points(p, "r", finger)[:, 1].min() < self.cards.level + 0.0001:
                self.skin.seat_pad(
                    p, "r", finger, [0, self.cards.level, 0], UP, entire=True
                )
            seat = KEY["handoff"] <= frame < KEY["release"] and finger in (
                "index",
                "middle",
            )
            self.skin.clear_face(
                p,
                "r",
                finger,
                centres[frame],
                axes[frame],
                self.cards.half,
                1,
                seats=seat,
            )
        # When the card reaches the two leading fingers, a free outside fingertip can still rest on the felt.
        if (
            WAIT_END < frame < KEY["handoff"]
            and self.skin.points(p, "r", "all")[:, 1].min() > self.cards.level + 0.0013
        ):
            for finger in ("pinky", "ring"):
                if not len(
                    self.skin.patch(
                        p, "r", finger, centres[frame], axes[frame], self.cards.half
                    )
                ):
                    self.skin.seat_pad(
                        p, "r", finger, [0, self.cards.level, 0], UP, clearance=0.0006
                    )
                    break

    def sample(self, frame, centres, axes, focus):
        origin = self.old[frame] if frame <= KEY["draw"] else self.ready
        p = Pose(self.names, origin.parents, origin.local)
        if frame == 0:
            return p
        if frame == KEY["ready"] or frame >= KEY["rest"]:
            return Pose(self.names, self.wait.parents, self.wait.local)
        if frame > KEY["draw"]:
            reach = ramp(frame, 75, 104) * (1 - ramp(frame, 106, KEY["rest"]))
            for bone, part in (
                ("c_spine0", 0.30),
                ("c_spine1", 0.30),
                ("c_spine2", 0.25),
                ("c_spine3", 0.15),
            ):
                p.rotate(
                    bone,
                    Rotation.from_euler(
                        "yx", [-5 * reach * part, 17 * reach * part], degrees=True
                    ).as_matrix(),
                )
            self.left(p, frame, centres[frame], axes[frame])
            follow = 1 - ramp(frame, KEY["land"], KEY["rest"])
            align_gaze(p, blend(focus, centres[frame], follow), 0.81)
        self.right(p, frame, centres, axes)
        return p


def build(folder, provisional):
    assert sha(SOURCE) == SOURCE_SHA
    old_report = json.loads(
        SOURCE.with_name("givmatning.json").read_text(encoding="utf8")
    )
    glb = Glb(SOURCE)
    names, nodes, _, rest = hierarchy(glb)
    cards = Cards(Glb(ANCHOR), Equipment())
    assert glb.doc["nodes"][cards.node]["name"] == CARD_NAME
    old, old_centres, old_axes = read_exported_motion(glb, cards.node)
    skin = ContactSkin(glb, names)
    centres, axes = card_path(cards, old_centres, old_axes)
    anchor = json.loads(ANCHOR.with_name("posematning.json").read_text(encoding="utf8"))
    mouth, focus = np.asarray(anchor["mouthM"]), np.asarray(anchor["gazeTargetM"])
    gesture = SlidingHands(old, old_centres, old_axes, cards, skin)
    poses = [gesture.sample(i, centres, axes, focus) for i in range(LAST + 1)]
    write_animation(glb, poses, centres, axes, cards.node, nodes, rest)
    glb.doc["asset"]["extras"]["physicalDeal"].update(
        keyframes=KEY, sourceSceneSha256=SOURCE_SHA
    )
    compact(glb)
    with TemporaryDirectory(prefix="paulina-glidgiv-") as temp:
        filename = glb.save(Path(temp) / "giv.glb")
        contents = filename.read_bytes()
        exported = Glb(filename)
        independent, protocols = triangle_review(filename)
    poses, centres, axes = read_exported_motion(exported, cards.node)
    skin = ContactSkin(exported, names)
    measurements = measure(exported, cards, skin, poses, centres, axes, mouth, focus)
    hair = next(n for n in exported.doc["nodes"] if n["name"] == "Paulinas hår")
    hair_attrs = exported.doc["meshes"][hair["mesh"]]["primitives"][0]["attributes"]
    ids = np.arange(exported.doc["accessors"][hair_attrs["POSITION"]]["count"])
    palettes = np.asarray([p.world @ skin.inverse for p in poses])[:, :, :3, :]
    hair_vertices = deformed_vertices(exported, palettes, hair_attrs, ids)
    crown = hair_vertices[
        np.arange(len(poses)), np.argmax(hair_vertices[:, :, 1], axis=1)
    ]
    upper = names.index("c_spine3")
    ready_orientation = Rotation.from_matrix(
        rotation_blocks(poses[KEY["ready"]].world[upper, :3, :3])
    ).as_matrix()
    for i, (row, p) in enumerate(zip(measurements, poses)):
        skin_y = skin.points(p, "r", "all")[:, 1] - cards.level
        row["rightLowestSkinToFeltMm"] = round(float(skin_y.min() * 1000), 4)
        row["rightHighestSkinToFeltMm"] = round(float(skin_y.max() * 1000), 3)
        row["rightWristToFeltMm"] = round(
            float((p.position("r_wrist")[1] - cards.level) * 1000), 3
        )
        row["spine3M"] = p.position("c_spine3").tolist()
        row["headM"] = p.position("c_head_null").tolist()
        row["crownM"] = crown[i].tolist()
        spine = p.position("c_spine3") - p.position("c_spine0")
        rotation = (
            Rotation.from_matrix(rotation_blocks(p.world[upper, :3, :3])).as_matrix()
            @ ready_orientation.T
        )
        forward = rotation @ UP
        row["spineAxisForwardDegrees"] = round(
            float(np.rad2deg(np.arctan2(spine[2], spine[1]))), 3
        )
        row["upperSpineForwardFromReadyDegrees"] = round(
            float(np.rad2deg(np.arctan2(forward[2], forward[1]))), 3
        )
    held = measurements[KEY["handoff"] : KEY["release"]]
    landing = measurements[KEY["land"] :]
    v = np.asarray([row["cornerToFeltMm"] for row in landing])
    active_pads = {}
    for digit in ("index", "middle"):
        values = [row["hands"]["r"]["fingers"][digit]["distalPadGapMm"] for row in held]
        active_pads[digit] = [min(values), max(values)]
    collisions = [
        r["frame"]
        for r in measurements
        if r["cardInsideShoeSolidsMm"]
        or any(
            h["solidIntersections"]
            or h["cardSurfaceIntersections"]
            or h["cardInteriorVertices"]
            for h in r["hands"].values()
        )
    ]
    waiting_motion = {}
    for joint in ["r_wrist"] + ["r_" + d + "_null" for d in FINGERS]:
        xz = np.asarray(
            [p.position(joint)[[0, 2]] for p in poses[KEY["ready"] : WAIT_END + 1]]
        )
        offsets = np.linalg.norm(xz - xz[0], axis=1) * 1000
        waiting_motion[joint] = dict(
            pathMm=round(
                float(np.linalg.norm(np.diff(xz, axis=0), axis=1).sum() * 1000), 4
            ),
            maximumOffsetMm=round(float(offsets.max()), 4),
            endOffsetMm=round(float(offsets[-1]), 4),
        )
    unchanged = [
        i
        for i, name in enumerate(names)
        if not any(
            name.startswith("r_" + k) for k in ("uparm", "lowarm", "wrist", *FINGERS)
        )
    ]
    physics = {
        "waitingFrames": [KEY["ready"], WAIT_END],
        "rightWaitingHorizontalTravel": waiting_motion,
        "rightReadyShiftFromSourceMm": {
            name: np.round(
                1000
                * (
                    poses[KEY["ready"]].position(name)
                    - old[KEY["ready"]].position(name)
                ),
                3,
            ).tolist()
            for name in waiting_motion
        },
        "rightReadyToWaitingEndLowestSkinRangeMm": [
            min(
                r["rightLowestSkinToFeltMm"]
                for r in measurements[KEY["ready"] : WAIT_END + 1]
            ),
            max(
                r["rightLowestSkinToFeltMm"]
                for r in measurements[KEY["ready"] : WAIT_END + 1]
            ),
        ],
        "firstRightIndexOrMiddleWithin2MmAfterDraw": next(
            r["frame"]
            for r in measurements[KEY["draw"] :]
            if min(
                r["hands"]["r"]["fingers"][d]["distalPadGapMm"]
                for d in ("index", "middle")
            )
            <= 2
        ),
        "rightWaitingMaxLowestSkinToFeltMm": max(
            r["rightLowestSkinToFeltMm"] for r in measurements[: KEY["handoff"] + 1]
        ),
        "rightWaitingMaxHighestSkinToFeltMm": max(
            r["rightHighestSkinToFeltMm"] for r in measurements[: KEY["handoff"] + 1]
        ),
        "rightWaitingMaxWristToFeltMm": max(
            r["rightWristToFeltMm"] for r in measurements[: KEY["handoff"] + 1]
        ),
        "rightIndexAndMiddleDistalGapRangeMm": active_pads,
        "leftPresentationMaxDistalGapMm": {
            d: max(
                r["hands"]["l"]["fingers"][d]["distalPadGapMm"]
                for r in measurements[KEY["draw"] : KEY["flat"] + 1]
            )
            for d in ("index", "middle")
        },
        "onFeltDistanceFromFlatToP4Mm": float(
            np.linalg.norm(centres[KEY["land"], [0, 2]] - centres[KEY["flat"], [0, 2]])
            * 1000
        ),
        "freeSlideMm": float(
            np.linalg.norm(
                centres[KEY["land"], [0, 2]] - centres[KEY["release"], [0, 2]]
            )
            * 1000
        ),
        "rightReleaseGapMm": {
            d: measurements[KEY["release"]]["hands"]["r"]["fingers"][d][
                "distalPadGapMm"
            ]
            for d in ("thumb", "index", "middle")
        },
        "p4HorizontalErrorMm": float(
            np.linalg.norm(centres[-1, [0, 2]] - cards.p4[[0, 2]]) * 1000
        ),
        "stationaryFrames": len(landing),
        "stationaryCentreTravelMm": float(
            np.max(np.linalg.norm(centres[KEY["land"] :] - centres[-1], axis=1)) * 1000
        ),
        "stationaryMinimumSupportedCorners": int(np.min((abs(v) < 0.25).sum(1))),
        "stationaryBottomToFeltMm": [float(v.min()), float(v.max())],
        "spine3ForwardFromReadyMm": round(
            max(
                float(
                    p.position("c_spine3")[2]
                    - poses[KEY["ready"]].position("c_spine3")[2]
                )
                for p in poses
            )
            * 1000,
            2,
        ),
        "headForwardFromReadyMm": round(
            max(
                float(
                    p.position("c_head_null")[2]
                    - poses[KEY["ready"]].position("c_head_null")[2]
                )
                for p in poses
            )
            * 1000,
            2,
        ),
        "crownDropFromReadyMm": round(
            float((crown[KEY["ready"], 1] - min(crown[KEY["ready"] :, 1])) * 1000), 2
        ),
        "maxSpineAxisForwardDegrees": max(
            r["spineAxisForwardDegrees"] for r in measurements
        ),
        "maxUpperSpineForwardFromReadyDegrees": max(
            r["upperSpineForwardFromReadyDegrees"] for r in measurements
        ),
        "anchorMaxJointMatrixDifference": {
            str(i): float(np.max(abs(poses[i].world - old[i].world)))
            for i in (0, KEY["ready"], KEY["rest"])
        },
        "leftAndBodySourceAnchorMaxJointMatrixDifference": {
            str(i): float(
                np.max(abs(poses[i].world[unchanged] - old[i].world[unchanged]))
            )
            for i in (0, KEY["ready"], KEY["rest"])
        },
        "readyToReturnMaxJointMatrixDifference": float(
            np.max(abs(poses[KEY["ready"]].world - poses[KEY["rest"]].world))
        ),
        "collisionFrames": collisions,
    }
    issues = []
    if collisions:
        issues.append("Hud eller kort korsar uppmätt solid/yta.")
    if independent["opposingHandCrossingFrames"] or any(
        independent["skinThroughCardFaceFrames"].values()
    ):
        issues.append("Det oberoende triangelprovet hittade en korsning.")
    if physics["rightWaitingMaxLowestSkinToFeltMm"] > 2:
        issues.append("Höger hand vilar för högt.")
    if max(v["maximumOffsetMm"] for v in waiting_motion.values()) > 2:
        issues.append("Höger stödhand flyttar sig under vänsterns kortdrag.")
    if (
        physics["readyToReturnMaxJointMatrixDifference"] > 1e-6
        or max(physics["leftAndBodySourceAnchorMaxJointMatrixDifference"].values())
        > 1e-6
    ):
        issues.append("Sitt-/vänsterankaret eller högerhandens återgång avviker.")
    if max(x[1] for x in active_pads.values()) > 1.2:
        issues.append("Glidning saknar fingertoppskontakt.")
    if (
        not 100 <= physics["freeSlideMm"] <= 140
        or physics["p4HorizontalErrorMm"] > 0.05
    ):
        issues.append("Kortets fria sträcka eller målposition avviker.")
    if (
        physics["stationaryMinimumSupportedCorners"] != 4
        or physics["stationaryCentreTravelMm"] > 0.02
    ):
        issues.append("Kortet ligger inte plant och stilla på P4.")
    output = {
        k: old_report[k]
        for k in (
            "bodySha256",
            "anchorSha256",
            "anchorFile",
            "cardNodeIndex",
            "cardDimensionsM",
            "shoeSourceSha256",
            "nextCardNode",
            "targetSeat",
            "targetRingNodeIndex",
            "tableHeightM",
            "cameraM",
            "fps",
            "seconds",
            "animationFrames",
            "joints",
            "skins",
        )
        if k in old_report
    }
    fingerprint = hashlib.sha256(contents).hexdigest()
    output.update(
        sceneSha256=fingerprint,
        sourceSceneSha256=SOURCE_SHA,
        cardNode=CARD_NAME,
        keyframes=KEY,
        mouthM=mouth.tolist(),
        p4M=cards.p4.tolist(),
        physics=physics,
        measuredFrames=measurements,
        measurementSource="Den exporterade GLB-filens ledskalor, skinntrianglar, kortytor och filt.",
        poses={},
        independentTriangleReview=independent,
        issues=issues,
    )
    for phase, frame in KEY.items():
        p = poses[frame]
        output["poses"][phase] = dict(
            frame=frame,
            time=frame / RATE,
            joints={name: np.round(p.position(name), 6).tolist() for name in LANDMARKS},
            poseSha256=hashlib.sha256(p.world.astype("<f4").tobytes()).hexdigest(),
            cardCentreM=centres[frame].tolist(),
        )
    print(
        json.dumps(
            dict(sha=fingerprint, physics=physics, issues=issues), ensure_ascii=False
        ),
        flush=True,
    )
    if issues and not provisional:
        raise ValueError(" ".join(issues))
    data = json_bytes(output)
    publications = [(folder / "giv.glb", contents)]
    publications.extend(
        (folder / "granskning" / name, content) for name, content in protocols.items()
    )
    publications.append((folder / "givmatning.json", data))
    for destination, content in publications:
        if (
            destination.exists()
            and sha(destination) != hashlib.sha256(content).hexdigest()
        ):
            raise ValueError(
                f"Versionskonflikt i {destination}. Välj en ny utgåvemapp."
            )
    for destination, content in publications:
        put(destination, content, hashlib.sha256(content).hexdigest())
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=OUT)
    parser.add_argument("--arbetsprov", action="store_true")
    args = parser.parse_args()
    if args.arbetsprov and args.out_dir.resolve() == OUT.resolve():
        parser.error("Ge arbetsprovet en egen undermapp.")
    build(args.out_dir, args.arbetsprov)
