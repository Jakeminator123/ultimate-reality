"""Jämför samma handpose med två styrkor och två kopplingar till den fasta pendeln."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

folder = Path(__file__).resolve().parent
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 21)
medium = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 23)
background = "#18201d"

# These fixed image regions follow visible skin, the glass silhouette including
# its rim, and a bare patch of felt in the 960 × 540 camera renders.
regions = {
    4: {"hand": (560, 242, 575, 250), "glas": (228, 258, 258, 299), "filt": (531, 327, 544, 335)},
    1: {"hand": (429, 242, 444, 249), "glas": (253, 335, 301, 387), "filt": (565, 303, 578, 310)},
}
detail = {
    4: [(525, 226, 645, 286), (183, 249, 303, 309), (471, 300, 591, 360)],
    1: [(396, 220, 516, 280), (219, 333, 339, 393), (509, 273, 629, 333)],
}

def source(seat, control, light):
    return Image.open(folder / f"stol-{seat}-ruta17-{control}-{light}.png").convert("RGB")

def level(image, box):
    rgb = np.asarray(image.crop(box)) / 255.
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    return linear @ np.array([.2126, .7152, .0722])

def caption(sheet, xy, title, bold=False):
    ImageDraw.Draw(sheet).text(xy, title, fill="#f3eee5", font=medium if bold else font)

def main():
    sheet = Image.new("RGB", (1200, 2 * 384), background)
    crops = Image.new("RGB", (784, 4 * 159 + 42), background)
    results = {}
    for column, title in enumerate(["Hand vid kortskon", "Dricksglas", "Filt vid kortmålet"]):
        caption(crops, (6 + 262 * column, 4), title, True)
    for row, seat in enumerate([4, 1]):
        results[seat] = {}
        for column, (light, name) in enumerate([("steady", "Fast sken"), ("dim", "Dämpat sken")]):
            view = source(seat, "bord", light)
            x, y = 600 * column, 384 * row
            caption(sheet, (x + 10, y + 5), f"Stol {seat} · {name} · ruta 17", True)
            sheet.paste(view.resize((600, 338), Image.Resampling.LANCZOS), (x, y + 39))
            crop_y = 42 + (2 * row + column) * 159
            caption(crops, (6, crop_y), f"Stol {seat} · {name}")
            for i, box in enumerate(detail[seat]):
                crops.paste(view.crop(box).resize((256, 128), Image.Resampling.LANCZOS), (6 + 262 * i, crop_y + 29))
        for name, box in regions[seat].items():
            measures = {}
            for control in ["bakgrund", "bord"]:
                full = level(source(seat, control, "steady"), box)
                dim = level(source(seat, control, "dim"), box)
                measures[control] = {
                    "fast": round(float(full.mean()), 5),
                    "dampat": round(float(dim.mean()), 5),
                    "minskning_procent": round(float((full.mean() - dim.mean()) / full.mean() * 100), 2),
                }
            results[seat][name] = {"pixelruta": box, **measures}
    (folder / "ljusmatning.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    sheet.save(folder / "pendelljus-ruta17.jpg", quality=94, subsampling=0)
    crops.save(folder / "pendelljus-detaljer.jpg", quality=94, subsampling=0)
    print(json.dumps(results, ensure_ascii=False))

if __name__ == "__main__":
    main()
