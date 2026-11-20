"""Knyt den renderade tvåkamerafilmen till rigg, fotoyta, kort och kameror i studion."""

import math
import sys
from pathlib import Path

PROV = Path(__file__).resolve().parent
ROOT = PROV.parents[4]
sys.path.insert(0, str(ROOT / "tools"))
import material_versions as versions


def cameras_from_export(cameras):
    result = []
    for seat in ("4", "1"):
        recorded = cameras[seat]
        position = recorded["position"]
        target = recorded["target"]
        x, y, z = (a - b for a, b in zip(position, target, strict=True))
        sample = {
            "frame": 0,
            "position": position,
            "target": target,
            "fov": recorded["fov"],
            "azimuth": math.degrees(math.atan2(x, z)),
            "elevation": math.degrees(math.atan2(y, math.hypot(x, z))),
            "distance": math.hypot(x, y, z),
        }
        result.append({"id": f"Stol {seat}", "projection": "perspektiv", "samples": [sample]})
    return result


def main():
    export = versions.read_json(PROV / "filmunderlag.json")
    store = versions.store_for("paulina")
    rig = versions.read_json(store / "modeller" / (export["rigSha256"] + ".json"))
    motion = rig["motion"]
    versions.check(rig["kind"] == "motion" and motion["card"] == "KORT-02", "Fel animations- eller kortversion.")
    marks = export["marks"]
    versions.check([m["pose"] for m in marks] == [1, 17, 33], "Exportens tre kontrollposer saknas.")
    capture = {
        "title": "Vänsterhandens kortdrag · Brown Photostudio 50 % med handljus",
        "take": motion["take"],
        "geometry": motion["geometry"],
        "appearance": motion["appearance"],
        "motion": export["rigSha256"],
        "card": motion["card"],
        "videoSha256": export["filmSha256"],
        "cameras": cameras_from_export(export["cameras"]),
        "marks": [{"frame": m["frame"], "label": f"Kortdragets ruta {m['pose']}/33"} for m in marks],
    }
    fingerprint = versions.register_film(store, PROV / "kortdrag-v2.mp4", capture)
    (PROV / "tagning.json").write_bytes(versions.json_bytes(capture))
    print(fingerprint)


if __name__ == "__main__":
    main()
