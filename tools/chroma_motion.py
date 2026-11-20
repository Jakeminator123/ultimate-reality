"""Key a seated dealer's green reference video while keeping its source timestamps."""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

import cv2
import numpy as np


def timeline(path):
    fields = "stream=width,height,avg_frame_rate,r_frame_rate:frame=best_effort_timestamp_time,duration_time"
    payload = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", fields,
        "-show_frames", "-show_streams", "-of", "json", str(path),
    ])
    info = json.loads(payload)
    stream = info["streams"][0]
    pts = [float(frame["best_effort_timestamp_time"]) for frame in info["frames"]]
    if not pts or any(b <= a for a, b in zip(pts, pts[1:])):
        raise ValueError("Filmen behöver ordnade, läsbara bildrutetider.")
    fps = Fraction(stream["avg_frame_rate"])
    if fps <= 0:
        fps = Fraction(stream["r_frame_rate"])
    return stream, fps, [t - pts[0] for t in pts]


def chroma_matte(frame, wooden_chair):
    b, g, r = cv2.split(frame.astype(np.float32))
    dominance = g - np.maximum(r, b)
    strength = np.clip((dominance - 6) / np.maximum(35, 0.36 * g), 0, 1)
    alpha = np.rint(255 * (1 - strength * strength * (3 - 2 * strength))).astype(np.uint8)
    wood_pixels = 0
    if wooden_chair:
        # The input stool has bare wooden legs below the seat. Skin, card and hands are above it.
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower = round(frame.shape[0] * 0.65)
        warm = cv2.inRange(hsv[lower:], (5, 52, 72), (33, 255, 255))
        visible = (warm > 0) & (alpha[lower:] > 0)
        wood_pixels = int(np.count_nonzero(visible))
        # Include the narrow mixed-color fringe immediately against the green.
        wood = cv2.dilate(warm, np.ones((3, 3), np.uint8))
        alpha[lower:][wood > 0] = 0
        # Narrow rubber caps can survive the wood key. Keep hanging trouser legs and boots
        # continuous with the seated body, while removing only small disconnected islands.
        _, components, stats, _ = cv2.connectedComponentsWithStats((alpha[lower:] > 3).astype(np.uint8))
        isolated = (stats[:, cv2.CC_STAT_TOP] > 0) & (stats[:, cv2.CC_STAT_AREA] < alpha.size * 0.002)
        isolated[0] = False
        alpha[lower:][isolated[components]] = 0
    corrected = frame.copy()
    corrected[:, :, 1] = np.minimum(g, np.maximum(r, b) + 2).astype(np.uint8)
    corrected[alpha == 0] = 0
    return np.dstack((corrected, alpha)), wood_pixels


def proof_row(bgr, bgra, pts):
    h, w = bgra.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    checker = np.where((xx // 24 + yy // 24) % 2, 198, 242).astype(np.float32)
    a = bgra[:, :, 3:4].astype(np.float32) / 255
    composite = (bgra[:, :, :3] * a + checker[:, :, None] * (1 - a)).astype(np.uint8)
    size = (560, round(h / w * 560))
    pair = np.hstack((cv2.resize(bgr, size, interpolation=cv2.INTER_AREA),
                      cv2.resize(composite, size, interpolation=cv2.INTER_AREA)))
    pair = cv2.copyMakeBorder(pair, 32, 0, 0, 0, cv2.BORDER_CONSTANT, value=(28, 27, 25))
    for x, label in [(12, "Runway"), (572, "Alfa")]:
        cv2.putText(pair, f"{label}    {pts:.3f} s", (x, 23), cv2.FONT_HERSHEY_SIMPLEX,
                    0.58, (245, 245, 245), 1, cv2.LINE_AA)
    return pair


def encode(directory, fps, pts, output):
    # Constant-rate movies can use the exact source rational, avoiding a resample to integer FPS.
    regular = all(abs(t - i / float(fps)) < 0.00055 for i, t in enumerate(pts))
    if regular:
        inputs = ["-framerate", str(fps), "-i", "frame-%06d.png"]
    else:
        # Millisecond timebase matches WebM and preserves irregular frame spacing.
        lines = ["ffconcat version 1.0"]
        for i, t in enumerate(pts):
            lines.extend([f"file frame-{i:06}.png", "option framerate 1000"])
            if i + 1 < len(pts):
                lines.append(f"duration {pts[i + 1] - t:.9f}")
        (directory / "sequence.ffconcat").write_text("\n".join(lines) + "\n", encoding="ascii")
        inputs = ["-f", "concat", "-safe", "0", "-i", "sequence.ffconcat"]
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", *inputs, "-fps_mode", "passthrough",
                    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "20",
                    "-deadline", "good", "-cpu-used", "4", "-threads", "4", "-row-mt", "1",
                    "-auto-alt-ref", "0", str(output)], cwd=directory, check=True)


def extract(source, destination, wooden_chair=False):
    source, destination = source.resolve(), destination.resolve()
    stream, fps, pts = timeline(source)
    names = ["frilagd.webm", "gron-och-frilagd.jpg", "frilagd-mitt.png", "frilaggning.json"]
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise FileExistsError("Välj en ny utmatningsmapp för en annan version.")
    rows, proof = [], []
    sample = {0, len(pts) // 2, len(pts) - 1}
    with tempfile.TemporaryDirectory(prefix=".paulina-alpha-", dir=destination.parent) as temp:
        work = Path(temp)
        capture = cv2.VideoCapture(str(source))
        try:
            for i, t in enumerate(pts):
                ok, frame = capture.read()
                if not ok or frame.shape[:2] != (stream["height"], stream["width"]):
                    raise ValueError(f"Bildruta {i} kunde inte avkodas i källans storlek.")
                rgba, wood = chroma_matte(frame, wooden_chair)
                mask = rgba[:, :, 3]
                if not cv2.imwrite(str(work / f"frame-{i:06}.png"), rgba):
                    raise OSError(f"Kunde inte spara bildruta {i}.")
                rows.append({"frame": i, "pts": t, "transparent": int(np.count_nonzero(mask == 0)),
                             "opaque": int(np.count_nonzero(mask == 255)), "wood": wood})
                if i in sample:
                    proof.append(proof_row(frame, rgba, t))
            if capture.read()[0]:
                raise ValueError("Avkodaren gav fler bildrutor än filens tidsregister.")
        finally:
            capture.release()
        transparent = work / names[0]
        encode(work, fps, pts, transparent)
        _, _, keyed_pts = timeline(transparent)
        if len(keyed_pts) != len(pts):
            raise ValueError("Antalet bildrutor ändrades i alfafilmen.")
        error = max(abs(a - b) for a, b in zip(pts, keyed_pts))
        if error > 0.0011:
            raise ValueError(f"Alfafilmen avviker {error:.6f} s från källans tidslinje.")
        # Chromium's VP9 alpha plane requires the libvpx decoder for this independent check.
        alpha = subprocess.check_output([
            "ffmpeg", "-nostdin", "-loglevel", "error", "-c:v", "libvpx-vp9", "-i", str(transparent),
            "-vf", "alphaextract", "-frames:v", "1", "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1",
        ])
        if len(alpha) != stream["width"] * stream["height"] or min(alpha) > 5 or max(alpha) < 250:
            raise ValueError("Alfakanalen i den avkodade filmen saknar genomskinlig eller solid yta.")
        if not cv2.imwrite(str(work / names[1]), np.vstack(proof)):
            raise OSError("Kunde inte skriva kontrollbilden.")
        shutil.copyfile(work / f"frame-{len(pts) // 2:06}.png", work / names[2])
        result = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                  "outputSha256": hashlib.sha256(transparent.read_bytes()).hexdigest(),
                  "size": [stream["width"], stream["height"]], "sourceFrameRate": str(fps),
                  "maxPtsDifferenceSeconds": error, "alphaRangeFirstDecodedFrame": [min(alpha), max(alpha)],
                  "removedWarmWoodBelowSeat": wooden_chair, "frames": rows}
        (work / names[3]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
        ready = work / "verified"
        ready.mkdir()
        for name in names:
            (work / name).rename(ready / name)
        ready.rename(destination)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--wooden-chair", action="store_true", help="Remove warm wooden legs below 65%% of frame height.")
    args = parser.parse_args()
    report = extract(args.source, args.directory, args.wooden_chair)
    print(len(report["frames"]), "rutor med verifierad alfa.", report["outputSha256"])
