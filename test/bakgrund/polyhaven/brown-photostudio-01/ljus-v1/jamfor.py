"""Show both locked cameras, compare identical pixel regions, and save full-size originals alongside."""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent
cameras = json.loads((folder.parents[3] / "bord/filtdjup-v1/matt.json").read_text())["cameras"]
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
matte = "#18201d"
paper = "#f5eddc"


def project(point, cam):
    eye = np.array(cam["eye"])
    forward = np.array(cam["aim"]) - eye
    forward /= np.linalg.norm(forward)
    right = np.cross(forward, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    vector = np.array(point) - eye
    scale = 450 / (math.tan(math.radians(cam["fovVertical"] / 2)) * (vector @ forward))
    return round(800 + scale * (vector @ right)), round(450 - scale * (vector @ up))


overview = Image.new("RGB", (1820, 780), matte)
details = Image.new("RGB", (842, 1510), matte)
regions = [
    ("Ansikte", None, 170, 84),
    ("Vänsterhand och sko", [.39, .055, -.30], 186, 92),
    ("Glas", [-.66, .052, -.10], 162, 80),
    ("Filt och kortmål", [.02, 0, .15], 182, 90),
]
for row, seat in enumerate(["4", "1"]):
    cam = cameras[seat]
    samples = []
    modes = [("studio", "Befintlig rumsreflex"), ("mild", "Brown Photostudio 50 %"), ("hdr", "Brown Photostudio 100 %")]
    for column, (setting, label) in enumerate(modes):
        image = Image.open(folder / f"stol-{seat}-{setting}.png").convert("RGB")
        assert image.size == (1600, 900)
        x, y = 8 + 604 * column, 390 * row
        overview.paste(image.resize((598, 336), Image.Resampling.LANCZOS), (x, y + 43))
        ImageDraw.Draw(overview).text((x, y + 5), f"Stol {seat}   /   {label}", font=font, fill=paper)
        x = 10 + column*277
        y = row * 755
        ImageDraw.Draw(details).text((x, y + 6), f"Stol {seat} · " + ["Före","50 %","100 %"][column], font=font, fill=paper)
        sample = []
        for index, (name, point, w, h) in enumerate(regions):
            cx, cy = project(point, cam) if point is not None else {"4": (795, 256), "1": (683, 261)}[seat]
            crop = image.crop((cx-w//2, cy-h//2, cx+w//2, cy+h//2))
            sample.append(np.asarray(crop, dtype=float))
            dy = y + 45 + index * 175
            if column == 0:
                ImageDraw.Draw(details).text((x, dy), name, font=font, fill=paper)
            details.paste(crop.resize((266, 132), Image.Resampling.LANCZOS), (x, dy+35))
        samples.append(sample)
    for (name, _, _, _), before, mild, full in zip(regions, *samples):
        changes = [np.abs(setting-before).mean() for setting in [mild, full]]
        print(f"Stol {seat} · {name}: {changes[0]:.2f} / {changes[1]:.2f} RGB-kodsteg mot befintligt ljus.")
        assert changes[1] > changes[0] > .5, "Urvalet måste reagera på båda ljusstyrkorna."
overview.save(folder / "jamforelse.jpg", quality=92, subsampling=0)
details.save(folder / "detaljer.jpg", quality=95, subsampling=0)
