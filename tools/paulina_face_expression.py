"""Export Paulina's photographed face and an independent rest → expression → rest animation."""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory

import numpy as np

from material_versions import sha
from paulina_deal_p4 import Glb, ROOT, compact
from paulina_hand_material import json_bytes, publish

MODULE = ROOT / "studio/app/giv-plats-4/face-expression.mjs"
BASE = ROOT / "avatars/paulina/giv-plats-4/v3/rigg/giv.glb"
BASE_HASH = "e0d5bc34b879397cfab41e527869b90202d8d35fcbadddca9adee4798c8d20ba"
OUT = BASE.parent.parent / "granskning/minspel"
BRIDGE = """
import { readFileSync } from 'node:fs';
const { buildPaulinaExpression, expressionTarget, expressionClip } = await import(process.argv[2]);
const input = JSON.parse(readFileSync(0, 'utf8'));
function decode(key, Type) {
  const bytes = Buffer.from(input[key], 'base64');
  return new Type(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const target = buildPaulinaExpression(decode('position', Float32Array),
  decode('normal', Float32Array), decode('index', Uint32Array));
const packed = Object.fromEntries(Object.entries(target).map(([k, a]) => [k, Buffer.from(a.buffer).toString('base64')]));
process.stdout.write(JSON.stringify({ ...packed, expressionTarget, expressionClip }));
"""


def freeze_original(glb):
    doc = glb.doc
    clip = doc["animations"][0]
    for channel in clip["channels"]:
        sampler = clip["samplers"][channel["sampler"]]
        if glb.read(sampler["input"]).ravel()[0] != 0 or sampler.get("interpolation", "LINEAR") != "LINEAR":
            raise ValueError("Källans första vila har en oväntad nyckeltid eller interpolering.")
        target = channel["target"]
        if target["path"] not in ("scale", "rotation", "translation"):
            raise ValueError("Vilonoden innehåller ett okänt animerat fält.")
        doc["nodes"][target["node"]][target["path"]] = glb.read(sampler["output"])[0].tolist()
    doc["animations"] = []
    compact(glb)
    return clip["name"], len(clip["channels"])


def build_morph(glb, primitive, node):
    attrs = primitive["attributes"]
    pos, normal, ids = [glb.read(attrs[k]) for k in ("POSITION", "NORMAL", "_SAM_INDEX")]
    buffers = dict(position=pos.astype("<f4"), normal=normal.astype("<f4"), index=ids.astype("<u4"))
    args = {k: base64.b64encode(a.tobytes()).decode("ascii") for k, a in buffers.items()}
    with TemporaryDirectory(prefix="paulina-morph-") as tmp:
        bridge = Path(tmp) / "bind.mjs"
        bridge.write_text(BRIDGE, encoding="utf8")
        result = subprocess.run(
            [node, str(bridge), MODULE.as_uri()],
            cwd=ROOT / "studio",
            input=json.dumps(args),
            text=True,
            encoding="utf8",
            capture_output=True,
            check=False,
        )
    if result.returncode:
        raise RuntimeError(result.stderr)
    raw = json.loads(result.stdout)
    movement, normals = [
        np.frombuffer(base64.b64decode(raw[k]), dtype="<f4").reshape(pos.shape)
        for k in ("position", "normal")
    ]
    if not np.isfinite(movement).all() or not np.isfinite(normals).all():
        raise ValueError("En uttryckskoordinat saknar värde.")
    return movement, normals, raw["expressionTarget"], raw["expressionClip"]


def geometry_check(glb, primitive, delta):
    a = primitive["attributes"]
    positions = glb.read(a["POSITION"]).astype(float)
    ids = glb.read(a["_SAM_INDEX"]).ravel()
    faces = glb.read(primitive["indices"]).reshape(-1, 3)
    active = np.linalg.norm(delta, axis=1) > 0
    changed = faces[active[faces].any(1)]
    before, after = positions[changed], (positions + delta)[changed]
    n0, n1 = [np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0]) for p in (before, after)]
    l0, l1 = np.linalg.norm(n0, axis=1), np.linalg.norm(n1, axis=1)
    valid = l0 > 1e-10
    cosine = (n0[valid] * n1[valid]).sum(1) / np.maximum(l0[valid] * l1[valid], 1e-14)
    ratio = l1[valid] / l0[valid]
    if not len(cosine) or np.min(cosine) <= 0 or np.min(ratio) < 0.18:
        raise ValueError(f"Ansiktets trianglar vändes eller kollapsade: {cosine.min():.3f}/{ratio.min():.3f}")
    landmark_ids = {
        "dealerRightMouthCorner": 5042,
        "dealerLeftMouthCorner": 904,
        "dealerRightCheek": 4869,
        "dealerLeftOuterBrow": 1156,
        "dealerRightBrow": 5098,
        "dealerRightIris": 4383,
        "dealerLeftIris": 1497,
        "nose": 3305,
        "chin": 3259,
    }
    return {
        "affectedVertices": int(active.sum()),
        "affectedTriangles": len(changed),
        "mostRestrainedTriangleNormalCosine": float(cosine.min()),
        "smallestTriangleAreaRatio": float(ratio.min()),
        "largestMovementMm": float(np.linalg.norm(delta, axis=1).max() * 1000),
        "bindDisplacementMm": {
            name: (delta[np.flatnonzero(ids == sam)[0]].astype(float) * 1000).round(3).tolist()
            for name, sam in landmark_ids.items()
        },
    }


def export(source, out, node):
    source_hash = sha(source)
    if source_hash != BASE_HASH:
        raise ValueError("Det portabla provet är registrerat mot Paulinas godkända V3.")
    glb = Glb(source)
    from_clip, baked = freeze_original(glb)
    doc = glb.doc
    mesh_id = next(i for i, m in enumerate(doc["meshes"]) if m["name"] == "Seated body")
    mesh = doc["meshes"][mesh_id]
    primary = next(p for p in mesh["primitives"] if "_SAM_INDEX" in p["attributes"])
    delta, normals, name, label = build_morph(glb, primary, node)
    geometry = geometry_check(glb, primary, delta)
    for p in mesh["primitives"]:
        if p is primary:
            position = glb.accessor(delta, "VEC3")
            normal = glb.accessor(normals, "VEC3")
        else:
            # glTF requires the same number of targets across all primitives of
            # a mesh. All four boot primitives receive a shared zero displacement.
            zero = np.zeros_like(glb.read(p["attributes"]["POSITION"]))
            position = normal = glb.accessor(zero, "VEC3")
        p["targets"] = [{"POSITION": position, "NORMAL": normal}]
    mesh["weights"] = [0]
    mesh.setdefault("extras", {})["targetNames"] = [name]
    body_node = next(i for i, n in enumerate(doc["nodes"]) if n.get("mesh") == mesh_id)
    doc["nodes"][body_node]["weights"] = [0]
    times, values = [0, 1, 1.5, 2.5], [0, 1, 1, 0]
    t = glb.accessor(np.asarray(times, "<f4"), "SCALAR")
    v = glb.accessor(np.asarray(values, "<f4"), "SCALAR")
    for index, lo, hi in ((t, 0, 2.5), (v, 0, 1)):
        doc["accessors"][index].update(min=[lo], max=[hi])
        # Animation accessors have no vertex/index buffer target in glTF.
        doc["bufferViews"][doc["accessors"][index]["bufferView"]].pop("target", None)
    doc["animations"] = [
        {
            "name": label,
            "samplers": [{"input": t, "output": v, "interpolation": "LINEAR"}],
            "channels": [{"sampler": 0, "target": {"node": body_node, "path": "weights"}}],
        }
    ]
    receipt = {
        "sourceSha256": source_hash,
        "sourceClip": from_clip,
        "bakedSourceFrame": 0,
        "bakedTRSChannels": baked,
        "expressionModuleSha256": sha(MODULE),
        "clip": label,
        "durationSeconds": 2.5,
        "morph": name,
        "seconds": times,
        "weights": values,
        **geometry,
    }
    doc["asset"].setdefault("extras", {})["portraitExpression"] = receipt
    with TemporaryDirectory(prefix="paulina-minspel-") as tmp:
        data = glb.save(Path(tmp) / "minspel.glb").read_bytes()
    receipt["sceneSha256"] = hashlib.sha256(data).hexdigest()
    publish(out, {"minspel.glb": data, "minspel.json": json_bytes(receipt)})
    print(receipt["sceneSha256"], json.dumps(geometry, ensure_ascii=False))


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--source", type=Path, default=BASE)
    cli.add_argument("--out-dir", type=Path, default=OUT)
    cli.add_argument("--node", default=shutil.which("node") or "node")
    args = cli.parse_args()
    export(args.source, args.out_dir, args.node)
