"""Packa upp V3:s inbäddade bilder till underlag/texturer med ursprungliga filbytes."""

from hashlib import sha256
from io import BytesIO
from pathlib import Path

from PIL import Image

from material_versions import json_bytes, put, sha
from paulina_utseende import Glb

EDITION = Path(__file__).resolve().parents[1] / "avatars/paulina/giv-plats-4/v3"
SCENE = "e0d5bc34b879397cfab41e527869b90202d8d35fcbadddca9adee4798c8d20ba"
FILENAMES = (
    "hud-och-klader.png",
    "har.png",
    "stovlar.jpg",
    "aldre-kortrygg.jpg",
    "hud-och-nagelglans.png",
    "har-insida.png",
)


def image_bindings(doc):
    result = [[] for image in doc["images"]]
    for index, material in enumerate(doc["materials"]):
        meshes = [
            mesh["name"]
            for mesh in doc["meshes"]
            if any(p.get("material") == index for p in mesh["primitives"])
        ]
        fields = {**material.get("pbrMetallicRoughness", {}), **material}
        for channel, texture in fields.items():
            if isinstance(texture, dict) and "index" in texture:
                source = doc["textures"][texture["index"]]["source"]
                result[source].append(
                    {"material": material["name"], "kanal": channel, "mesh": meshes}
                )
    return result


def export():
    source = EDITION / "rigg/giv.glb"
    if sha(source) != SCENE:
        raise ValueError("Bildindexen hör till Paulinas registrerade V3-utgåva.")
    folder = EDITION / "underlag/texturer"
    glb = Glb(source)
    bindings = image_bindings(glb.doc)
    records = []
    for i, (name, image) in enumerate(zip(FILENAMES, glb.doc["images"], strict=True)):
        view = glb.doc["bufferViews"][image["bufferView"]]
        first = view.get("byteOffset", 0)
        original = bytes(glb.data[first : first + view["byteLength"]])
        digest = sha256(original).hexdigest()
        with Image.open(BytesIO(original)) as decoded:
            width, height = decoded.size
        put(folder / name, original, digest)
        records.append(
            {
                "fil": name,
                "namn": image["name"],
                "bildindex": i,
                "bredd": width,
                "höjd": height,
                "sha256": digest,
                "bytes": len(original),
                "bindningar": bindings[i],
            }
        )
    index = json_bytes(
        {"källa": "../../rigg/giv.glb", "sha256": SCENE, "bilder": records}
    )
    put(folder / "filregister.json", index, sha256(index).hexdigest())
    print(folder)


if __name__ == "__main__":
    export()
