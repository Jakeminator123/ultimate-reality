"""Estimate one seated performer's motion from a fixed green-screen video.

Keep presentation timestamps, the camera, and MHR predictions together so a
later character can keep its own shape while following the performance.
"""

import argparse
import io
import json
import os
from pathlib import Path
import subprocess
import sys

import cv2
import numpy as np
import torch

from material_versions import save_version, sha


def frame_clock(path):
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_frames",
        "-show_entries",
        "frame=best_effort_timestamp_time,duration_time:stream=width,height",
        "-of",
        "json",
        str(path),
    ]
    info = json.loads(subprocess.check_output(command))
    frames = info["frames"]
    clock = np.array([float(f["best_effort_timestamp_time"]) for f in frames])
    if len(clock) < 2 or np.any(np.diff(clock) <= 0):
        raise ValueError("Expected a video with increasing frame presentation times.")
    end = clock[-1] + float(frames[-1].get("duration_time", np.median(np.diff(clock))))
    stream = info["streams"][0]
    return clock, end, (stream["width"], stream["height"])


def sample_frames(path, clock, size, rate):
    if rate is None:
        indices = np.arange(len(clock))
    else:
        desired = np.arange(clock[0], clock[-1], 1 / rate)
        right = np.searchsorted(clock, desired).clip(0, len(clock) - 1)
        left = np.maximum(right - 1, 0)
        closest = np.where(abs(clock[left] - desired) < abs(clock[right] - desired), left, right)
        indices = np.unique(np.r_[0, closest, len(clock) - 1])
    selected = set(indices.tolist())
    capture = cv2.VideoCapture(str(path))
    out = []
    try:
        for index in range(len(clock)):
            ok, frame = capture.read()
            if not ok or frame.shape[:2][::-1] != size:
                raise ValueError(f"Frame {index} could not be decoded at the registered size.")
            if index in selected:
                out.append(frame)
        if capture.read()[0]:
            raise ValueError("Decoded video and ffprobe clocks have different lengths.")
    finally:
        capture.release()
    return indices, out


def performer_bounds(frame):
    """Find the main connected foreground island on a chroma-green stage."""
    h, w = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(frame.astype(np.int16))
    green = (hsv[..., 0] > 32) & (hsv[..., 0] < 99) & (g - r > 10) & (g - b > 8)
    foreground = cv2.morphologyEx(
        (~green).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), dtype=np.uint8)
    )
    count, _, stats, _ = cv2.connectedComponentsWithStats(foreground)
    candidates = [row for row in stats[1:count] if row[cv2.CC_STAT_HEIGHT] > h * 0.35]
    if not candidates or green.mean() < 0.2:
        raise ValueError("A persistent green stage and a visible seated performer are required.")
    x, y, width, height, _ = max(candidates, key=lambda row: row[cv2.CC_STAT_AREA])
    return [
        max(0, x - 0.08 * width),
        max(0, y - 0.035 * height),
        min(w, x + 1.08 * width),
        min(h, y + 1.035 * height),
    ]


def red_card(frame, previous, hand_center=None):
    """Track the red stock even edge-on without confusing lips, tattoos or the other hand."""
    h, w = frame.shape[:2]
    anchor = previous if previous is not None else hand_center
    margin = h * (0.085 if previous is not None else 0.19)
    begin = (
        np.zeros(2, dtype=int) if anchor is None else np.maximum(0, np.floor(anchor - margin).astype(int))
    )
    end = np.array([w, h]) if anchor is None else np.minimum([w, h], np.ceil(anchor + margin).astype(int))
    crop = frame[begin[1] : end[1], begin[0] : end[0]]
    b, g, r = cv2.split(crop.astype(np.int16))
    # Skin away from the stock usually contains more green than blue; the
    # card's pale red reflection and its maroon grazing edge both keep red dominance.
    red = (r - g > 55) & (r - b > 45) & (b - g > -10) & (r > 65)
    mask = cv2.morphologyEx(red.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for contour in contours:
        area = cv2.contourArea(contour)
        center, sides, angle = cv2.minAreaRect(contour)
        short, long = sorted(sides)
        if (
            area < max(9, w * h * 0.000013)
            or area > w * h * 0.025
            or short < 0.45
            or long < 0.017 * h
            or long / short > 135
            or area < 0.38 * short * long
        ):
            continue
        center = np.asarray(center) + begin
        drift = np.linalg.norm(center - anchor) / margin if anchor is not None else 0
        if drift > 1:
            continue
        score = area / (1 + 9 * drift**2)
        if best is None or score > best[0]:
            best = (score, cv2.boxPoints((tuple(center), sides, angle)), center)
    if previous is not None:
        # At rest the red print is only two to four pixels high and picks up
        # green from the felt. Reconnect the measured horizontal maroon run.
        dark_red = (r - g > 35) & (r - b > 42) & (b - g > -48) & (r > 64) & (r < 175)
        band = cv2.morphologyEx(dark_red.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((1, 9), np.uint8))
        segments, _ = cv2.findContours(band, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for segment in segments:
            center, sides, angle = cv2.minAreaRect(segment)
            short, long = sorted(sides)
            if not 0.035 * h <= long <= 0.12 * h or not 0.45 <= short <= 0.17 * long:
                continue
            corners = cv2.boxPoints((center, sides, angle)) + begin
            edges = np.roll(corners, -1, axis=0) - corners
            longest = edges[np.linalg.norm(edges, axis=1).argmax()]
            center = np.asarray(center) + begin
            drift = np.linalg.norm(center - previous) / margin
            if np.abs(longest[1]) > 0.32 * long or drift > 0.54:
                continue
            score = long**2 * 0.16 / (1 + 14 * drift**2)
            if best is None or score > best[0]:
                best = (score, corners, center)
        if best is None:
            # A fingertip can merge with the left edge of the card. Measure
            # the visible coloured scanlines instead of the bounding box of
            # that joined hand-and-card component.
            runs = []
            for row in range(
                max(0, int(previous[1] - begin[1] - h * 0.018)),
                min(band.shape[0], int(previous[1] - begin[1] + h * 0.018) + 1),
            ):
                stops = np.flatnonzero(np.diff(np.r_[0, band[row], 0].astype(int)))
                for start, finish in stops.reshape(-1, 2):
                    length = finish - start
                    point = np.array([(start + finish - 1) * 0.5, row]) + begin
                    distance = np.linalg.norm(point - previous)
                    if 0.033 * h <= length <= 0.09 * h and distance < 0.027 * h:
                        runs.append((length / (1 + distance / (h * 0.022)), point, length))
            if runs:
                _, centre, length = max(runs, key=lambda run: run[0])
                joined = [
                    point
                    for _, point, span in runs
                    if span >= length * 0.7 and np.linalg.norm(point - centre) < 5
                ]
                ys = np.array(joined)[:, 1]
                centre = np.array([centre[0], (ys.min() + ys.max()) * 0.5])
                corners = cv2.boxPoints(
                    (tuple(centre), (float(length), float(max(1, ys.max() - ys.min() + 1))), 0.0)
                )
                best = (length, corners, centre)
    if best is None:
        return np.full((4, 2), np.nan), previous
    return best[1], best[2]


def observed_card(video, indices, keypoints):
    """Read the actual image sequence; retain missing detections and the source-frame ordering."""
    rows = {int(frame): i for i, frame in enumerate(indices)}
    output, previous = [], None
    capture = cv2.VideoCapture(str(video))
    try:
        for number in range(int(indices[-1]) + 1):
            ok, frame = capture.read()
            if not ok:
                raise ValueError(f"Cannot inspect the card in source frame {number}.")
            i = rows.get(number)
            if i is not None:
                corners, previous = red_card(frame, previous, keypoints[i, 21:42].mean(axis=0))
                output.append(corners)
    finally:
        capture.release()
    return np.asarray(output)


def front_card_texture(video, first_quad):
    """Rectify the upright source card. Its untouched lower right edge supplies the small finger occlusion."""
    reader = cv2.VideoCapture(str(video))
    try:
        ok, frame = reader.read()
    finally:
        reader.release()
    if not ok or not np.isfinite(first_quad).all():
        raise ValueError("A visible upright first card is required for its photo texture.")
    centre = first_quad.mean(axis=0)
    size = np.ptp(first_quad, axis=0)
    left, top = np.round(centre - size / 2 - [2.7, 2.7]).astype(int)
    right, bottom = np.round(centre + size / 2 + [2.7, 2.7]).astype(int)
    rgb = cv2.cvtColor(frame[top : bottom + 1, left : right + 1], cv2.COLOR_BGR2RGB).copy()
    h, w = rgb.shape[:2]
    corner_w, corner_h = int(np.ceil(w * 0.26)), int(np.ceil(h * 0.31))
    rgb[-corner_h:, :corner_w] = rgb[-corner_h:, -corner_w:][:, ::-1]
    return rgb


def photographed_hands(frame, keypoints):
    """Measure visible skin islands near each hand, with crossed hands marked as occluded."""
    h, w = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    colour = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
    skin = (
        (hsv[..., 0] <= 29)
        & (hsv[..., 1] >= 16)
        & (hsv[..., 1] <= 145)
        & (colour[..., 0] > 57)
        & (colour[..., 1] > 128)
        & (colour[..., 1] < 186)
        & (colour[..., 2] > 68)
        & (colour[..., 2] < 129)
    )
    hand_points = np.stack((keypoints[21:42], keypoints[42:63]))
    centers = hand_points.mean(axis=1)
    radii = np.clip(
        1.6 * np.linalg.norm(hand_points - centers[:, None], axis=2).max(axis=1), h * 0.023, h * 0.12
    )
    found = np.full((2, 2), np.nan, dtype=np.float32)
    if np.linalg.norm(centers[0] - centers[1]) < radii.mean():
        return found
    for side, (center, radius) in enumerate(zip(centers, radii)):
        p0 = np.maximum(0, (center - radius).astype(int))
        p1 = np.minimum([w, h], np.ceil(center + radius).astype(int) + 1)
        if np.any(p0 >= p1):
            continue
        crop = skin[p0[1] : p1[1], p0[0] : p1[0]].astype(np.uint8)
        crop = cv2.morphologyEx(crop, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        _, _, stats, centroids = cv2.connectedComponentsWithStats(crop)
        area = stats[1:, cv2.CC_STAT_AREA]
        offset = np.linalg.norm(centroids[1:] + p0 - center, axis=1)
        eligible = (area >= max(10, radius**2 * 0.065)) & (offset < radius * 0.8)
        if eligible.any():
            pick = np.argmax(np.where(eligible, area / (1 + 4 * offset / radius), 0))
            found[side] = centroids[pick + 1] + p0
    return found


def track(video, sam, output, rate):
    if rate is not None and not 1 <= rate <= 60:
        raise ValueError("Sample rate must be between 1 and 60 Hz.")
    fingerprint = sha(video)
    clock, end, size = frame_clock(video)
    effective_rate = len(clock) / (end - clock[0]) if rate is None else rate
    if output.is_file():
        with np.load(output, allow_pickle=False) as previous:
            if (
                str(previous["video_sha256"]) == fingerprint
                and np.isclose(float(previous["sample_rate"]), effective_rate)
                and (rate is not None or len(previous["frame_indices"]) == len(clock))
            ):
                print(f"Verified existing motion {output}", flush=True)
                return
        raise ValueError("This motion filename already belongs to another video or sample rate.")
    indices, samples = sample_frames(video, clock, size, rate)
    boxes = np.array([performer_bounds(frame) for frame in samples])
    bbox = np.r_[boxes[:, :2].min(axis=0), boxes[:, 2:].max(axis=0)].astype(np.float32)[None]
    os.environ["HF_HUB_OFFLINE"] = "1"
    sys.path.insert(0, str(sam))
    from sam_3d_body import SAM3DBodyEstimator, load_sam_3d_body

    weights = sam / "checkpoints/sam-3d-body-dinov3"
    skeleton = weights / "assets/mhr_model.pt"
    torch.set_num_threads(4)
    cv2.setNumThreads(4)
    if not torch.cuda.is_available():
        raise RuntimeError("SAM video tracking requires the local CUDA runtime.")
    model, config = load_sam_3d_body(str(weights / "model.ckpt"), device="cuda", mhr_path=str(skeleton))
    estimator = SAM3DBodyEstimator(model, config)
    fields = [
        "mhr_model_params",
        "shape_params",
        "focal_length",
        "pred_cam_t",
        "pred_joint_coords",
        "pred_keypoints_2d",
        "pred_keypoints_3d",
    ]
    estimates = {name: [] for name in fields}
    hand_pixels = []
    for number, (index, frame) in enumerate(zip(indices, samples), 1):
        with torch.inference_mode():
            people = estimator.process_one_image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), bboxes=bbox)
        if len(people) != 1:
            raise ValueError(f"Frame {index}: expected one person, found {len(people)}.")
        for name in fields:
            value = np.asarray(people[0][name])
            if not np.isfinite(value).all():
                raise ValueError(f"Frame {index}: non-finite {name}.")
            estimates[name].append(value)
        hand_pixels.append(photographed_hands(frame, estimates["pred_keypoints_2d"][-1]))
        print(f"SAM {number}/{len(indices)}, source frame {index} at {clock[index]:.3f} s", flush=True)
    result = io.BytesIO()
    np.savez_compressed(
        result,
        video_sha256=fingerprint,
        mhr_sha256=sha(skeleton),
        source_clock=clock,
        source_end=end,
        frame_indices=indices,
        times=clock[indices] - clock[0],
        sample_rate=effective_rate,
        frame_size=size,
        crop=bbox,
        photographed_hands_2d=hand_pixels,
        **estimates,
    )
    print(save_version(output, result.getvalue()), flush=True)


if __name__ == "__main__":
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--sam", type=Path, default=Path(os.environ.get("SAM3D_ROOT", project.parent / "sam-3d-body"))
    )
    parser.add_argument(
        "--sample-rate",
        type=float,
        help="Optional subset rate in Hz. Defaults to every decoded source frame.",
    )
    args = parser.parse_args()
    track(args.video.resolve(), args.sam.resolve(), args.output, args.sample_rate)
