"""Transfer the measured Kling right-hand grip and the red card together to the released V4."""

import argparse
from copy import deepcopy
import hashlib
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, sha
from paulina_blackjack_scene import measure_table_contact, table_cross_section
from paulina_deal_p4 import Glb, Pose
from paulina_film_motion import (
    KLING_SHA,
    KLING_TRACK,
    KLING_VIDEO,
    TRIAL,
    V4,
    V4_SHA,
    orient_wrist,
    store_clip,
)
from paulina_hand_material import publish
from paulina_motion_trial import compact, deformed_vertices, hierarchy, motion_channel, rotation_blocks

SOURCE = TRIAL / "modell/blackjack.glb"
SOURCE_SHA = "60744fff89e8240e17d4577b540b4ac068e9ace68f2acd7a30d205df60b2bffd"
OUT = V4.parent.parent.parent / "filmrorelse/v2/rigg"
CARD = "Rött spelkort"
SETDOWN, RELEASE = 62, 73
CARD_HALF_EXTENT = np.array([0.0315, 0.00035, 0.0445])
CHECK_FRAMES = [0, 17, 32, 42, 54, 60, 62, 70, 72, 73, 77, 81, 92, 120]


def ease(frame, start, end):
    t = np.clip((frame - start) / (end - start), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def read_film_clip(glb, card_node):
    names, nodes, parents, rest = hierarchy(glb)
    clip = glb.doc["animations"][0]
    clock = glb.read(clip["samplers"][0]["input"]).ravel()
    count = len(clock) - 1
    local_poses = np.repeat(rest[None], count, axis=0)
    card = {}
    for channel in clip["channels"]:
        target = channel["target"]
        sampler = clip["samplers"][channel["sampler"]]
        if not np.array_equal(glb.read(sampler["input"]).ravel(), clock):
            raise ValueError("Ledspår eller kort har en avvikande tidslinje.")
        values = glb.read(sampler["output"])[:count]
        if target["node"] == card_node:
            card[target["path"]] = values.astype(float)
        elif target["node"] in nodes and target["path"] == "rotation":
            joint_index = nodes.index(target["node"])
            local_poses[:, joint_index, :3, :3] = (
                Rotation.from_quat(values).as_matrix()
                * np.linalg.norm(rest[joint_index, :3, :3], axis=0)[None, None, :]
            )
        else:
            raise ValueError("Filmens animerade objekt saknas i det registrerade provet.")
    return clock, [Pose(names, parents, row) for row in local_poses], card


def photographed_back():
    """The bright paper ends at these four measured lines in Kling frame zero."""
    reader = cv2.VideoCapture(str(KLING_VIDEO))
    try:
        ok, frame = reader.read()
    finally:
        reader.release()
    if not ok:
        raise ValueError("Startbilden för den röda kortryggen gick inte att avkoda.")
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    u, v = np.meshgrid(np.linspace(0, 1, 126, dtype="float32"), np.linspace(0, 1, 178, dtype="float32"))
    source_x = 566.0 + (600.05 - 566.0) * u
    source_y = 263.0 + (312.05 - 263.0) * v
    native = cv2.remap(rgb, source_x, source_y, cv2.INTER_LINEAR).astype(float)
    opposite = cv2.remap(rgb, 600.05 - (600.05 - 566.0) * u, source_y, cv2.INTER_LINEAR).astype(float)
    # The photographed fingertips obscure the lower left rim in this frame.
    # Reconstruct that part only, from the visible rim at the same card height.
    cover = (1 - ease(u, 0.23, 0.34)) * ease(v, 0.55, 0.67)
    clean = np.rint(native + (opposite - native) * cover[..., None]).astype(np.uint8)
    border = np.minimum(np.minimum(u, 1 - u) * 34.05, np.minimum(v, 1 - v) * 49.05) < 0.4
    paper = np.median(rgb[263, 574:592], axis=0).astype(np.uint8)
    dark_rim = border & (clean.mean(2) < 145)
    clean[dark_rim] = paper
    stream = BytesIO()
    Image.fromarray(clean).save(stream, format="PNG")
    texture_bytes = stream.getvalue()
    return texture_bytes, {
        "sourceVideoFrame": 0,
        "nativeOuterRimPx": [566.0, 263.0, 600.05, 312.05],
        "outputSize": [126, 178],
        "sampledPaperRgb": paper.tolist(),
        "minimumRimLuminance": round(float(clean[border].mean(1).min()), 2),
        "darkBackgroundPixelsOnRim": int((clean[border].mean(1) < 90).sum()),
        "photoTextureSha256": hashlib.sha256(texture_bytes).hexdigest(),
    }


def import_card(source, target, node_index):
    """Carry the photographed card front, paper edge, physical corners and UVs with the same local axes."""
    source_doc = source.doc
    target_doc = target.doc
    source_node = next(n for n in source_doc["nodes"] if n["name"] == CARD)
    card_mesh = deepcopy(source_doc["meshes"][source_node["mesh"]])
    new_back, photo_proof = photographed_back()
    for primitive in card_mesh["primitives"]:
        for key, accessor_index in list(primitive["attributes"].items()):
            primitive["attributes"][key] = target.accessor(
                source.read(accessor_index), source_doc["accessors"][accessor_index]["type"]
            )
        accessor_index = primitive["indices"]
        primitive["indices"] = target.accessor(source.read(accessor_index), "SCALAR", True)
        material = deepcopy(source_doc["materials"][primitive["material"]])
        texture_ref = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if texture_ref:
            texture = deepcopy(source_doc["textures"][texture_ref["index"]])
            image = deepcopy(source_doc["images"][texture["source"]])
            image["bufferView"] = target.buffer(new_back)
            image["mimeType"] = "image/png"
            texture["source"] = len(target_doc["images"])
            target_doc["images"].append(image)
            if "sampler" in texture:
                sampler = deepcopy(source_doc["samplers"][texture["sampler"]])
                texture["sampler"] = len(target_doc.setdefault("samplers", []))
                target_doc["samplers"].append(sampler)
            texture_ref["index"] = len(target_doc["textures"])
            target_doc["textures"].append(texture)
        primitive["material"] = len(target_doc["materials"])
        target_doc["materials"].append(material)
    node = target_doc["nodes"][node_index]
    target_doc["meshes"][node["mesh"]] = card_mesh
    node["name"] = CARD
    return next(
        accessor_index for accessor_index, n in enumerate(source_doc["nodes"]) if n["name"] == CARD
    ), photo_proof


def skinned_hands_and_fingertips(glb, poses):
    names = poses[0].names
    attrs = glb.doc["meshes"][0]["primitives"][0]["attributes"]
    joints, weights = [glb.read(attrs[digit]) for digit in ("JOINTS_0", "WEIGHTS_0")]
    dominant = joints[np.arange(len(weights)), weights.argmax(1)]
    inverse_bind = (
        glb.read(glb.doc["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    )
    palette = (np.stack([pose.world for pose in poses]) @ inverse_bind)[..., :3, :]
    hand_points = {}
    fingers = {}
    for side in ("r", "l"):
        prefix = tuple(
            side + "_" + suffix for suffix in ("wrist", "thumb", "index", "middle", "ring", "pinky")
        )
        hand_vertices = np.flatnonzero(
            np.array([joint_name.startswith(prefix) for joint_name in names])[dominant]
        )
        hand_points[side] = deformed_vertices(glb, palette, attrs, hand_vertices)
        if side == "r":
            for digit in ("thumb", "index", "middle", "ring", "pinky"):
                distal = [names.index("r_" + digit + "3"), names.index("r_" + digit + "_null")]
                fingers[digit] = hand_points["r"][:, np.isin(dominant[hand_vertices], distal)]
    return hand_points, fingers


def adapt_grip_to_felt(original, felt_height_difference, source_card):
    frame_numbers = np.arange(len(original))
    initial_clearance = 0.032
    lift = initial_clearance + (felt_height_difference - initial_clearance) * ease(frame_numbers, 16, 46)
    centre = source_card["translation"].copy()
    front_camera = np.array([0.072, 1.400, 1.853])
    initial_ray = (front_camera - centre[0]) / (front_camera[1] - centre[0, 1])
    projected_lift = initial_clearance * (1 - ease(frame_numbers, 17, 43))
    offsets = 0.24 * projected_lift[:, None] * initial_ray
    offsets[:, 1] = lift
    centre += offsets
    card_quaternions = source_card["rotation"]
    wrist_offsets = offsets * (1 - ease(frame_numbers, 79, 92))[:, None]
    # The higher V4 tabletop extends 16 mm further towards the dealer.
    # Withdraw behind that rear edge after the card has visibly left the hand.
    wrist_offsets[:, 2] -= 0.012 * ease(frame_numbers, 74, 80) * (1 - ease(frame_numbers, 83, 95))
    poses = []
    for frame, source_pose in enumerate(original):
        pose = Pose(source_pose.names, source_pose.parents, source_pose.local.copy())
        offset = wrist_offsets[frame]
        if np.any(offset):
            wrist_name = "r_wrist"
            wrist_index = source_pose.names.index(wrist_name)
            orient_wrist(
                pose,
                "r",
                source_pose.position(wrist_name) + offset,
                source_pose.position("r_lowarm") + offset * 0.50,
                rotation_blocks(source_pose.world[wrist_index, :3, :3]),
            )
        poses.append(pose)
    return poses, centre, card_quaternions


def distal_contact_mm(fingers, centres, basis):
    measurements = {}
    for digit, skin_points in fingers.items():
        card_space = (skin_points - centres[:, None]) @ basis
        distance = np.linalg.norm(np.maximum(np.abs(card_space) - CARD_HALF_EXTENT, 0), axis=2)
        measurements[digit] = distance.min(axis=1) * 1000
    return measurements


def generate(out, trial=False):
    if sha(V4) != V4_SHA or sha(SOURCE) != SOURCE_SHA or sha(KLING_VIDEO) != KLING_SHA:
        raise ValueError("V4, det röda kortprovet eller den registrerade Kling-filmen har ändrats.")
    donor = Glb(SOURCE)
    target_scene = Glb(V4)
    names, nodes, parents, rest = hierarchy(target_scene)
    source_names, _, source_parents, source_rest = hierarchy(donor)
    if (
        names != source_names
        or not np.array_equal(parents, source_parents)
        or not np.array_equal(rest, source_rest)
    ):
        raise ValueError("MHR-ledernas koordinatsystem skiljer sig mellan utgåvorna.")
    target_inverse_bind = target_scene.read(target_scene.doc["skins"][0]["inverseBindMatrices"])
    if not np.array_equal(target_inverse_bind, donor.read(donor.doc["skins"][0]["inverseBindMatrices"])):
        raise ValueError("Skelettens bindmatriser skiljer sig.")
    v4_receipt = json.loads(V4.with_name("givmatning.json").read_text(encoding="utf8"))
    card_node_index = v4_receipt["cardNodeIndex"]
    source_card_node, photo_proof = import_card(donor, target_scene, card_node_index)
    clock, source_poses, source_card = read_film_clip(donor, source_card_node)
    with np.load(KLING_TRACK, allow_pickle=False) as data:
        np.testing.assert_allclose(data["times"], clock[:-1], atol=2e-7, rtol=0)
        assert (
            len(clock) == 122
            and np.array_equal(data["frame_indices"], np.arange(121))
            and str(data["video_sha256"]) == KLING_SHA
        )
        mhr = str(data["mhr_sha256"])
    target_felt = table_cross_section(target_scene, "Spelyta")[-1]
    source_felt = table_cross_section(donor, "Spelyta")[-1]
    poses, centres, card_quaternions = adapt_grip_to_felt(
        source_poses, float(target_felt - source_felt), source_card
    )
    card_node = target_scene.doc["nodes"][card_node_index]
    card_node["translation"] = centres[0].tolist()
    card_node["rotation"] = card_quaternions[0].tolist()
    changed = store_clip(target_scene, poses, nodes, rest, clock[:-1], clock[-1], "Kling 4 · rött kort")
    animation = target_scene.doc["animations"][0]
    clock_accessor = animation["samplers"][0]["input"]
    motion_channel(
        target_scene,
        animation,
        clock_accessor,
        card_node_index,
        "translation",
        np.vstack((centres, centres[-1])),
    )
    motion_channel(
        target_scene,
        animation,
        clock_accessor,
        card_node_index,
        "rotation",
        np.vstack((card_quaternions, card_quaternions[-1])),
    )
    target_scene.doc["asset"].setdefault("extras", {})["filmCard"] = {
        "node": card_node_index,
        "sourceScene": SOURCE_SHA,
        "sourceVideo": KLING_SHA,
    }
    compact(target_scene)
    with TemporaryDirectory(prefix="paulina-film-kort-") as temp:
        path = target_scene.save(Path(temp) / "filmrorelse.glb")
        exported_scene = Glb(path)
        exported_bytes = path.read_bytes()
    exported_clock, exported_poses, card_tracks = read_film_clip(exported_scene, card_node_index)
    if not np.array_equal(exported_clock, clock):
        raise ValueError("Exporten ändrade tidbasen.")
    card_centres = card_tracks["translation"]
    card_bases = Rotation.from_quat(card_tracks["rotation"]).as_matrix()
    hand_points, fingers = skinned_hands_and_fingertips(exported_scene, exported_poses)
    distances = distal_contact_mm(fingers, card_centres, card_bases)
    table = measure_table_contact(exported_scene, hand_points, card_centres, card_bases, SETDOWN)
    intersections = {
        name: {side: row["framesInside"] for side, row in table[name]["hands"].items()}
        for name in ("Spelyta", "Bordets kant")
    }
    failures = []
    if any(frames for solid in intersections.values() for frames in solid.values()):
        failures.append("hudyta inne i bordet")
    if (
        table["stationaryCard"]["minimumSupportedCorners"] != 4
        or np.ptp(card_centres[SETDOWN:], axis=0).max() > 2e-7
    ):
        failures.append("kortet fick inte obrutet stöd i V4")
    source_hand_points, source_fingertips = skinned_hands_and_fingertips(donor, source_poses)
    source_distances = distal_contact_mm(
        source_fingertips,
        source_card["translation"],
        Rotation.from_quat(source_card["rotation"]).as_matrix(),
    )
    until_release = slice(0, RELEASE)
    largest_grip_change = max(
        float(np.abs(values[until_release] - source_distances[digit][until_release]).max())
        for digit, values in distances.items()
    )
    if largest_grip_change > 0.02:
        failures.append("överföringen ändrade fingeravståndet under greppet")
    held_range = slice(0, 56)
    maximum_held = {digit: float(distances[digit][held_range].max()) for digit in ("thumb", "index")}
    if max(maximum_held.values()) > 0.8:
        failures.append("avbrutet kontaktgrepp före bordet")
    samples = {}
    for frame in CHECK_FRAMES:
        samples[str(frame)] = {
            "ptsSeconds": float(clock[frame]),
            "redCardCentreM": card_centres[frame].round(6).tolist(),
            "redFaceTiltDeg": round(
                float(np.degrees(np.arccos(np.clip(abs(card_bases[frame, 1, 1]), 0, 1)))), 3
            ),
            "distalFingerToCardMm": {
                digit: round(float(values[frame]), 3) for digit, values in distances.items()
            },
            "sourceFingerToCardMm": {
                digit: round(float(values[frame]), 3) for digit, values in source_distances.items()
            },
            "rightWristM": exported_poses[frame].position("r_wrist").round(6).tolist(),
            "leftWristM": exported_poses[frame].position("l_wrist").round(6).tolist(),
        }
    if (
        max(distances["thumb"][0], distances["index"][0], distances["thumb"][42], distances["index"][42])
        > 1.1
    ):
        failures.append("tum-/pekgrepp vid start eller transport")
    if (
        max(distances["index"][70], distances["middle"][70]) > 1.1
        or min(distances["index"][73], distances["middle"][73]) < 3
    ):
        failures.append("hudkontakt före/efter släpp")
    if failures and not trial:
        raise ValueError(", ".join(failures))
    start_surface_difference = {
        digit: round(
            float(np.max(np.abs(hand_points[digit][0] - source_hand_points[digit][0]))) * 1000, 3
        )
        if hand_points[digit].shape[1] == source_hand_points[digit].shape[1]
        else None
        for digit in hand_points
    }
    report = {
        "sceneSha256": hashlib.sha256(exported_bytes).hexdigest(),
        "inputSceneSha256": V4_SHA,
        "sourceVideoSha256": KLING_SHA,
        "sourceRegisteredSceneSha256": SOURCE_SHA,
        "trackingSha256": sha(KLING_TRACK),
        "mhrSha256": mhr,
        "providerModel": "kling_4",
        "fps": 24,
        "frames": 121,
        "seconds": float(clock[-1]),
        "keyframes": {"start": 0, "extended": 42, "sourceSetDown": 62, "sourceRelease": 73, "end": 120},
        "sourceFrameIndices": list(range(121)),
        "sourceTimesSeconds": clock[:-1].tolist(),
        "binding": {
            "skeletonJoints": len(nodes),
            "inverseBindMatricesIdentical": True,
            "animationChannels": changed,
            "surfaceStartDifferenceMm": start_surface_difference,
        },
        "card": {
            "nodeIndex": card_node_index,
            "nodeName": CARD,
            "sizeMm": (CARD_HALF_EXTENT * 2000).tolist(),
            "sourceTextureFrame": 0,
            "fixedYellowShoe": True,
            "stationaryAfterFrame": SETDOWN,
            "setDownSourceFrame": SETDOWN,
            "releaseSourceFrame": RELEASE,
            "feltTopM": float(target_felt),
            "sourceFeltTopM": float(source_felt),
            "heightAdjustmentMm": round(float((target_felt - source_felt) * 1000), 3),
            "startAdjustmentMm": ((card_centres[0] - source_card["translation"][0]) * 1000)
            .round(3)
            .tolist(),
            "photoTexture": photo_proof,
        },
        "samples": samples,
        "grip": {
            "method": "Nearest exported skinned distal vertex to the solid 63 × 89 × 0.7 mm card, including fingertip-null weights.",
            "maximumHeldFingerGapMmFrames0To55": maximum_held,
            "maximumDifferenceFromRegisteredGripMmBeforeRelease": largest_grip_change,
            "rightFingerToRedCardMmByFrame": {
                digit: values.round(3).tolist() for digit, values in distances.items()
            },
        },
        "tableContact": table,
        "validationFailures": failures,
    }
    publish(out, {"filmrorelse.glb": exported_bytes, "rorelsematning.json": json_bytes(report)})
    print(
        report["sceneSha256"],
        failures,
        intersections,
        {frame: samples[str(frame)]["distalFingerToCardMm"] for frame in (0, 42, 70, 73)},
        flush=True,
    )


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--out-dir", type=Path, default=OUT)
    cli.add_argument(
        "--trial", action="store_true", help="Märk en arbetsmapp med ej godkända kontroller."
    )
    args = cli.parse_args()
    if args.trial and args.out_dir.resolve() == OUT.resolve():
        raise ValueError("Arbetsprov har egen mapp.")
    generate(args.out_dir, args.trial)
