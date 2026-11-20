"""Compare Paulina's photographed entry and two generated deals on their original timeline."""

import argparse
import json
import subprocess
from fractions import Fraction
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw, ImageFont

from compare_motion_views import probe
from material_versions import check, json_bytes, put, read_json, sha


TRIAL = Path(__file__).resolve().parents[1] / "avatars/paulina/prov-ankare/v1"
SHOTS = [
    ("a1-foto-front", "Vila till kortskon · Grok med startbild"),
    ("a1-kling-slutbild", "Vila till kortskon · Kling 4 med start- och slutbild"),
    ("a23-rigg-front", "Giv framifrån · Grok från 3D-ankaret"),
    ("a23-rigg-sida70", "Giv från 70° · Grok med samma givprompt"),
]
WIDTH, HEIGHT, HEADER = 768, 432, 42


def caption_font(size):
    for filename in ("segoeui.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(filename, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def make_header(path, pair):
    image = Image.new("RGB", (WIDTH * len(pair), HEADER), "#172923")
    draw = ImageDraw.Draw(image)
    font = caption_font(24)
    for index, (_, label) in enumerate(pair):
        draw.text((index * WIDTH + 14, HEADER // 2), label, font=font, fill="white", anchor="lm")
    image.save(path)


def run_ffmpeg(*args):
    subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", *map(str, args)], check=True)


def compare(trial):
    sources = []
    shots = []
    for key, _ in SHOTS:
        folder = trial / "runway" / key
        source = folder / "original.mp4"
        order, delivery = read_json(folder / "utkast.json"), read_json(folder / "output.json")
        check(sha(source) == delivery["sha256"], f"Fel originalfilm för {key}.")
        video = probe(source)
        check([video.width, video.height] == [1280, 720] and video.rotation == 0 and video.pixel_aspect == 1,
              f"Oväntad orientering eller bildstorlek för {key}.")
        check(len(video.pts) == delivery["frames"], f"Fel antal rutor för {key}.")
        sources.append(source)
        shots.append({"key": key, "version": order["version"], "model": order["model"], "jobId": delivery["taskId"],
                      "sourceSha256": delivery["sha256"], "firstImageSha256": order["sourceSha256"],
                      "prompt": order["prompt"], "lastImageSha256": order.get("lastSourceSha256"),
                      "sentFirstJpegSha256": order["inputJpegSha256"], "quotedCredits": order["quotedCredits"], "video": video})

    timeline = shots[0]["video"].seconds()
    frame_duration = timeline[1] - timeline[0]
    check(all(time == index * frame_duration for index, time in enumerate(timeline)), "Oregelbunden bildtakt i fotofilmen.")
    for shot in shots:
        video = shot.pop("video")
        check(video.seconds() == timeline and video.last_duration * video.unit == frame_duration,
              f"Olika bildtider i {shot['key']}, jämförelsen behöver anpassas till källorna.")
    check(shots[2]["prompt"] == shots[3]["prompt"], "3D-tagningarna måste ha samma givprompt.")
    check(shots[0]["prompt"] == shots[1]["prompt"] and shots[0]["sentFirstJpegSha256"] == shots[1]["sentFirstJpegSha256"],
          "Fototagningarna måste ha identisk startbild och text.")
    fps = Fraction(1, 1) / frame_duration
    destination = trial / "visning"
    destination.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as scratch:
        work = Path(scratch)
        headings = [work/"foto-rubriker.png", work/"rigg-rubriker.png"]
        film, poster = work/"fyra-filmprov.mp4", work/"fyra-filmprov.jpg"
        make_header(headings[0], SHOTS[:2])
        make_header(headings[1], SHOTS[2:])
        inputs = [option for source in sources for option in ("-i", source)]
        scales = [f"[{i}:v]scale={WIDTH}:{HEIGHT},setsar=1,setpts=PTS-STARTPTS[view{i}]" for i in range(len(SHOTS))]
        for head in headings:
            inputs.extend(["-loop", 1, "-framerate", str(fps), "-i", head])
        filters = ";".join([*scales, "[view0][view1]hstack[foto]", "[view2][view3]hstack[rigg]",
                            "[4:v][foto][5:v][rigg]vstack=4:shortest=1[out]"])
        run_ffmpeg(*inputs,
                   "-filter_complex", filters, "-map", "[out]", "-an", "-frames:v", len(timeline),
                   "-c:v", "libx264", "-crf", "17", "-threads", "4", "-pix_fmt", "yuv420p", "-movflags", "+faststart", film)
        compared = probe(film)
        check(compared.seconds() == timeline and compared.last_duration * compared.unit == frame_duration,
              "Jämförelsefilmens bildtider avviker från originalen.")
        check([compared.width, compared.height] == [2 * WIDTH, 2 * (HEADER + HEIGHT)], "Fel panelstorlek.")
        chosen = min(range(len(timeline)), key=lambda index: abs(timeline[index] - Fraction(3, 2)))
        run_ffmpeg("-i", film, "-vf", f"select=eq(n\\,{chosen})", "-frames:v", 1, "-q:v", 2, poster)
        report = {"shots": shots, "frames": len(timeline), "frameRate": str(fps), "firstFrameSeconds": 0,
                  "lastFrameStartSeconds": float(timeline[-1]), "playbackDurationSeconds": float(timeline[-1] + frame_duration),
                  "comparisonPtsDifferenceSeconds": 0, "posterFrame": chosen,
                  "outputSha256": sha(film), "posterSha256": sha(poster)}
        receipt = work/"jämförelse.json"
        receipt.write_bytes(json_bytes(report))
        for asset in (film, poster, receipt):
            put(destination/asset.name, asset, sha(asset))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trial", type=Path, default=TRIAL)
    result = compare(parser.parse_args().trial)
    print(json.dumps({"frames": result["frames"], "fps": result["frameRate"], "sha256": result["outputSha256"]}))
