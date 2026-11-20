"""Spara granskningens bildrutor och verifiera måtten från samma tagning."""
from base64 import b64decode
from hashlib import sha256
from importlib.util import module_from_spec, spec_from_file_location
from io import BytesIO
import json
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
spec = spec_from_file_location("skolage", here.parent / "skolage-v1/jamfor.py")
skolage = module_from_spec(spec)
spec.loader.exec_module(skolage)


def measure():
    contour = json.loads((here/"kontur.json").read_text())
    edges = np.asarray(contour["felt_edges_xz_m"])
    foot = np.asarray(contour["shoe_foot_xz_m"])
    foot = foot[np.argsort(np.arctan2(*(foot-foot.mean(axis=0)).T[::-1]))]
    if not all(skolage.inside(vertex, edges) for vertex in foot):
        raise ValueError("Skon saknar fullt stöd.")
    rear = [edge for edge in edges if np.max(edge[:,1]) <= -.21+1e-6]
    left, right = skolage.nearest(foot, rear)
    report = json.loads((here/"matt-utseende.json").read_text())
    if report["frames_with_penetration"] or len(report["samples"]) != 33:
        raise ValueError("Utdragsprovet innehåller genomskärningar eller saknade rutor.")
    gaps = [v for row in report["samples"] for v in row["min_skin_gap_above_14mm_contact_patch_mm"].values()]
    return report, {"shoe_foot_to_edge_cm": float(np.linalg.norm(left-right)*100),
                    "finger_gap_mm": [min(gaps), max(gaps)], "frames": len(report["samples"])}


def main():
    report, stats = measure()
    html = (here/"utdrag.html").read_text(encoding="utf8")
    data = json.loads(re.search(r'<script type="application/json" id="take">(.*?)</script>', html, re.S)[1])
    assert data["appearanceHash"] == report["appearance_sha256"]
    assert data["poseHashes"] == [item["sha256"] for item in report["hashes"]]
    assert report["path_sha256"] == sha256((here/"bana.json").read_bytes()).hexdigest()
    width, height, title = 400, 225, 26
    sheet = Image.new("RGB", (3*width, 3*(height+title)), "#19241e")
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf",16)
    draw = ImageDraw.Draw(sheet)
    views = [("topp", "Skon ovanifrån"), ("4-hand", "Hand, Stol 4"), ("1-hand", "Hand, Stol 1")]
    for col, frame in enumerate([1, 17, 33]):
        for row, (key, label) in enumerate(views):
            encoded = data["pixels"][frame-1][key].split(",", 1)[1]
            image = Image.open(BytesIO(b64decode(encoded)))
            origin = (width*col, (height+title)*row)
            sheet.paste(image.resize((width,height), Image.Resampling.LANCZOS), (origin[0],origin[1]+title))
            draw.text((origin[0]+6,origin[1]+2),f"{label} · ruta {frame}",font=font,fill="white")
    sheet.save(here/"grepp.jpg",quality=94)
    (here/"matt.json").write_text(json.dumps(stats, indent=2)+"\n",encoding="utf8")


if __name__ == "__main__":
    main()
