"""Compare the two portrait films at the same presentation times."""

from bisect import bisect_right
from fractions import Fraction
from io import BytesIO
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw

from compare_anchor_films import caption_font
from compare_motion_views import probe
from material_versions import check, save_version


TRIAL = Path(__file__).resolve().parents[1] / "avatars/paulina/rorelseprov-dans/v1"
SAMPLE_FRAMES = (0, 12, 26, 40, 55, 64, 71, 95)


def samples(film, sample_frames, size, crop):
    video = probe(film)
    times = video.seconds()
    indices = [bisect_right(times, Fraction(frame, 24)) - 1 for frame in sample_frames]
    check(indices == sorted(set(indices)) and indices[0] >= 0, "Filmen täcker inte jämförelsen.")
    check(times[-1] + video.last_duration * video.unit > Fraction(sample_frames[-1], 24),
          "Filmen slutar före sista jämförelsetiden.")
    selection = "+".join(f"eq(n,{n})" for n in indices)
    width, height = size
    filters = [f"select='{selection}'"]
    if crop:
        filters.append("crop=" + ":".join(str(value) for value in crop))
    filters.extend([f"scale={width}:{height}:force_original_aspect_ratio=decrease",
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"])
    encoded = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(film), "-an", "-vf", ",".join(filters),
        "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ])
    byte_count = width * height * 3
    check(len(encoded) == len(indices) * byte_count, "FFmpeg läste fel antal rutor.")
    return [Image.frombytes("RGB", size, encoded[p:p+byte_count])
            for p in range(0, len(encoded), byte_count)]


def comparison(pairs, sample_frames, size, target):
    width, height = size
    row_height = height + 32
    sheet = Image.new("RGB", (width * len(sample_frames), 30 + len(pairs) * row_height), "#19382e")
    draw = ImageDraw.Draw(sheet)
    font = caption_font(17)
    for index, frame in enumerate(sample_frames):
        label = f"{frame/24:.2f} s".replace(".", ",")
        draw.text((index * width + 6, 4), label, font=font, fill="white")
    for row, (label, film, crop) in enumerate(pairs):
        y = 30 + row * row_height
        draw.text((6, y + 3), label, font=font, fill="white")
        for index, picture in enumerate(samples(film, sample_frames, size, crop)):
            sheet.paste(picture, (index * width, y + 32))
    target.parent.mkdir(parents=True, exist_ok=True)
    output = BytesIO()
    sheet.save(output, format="JPEG", quality=94)
    print(save_version(target, output.getvalue()))


def main():
    rig = ("Paulinas 3D-rigg", TRIAL / "visning/rorelsereferens.mp4")
    kling = ("Kling 4 via Runway", TRIAL / "runway/resultat.mp4")
    dest = TRIAL / "granskning"
    comparison([(*rig, None), (*kling, None)], SAMPLE_FRAMES, (144, 256), dest / "samma-tid.jpg")
    # Fixed eye regions in the native 720 × 1280 and 1080 × 1920 films, in FFmpeg's w:h:x:y order.
    eyes = [(*rig, (164, 74, 176, 250)), (*kling, (254, 104, 388, 190))]
    comparison(eyes, (9, 11, 12, 13, 14, 16), (164, 74), dest / "blinkning.jpg")


if __name__ == "__main__":
    main()
