"""Mät vänsterarmens skelettleder i de två registrerade givarna och deras sittbaser."""
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools"))
from paulina_utseende import Glb

FRAMES = 54
FPS = 24
TAKES = ("samspel-v2-v5", "giv-sam-v4-v2")
DEALER = ROOT / "test/dealer/paulina"
STORE = ROOT / "avatars/paulina/3d/versioner/filer"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def verified_model(path, sha):
    assert hashlib.sha256(path.read_bytes()).hexdigest() == sha
    return Glb(path)


def transforms(doc):
    return {i: {p: n[p] for p in ("translation", "rotation", "scale") if p in n}
            for i, n in enumerate(doc["nodes"])}


def matrix(trs):
    m = np.eye(4)
    m[:3, 3] = trs.get("translation", (0, 0, 0))
    m[:3, :3] = Rotation.from_quat(trs.get("rotation", (0, 0, 0, 1))).as_matrix() * trs.get("scale", (1, 1, 1))
    return m


def positions(doc, trs, placement):
    result = {}

    def visit(index, parent):
        node = doc["nodes"][index]
        world = parent @ matrix(trs[index])
        result[node["name"]] = world[:3, 3] * 1000
        for child in node.get("children", []):
            visit(child, world)

    for index in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        visit(index, placement)
    return result


def arm(points, mouth):
    shoulder, elbow, wrist = [points["l_" + part] for part in ("uparm", "lowarm", "wrist")]
    tip = (points["l_index_null"] + points["l_middle_null"]) / 2
    chain = np.linalg.norm(elbow - shoulder) + np.linalg.norm(wrist - elbow)
    reach = np.linalg.norm(wrist - shoulder)
    return dict(wrist=np.round(wrist, 1).tolist(), fingertips=np.round(tip, 1).tolist(),
                tipToMouth=round(float(np.linalg.norm(tip - mouth)), 1),
                tipToMouthXZ=round(float(np.linalg.norm((tip - mouth)[[0, 2]])), 1),
                shoulderToWrist=round(float(reach), 1), armSegments=round(float(chain), 1),
                extensionPct=round(100 * float(reach / chain), 1))


def measure(take, mouth):
    info = read_json(DEALER / take / "matning.json")
    base = verified_model(STORE / (info["geometry"] + ".glb"), info["geometry"])
    model = verified_model(DEALER / take / ("paulina-" + take + ".glb"), info["motion"])
    clip, = model.doc["animations"]
    assert clip["name"] == take
    placement, = [node for node in model.doc["nodes"] if node["name"] == "Bordsplacering Kasinorum"]
    base_points = positions(base.doc, transforms(base.doc), matrix(placement))
    result = {"sittbas": arm(base_points, mouth)}
    tracks = {}
    card_node, = [i for i, node in enumerate(model.doc["nodes"]) if node["name"] == "KORT-02 · spader två"]
    card_data = {}
    mesh = model.doc["meshes"][model.doc["nodes"][card_node]["mesh"]]
    for i, primitive in enumerate(mesh["primitives"]):
        card_data[i, "position"] = model.read(primitive["attributes"]["POSITION"])
        for j, target in enumerate(primitive.get("targets", [])):
            card_data[i, j] = model.read(target["POSITION"])
    for channel in clip["channels"]:
        target = channel["target"]
        sampler = clip["samplers"][channel["sampler"]]
        if target["node"] == card_node:
            card_data["keys", target["path"]] = model.read(sampler["output"])
            np.testing.assert_allclose(model.read(sampler["input"]).ravel(), np.arange(FRAMES) / FPS, atol=2e-7, rtol=0)
        if target["path"] == "weights":
            continue
        np.testing.assert_allclose(model.read(sampler["input"]).ravel(), np.arange(FRAMES) / FPS, atol=2e-7, rtol=0)
        tracks[target["node"], target["path"]] = model.read(sampler["output"])
    card_origins = []
    trs = transforms(model.doc)
    for frame in range(FRAMES):
        for (index, prop), samples in tracks.items():
            trs[index][prop] = samples[frame]
        points = positions(model.doc, trs, np.eye(4))
        card_origins.append(points["KORT-02 · spader två"])
        if frame in (0, 4, 8, 9, 16, 22, 38, 53):
            result[frame] = arm(points, mouth)
    return result, np.array(card_origins), card_data


if __name__ == "__main__":
    path_files = (DEALER / "tvahandsgiv-v2-v4/kortbana.json", DEALER / "giv-sam-v4-v2/kortbana.json")
    paths = [read_json(p) for p in path_files]
    assert paths[0] == paths[1]
    shoe = paths[0]["shoe"]
    yaw = np.radians(shoe["yawDegrees"])
    x, z = shoe["shoeCenterXZ"]
    mouth = 1000 * np.array([x + np.sin(yaw)*shoe["mouthZ"], shoe["cardTopY"], z + np.cos(yaw)*shoe["mouthZ"]])
    results = [measure(take, mouth) for take in TAKES]
    np.testing.assert_allclose(results[0][1], results[1][1], atol=0.001, rtol=0)
    assert np.max(abs(results[0][1][22:] - results[0][1][22])) < 0.001
    left, right = results[0][2], results[1][2]
    assert left.keys() == right.keys()
    for key in left:
        np.testing.assert_array_equal(left[key], right[key])
    print(json.dumps({"mouthMm": mouth.round(1).tolist(), "takeMeasurementsMm":
                      {take: result[0] for take, result in zip(TAKES, results)}}, indent=2))
