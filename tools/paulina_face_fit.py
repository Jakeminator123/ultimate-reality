"""Fit Paulina's midface to original 03 at the studio portrait camera's eye scale."""

import argparse
from io import BytesIO
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy.spatial.transform import Rotation

from material_versions import json_bytes, put, sha
from paulina_deal_p4 import Glb, compact, read_exported_motion
from paulina_original_portrait import (
    PHOTO_SHA,
    SOURCE_PHOTO,
    TRIAL,
    projected,
    to_linear,
    to_srgb,
)
from paulina_trial_surface import image_buffer, sample_pixels, weighted
from paulina_utseende import mix, rgb_at, unit

# Coordinates in the player's 1280 x 720 face view and in the 1448 x 1086 photograph.
# The two pupils fix translation, uniform scale and roll. Depth is retained from SAM.
SOURCE_EYES = np.array([[682, 216], [763, 213.5]])
VIEW_EYES = np.array([[569, 331.5], [712, 328.0]])
BASELINE = TRIAL / "v3/underlag/ansiktsljus"
V2 = "f2605ffe6e47ab4b2ef89162a1d30c5d46692b8535d2108c9fcf34848d2df347"
# Corresponding corners of lids and mouth, the alar bases and the soft chin.
# Leave pupil depth, skull, hair, jaw hinge and neck in their registered positions.
MODEL_MARKS = np.array(
    [
        [542, 330],
        [573, 312],
        [574, 338],
        [604, 329],
        [677, 326],
        [710, 308],
        [711, 335],
        [741, 323],
        [604, 400],
        [623, 414],
        [640, 402],
        [654, 413],
        [668, 398],
        [584, 464],
        [625, 454],
        [641, 460],
        [658, 452],
        [690, 459],
        [641, 465],
        [641, 483],
        [583, 529],
        [640, 553],
        [697, 522],
    ],
    float,
)
PHOTO_MARKS = np.array(
    [
        [660, 218],
        [682, 209],
        [682, 223],
        [704, 221],
        [744, 219],
        [763, 205],
        [763, 222],
        [786, 210],
        [708.5, 264],
        [716, 269.5],
        [726, 262],
        [737, 269],
        [744, 263],
        [691, 298],
        [718, 286.5],
        [726, 289.5],
        [738, 285.5],
        [759, 293],
        [726, 298],
        [726, 311.5],
        [687, 333],
        [726, 347],
        [765, 330],
    ],
    float,
)
# Keep the entire outer transition continuous with the existing seated body.
FIXED = np.array(
    [
        [440, 179],
        [530, 177],
        [635, 175],
        [745, 178],
        [840, 187],
        [492, 256],
        [525, 273],
        [641, 258],
        [775, 264],
        [484, 341],
        [787, 342],
        [486, 415],
        [786, 417],
        [506, 483],
        [763, 484],
        [544, 543],
        [736, 543],
        [575, 566],
        [644, 575],
        [703, 560],
    ]
)
PHOTO_OUTLINE = np.array(
    [
        [642, 225],
        [647, 207],
        [657, 190],
        [672, 170],
        [689, 130],
        [703, 107],
        [718, 101],
        [749, 108],
        [773, 130],
        [787, 157],
        [797, 190],
        [802, 216],
        [804, 244],
        [798, 278],
        [790, 301],
        [780, 319],
        [766, 332],
        [745, 343],
        [728, 348],
        [707, 344],
        [682, 333],
        [663, 316],
        [650, 298],
        [641, 270],
        [639, 245],
    ],
    np.int32,
)


def to_view(points, inverse=False):
    source, target = (VIEW_EYES, SOURCE_EYES) if inverse else (SOURCE_EYES, VIEW_EYES)
    # A 2D similarity keeps iris width and the eyes-to-mouth ratio from the original.
    a, b = [p[:, 0] + 1j * p[:, 1] for p in (source, target)]
    z = points[:, 0] + 1j * points[:, 1]
    result = (z - a[0]) * ((b[1] - b[0]) / (a[1] - a[0])) + b[0]
    return np.column_stack((result.real, result.imag))


def body_data(glb, pose):
    primitive = glb.doc["meshes"][0]["primitives"][0]
    attrs = {n: glb.read(a) for n, a in primitive["attributes"].items()}
    bind = (
        glb.read(glb.doc["skins"][0]["inverseBindMatrices"])
        .reshape(-1, 4, 4)
        .transpose(0, 2, 1)
    )
    joints, weights = attrs["JOINTS_0"], attrs["WEIGHTS_0"]
    skin = ((pose.world @ bind)[joints] * weights[:, :, None, None]).sum(1)
    xyz = np.einsum("nij,nj->ni", skin[:, :3, :3], attrs["POSITION"]) + skin[:, :3, 3]
    head = np.array(
        [n.startswith(("c_head", "c_jaw", "l_eye", "r_eye")) for n in pose.names]
    )
    return primitive, attrs, skin, xyz, (head[joints] * weights).sum(1)


def geometric_normals(verts, faces, ids):
    corners = verts[faces]
    tri = np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
    normals = np.zeros((ids.max() + 1, 3))
    for column in faces.T:
        np.add.at(normals, ids[column], tri)
    return unit(normals[ids]), unit(tri)


def fit_shape(glb, pose, camera):
    if "portraitShape03" in glb.doc["asset"]["extras"]:
        raise ValueError("Scenen har redan den registrerade ansiktsformen.")
    p, a, skin, world, head = body_data(glb, pose)
    xy = projected(world, camera)
    mask = (
        (head > 0.65)
        & (xy[:, 0] > 480)
        & (xy[:, 0] < 794)
        & (xy[:, 1] > 247)
        & (xy[:, 1] < 575)
    )
    # Fade the correction toward the temples in depth. The unseen side supplies no depth measurement.
    depth = mix(-0.039, 0.026, world[:, 2] - pose.position("c_head")[2])
    mask &= depth > 0
    positions = a["POSITION"].copy()
    old = positions.astype(float)
    q = xy[mask]
    border = (
        mix(480, 531, q[:, 0])
        * mix(-794, -750, -q[:, 0])
        * mix(247, 287, q[:, 1])
        * mix(-575, -548, -q[:, 1])
    )
    warp = RBFInterpolator(
        np.vstack((MODEL_MARKS, FIXED)),
        np.vstack((to_view(PHOTO_MARKS) - MODEL_MARKS, np.zeros_like(FIXED))),
        smoothing=38.0,
    )
    delta = warp(q) * (border * depth[mask] * mix(0.65, 0.98, head[mask]))[:, None]
    # For a perspective camera a pixel is proportional to camera-space depth. Keep Z fixed in camera coordinates.
    to_camera = np.array(camera["worldToCamera"]).reshape(4, 4).T
    camera_z = -(world[mask] @ to_camera[2, :3] + to_camera[2, 3])
    focal = camera["height"] * camera["projection"][5] / 2
    disp_world = ((delta * [1, -1]) @ to_camera[:2, :3]) * (camera_z / focal)[:, None]
    positions[mask] += np.linalg.solve(skin[mask, :3, :3], disp_world[:, :, None])[
        :, :, 0
    ]
    displacement = np.linalg.norm(disp_world, axis=1)
    if not 0.002 < displacement.max() < 0.016:
        raise ValueError(
            f"Oväntad största ansiktsförflyttning {displacement.max() * 1000:.2f} mm."
        )
    faces = glb.read(p["indices"]).reshape(-1, 3)
    ids = a["_SAM_INDEX"].ravel().astype(int)
    n0, t0 = geometric_normals(old, faces, ids)
    n1, t1 = geometric_normals(positions.astype(float), faces, ids)
    touched = (
        mask[faces].any(1)
        & (np.linalg.norm(t0, axis=1) > 0.9)
        & (np.linalg.norm(t1, axis=1) > 0.9)
    )
    dots = (t0[touched] * t1[touched]).sum(1)
    smallest_dot = float(dots.min())
    if smallest_dot < 0.65:
        worst = faces[np.flatnonzero(touched)[np.argmin(dots)]]
        raise ValueError(
            f"För skarp vinkeländring i ansiktspassningen, cos {smallest_dot:.3f}, bildhörn {xy[worst].round(1).tolist()}, {np.count_nonzero(dots < 0.65)} trianglar."
        )
    axis = np.cross(n0, n1)
    normals = a["NORMAL"].copy()
    turning = np.linalg.norm(axis, axis=1) > 1e-7
    v, k = normals[turning].astype(float), axis[turning]
    d = 1 + (n0[turning] * n1[turning]).sum(1)
    normals[turning] = unit(
        v + np.cross(k, v) + np.cross(k, np.cross(k, v)) / d[:, None]
    )
    p["attributes"]["POSITION"] = glb.accessor(positions, "VEC3")
    p["attributes"]["NORMAL"] = glb.accessor(normals, "VEC3")
    if not np.array_equal(positions[head <= 0.65], old[head <= 0.65]):
        raise ValueError("En punkt utanför huvudets hudförankring ändrades.")
    glb.doc["asset"]["extras"]["portraitLighting"] = {"shadowNormalBiasM": 0.002}
    # Original 03 has soft reflected light under the nose. Aim a local fill from
    # the table side at the seated head. A glTF light travels with the scene and
    # supplies the missing irradiance when the face turns toward the player.
    origin = np.array([0.018, 0.86, 0.78])
    target = np.array([0, 1.13, 0.085])
    back = unit(origin - target)
    right = unit(np.cross([0.0, 1.0, 0.0], back))
    up = np.cross(back, right)
    orient = Rotation.from_matrix(np.column_stack([right, up, back])).as_quat().tolist()
    name = "KHR_lights_punctual"
    lamps = glb.doc.setdefault("extensions", {}).setdefault(name, {"lights": []})[
        "lights"
    ]
    lamp_id = len(lamps)
    lamps.append(
        {
            "name": "Reflexljus vid spelarplatsen",
            "type": "spot",
            "color": [1.0, 0.94, 0.90],
            "intensity": 1.15,
            "range": 1.8,
            "spot": {"innerConeAngle": 0.23, "outerConeAngle": 0.39},
        }
    )
    used = glb.doc.setdefault("extensionsUsed", [])
    if name not in used:
        used.append(name)
    glb.doc["scenes"][glb.doc.get("scene", 0)]["nodes"].append(len(glb.doc["nodes"]))
    glb.doc["nodes"].append(
        {
            "name": "Reflexljus vid spelarplatsen",
            "translation": origin.tolist(),
            "rotation": orient,
            "extensions": {name: {"light": lamp_id}},
        }
    )
    return {
        "photoSha256": PHOTO_SHA,
        "camera": "Ansikte 0°, ruta 0",
        "photoEyeCentersPx": SOURCE_EYES.tolist(),
        "cameraEyeCentersPx": VIEW_EYES.tolist(),
        "registeredPointPairs": len(MODEL_MARKS),
        "movedVerticesAbove0_1mm": int((displacement > 0.0001).sum()),
        "maxDisplacementMm": float(displacement.max() * 1000),
        "minTriangleNormalDot": smallest_dot,
        "cameraDepthPreserved": True,
    }


def fit_surface(glb, pose, camera, light_dir, light_register):
    p, a, skin, world, head = body_data(glb, pose)
    normal = unit(np.einsum("nij,nj->ni", skin[:, :3, :3], a["NORMAL"]))
    facing = (normal * unit(np.array(camera["positionM"]) - world)).sum(1)
    faces = glb.read(p["indices"]).reshape(-1, 3)
    enabled = (head[faces].max(1) > 0.75) & (facing[faces].max(1) > -0.08)
    image, atlas = image_buffer(glb, p)
    pixel, corners, bw = sample_pixels(a["TEXCOORD_0"], faces, atlas.shape[:2], enabled)
    xy = projected(weighted(world, corners, bw), camera)
    photo = np.asarray(Image.open(SOURCE_PHOTO).convert("RGB"))
    photo_xy = to_view(xy, inverse=True)
    mask = np.zeros(photo.shape[:2], np.uint8)
    cv2.fillPoly(mask, [PHOTO_OUTLINE], 1)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    alpha = mix(0.5, 10, rgb_at(distance[..., None], photo_xy)[:, 0])
    toward = (facing[corners] * bw).sum(1)
    # The alar folds are viewed obliquely even in front. Keep the photographed
    # nostril and underside there, fading back to the side material at the cheek.
    nose = 1 - mix(
        0.72, 1.15, np.linalg.norm((photo_xy - [726, 263]) / [23, 16], axis=1)
    )
    front = np.maximum(mix(0.08, 0.49, toward), nose * mix(-0.16, 0.08, toward))
    alpha *= front * mix(0.53, 0.94, (head[corners] * bw).sum(1))
    used = alpha > 0
    pixels = tuple(part[used] for part in pixel)
    alpha, xy, photo_xy = alpha[used], xy[used], photo_xy[used]
    dark, gray = [
        to_linear(np.asarray(Image.open(light_dir / n).convert("RGB")))
        for n in ["svart.png", "gra.png"]
    ]
    black = rgb_at(dark, xy)
    diffuse = (rgb_at(gray, xy) - black) / light_register["grayLinear"]
    target = 0.86 * to_linear(rgb_at(photo, photo_xy))
    albedo = np.maximum(target - np.minimum(black, 0.35 * target), 0) / np.clip(
        diffuse, 0.20, 3
    )
    albedo /= np.maximum(1, albedo.max(1, keepdims=True) / 0.98)
    before = atlas[pixels].astype(float)
    atlas[pixels] = (
        np.rint(before + alpha[:, None] * (to_srgb(albedo) - before))
        .clip(0, 255)
        .astype(np.uint8)
    )
    stream = BytesIO()
    Image.fromarray(atlas).save(stream, format="PNG", compress_level=4)
    tex = stream.getvalue()
    image.update(
        bufferView=glb.buffer(tex),
        mimeType="image/png",
        name="Paulina · ansikte från sittfoto 03 i spelarens ögonskala",
    )
    return {
        "photoSha256": PHOTO_SHA,
        "lightingSceneSha256": light_register["sourceSceneSha256"],
        "baseColorSha256": hashlib.sha256(tex).hexdigest(),
        "camera": "Ansikte 0°, ruta 0",
        "paintedTexels": int((alpha > 0.05).sum()),
        "photoExposureLinear": 0.86,
    }


def build(stage, source, out, lighting):
    if sha(SOURCE_PHOTO) != PHOTO_SHA:
        raise ValueError("Källfotot avviker från original 03.")
    receipt = json.loads(source.with_name("givmatning.json").read_bytes())
    source_hash = sha(source)
    if source_hash != receipt["sceneSha256"]:
        raise ValueError("Scen och kvitto hör till olika utgåvor.")
    baseline = json.loads((BASELINE / "ljus.json").read_bytes())
    if baseline["sourceSceneSha256"] != V2:
        raise ValueError("Närbildens markeringar kräver den registrerade V2-scenen.")
    glb = Glb(source)
    pose = read_exported_motion(glb, receipt["cardNodeIndex"])[0][0]
    camera = baseline["cameras"]["0"]
    expected = np.array(camera["lookAtM"]) + [0, 0.022, 0]
    if (
        np.linalg.norm((pose.position("l_eye") + pose.position("r_eye")) / 2 - expected)
        > 0.00015
    ):
        raise ValueError("Vilan har en annan huvudposition än närbilden.")
    if stage == "form":
        key = "portraitShape03"
        result = fit_shape(glb, pose, camera)
    else:
        key = "portraitSurface03"
        light = json.loads((lighting / "ljus.json").read_bytes())
        if (
            "portraitShape03" not in glb.doc["asset"]["extras"]
            or light["sourceSceneSha256"] != source_hash
        ):
            raise ValueError(
                "Ljuskalibreringen kräver samma 3D-form och vila som fotopasset."
            )
        for n in ("svart.png", "gra.png"):
            if sha(lighting / n) != light["files"][n]:
                raise ValueError("Den neutrala ljusbilden tillhör en annan passning.")
        result = fit_surface(glb, pose, light["cameras"]["0"], lighting, light)
    result["parentSceneSha256"] = source_hash
    glb.doc["asset"]["extras"][key] = result
    compact(glb)
    with TemporaryDirectory(prefix="paulina-portratt-") as tmp:
        data = glb.save(Path(tmp) / "giv.glb").read_bytes()
    scene_id = hashlib.sha256(data).hexdigest()
    updated = {
        **receipt,
        "sceneSha256": scene_id,
        "parentSceneSha256": source_hash,
        key: result,
    }
    report = json_bytes(updated)
    products = [
        (out / "giv.glb", data, scene_id),
        (out / "givmatning.json", report, hashlib.sha256(report).hexdigest()),
    ]
    for file, _, digest in products:
        if file.exists() and sha(file) != digest:
            raise FileExistsError("Välj en ny utgåvemapp: " + str(file))
    for file, payload, digest in products:
        put(file, payload, digest)
    print(json.dumps({"sceneSha256": scene_id, **result}, ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("stage", choices=["form", "foto"])
    ap.add_argument("source", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--lighting", type=Path)
    args = ap.parse_args()
    if args.stage == "foto" and args.lighting is None:
        ap.error("Fotopasset kräver --lighting från den formpassade scenen.")
    build(args.stage, args.source, args.out, args.lighting)
