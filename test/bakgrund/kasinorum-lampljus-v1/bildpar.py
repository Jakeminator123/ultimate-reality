"""Make labelled comparisons and identical crops from the four unretouched camera renders."""
from pathlib import Path
import json
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent
cameras = json.loads((folder / "../../bord/filtdjup-v1/matt.json").read_text())["cameras"]
background, letter = "#14221c", "#f3eee3"
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 21)
heading = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 25)


def project(point, camera):
    eye = np.array(camera["eye"])
    forward = np.array(camera["aim"]) - eye
    forward /= np.linalg.norm(forward)
    right = np.cross(forward, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    ray = np.array(point) - eye
    scale = 450 / math.tan(math.radians(camera["fovVertical"] / 2)) / (forward @ ray)
    return round(800 + scale * (right @ ray)), round(450 - scale * (up @ ray))


def label(sheet, x, y, text, face=font):
    ImageDraw.Draw(sheet).text((x, y), text, font=face, fill=letter)


def main():
    width, height = 600, 338
    overview = Image.new("RGB", (2 * width + 24, 2 * (height + 45) + 10), background)
    regions = [
        ("Vänsterhand och sko", [.39, .055, -.30], (236, 132)),
        ("Dricksglas", [-.66, .052, -.10], (284, 160)),
        ("Filt vid kortmålet", [.02, .0, .15], (252, 142)),
    ]
    for row, seat in enumerate(["4", "1"]):
        details = Image.new("RGB", (820, 830), background)
        label(details, 12, 6, f"Stol {seat}  ·  Före", heading)
        label(details, 416, 6, "Efter", heading)
        for col, (mode, name) in enumerate([("fore", "Före · studioljus"), ("efter", "Efter · rummets armaturer")]):
            image = Image.open(folder / f"stol-{seat}-{mode}.png").convert("RGB")
            assert image.size == (1600, 900)
            x, y = 8 + col * (width + 8), row * (height + 45)
            label(overview, x, y + 4, f"Stol {seat}   /   {name}")
            overview.paste(image.resize((width, height), Image.Resampling.LANCZOS), (x, y + 38))
            for index, (title, point, (w, h)) in enumerate(regions):
                cx, cy = project(point, cameras[seat])
                left, top = cx - w // 2, cy - h // 2
                crop = image.crop((left, top, left + w, top + h))
                dy = 49 + index * 261
                if col == 0:
                    label(details, 12, dy, title)
                details.paste(crop.resize((398, 223), Image.Resampling.LANCZOS), (8 + 406 * col, dy + 29))
        details.save(folder / f"stol-{seat}-detaljer.jpg", quality=95, subsampling=0)
    overview.save(folder / "jamforelse.jpg", quality=94, subsampling=0)


if __name__ == "__main__":
    main()
