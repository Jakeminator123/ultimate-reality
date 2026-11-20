"""För in drag från Paulinas riktiga sittfoto på den synliga ansiktshuden i P4-given."""

import argparse
import hashlib
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator

from material_versions import put, sha
from paulina_deal_p4 import Glb, ROOT, compact, read_exported_motion
from paulina_trial_surface import image_buffer, sample_pixels, weighted
from paulina_utseende import mix, rgb_at, unit

TRIAL = ROOT / "avatars/paulina/giv-plats-4"
SOURCE_PHOTO = ROOT / "avatars/paulina/03_sittande_bakgrund.png"
REFERENCE = TRIAL / "v1/visning"
PHOTO_SHA = "5a48e0e6e1286b5310ee42f8c93fad33d3f3d663076f3461d223bc64a09a71d9"
FRONT_SHA = "1ecf453eb43683d8ff85edf9bb70a398faeddacbfe18670837b9a5121defdf71"

# Image-space correspondences at 1280 × 720 (front, frame 0) and in original 03
# at 1448 × 1086. Each iris, lid corner, brow, nostril and lip has its own mark.
MARKS = np.array(
    [
        [573, 120, 665, 132],
        [590, 109, 697, 113],
        [600, 105, 717, 104],
        [612, 108, 743, 109],
        [625, 120, 773, 132],
        [568, 142, 657, 192],
        [577, 139, 674, 190],
        [588, 143, 703, 201],
        [608, 142, 743, 199],
        [618, 139, 768, 188],
        [626, 138, 787, 185],
        [571, 151, 658, 219],
        [578.7, 149.8, 682, 216],
        [588, 151.2, 700, 220],
        [609.2, 149.7, 746, 218],
        [621, 148.3, 764, 212],
        [629, 148.2, 788, 212],
        [597.5, 155, 714, 225],
        [604.5, 154, 733, 224],
        [590.6, 171.8, 708, 266],
        [594.1, 174, 716, 269],
        [600.1, 170.2, 727, 261.2],
        [605.6, 174, 737.5, 268.3],
        [610.1, 171.3, 745, 264],
        [583.2, 187.6, 690.8, 298],
        [596.4, 186, 716, 287],
        [600, 187.1, 726, 290],
        [605.1, 185.1, 742, 286],
        [616.2, 186.4, 760, 293.6],
        [600.6, 188.7, 727, 299.5],
        [601, 194, 728, 310],
        [562, 160, 642, 240],
        [569.1, 185, 659, 291],
        [579, 201, 682, 327],
        [600, 210, 727, 347],
        [620, 200, 769, 324],
        [631, 181, 793, 286],
        [635, 158, 804, 236],
    ],
    dtype=float,
)
# Only the forward face is photographed here. Feather inside the hairline, jaw
# and ears. The original calibrated side and rear materials supply the turn.
OUTLINE = np.array(
    [
        [562, 149],
        [566, 133],
        [575, 122],
        [585, 111],
        [595, 106],
        [606, 106],
        [619, 114],
        [627, 125],
        [632, 140],
        [635, 152],
        [634, 170],
        [628, 187],
        [619, 201],
        [609, 210],
        [600, 213],
        [590, 211],
        [577, 203],
        [570, 192],
        [563, 177],
        [559, 164],
    ],
    dtype=np.int32,
)


def projected(points, camera):
    clip = (
        np.asarray(camera["projection"]).reshape(4, 4).T
        @ np.asarray(camera["worldToCamera"]).reshape(4, 4).T
    )
    xyzw = np.column_stack((points, np.ones(len(points)))) @ clip.T
    ndc = xyzw[:, :2] / xyzw[:, 3:]
    return (1 + ndc * [1, -1]) * [camera["width"] / 2, camera["height"] / 2]


def to_linear(rgb):
    value = rgb / 255
    return np.where(value <= 0.04045, value / 12.92, ((value + 0.055) / 1.055) ** 2.4)


def to_srgb(linear):
    value = np.clip(linear, 0, 1)
    return 255 * np.where(
        value <= 0.0031308, 12.92 * value, 1.055 * value ** (1 / 2.4) - 0.055
    )


def irradiance():
    folder = TRIAL / "v2/underlag/portrattljus"
    measurement = json.loads((folder / "ljus.json").read_text(encoding="utf8"))
    if sha(REFERENCE / "front.mp4") != FRONT_SHA or sha(SOURCE_PHOTO) != PHOTO_SHA:
        raise ValueError(
            "Ansiktsmarkeringarna hör till en annan version av fotot eller frontfilmen."
        )
    if any(
        sha(folder / name) != digest for name, digest in measurement["files"].items()
    ):
        raise ValueError("Ljusmätningen och de neutrala renderingarna stämmer inte.")
    dark, gray = [
        to_linear(np.asarray(Image.open(folder / name).convert("RGB")))
        for name in ("svart.png", "gra.png")
    ]
    return dark, (gray - dark) / measurement["grayLinear"], measurement


def apply_face(glb, pose, camera):
    body = glb.doc["meshes"][0]["primitives"][0]
    attr = {name: glb.read(accessor) for name, accessor in body["attributes"].items()}
    inverse = (
        glb.read(glb.doc["skins"][0]["inverseBindMatrices"])
        .reshape(-1, 4, 4)
        .transpose(0, 2, 1)
    )
    joints, weights = attr["JOINTS_0"], attr["WEIGHTS_0"]
    skin = np.sum((pose.world @ inverse)[joints] * weights[:, :, None, None], axis=1)
    xyz = np.einsum("vij,vj->vi", skin[:, :3, :3], attr["POSITION"]) + skin[:, :3, 3]
    normals = unit(np.einsum("vij,vj->vi", skin[:, :3, :3], attr["NORMAL"]))
    faces = glb.read(body["indices"]).reshape(-1, 3)
    head = np.array(
        [n.startswith(("c_head", "c_jaw", "l_eye", "r_eye")) for n in pose.names]
    )
    head_weight = (head[joints] * weights).sum(1)
    direction = unit(np.asarray(camera["positionM"]) - xyz)
    facing = (direction * normals).sum(1)
    enabled = (head_weight[faces].max(1) > 0.35) & (facing[faces].max(1) > 0.12)
    image, atlas = image_buffer(glb, body)
    pixel, corners, bw = sample_pixels(
        attr["TEXCOORD_0"], faces, atlas.shape[:2], enabled
    )
    xy = projected(weighted(xyz, corners, bw), camera)
    w, h = camera["width"], camera["height"]
    mask = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(mask, OUTLINE, 1)
    border = cv2.distanceTransform(mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    support = rgb_at(border[..., None], xy)[:, 0]
    alpha = mix(1.2, 8.5, support) * mix(0.03, 0.37, (facing[corners] * bw).sum(1))
    alpha *= mix(0.25, 0.8, (head_weight[corners] * bw).sum(1))
    keep = alpha > 0
    pixels = tuple(component[keep] for component in pixel)
    xy, alpha = xy[keep], alpha[keep]
    old = atlas[pixels].astype(float)

    # Two renders with known linear albedo separate diffuse illumination from
    # specular light. This avoids duplicating the photo's existing nose shadow.
    dark, light, measurement = irradiance()
    mapping = RBFInterpolator(MARKS[:, :2], MARKS[:, 2:], smoothing=2)
    photo = np.array(Image.open(SOURCE_PHOTO).convert("RGB"))
    photo_xy = mapping(xy)
    # The portrait has a broad frontal fill. Bring it within the game's skin
    # exposure. Scale all three channels together if a shadow cannot reproduce
    # the photographed intensity; independent clipping turns warm brows grey.
    target = 0.78 * to_linear(rgb_at(photo, photo_xy))
    black = np.minimum(rgb_at(dark, xy), 0.22 * target)
    albedo = (target - black) / np.clip(rgb_at(light, xy), 0.16, 2.5)
    albedo /= np.maximum(1, albedo.max(axis=1, keepdims=True) / 0.95)
    colour = to_srgb(albedo)
    blended = old + 0.97 * alpha[:, None] * (colour - old)
    atlas[pixels] = np.rint(blended).clip(0, 255).astype(np.uint8)
    stream = BytesIO()
    Image.fromarray(atlas).save(stream, format="PNG", compress_level=4)
    payload = stream.getvalue()
    image.update(
        bufferView=glb.buffer(payload),
        mimeType="image/png",
        name="Paulina · sittfoto 03, ansikte och händer",
    )
    return {
        "photoSha256": PHOTO_SHA,
        "frontFilmSha256": FRONT_SHA,
        "frontFrame": 0,
        "markedPairs": len(MARKS),
        "paintedTexels": int(np.sum(alpha > 0.05)),
        "lightingCalibration": measurement,
        "baseColorImageSha256": hashlib.sha256(payload).hexdigest(),
        "note": "Tonpassad fotoyta över främre ansiktet. Pose, hudvikter, handfoton och hårgeometri bevarade.",
    }


def build(source, out):
    receipt = json.loads(
        source.with_name("givmatning.json").read_text(encoding="utf-8")
    )
    if receipt["sceneSha256"] != sha(source):
        raise ValueError("Källscenen och dess mätkvitto har olika version.")
    render = json.loads((REFERENCE / "rendering.json").read_text(encoding="utf-8"))
    glb = Glb(source)
    pose = read_exported_motion(glb, receipt["cardNodeIndex"])[0][0]
    reference_pose = json.loads(
        (TRIAL / "v1/rigg/givmatning.json").read_text(encoding="utf-8")
    )["poses"]["a1"]["joints"]
    for side in ("l", "r"):
        for name in (side + "_eye", side + "_eye_null"):
            if np.linalg.norm(pose.position(name) - reference_pose[name]) > 0.0002:
                raise ValueError(
                    "Frontmarkeringarna kräver Paulinas registrerade vilopose i ruta 0."
                )
    face = apply_face(glb, pose, render["cameras"]["front"])
    if face["lightingCalibration"]["sourceSceneSha256"] != render["sceneSha256"]:
        raise ValueError("Ljus och frontkamera hör till olika scener.")
    if face["paintedTexels"] < 2000:
        raise ValueError("För få texlar på frontal ansiktshud.")
    face["sourceSceneSha256"] = receipt["sceneSha256"]
    glb.doc["asset"].setdefault("extras", {})["portraitOriginal03"] = face
    compact(glb)
    with TemporaryDirectory(prefix="paulina-ansikte-") as folder:
        f = glb.save(Path(folder) / "giv.glb")
        data = f.read_bytes()
        checked = Glb(f)
        before = Glb(source)
        if len(checked.doc["accessors"]) != len(before.doc["accessors"]) or any(
            not np.array_equal(checked.read(i), before.read(i))
            for i in range(len(checked.doc["accessors"]))
        ):
            raise ValueError(
                "En geometri-, hud- eller rörelseaccessor ändrades i ansiktspasset."
            )
    result = {
        **receipt,
        "sceneSha256": hashlib.sha256(data).hexdigest(),
        "parentSceneSha256": receipt["sceneSha256"],
        "handSourceSceneSha256": receipt.get("parentSceneSha256"),
        "portraitOriginal03": face,
    }
    content = (
        json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    ).encode()
    products = [(out / "giv.glb", data), (out / "givmatning.json", content)]
    for name, blob in products:
        if name.exists() and sha(name) != hashlib.sha256(blob).hexdigest():
            raise FileExistsError("Välj en ny utgåvemapp: " + str(name))
    for name, blob in products:
        put(name, blob, hashlib.sha256(blob).hexdigest())
    print(
        json.dumps({"sceneSha256": result["sceneSha256"], **face}, ensure_ascii=False)
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    build(args.source, args.out_dir)
