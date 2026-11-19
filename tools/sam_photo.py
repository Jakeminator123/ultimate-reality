"""Fotoprovet bygger på verktyg/sam_snabbprov.py i Dealer_3D_labbpaket.zip."""

import os
import sys


def save_sheet(path, rgb, person, faces):
    import numpy as np
    from PIL import Image, ImageDraw
    from sam_3d_body.visualization.renderer import Renderer

    height, width = rgb.shape[:2]
    renderer = Renderer(focal_length=person["focal_length"], faces=faces)
    sheet = Image.new("RGB", (3 * width, height + 28), "white")
    sheet.paste(Image.fromarray(rgb), (0, 28))
    bgr = np.ascontiguousarray(rgb[:, :, ::-1])
    for panel, rotated in ((1, False), (2, True)):
        background = np.full_like(bgr, 245) if rotated else bgr.copy()
        pixels = renderer(
            person["pred_vertices"], person["pred_cam_t"].copy(), background,
            side_view=rotated, rot_angle=45, mesh_base_color=(0.64, 0.73, 0.84),
            scene_bg_color=(1, 1, 1),
        )
        rendered_rgb = (np.clip(pixels[:, :, ::-1], 0, 1) * 255).astype(np.uint8)
        sheet.paste(Image.fromarray(rendered_rgb), (panel * width, 28))
    draw = ImageDraw.Draw(sheet)
    for index, label in enumerate(("Foto", "SAM / uppskattad kamera", "SAM / vriden 45 grader")):
        draw.text((index * width + 6, 8), label, fill="black")
    sheet.save(path)


def estimate(repo, sources, run, mesh_only):
    os.environ["HF_HUB_OFFLINE"] = "1"
    sys.path.insert(0, str(repo))
    import numpy as np
    import torch
    from PIL import Image, ImageOps
    from sam_3d_body import SAM3DBodyEstimator, load_sam_3d_body

    weights = repo / "checkpoints" / "sam-3d-body-dinov3"
    checkpoint = weights / "model.ckpt"
    mhr = weights / "assets" / "mhr_model.pt"
    for required in (checkpoint, weights / "model_config.yaml", mhr):
        if not required.is_file():
            raise FileNotFoundError(required)
    if not torch.cuda.is_available():
        raise RuntimeError("SAM-miljön hittar ingen CUDA-GPU.")
    model, config = load_sam_3d_body(str(checkpoint), device="cuda", mhr_path=str(mhr))
    estimator = SAM3DBodyEstimator(model, config)
    faces = np.asarray(estimator.faces)
    fields = ("pred_vertices", "pred_cam_t", "focal_length", "pred_keypoints_2d",
              "pred_keypoints_3d", "pred_joint_coords", "hand_pose_params",
              "body_pose_params", "mhr_model_params", "shape_params", "scale_params")
    for index, path in enumerate(sources, 1):
        with Image.open(path) as image:
            photo = ImageOps.exif_transpose(image).convert("RGB")
        original_size = photo.size
        photo.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        rgb = np.asarray(photo)
        with torch.inference_mode():
            people = estimator.process_one_image(rgb.copy())
        if len(people) != 1:
            raise ValueError(f"{path.name}: förväntade en kropp, fick {len(people)}.")
        person = people[0]
        prefix = f"{index:02d}-{path.stem}"
        np.savez_compressed(run / (prefix + ".npz"), faces=faces, original_size=original_size,
                            inference_size=photo.size, **{key: person[key] for key in fields})
        with (run / (prefix + ".obj")).open("w", encoding="utf-8") as obj:
            obj.write("# SAM 3D Body. Camera translation is stored separately in NPZ.\n")
            np.savetxt(obj, person["pred_vertices"], fmt="v %.7f %.7f %.7f")
            np.savetxt(obj, faces + 1, fmt="f %d %d %d")
        if not mesh_only:
            save_sheet(run / (prefix + ".png"), rgb, person, faces)
