"""Återskapa eller verifiera Paulinas ståspår från originalfoto 01 med lokala SAM-vikter."""

import argparse
import hashlib
import json
import os
import sys
from contextlib import ExitStack
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np
import torch
from PIL import Image

from material_versions import put, sha
from paulina_dance_motion import (
    MODEL,
    OUT,
    PHOTO,
    PHOTO_SHA,
    V4,
    BootSurface,
    Glb,
    hierarchy,
    standing,
)

CPU_TRACK_SHA = "370e908d26d3af9e245efb30ba55cbcc7374ddb0834d399551ac106e29563d9a"
MEASUREMENTS = {
    "pred_joint_coords": (127, 3),
    "mhr_model_params": (204,),
    "shape_params": (45,),
    "pred_keypoints_2d": (70, 2),
}


def original():
    if sha(PHOTO) != PHOTO_SHA:
        raise ValueError("Originalfoto 01 har inte den registrerade SHA-256-summan.")
    with Image.open(PHOTO) as source:
        image = source.convert("RGB")
    size = image.size
    image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
    return image, size


def pack(person, photo_size, inference_size):
    values = {}
    for name, shape in MEASUREMENTS.items():
        value = np.asarray(person[name])
        if (
            value.shape != shape
            or value.dtype != np.float32
            or not np.isfinite(value).all()
        ):
            raise ValueError(
                f"Ogiltig ståskattning i {name}, förväntade {shape} ändliga float32-värden."
            )
        values[name] = value
    out = BytesIO()
    np.savez_compressed(
        out,
        **values,
        source_sha256=PHOTO_SHA,
        source_size=photo_size,
        inference_size=inference_size,
    )
    return out.getvalue()


def infer(image, device):
    os.environ["HF_HUB_OFFLINE"] = "1"
    sys.path.insert(0, str(MODEL.parents[3]))
    from sam_3d_body import SAM3DBodyEstimator, load_sam_3d_body
    from sam_3d_body import sam_3d_body_estimator
    from sam_3d_body.models.meta_arch import sam3d_body
    from sam_3d_body.utils import recursive_to

    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA saknas i aktiv SAM-miljö. CPU-läget kan användas på samma foto."
        )
    torch.set_num_threads(4)
    cache = Path(torch.hub.get_dir()) / "facebookresearch_dinov3_main"
    if not (cache / "hubconf.py").is_file():
        raise FileNotFoundError(f"Den lokala DINOv3-koden behövs i {cache}.")
    hub_load = torch.hub.load

    def load_backbone(repo, name, *args, **kwargs):
        if repo != "facebookresearch/dinov3" or kwargs.get("pretrained", True):
            raise ValueError(f"Okänd backbone eller extern viktkälla: {repo}/{name}.")
        kwargs["source"] = "local"
        return hub_load(str(cache), name, *args, **kwargs)

    with patch.object(torch.hub, "load", load_backbone):
        model, config = load_sam_3d_body(
            str(MODEL.parent.parent / "model.ckpt"), device=device, mhr_path=str(MODEL)
        )
    estimator = SAM3DBodyEstimator(model, config)
    with ExitStack() as scope, torch.inference_mode():
        if device == "cpu":
            # These three CUDA transfers are hardcoded in the installed Meta
            # estimator. Limit the CPU substitutions to this single prediction.
            def to_device(value, target, *args, **kwargs):
                return recursive_to(
                    value,
                    "cpu" if str(target).startswith("cuda") else target,
                    *args,
                    **kwargs,
                )

            scope.enter_context(
                patch.object(sam_3d_body_estimator, "recursive_to", to_device)
            )
            scope.enter_context(patch.object(sam3d_body, "recursive_to", to_device))
            scope.enter_context(
                patch.object(
                    torch.Tensor, "cuda", lambda tensor, *args, **kwargs: tensor.cpu()
                )
            )
        people = estimator.process_one_image(np.asarray(image).copy())
    if len(people) != 1:
        raise ValueError(
            f"Ståoriginal 01 ska ge en person, skattningen gav {len(people)}."
        )
    return people[0]


def verify(track, size, inference_size):
    with np.load(track, allow_pickle=False) as data:
        if (
            str(data["source_sha256"]) != PHOTO_SHA
            or tuple(data["source_size"]) != size
            or tuple(data["inference_size"]) != inference_size
        ):
            raise ValueError(
                "Ståspåret tillhör en annan bild eller beskärningsstorlek."
            )
        repacked = pack(data, size, inference_size)
    archive_hash = sha(track)
    figure = Glb(V4)
    _, _, result = standing(figure, track, BootSurface(figure, hierarchy(figure)[0]))
    return {
        "trackSha256": archive_hash,
        "matchesRecordedCpuExport": archive_hash == CPU_TRACK_SHA,
        "repackedBytesIdentical": archive_hash == hashlib.sha256(repacked).hexdigest(),
        "sourcePhotoSha256": PHOTO_SHA,
        "checkpoint": result["model"],
        "mhrSha256": result["mhrSha256"],
        "modelConfigSha256": sha(MODEL.parent.parent / "model_config.yaml"),
        "modelCheckpointSha256": sha(MODEL.parent.parent / "model.ckpt"),
        "torchVersion": str(torch.__version__),
        "numpyVersion": np.__version__,
        "sourceSizePx": list(size),
        "inferenceSizePx": list(inference_size),
        "mhrJointPositionMaxErrorMm": result["xyzResidualMm"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--device",
        choices=("cpu", "cuda"),
        help="Skatta original 01 om spårfilen saknas.",
    )
    mode.add_argument(
        "--verify",
        action="store_true",
        help="Kontrollera befintligt spår, dess SHA-256 och MHR-leder.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUT / "staende01.npz",
        help="Sökväg till den lokala NPZ-filen.",
    )
    args = parser.parse_args()
    image, size = original()
    status = "verified"
    if args.verify or args.output.exists():
        receipt = verify(args.output, size, image.size)
    else:
        payload = pack(infer(image, args.device), size, image.size)
        with TemporaryDirectory(prefix="paulina-staende-") as temporary:
            staged = Path(temporary) / "staende01.npz"
            staged.write_bytes(payload)
            receipt = verify(staged, size, image.size)
        put(args.output, payload, receipt["trackSha256"])
        status = f"estimated-{args.device}"
    print(
        json.dumps(
            {"status": status, "file": str(args.output.resolve()), **receipt},
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
