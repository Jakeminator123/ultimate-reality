"""Add the observed palm and rear references to the seated trial's existing UV maps."""

from io import BytesIO
import json

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import distance_transform_edt

from paulina_utseende import barycentric, mix, rgb_at, sha, triangles_at, unit


# Wrist then thumb, index, middle, ring, pinky. Marked on the 768 × 512
# review of this particular generated palm reference. Finger entries are
# proximal, intermediate, distal joint and fingertip in that order.
PALM_LANDMARKS = {
    "r": [
        (247, 398),
        (175, 336),
        (151, 282),
        (128, 235),
        (103, 188),
        (207, 211),
        (201, 150),
        (201, 91),
        (204, 42),
        (250, 207),
        (253, 137),
        (254, 72),
        (256, 16),
        (289, 209),
        (291, 153),
        (295, 95),
        (296, 42),
        (322, 229),
        (333, 184),
        (338, 145),
        (345, 105),
    ],
    "l": [
        (518, 397),
        (589, 337),
        (615, 282),
        (643, 231),
        (661, 185),
        (562, 211),
        (565, 151),
        (568, 94),
        (567, 42),
        (522, 207),
        (519, 138),
        (515, 72),
        (514, 16),
        (477, 207),
        (471, 152),
        (467, 95),
        (469, 43),
        (443, 228),
        (432, 184),
        (426, 145),
        (422, 108),
    ],
}


def image_buffer(glb, primitive):
    pbr = glb.doc["materials"][primitive["material"]]["pbrMetallicRoughness"]
    texture = glb.doc["textures"][pbr["baseColorTexture"]["index"]]
    image = glb.doc["images"][texture["source"]]
    view = glb.doc["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return image, np.array(
        Image.open(BytesIO(glb.data[start : start + view["byteLength"]])).convert("RGB")
    )


def replace_texture(glb, image, rgb):
    stream = BytesIO()
    Image.fromarray(rgb).save(stream, format="JPEG", quality=96, subsampling=0)
    image["bufferView"] = glb.buffer(stream.getvalue())
    image["mimeType"] = "image/jpeg"


def sample_pixels(uv, faces, size, enabled):
    height, width = size
    pixels = uv * [width - 1, height - 1]
    selection = np.flatnonzero(enabled)
    ids = triangles_at(pixels, faces[selection], width, height, np.arange(len(selection)))
    y, x = np.nonzero(ids >= 0)
    corners = faces[selection[ids[y, x]]]
    weights = barycentric(np.column_stack((x, y)), pixels[corners])
    return (y, x), corners, weights


def weighted(values, corners, weights):
    return (values[corners] * weights[..., None]).sum(axis=1)


def mix_into(image, pixels, colour, alpha):
    old = image[pixels].astype(float)
    image[pixels] = np.rint(old + alpha[:, None] * (colour - old)).clip(0, 255).astype(np.uint8)
    return int(np.sum(alpha > 0.05))


def smooth_palm_edges(photo):
    rgb = photo.astype(np.int16)
    y = np.arange(photo.shape[0])[:, None] / photo.shape[0]
    mask = (rgb[..., 0] - rgb[..., 2] > 18) & (rgb[..., 0] > 85) & (y < 0.81)
    mask = cv2.erode(mask.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    distance, closest = distance_transform_edt(~mask, return_indices=True)
    return photo[closest[0], closest[1]], distance


def bake_trial_views(glb, names, world, palms, rear_photo, rear_run):
    manifests = json.loads((rear_run / "run.json").read_text(encoding="utf8"))
    if manifests["state"] != "complete" or [i["sha256"] for i in manifests["inputs"]] != [
        sha(rear_photo)
    ]:
        raise ValueError("Rear camera estimate and reference image do not match.")
    estimate = next(rear_run.glob("*.npz"))
    with np.load(estimate, allow_pickle=False) as rear:
        rear_xyz = rear["pred_vertices"] + rear["pred_cam_t"]
        frame_center = rear["original_size"] / 2
        focal = rear["focal_length"] * rear["original_size"] / rear["inference_size"]

    def project(points):
        return points[:, :2] / points[:, 2:] * focal + frame_center

    rear_image = np.array(Image.open(rear_photo).convert("RGB"))
    palm_image = np.array(Image.open(palms).convert("RGB"))
    palm_padded, palm_distance = smooth_palm_edges(palm_image)
    body = glb.doc["meshes"][0]["primitives"][0]
    hair = glb.doc["meshes"][1]["primitives"][0]
    attr = {name: glb.read(a) for name, a in body["attributes"].items()}
    faces = glb.read(body["indices"]).reshape(-1, 3)
    uv, positions, normals = (attr[k] for k in ("TEXCOORD_0", "POSITION", "NORMAL"))
    skin, influence = attr["JOINTS_0"], attr["WEIGHTS_0"]
    sam_indices = attr["_SAM_INDEX"].ravel()
    image, atlas = image_buffer(glb, body)
    measurements = {}
    hand_parts = ("wrist", "index", "middle", "ring", "pinky", "thumb")
    for side, marks in PALM_LANDMARKS.items():
        means_hand = [
            n.startswith(tuple(side + "_" + part for part in hand_parts)) and "twist" not in n
            for n in names
        ]
        coverage = (np.asarray(means_hand)[skin] * influence).sum(axis=1)
        pix, tri, weights = sample_pixels(
            uv, faces, atlas.shape[:2], (coverage[faces].max(axis=1) > 0.18)
        )
        source_xyz = weighted(positions, tri, weights)
        source_normal = unit(weighted(normals, tri, weights))
        joints = ["wrist"] + [
            digit + level
            for digit in ("thumb", "index", "middle", "ring", "pinky")
            for level in ("1", "2", "3", "_null")
        ]
        anchors = np.stack([world[names.index(side + "_" + j), :3, 3] for j in joints])
        palm_normal = unit(np.cross(anchors[9] - anchors[0], anchors[5] - anchors[0]))
        # Both hands are photographed resting palm-down on the thighs in the base pose.
        if palm_normal[1] > 0:
            palm_normal = -palm_normal
        landmark_pixels = np.array(marks) * np.array(palm_image.shape[:2][::-1]) / [768, 512]
        mapping = RBFInterpolator(
            np.vstack([anchors, anchors + 0.012 * palm_normal]) * 100,
            np.vstack([landmark_pixels, landmark_pixels]),
            smoothing=0.045,
        )
        points = mapping(source_xyz * 100)
        colour = rgb_at(palm_padded, points)
        px = np.rint(points).astype(int)
        px = np.clip(px, [0, 0], np.array(palm_image.shape[:2][::-1]) - 1)
        distance = palm_distance[px[:, 1], px[:, 0]]
        support = mix(0.15, 0.85, (coverage[tri] * weights).sum(axis=1))
        fit = (1 - mix(2, 22, distance)) * mix(-0.12, 0.65, source_normal @ palm_normal) * support
        measurements[side + "PalmTexels"] = mix_into(atlas, pix, colour, fit)

    coat_bones = [
        n.startswith(("c_spine", "r_clavicle", "l_clavicle", "r_uparm", "l_uparm")) for n in names
    ]
    coat = (np.asarray(coat_bones)[skin] * influence).sum(axis=1)
    nums = rear_xyz[sam_indices]
    rear_normals = unit(
        np.cross(nums[faces[:, 1]] - nums[faces[:, 0]], nums[faces[:, 2]] - nums[faces[:, 0]])
    )
    seen = -np.sum(rear_normals * unit(nums[faces].mean(axis=1)), axis=1)
    enabled = (coat[faces].mean(axis=1) > 0.2) & (normals[faces, 2].mean(axis=1) < 0.03) & (seen > 0.28)
    pix, tri, weights = sample_pixels(uv, faces, atlas.shape[:2], enabled)
    points = project(weighted(nums, tri, weights))
    colour = rgb_at(rear_image, points)
    darkness = 1 - mix(66, 111, colour.max(axis=1))
    back = mix(0.02, 0.68, -weighted(normals, tri, weights)[:, 2])
    measurements["backJacketTexels"] = mix_into(atlas, pix, colour, darkness * back)
    replace_texture(glb, image, atlas)

    head_bones = [n.startswith(("c_head", "c_jaw", "l_eye", "r_eye")) for n in names]
    is_head = (np.asarray(head_bones)[skin] * influence).sum(axis=1) > 0.93
    source, target = positions[is_head], nums[is_head]
    a, b = source.mean(axis=0), target.mean(axis=0)
    u, _, vt = np.linalg.svd((source - a).T @ (target - b))
    R = u @ vt
    if np.linalg.det(R) < 0:
        u[:, -1] *= -1
        R = u @ vt
    scale = np.sum(((source - a) @ R) * (target - b)) / np.sum((source - a) ** 2)
    metrics_delta = np.linalg.norm((source - a) @ R * scale + b - target, axis=1)
    hattr = {
        k: glb.read(a) for k, a in hair["attributes"].items() if k in ("POSITION", "NORMAL", "TEXCOORD_0")
    }
    hfaces = glb.read(hair["indices"]).reshape(-1, 3)
    hsource = (hattr["POSITION"] - a) @ R * scale + b
    image, hair_map = image_buffer(glb, hair)
    hnorm = unit(hattr["NORMAL"] @ R)
    hseen = -np.sum(hnorm * unit(hsource), axis=1)
    enabled = (hseen[hfaces].mean(axis=1) > 0.02) & (hattr["NORMAL"][hfaces, 2].mean(axis=1) < 0.05)
    pix, tri, weights = sample_pixels(hattr["TEXCOORD_0"], hfaces, hair_map.shape[:2], enabled)
    points = project(weighted(hsource, tri, weights))
    colour = rgb_at(rear_image, points)
    blonde = mix(10, 29, colour[:, 0] - colour[:, 2]) * mix(65, 112, colour[:, 0])
    rear_angle = mix(0.03, 0.6, -weighted(hattr["NORMAL"], tri, weights)[:, 2])
    fit = mix(0.03, 0.65, (hseen[tri] * weights).sum(1)) * rear_angle * blonde
    measurements["backHairTexels"] = mix_into(hair_map, pix, colour, fit)
    replace_texture(glb, image, hair_map)
    return {
        "palmReference": sha(palms),
        "backReference": sha(rear_photo),
        "backSamRun": rear_run.name,
        "rearHeadAlignmentMedianMm": round(1000 * float(np.median(metrics_delta)), 2),
        **measurements,
    }
