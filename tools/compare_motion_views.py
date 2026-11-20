"""Place the Kling original beside the two registered Paulina cameras, one source frame at a time."""

import argparse
from dataclasses import dataclass
from fractions import Fraction
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

from material_versions import check, json_bytes, put, read_json, sha


DEFAULT_TRIAL = Path(__file__).resolve().parents[1] / "avatars/paulina/prov-70/v1"
MAX_INPUT_DRIFT = Fraction(1, 1000)


@dataclass
class Video:
    width: int
    height: int
    pixel_aspect: Fraction
    rotation: int
    unit: Fraction
    pts: list[int]
    last_duration: int

    def seconds(self):
        return [(p - self.pts[0]) * self.unit for p in self.pts]

    def dimensions(self):
        return [self.width, self.height]


def probe(path):
    fields = ("stream=width,height,sample_aspect_ratio,time_base,duration_ts,start_pts:"
              "stream_side_data=rotation:frame=best_effort_timestamp,duration")
    data = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames", "-show_streams",
        "-show_entries", fields, "-of", "json", str(path),
    ]))
    stream, frames = data["streams"][0], data["frames"]
    pts = [int(frame["best_effort_timestamp"]) for frame in frames]
    check(pts and all(b > a for a, b in zip(pts, pts[1:])), f"Oordnade eller saknade bildtider i {path.name}.")
    sar = stream.get("sample_aspect_ratio", "1:1")
    sar = Fraction(1) if sar in ("N/A", "0:1") else Fraction(sar.replace(":", "/"))
    rotation = next((int(side["rotation"]) for side in stream.get("side_data_list", []) if "rotation" in side), 0)
    check(rotation % 90 == 0, f"{path.name} har okänd visningsrotation.")
    duration = frames[-1].get("duration")
    if not duration:
        duration = int(stream["start_pts"]) + int(stream["duration_ts"]) - pts[-1]
    check(int(duration) > 0, f"Sista bildrutans visningstid saknas i {path.name}.")
    return Video(stream["width"], stream["height"], sar, rotation, Fraction(stream["time_base"]), pts, int(duration))


def pts_expression(ticks, start=0, end=None):
    # A balanced lookup also covers variable-rate captures, without matching frames by rounded times.
    end = len(ticks) if end is None else end
    if end - start == 1:
        return str(ticks[start])
    step = ticks[start + 1] - ticks[start]
    if all(ticks[i] == ticks[start] + (i-start)*step for i in range(start+2, end)):
        return f"({ticks[start]}+(N-{start})*{step})"
    middle = (start + end) // 2
    left = pts_expression(ticks, start, middle)
    right = pts_expression(ticks, middle, end)
    return f"if(lt(N,{middle}),{left},{right})"


def header(path, width, height):
    image = Image.new("RGB", (width, height), "#172923")
    font_size = max(12, round(height * 22 / 46))
    try:
        font = ImageFont.truetype("segoeui.ttf", size=font_size)
    except OSError:
        font = ImageFont.truetype("DejaVuSans.ttf", size=font_size)
    ImageDraw.Draw(image).text((round(height * 20 / 46), round(height * 31 / 46)),
                               "Kling · original", font=font, fill="#f2eee4", anchor="ls")
    image.save(path)


def compare(trial):
    out = trial / "visning"
    source_file, pair_file = trial / "runway/original.mp4", out / "front-och-70.mp4"
    rendering_file = out / "rendering.json"
    rendering_hash = sha(rendering_file)
    rendering = read_json(rendering_file)
    source_hash, pair_hash = sha(source_file), sha(pair_file)
    check(source_hash == rendering["sourceVideoSha256"] and pair_hash == rendering["outputSha256"],
          "Källfilmen och kamerafilmen måste matcha den registrerade renderingen.")
    source, pair = probe(source_file), probe(pair_file)
    src_sec, pair_sec = source.seconds(), pair.seconds()
    count = len(src_sec)
    check(count == len(pair_sec) == rendering["frames"], "Källfilmen och kamerafilmen har olika antal rutor.")
    pair_drift = max(abs(a-b) for a, b in zip(src_sec, pair_sec))
    check(pair_drift < MAX_INPUT_DRIFT, "Källfilmen och kamerafilmen har olika bildtider.")
    selected = rendering["selectedSourceFrame"]
    check(0 <= selected < count and abs(float(src_sec[selected])-rendering["selectedTimeSeconds"]) < .001,
          "Den valda källrutan har en annan tid i renderingen.")
    front_png = out / "pose-front.png"
    check(sha(front_png) == rendering["stills"][front_png.name], "Frontvyn har fel version.")
    with Image.open(front_png) as front:
        view_width, view_height = front.size
    head = pair.height - view_height
    check(pair.width == 2*view_width and [pair.width, pair.height] == [rendering["width"], rendering["height"]]
          and head > 0 and pair.rotation % 360 == 0 and pair.pixel_aspect == 1, "Kameraparets bildmått avviker.")
    dar = Fraction(source.width, source.height) * source.pixel_aspect
    if source.rotation % 180 != 0:
        dar = 1/dar
    source_width = max(2, 2*round(view_height*dar/2))
    denominator = source.unit.denominator
    ticks = [(p-source.pts[0])*source.unit.numerator for p in source.pts]
    movie_name, still_name = "runway-front-70.mp4", "runway-front-70.jpg"
    # Match decoded frame N on both inputs before restoring every exact Kling timestamp.
    # A framesync join on independent rounded PTS can silently repeat an earlier camera frame.
    with tempfile.TemporaryDirectory(prefix="paulina-jamforelse-") as staging:
        stage = Path(staging)
        title, filters = stage/"titel.png", stage/"filter.txt"
        movie, still = stage/movie_name, stage/still_name
        header(title, source_width, head)
        index_clock = f"settb=1/{denominator},setpts=N*{denominator}"
        filters.write_text(
            f"[0:v:0]scale={source_width}:{view_height}:flags=lanczos,setsar=1,"
            f"pad={source_width}:{pair.height}:0:{head}:color=0x172923,{index_clock}[source];\n"
            "[2:v:0]format=yuva420p,setpts=PTS-STARTPTS[header];\n"
            "[source][header]overlay=eof_action=repeat:repeatlast=1[left];\n"
            f"[1:v:0]{index_clock}[cameras];\n"
            f"[left][cameras]hstack=inputs=2:shortest=1,settb=1/{denominator},"
            f"setpts='{pts_expression(ticks)}'[comparison]\n", encoding="utf-8",
        )
        start = float(source.pts[0]*source.unit)
        end = float((source.pts[-1]+source.last_duration)*source.unit)
        last_ticks = source.last_duration * source.unit.numerator
        last_packet = f"setts=pts=PTS:dts=DTS:duration='if(eq(PTS,{ticks[-1]}),{last_ticks},DURATION)'"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-copyts",
                        "-i", str(source_file), "-i", str(pair_file), "-i", str(title),
                        "-filter_complex_threads", "4", "-/filter_complex", str(filters),
                        "-map", "[comparison]", "-map", "0:a:0?", "-fps_mode:v", "passthrough",
                        "-enc_time_base:v", f"1/{denominator}", "-video_track_timescale", str(denominator),
                        "-c:v", "libx264", "-threads:v", "4", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
                        "-bsf:v", last_packet,
                        "-af", f"atrim=start={start:.9f}:end={end:.9f},asetpts=PTS-({start:.9f})/TB",
                        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(movie)], check=True)
        delivered = probe(movie)
        output_sec = delivered.seconds()
        check(delivered.dimensions() == [source_width+pair.width, pair.height] and len(output_sec) == count
              and delivered.pixel_aspect == 1 and delivered.rotation % 360 == 0,
              "Exporten har fel bildmått eller antal rutor.")
        check(delivered.pts[0] == 0 and output_sec == src_sec, "Exportens bildtider avviker från Kling-originalet.")
        check(delivered.last_duration * delivered.unit == source.last_duration * source.unit,
              "Exportens sista ruta har en annan visningstid än Kling-originalet.")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(movie),
                        "-vf", f"select=eq(n\\,{selected})", "-frames:v", "1", "-q:v", "2", str(still)], check=True)
        with Image.open(still) as image:
            check(list(image.size) == delivered.dimensions(), "Stillbilden har fel mått.")
        check(sha(rendering_file) == rendering_hash and sha(source_file) == source_hash and sha(pair_file) == pair_hash,
              "Ett källunderlag ändrades under jämförelsen.")
        evidence = {
            "sourceVideoSha256": source_hash, "pairVideoSha256": pair_hash, "renderingSha256": rendering_hash,
            "outputSha256": sha(movie), "stillSha256": sha(still), "frames": count,
            "selectedSourceFrame": selected, "selectedTimeSeconds": float(src_sec[selected]),
            "sourceSizePx": source.dimensions(), "sourcePixelAspect": str(source.pixel_aspect),
            "sourceRotationDegrees": source.rotation, "pairSizePx": pair.dimensions(), "outputSizePx": delivered.dimensions(),
            "headerHeightPx": head, "panels": [
                {"view": "Kling", "x": 0, "contentSizePx": [source_width, view_height]},
                {"view": "0°", "x": source_width, "contentSizePx": [view_width, view_height]},
                {"view": "+70°", "x": source_width + view_width, "contentSizePx": [view_width, view_height]},
            ],
            "sourceTimeBase": str(source.unit), "pairTimeBase": str(pair.unit), "outputTimeBase": str(delivered.unit),
            "maximumPairPtsErrorSeconds": float(pair_drift), "maximumOutputPtsErrorSeconds": 0,
            "sourceLastFrameDurationSeconds": float(source.last_duration*source.unit),
            "outputLastFrameDurationSeconds": float(delivered.last_duration*delivered.unit),
            "ptsColumns": ["sourceFrame", "sourcePts", "pairPts", "outputPts"],
            "pts": [[i, a, b, c] for i, (a, b, c) in enumerate(zip(source.pts, pair.pts, delivered.pts))],
        }
        record = stage/"runway-front-70.json"
        record.write_bytes(json_bytes(evidence))
        files = (movie, still, record)
        for file in files:
            target = out/file.name
            check(not target.exists() or sha(target) == sha(file), f"Versionskonflikt i {target.name}.")
        for file in files:
            put(out/file.name, file, sha(file))
    return evidence


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trial", type=Path, default=DEFAULT_TRIAL)
    result = compare(parser.parse_args().trial)
    print(f"{result['frames']} rutor, vald källruta {result['selectedSourceFrame']}, "
          f"{result['outputSizePx']}, maxavvikelse {result['maximumOutputPtsErrorSeconds']} s")
