"""Visa fyra tryck på samma 63 x 89 mm kort i samma projektion."""

from pathlib import Path
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
RED = (152, 1, 9)
WHITE_INK = (241, 240, 242)
WHITE_TABLE = (245, 243, 245)
GREEN_FELT = (16, 46, 31)
LIGHT_VIOLET = (222, 198, 250)
DARK_VIOLET = (111, 67, 158)
DESIGNS = [
    ("Nuvarande rygg", "Vit ram och vit punkt", True, False, WHITE_INK),
    ("Rött till kanten", "Vit punkt", False, False, WHITE_INK),
    ("X + mörklila", "Rött till kanten", False, True, DARK_VIOLET),
    ("X + ljuslila", "Rött till kanten", False, True, LIGHT_VIOLET),
]


def card_texture(rim, cross, dot_colour):
    # Four texture pixels per millimetre. The 63 x 89 mm format comes from SKO-03.
    texture = Image.new("RGBA", (252, 356))
    draw = ImageDraw.Draw(texture)
    draw.rounded_rectangle((0, 0, 251, 355), radius=12, fill=WHITE_INK if rim else RED)
    if rim:
        draw.rounded_rectangle((12, 12, 239, 343), radius=6, fill=RED)
    if cross:
        draw.line((78, 123, 174, 233), fill=WHITE_INK, width=12)
        draw.line((174, 123, 78, 233), fill=WHITE_INK, width=12)
    draw.ellipse((28, 28, 52, 52), fill=dot_colour)
    return texture


def project(texture, tilt, background):
    # Pinhole camera 450 mm away, 450 px focal length. Width head-on is 63 px.
    angle = math.radians(tilt)
    roll = math.radians(-14)
    projected = []
    for x, y in [(-31.5, -44.5), (31.5, -44.5), (31.5, 44.5), (-31.5, 44.5)]:
        scale = 450 / (450 + x * math.sin(angle))
        u, v = x * math.cos(angle) * scale, y * scale
        projected.append((58 + u * math.cos(roll) - v * math.sin(roll),
                          60 + u * math.sin(roll) + v * math.cos(roll)))
    source = np.float32([(0, 0), (251, 0), (251, 355), (0, 355)])
    transform = cv2.getPerspectiveTransform(source, np.float32(projected) * 4)
    rgba = np.asarray(texture, dtype=np.float32) / 255
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    warped = cv2.warpPerspective(rgba, transform, (116 * 4, 120 * 4))
    rgb = warped[:, :, :3] * 255 + (1 - warped[:, :, 3:4]) * background
    return cv2.resize(rgb, (116, 120), interpolation=cv2.INTER_AREA)


def simulate(texture, angles, background):
    frames = [project(texture, angle, np.array(background)) for angle in angles]
    return Image.fromarray(np.mean(frames, axis=0).round().astype("uint8"))


def font(size, bold=False):
    return ImageFont.truetype("segoeuib.ttf" if bold else "segoeui.ttf", size)


def main():
    scenarios = [
        ("0°", "Vit bakgrund", [0], WHITE_TABLE),
        ("60°", "Vit bakgrund", [60], WHITE_TABLE),
        ("72–84°", "Simulerad oskärpa", np.linspace(72, 84, 13), WHITE_TABLE),
        ("60°", "Grön filt", [60], GREEN_FELT),
    ]
    sheet = Image.new("RGB", (1060, 882), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 12), "Kortets kontur och riktning", font=font(29, True), fill="#202326")
    draw.text((20, 58), "Samma kort och kamera i varje rad. Kortsidan är 63 px framifrån före förstoring.",
              font=font(17), fill="#50565a")
    for i, (name, description, rim, cross, dot_colour) in enumerate(DESIGNS):
        x = 190 + i * 216
        draw.text((x, 97), name, font=font(19, True), fill="#202326")
        draw.text((x, 125), description, font=font(15), fill="#50565a")
        texture = card_texture(rim, cross, dot_colour)
        for j, (title, detail, angles, background) in enumerate(scenarios):
            y = 157 + j * 175
            preview = simulate(texture, angles, background).resize((164, 170), Image.Resampling.NEAREST)
            sheet.paste(preview, (x, y))
            if i == 0:
                draw.text((20, y + 57), title, font=font(23, True), fill="#202326")
                draw.text((20, y + 94), detail, font=font(15), fill="#50565a")
    draw.text((20, 856), "Lutningen gäller kortets långa axel. Oskärpeprovet är medelvärdet av 13 projektioner.",
              font=font(14), fill="#50565a")
    sheet.save(OUT / "jamforelse.png")
    card_texture(False, True, LIGHT_VIOLET).save(OUT / "provrygg.png")


if __name__ == "__main__":
    main()
