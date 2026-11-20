"""Measure frame-to-frame rotation of the deforming forearm and wrist joints in a dealer take."""
import argparse
import json
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation, Slerp

from paulina_utseende import Glb, sha


def rotation_steps(times, values, sampling):
    """Geodesic angle in local joint space. Sign-equivalent quaternions give the same pose."""
    if len(times) == 1:
        return np.zeros(len(sampling) - 1)
    rotations = Slerp(times, Rotation.from_quat(values))(np.clip(sampling, times[0], times[-1]))
    return np.rad2deg((rotations[:-1].inv() * rotations[1:]).magnitude())


def arm_rotation_report(model_file, first, last, fps):
    if last <= first or first < 0 or fps <= 0:
        raise ValueError("Ange ett giltigt rutintervall och en positiv bildfrekvens.")
    model = Glb(model_file)
    skin, = model.doc["skins"]
    clip, = model.doc["animations"]
    deforming = set(skin["joints"])
    names = model.doc["nodes"]
    times = np.arange(first, last + 1) / fps
    sides = {"l": [], "r": []}
    for channel in clip["channels"]:
        target = channel["target"]
        if target["path"] != "rotation" or target["node"] not in deforming:
            continue
        name = names[target["node"]]["name"]
        side, _, joint = name.partition("_")
        if side not in sides or not joint.startswith(("lowarm_twist", "wrist")):
            continue
        sampler = clip["samplers"][channel["sampler"]]
        if sampler.get("interpolation", "LINEAR") != "LINEAR":
            raise ValueError(f"{name} behöver mätas med tagningens interpolationsmetod.")
        steps = rotation_steps(model.read(sampler["input"]).ravel(), model.read(sampler["output"]), times)
        peak = int(np.argmax(steps))
        sides[side].append(dict(joint=name, fromFrame=first + peak, toFrame=first + peak + 1,
                                degrees=round(float(steps[peak]), 3)))
    for rows in sides.values():
        rows.sort(key=lambda step: -step["degrees"])
    return dict(modelSHA256=sha(model_file), firstFrame=first, lastFrame=last, fps=fps,
                localRotationPeaksDegrees=sides)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("--first", type=int, default=0)
    parser.add_argument("--last", type=int, required=True)
    parser.add_argument("--fps", type=float, required=True)
    args = parser.parse_args()
    print(json.dumps(arm_rotation_report(args.model, args.first, args.last, args.fps), ensure_ascii=False, indent=2))
