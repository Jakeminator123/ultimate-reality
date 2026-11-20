"""Measure crown, sole and a visible seat landmark in Paulina's Phase 1 originals."""
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def measure(file, seat_x):
    with Image.open(file) as image:
        rgb = np.array(image.convert("RGB"), dtype=float)
    height, width = rgb.shape[:2]
    rows, cols = np.indices((height, width))
    background = np.median(rgb[:, :45], axis=1)[:, None, :]
    distance = np.linalg.norm(rgb - background, axis=2)
    head = (rows < height * .35) & (cols > width * .15) & (cols < width * .9) & (distance > 35)
    _, _, boxes, _ = cv2.connectedComponentsWithStats(head.astype("uint8"))
    crown = int(boxes[1 + boxes[1:, cv2.CC_STAT_AREA].argmax(), cv2.CC_STAT_TOP])
    boots = (rows > height * .80) & (rgb.mean(axis=2) < 120)
    _, _, boxes, _ = cv2.connectedComponentsWithStats(boots.astype("uint8"))
    sole = int(max(y + h - 1 for _, y, _, h, area in boxes[1:] if area > 2400))
    # At the selected near front leg, the grey cushion meets the warm wooden support.
    from_y = int(height * .62)
    colour = np.median(rgb[from_y:int(height * .72), seat_x - 2:seat_x + 3], axis=1)
    wood = (colour[:, 0] - colour[:, 2] > 30) & (colour[:, 0] - colour[:, 1] > 13)
    seat = from_y + int(np.flatnonzero(wood)[0])
    return {"width": width, "height": height, "crownY": crown, "soleY": sole,
            "seatX": seat_x, "seatY": seat, "sourceSha256": hashlib.sha256(file.read_bytes()).hexdigest()}


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    folder = root / "avatars/paulina/fas-1/v1"
    release = json.loads((folder / "bildregister.json").read_text(encoding="utf-8"))
    entries = {entry["fil"]: entry for entry in release["bilder"]}
    views = []
    for name, label, degree, seat_x in [("front", "Framifrån", 0, 343), ("trekvart", "Trekvart", 45, 618), ("profil", "Profil", 90, 421)]:
        filename = f"sittande/{name}.png"
        data = measure(folder / filename, seat_x)
        if data["sourceSha256"] != entries[filename]["sha256"]:
            raise ValueError(f"Grundbildens version har ändrats: {filename}")
        views.append({"file": filename, "label": label, "degrees": degree, **data})
    output = {"release": "fas-1/v1", "views": views}
    target = folder / "sittande-bildskala.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(target)
