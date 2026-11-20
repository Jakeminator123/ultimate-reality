"""Fit the skinned bob to original photo 03 in the registered front camera."""

import argparse
from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter, minimum_filter
import trimesh

from material_versions import sha
from paulina_deal_p4 import Glb, ROOT, compact, read_exported_motion
from paulina_hand_material import digest, json_bytes, publish
from paulina_original_portrait import PHOTO_SHA, SOURCE_PHOTO, projected
from paulina_trial_surface import image_buffer
from paulina_utseende import barycentric, mix, rgb_at, triangles_at, unit

DEAL = ROOT / "avatars/paulina/giv-plats-4"
BASE = DEAL / "v2/rigg/giv.glb"
BASE_SHA = "f2605ffe6e47ab4b2ef89162a1d30c5d46692b8535d2108c9fcf34848d2df347"
OUT = DEAL / "v3/underlag/har"
ROWS, COLS = 81, 161

# Outer tips and inner opening traced on the 1448 x 1086 original, in native
# pixels. Columns are y, exterior left, inward left, inward right, exterior right.
# The opening is closed above the roots. The part itself is photographed hair.
OUTLINE = np.array(
    [
        (49, 713, 717, 717, 722),
        (52, 700, 717, 717, 730),
        (56, 688, 726, 726, 758),
        (64, 671, 731, 731, 770),
        (75, 655, 733, 733, 783),
        (90, 638, 727, 727, 799),
        (99, 631, 718, 718, 805),
        (103, 628, 704, 735, 808),
        (110, 623, 697, 753, 813),
        (120, 615, 693, 766, 819),
        (135, 608, 688, 777, 829),
        (150, 600, 685, 783, 835),
        (165, 596, 681, 788, 839),
        (180, 591, 676, 791, 844),
        (190, 590, 671, 793, 847),
        (202, 588, 659, 797, 849),
        (213, 587, 650, 798, 851),
        (228, 587, 644, 799, 851),
        (247, 587, 642, 801, 852),
        (268, 585, 643, 801, 852),
        (288, 585, 646, 797, 850),
        (304, 588, 652, 792, 846),
        (318, 594, 658, 785, 840),
        (329, 599, 663, 780, 832),
        (339, 605, 661, 781, 826),
        (348, 610, 657, 783, 820),
        (355, 616, 650, 786, 817),
        (362, 622, 643, 790, 813),
        (369, 631, 638, 795, 805),
        (373, 636, 638, 798, 801),
    ],
    dtype=float,
)

MODEL_EYES = np.array([[569, 331.5], [712, 328.0]], float)
PHOTO_EYES = np.array([[682, 216], [763, 213.5]], float)


def photo_xy(xy, inverse=False):
    """Apply the single planar similarity defined by the four observed iris centres."""
    a, b = (PHOTO_EYES, MODEL_EYES) if inverse else (MODEL_EYES, PHOTO_EYES)
    v, w = a[1] - a[0], b[1] - b[0]
    q = np.array([[v[0], v[1]], [-v[1], v[0]]])
    u = np.array([[w[0], w[1]], [-w[1], w[0]]])
    return (xy - a[0]) @ np.linalg.solve(q, u) + b[0]


def source_limits(y):
    return [np.interp(y, OUTLINE[:, 0], a) for a in OUTLINE[:, 1:].T]


def pose_geometry(glb, primitive, pose):
    attr = {k: glb.read(i) for k, i in primitive["attributes"].items()}
    inv = glb.read(glb.doc["skins"][0]["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    skin = np.sum((pose.world @ inv)[attr["JOINTS_0"]] * attr["WEIGHTS_0"][:, :, None, None], axis=1)
    xyz = np.einsum("vij,vj->vi", skin[:, :3, :3], attr["POSITION"]) + skin[:, :3, 3]
    return attr, skin, xyz


def camera_geometry(camera):
    transition = np.asarray(camera["worldToCamera"]).reshape(4, 4).T
    projection = np.asarray(camera["projection"]).reshape(4, 4).T
    inv = np.linalg.inv(transition)

    def unproject(xy, depth):
        normalized = (xy / [camera["width"] / 2, camera["height"] / 2] - 1) * [1, -1]
        cam = np.column_stack(
            (normalized[:, 0] * depth / projection[0, 0], normalized[:, 1] * depth / projection[1, 1], -depth)
        )
        return cam @ inv[:3, :3].T + inv[:3, 3]

    return transition, unproject


def scalp_surface(glb, pose, camera, screen):
    p = glb.doc["meshes"][0]["primitives"][0]
    _, _, world = pose_geometry(glb, p, pose)
    faces = glb.read(p["indices"]).reshape(-1, 3)
    source = projected(world, camera)
    cm, _ = camera_geometry(camera)
    depth = -(world @ cm[2, :3] + cm[2, 3])
    order = np.argsort(depth[faces].mean(1))[::-1]
    ids = triangles_at(source, faces, camera["width"], camera["height"], order)
    coords = np.clip(np.rint(screen).astype(int), [0, 0], [camera["width"] - 1, camera["height"] - 1])
    ix = ids[coords[:, 1], coords[:, 0]]
    triangles = faces[np.maximum(ix, 0)]
    b = np.clip(barycentric(screen, source[triangles]), 0, 1)
    b /= np.maximum(b.sum(1, keepdims=True), 1e-9)
    return np.where(ix >= 0, (b * depth[triangles]).sum(1), np.nan)


def fit_shell(glb, p, pose, camera):
    attrib, skin, positions = pose_geometry(glb, p, pose)
    if len(positions) != ROWS * COLS or not np.allclose(skin, skin[0], atol=1e-7):
        raise ValueError("Originalets håryta eller huvudbindning har ändrats.")
    grid = photo_xy(projected(positions, camera)).reshape(ROWS, COLS, 2)
    current_y = grid[:, :, 1]
    root_y = current_y[0, [0, -1]].mean()
    # Keep the length at the neck; restore the missing volume above the brow.
    y = current_y - (root_y - 50.4) * (1 - mix(root_y, 212, current_y)) + 14 * mix(300, 354, current_y)
    columns = np.arange(COLS)
    left, inner_left, inner_right, right = source_limits(y)
    proposed = np.empty_like(y)
    near = np.zeros_like(y)
    for row, section in enumerate(grid):
        x = section[:, 0]
        hi, lo = int(np.argmax(x)), int(np.argmin(x))
        hi = min(max(1, hi), COLS // 2 - 1)
        lo = max(min(COLS - 2, lo), COLS // 2 + 1)
        outer = mix(0, 1, (x - x[lo]) / max(1e-6, x[hi] - x[lo]))
        proposed[row] = left[row] + outer * (right[row] - left[row])
        rr = columns <= hi
        ll = columns >= lo
        # Preserve the original shell's curved azimuthal spacing.
        u = np.clip((x[rr] - x[0]) / max(1e-6, x[hi] - x[0]), 0, 1)
        proposed[row, rr] = inner_right[row, rr] + u * (right[row, rr] - inner_right[row, rr])
        near[row, rr] = 1 - u
        u = np.clip((x[-1] - x[ll]) / max(1e-6, x[-1] - x[lo]), 0, 1)
        proposed[row, ll] = inner_left[row, ll] - u * (inner_left[row, ll] - left[row, ll])
        near[row, ll] = 1 - u
    # The two boundary chains meet on the entire photographed root above the
    # forehead. Identical 3D positions, including depth, seal this seam.
    join = y[:, [0, -1]].mean(1) < 99.2
    proposed[join, 0] = proposed[join, -1] = (proposed[join, 0] + proposed[join, -1]) * 0.5
    y[join, 0] = y[join, -1] = (y[join, 0] + y[join, -1]) * 0.5
    target_photo = np.stack((proposed, y), axis=-1).reshape(-1, 2)
    screen = photo_xy(target_photo, inverse=True)
    cm, unproject = camera_geometry(camera)
    depth = -(positions @ cm[2, :3] + cm[2, 3])
    baseline = depth.copy()
    scalp = scalp_surface(glb, pose, camera, screen)
    # Seat the fringe within the same physical surface at the hairline.
    # The side locks naturally hang free below the cheekbone.
    # The original shell boundary floats far in front of either temple and
    # dips through the scalp on the left. Use smooth deformations across a
    # whole lock. Depth taken at each isolated pixel produces sawteeth.
    levels = np.array([48, 78, 87, 96, 104, 119, 138, 161, 176, 193, 209, 226, 245, 271, 308, 372])
    right_shift = [0, 0, 3, 18, 27, 26, 20, 14, 14, 17, 16, 13, 8, 0, 0, 0]
    left_shift = [0, 0, 3, 18, 24, 9, -9, -25, -32, -31, -16, 5, 6, 0, 0, 0]
    correction = (
        np.where(
            columns[None, :] < COLS // 2,
            PchipInterpolator(levels, right_shift)(y),
            PchipInterpolator(levels, left_shift)(y),
        )
        / 1000
    )
    depth += (correction * mix(0.28, 0.98, near)).ravel()
    remaining = (scalp - depth - 0.0028).reshape(ROWS, COLS)
    # Enforce a continuous clearance where the scalp is visible under the
    # photographed forelock. Feather outside this inner lock before rendering.
    active = np.isfinite(remaining) & (near > 0.48) & (y < 220) & (y > 101)
    required = np.where(active, np.minimum(remaining, 0), 0)
    envelope = gaussian_filter(
        minimum_filter(required, size=(5, 7), mode="nearest"), sigma=(1.15, 1.45), mode="nearest"
    )
    depth += envelope.ravel()
    # The real part rounds away above the hairline. Moving the overhang
    # rearward preserves its front outline and lets light reach the root.
    around_part = 1 - np.minimum(columns, COLS - 1 - columns) * 4 / (COLS - 1)
    crown_roll = mix(50, 70, y) * (1 - mix(87, 110, y)) * mix(0.25, 0.89, around_part)[None, :]
    depth += (0.018 * crown_roll).ravel()
    z = depth.reshape(ROWS, COLS)
    z[join, 0] = z[join, -1] = (z[join, 0] + z[join, -1]) * 0.5
    world = unproject(screen, depth)
    transform = skin[0]
    neutral = (world - transform[:3, 3]) @ np.linalg.inv(transform[:3, :3]).T
    faces = glb.read(p["indices"]).reshape(-1, 3).astype(int)
    cap = np.column_stack((np.zeros(COLS - 3, int), np.arange(1, COLS - 2), np.arange(2, COLS - 1)))
    cap_norm = np.cross(neutral[cap[:, 1]] - neutral[cap[:, 0]], neutral[cap[:, 2]] - neutral[cap[:, 0]])
    cap[cap_norm[:, 1] < 0] = cap[cap_norm[:, 1] < 0, ::-1]
    cap = cap[np.linalg.norm(cap_norm, axis=1) > 1e-16]
    all_faces = np.vstack((faces, cap))
    normal = trimesh.Trimesh(neutral, all_faces, process=False).vertex_normals.copy()
    # Seam sides share a normal as well as a location, eliminating a lighting notch.
    nr = normal.reshape(ROWS, COLS, 3)
    nr[join, 0] = nr[join, -1] = unit(nr[join, 0] + nr[join, -1])
    return (
        neutral,
        normal,
        all_faces,
        world,
        target_photo,
        {
            "closedRootRows": int(join.sum()),
            "capTriangles": len(cap),
            "maximumHairlineDepthAdjustmentMm": float(np.max(abs(depth - baseline)) * 1000),
            "originalIrisPx": PHOTO_EYES.tolist(),
            "modelIrisPx": MODEL_EYES.tolist(),
            "originalHairExtentsPx": [target_photo.min(0).tolist(), target_photo.max(0).tolist()],
        },
    )


def safe_hair(photo):
    yy, xx = np.indices(photo.shape[:2])
    left, il, ir, right = source_limits(yy)
    r, g, b = photo.astype(int).transpose(2, 0, 1)
    mask = (
        (yy >= 50)
        & (yy <= 371)
        & (xx >= left + 1)
        & (xx <= right - 1)
        & ((xx < il - 1.3) | (xx > ir + 1.3) | (ir - il < 1))
    )
    mask &= (r - b > 14) & (r - g > 3)
    # A far cheek, eye, the collar and the pale photographic backdrop cannot
    # be admitted by this inward hair-only silhouette.
    mask &= ~(
        (yy > 332)
        & (xx > np.interp(yy, [332, 349, 360, 373], [660, 652, 640, 634]))
        & (xx < np.interp(yy, [332, 349, 360, 373], [783, 786, 794, 800]))
    )
    nearest = distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return photo[nearest[0], nearest[1]], mask


def hair_texture(old, world, face_normal, camera):
    # On this regular angular / vertical UV chart we can interpolate posed 3D
    # positions directly. Perspective is evaluated after interpolation.
    width, height = 1536, 1024
    s = np.linspace(0, COLS - 1, width, dtype=np.float32)
    t = np.linspace(0, ROWS - 1, height, dtype=np.float32)
    u, v = np.meshgrid(s, t)

    def field(values):
        return cv2.remap(
            values.reshape(ROWS, COLS, 3).astype(np.float32),
            u,
            v,
            cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE,
        )

    xyz = field(world).reshape(-1, 3)
    normal = unit(field(face_normal).reshape(-1, 3))
    source = photo_xy(projected(xyz, camera))
    photograph = np.array(Image.open(SOURCE_PHOTO).convert("RGB"))
    clean, mask = safe_hair(photograph)
    detail = clean.astype(np.float32) - cv2.GaussianBlur(clean.astype(np.float32), (0, 0), 1.08)
    donor = np.clip(clean + 0.41 * detail, 0, 255)
    photographic = rgb_at(donor, source)
    to_camera = unit(np.asarray(camera["positionM"]) - xyz)
    facing = np.einsum("vi,vi->v", to_camera, normal)
    previous = cv2.resize(old, (width, height), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    old = previous.reshape(-1, 3)
    # Keep the previously registered back view on backward-facing lengths.
    # Smooth overlap uses the topological direction as well as surface normal.
    portion = np.minimum(u.ravel(), COLS - 1 - u.ravel()) / (COLS - 1)
    # At a tangent the frontal camera collapses several centimetres of 3D
    # width into a handful of pixels. Unwrap a photographed side lock along
    # the arc, preserving actual longitudinal hairs on either temple.
    lx, li, ri, rx = source_limits(source[:, 1])
    phase = mix(0.10, 0.36, portion)
    blend = mix(0.045, 0.23, portion) * (1 - mix(0.32, 0.44, portion)) * (1 - mix(0.24, 0.68, facing))
    width_fraction = 0.17 + 0.58 * phase
    temple_x = np.where(
        u.ravel() < COLS / 2, rx + width_fraction * (ri - rx), lx + width_fraction * (li - lx)
    )
    side_color = rgb_at(donor, np.column_stack((temple_x, source[:, 1])))
    photographic += blend[:, None] * (side_color - photographic)
    front = 1 - mix(0.30, 0.43, portion)
    trusted = np.maximum(front, mix(-0.12, 0.40, facing) * (1 - mix(0.25, 0.39, portion)))
    # A frontal still cannot measure the outside of a lock in profile. Keep
    # the existing registered profile's strands there, with their original
    # width and direction, as the view turns past the temple.
    registered_side = mix(0.075, 0.235, portion) * (1 - mix(0.12, 0.72, facing))
    trusted *= 1 - 0.88 * registered_side
    joined = old + (photographic - old) * trusted[:, None]
    high = (previous - cv2.GaussianBlur(previous, (0, 0), 3.0)).reshape(-1, 3)
    joined += np.clip(high, -18, 18) * (0.65 * trusted * mix(0.035, 0.17, portion))[:, None]
    rgb = np.uint8(np.clip(np.rint(joined.reshape(height, width, 3)), 0, 255))
    stream = BytesIO()
    Image.fromarray(rgb).save(stream, format="PNG", compress_level=6)
    return stream.getvalue(), {
        "textureSize": [width, height],
        "nativeAdmittedHairPixels": int(mask.sum()),
        "nativeColorOutsideMaskUsed": 0,
        "visibleSourceCoverage": float(np.mean(trusted > 0.7)),
    }


def line_the_locks(glb, mesh, prim, world, skin_matrix, camera, pose):
    # In the first shell, the back of the rear hair sheet is visible in the
    # cheek gaps. Give the bob its real 3D depth at the cut edge using two
    # inward-facing lock surfaces, following the photographic sides individually.
    grid = world.reshape(ROWS, COLS, 3)
    cm, unproject = camera_geometry(camera)
    width = 15
    inner_points = []
    inner_uv = []
    sides = []
    clean, _ = safe_hair(np.asarray(Image.open(SOURCE_PHOTO).convert("RGB")))
    colors = np.empty((512, 512, 3), np.uint8)
    for number, edge in enumerate((grid[:, -1], grid[:, 0])):
        orig = photo_xy(projected(edge, camera))
        y = orig[:, 1]
        towards_face = 1 if number == 0 else -1
        w = mix(173, 254, y) * (1 - mix(335, 369, y))
        lock_width = (1.4 + 16.3 * w) * mix(115, 178, y)
        src_depth = -(edge @ cm[2, :3] + cm[2, 3])
        par = np.linspace(0, 1, width)[None, :]
        to_face = orig[:, None, :] + np.stack(
            (
                towards_face * lock_width[:, None] * par,
                np.broadcast_to(1.7 * par * w[:, None], (ROWS, width)),
            ),
            axis=-1,
        )
        sample_screen = photo_xy(to_face.reshape(-1, 2), inverse=True)
        scalp = scalp_surface(glb, pose, camera, sample_screen).reshape(ROWS, width)
        # Take the lining behind the cheek. Its exposed section connects
        # continuously to the front rim with the same 127-joint skin.
        deep = src_depth[:, None] + (0.009 + 0.036 * w[:, None]) * par
        valid = np.isfinite(scalp) & (np.abs(scalp - src_depth[:, None]) < 0.105)
        deep = np.where(
            valid, np.maximum(deep, src_depth[:, None] + par * (scalp + 0.004 - src_depth[:, None])), deep
        )
        layer = unproject(sample_screen, deep.ravel()).reshape(ROWS, width, 3)
        layer[:, 0] = edge
        inner_points.append(layer.reshape(-1, 3))
        u, v = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, ROWS))
        inner_uv.append(np.stack(((u * 0.497) + number * 0.503, v), axis=-1).reshape(-1, 2))
        v, u = np.meshgrid(np.linspace(0, ROWS - 1, 512), np.linspace(0, 1, 256), indexing="ij")
        ys = np.interp(v.ravel(), np.arange(ROWS), y)
        lx, li, ri, rx = source_limits(ys)
        frac = 0.17 + 0.56 * u.ravel()
        px = li + frac * (lx - li) if number == 0 else ri + frac * (rx - ri)
        rgb = rgb_at(clean, np.column_stack((px, ys)))
        shade = (0.94 - 0.23 * u.ravel())[:, None]
        colors[:, number * 256 : (number + 1) * 256] = (
            np.rint(rgb * shade).clip(0, 255).astype(np.uint8).reshape(512, 256, 3)
        )
        strips = np.arange((ROWS - 1) * width).reshape(ROWS - 1, width)
        # Only free side locks have an underside. A folded strip above the
        # temples casts a second shadow on the central part even at zero width.
        idx = strips[y[:-1] >= 144, :-1].ravel() + number * ROWS * width
        side = np.vstack(
            (
                np.column_stack((idx, idx + width, idx + 1)),
                np.column_stack((idx + 1, idx + width, idx + width + 1)),
            )
        )
        sides.append(side if number == 0 else side[:, ::-1])
    posed = np.concatenate(inner_points)
    neutral = (posed - skin_matrix[:3, 3]) @ np.linalg.inv(skin_matrix[:3, :3]).T
    tris = np.vstack(sides)
    norm = trimesh.Trimesh(neutral, tris, process=False).vertex_normals
    source_joints = glb.read(prim["attributes"]["JOINTS_0"])[0]
    source_weights = glb.read(prim["attributes"]["WEIGHTS_0"])[0]
    arrays = [
        ("POSITION", neutral, "<f4", "VEC3"),
        ("NORMAL", norm, "<f4", "VEC3"),
        ("TEXCOORD_0", np.vstack(inner_uv), "<f4", "VEC2"),
        ("JOINTS_0", np.tile(source_joints, (len(neutral), 1)), "<u2", "VEC4"),
        ("WEIGHTS_0", np.tile(source_weights, (len(neutral), 1)), "<f4", "VEC4"),
    ]
    attrs = {name: glb.accessor(np.asarray(data, dtype=dtype), kind) for name, data, dtype, kind in arrays}
    stream = BytesIO()
    Image.fromarray(colors).save(stream, format="PNG")
    photo_index = len(glb.doc["images"])
    glb.doc["images"].append(
        {
            "name": "Inre längder från original 03",
            "mimeType": "image/png",
            "bufferView": glb.buffer(stream.getvalue()),
        }
    )
    texture = len(glb.doc["textures"])
    glb.doc["textures"].append({"source": photo_index})
    material = len(glb.doc["materials"])
    glb.doc["materials"].append(
        {
            "name": "Paulina · blond page · inre längder",
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": texture},
                "metallicFactor": 0,
                "roughnessFactor": 0.93,
            },
        }
    )
    mesh["primitives"].append(
        {
            "attributes": attrs,
            "indices": glb.accessor(np.asarray(tris.ravel(), dtype="<u2"), "SCALAR"),
            "material": material,
            "mode": 4,
        }
    )
    return {
        "liningVertices": len(neutral),
        "liningTriangles": len(tris),
        "liningBindsToHead": int(source_joints[0]),
    }


# The secondary fringe is baked into the *body's* scalp under the hair shell.
# Trace that fringe in original-photo coordinates from the isolated V2 body.
# Refill only the displaced strip with actual neighbouring GLB forehead albedo.
# No pixel from the photo's eyes or face enters either output texture.
OLD_SKIN_EDGE = np.array(
    [
        (645, 210),
        (657, 201),
        (669, 192),
        (677, 181),
        (683, 167),
        (688, 150),
        (693, 137),
        (700, 130),
        (709, 126),
        (721, 125),
        (732, 126),
        (742, 128),
        (752, 131),
        (762, 137),
        (770, 147),
        (778, 160),
        (784, 177),
        (791, 194),
        (800, 211),
    ],
    float,
)


def clear_secondary_fringe(glb, pose, camera):
    p = glb.doc["meshes"][0]["primitives"][0]
    attr, _, world = pose_geometry(glb, p, pose)
    image, body = image_buffer(glb, p)
    screen = projected(world, camera)
    native = photo_xy(screen)
    faces = glb.read(p["indices"]).reshape(-1, 3)
    touched = (native[:, 1] > 77) & (native[:, 1] < 189) & (native[:, 0] > 643) & (native[:, 0] < 805)
    selection = np.flatnonzero(touched[faces].any(1))
    cm, _ = camera_geometry(camera)
    depth = -(world @ cm[2, :3] + cm[2, 3])
    ids = triangles_at(
        screen, faces, camera["width"], camera["height"], np.argsort(depth[faces].mean(1))[::-1]
    )
    size = body.shape[0]
    uv = attr["TEXCOORD_0"] * (size - 1)
    uv_tri = uv[faces[selection]]
    lo = np.maximum(np.floor(uv_tri.min((0, 1))).astype(int) - 2, 0)
    hi = np.minimum(np.ceil(uv_tri.max((0, 1))).astype(int) + 3, size)
    labels = triangles_at(uv - lo, faces[selection], *(hi - lo), np.arange(len(selection)))
    original = body.copy()
    clean_hair, photo_mask = safe_hair(np.array(Image.open(SOURCE_PHOTO).convert("RGB")))
    distance_from_hair = distance_transform_edt(~photo_mask)
    # Eyelids, brows and their visible outer taper belong to the separate
    # portrait pass. Protect their physical albedo even behind individual hairs.
    protected = np.zeros(photo_mask.shape, np.uint8)
    brows_and_eyes = [
        [[646, 186], [663, 182], [677, 181], [706, 191], [714, 202], [716, 237], [645, 240]],
        [[731, 188], [752, 180], [769, 176], [781, 173], [794, 181], [802, 193], [803, 234], [730, 238]],
    ]
    cv2.fillPoly(protected, [np.asarray(poly, np.int32) for poly in brows_and_eyes], 1)
    protected = cv2.dilate(protected, np.ones((7, 7), np.uint8))
    eye_clearance = distance_transform_edt(protected == 0)
    count = 0
    for row in range(0, len(labels), 70):
        slab = labels[row : row + 70]
        yy, xx = np.nonzero(slab >= 0)
        if not len(xx):
            continue
        face_ids = selection[slab[yy, xx]]
        tri = faces[face_ids]
        xx, yy = xx + lo[0], yy + lo[1] + row
        b = np.clip(barycentric(np.column_stack((xx, yy)), uv[tri]), 0, 1)
        b /= np.maximum(b.sum(1, keepdims=True), 1e-9)
        point = np.einsum("vi,vij->vj", b, world[tri])
        xy = projected(point, camera)
        q = photo_xy(xy)
        x, y = q.T
        _, il, ir, _ = source_limits(y)
        old_edge = np.interp(x, OLD_SKIN_EDGE[:, 0], OLD_SKIN_EDGE[:, 1])
        alpha = mix(91, 99, y) * (1 - mix(old_edge + 16, old_edge + 36, y)) * (1 - mix(167, 188, y))
        alpha *= mix(-8, -0.2, x - il) * mix(-8, -0.2, ir - x)
        native_pixel = np.clip(np.rint(q).astype(int), [0, 0], np.array(protected.shape[::-1]) - 1)
        alpha *= mix(4, 9, eye_clearance[native_pixel[:, 1], native_pixel[:, 0]])
        pixel = np.clip(np.rint(xy).astype(int), [0, 0], [camera["width"] - 1, camera["height"] - 1])
        visible_face = ids[pixel[:, 1], pixel[:, 0]]
        front_depth = np.median(depth[faces[np.maximum(visible_face, 0)]], axis=1)
        own_depth = -(point @ cm[2, :3] + cm[2, 3])
        alpha *= (visible_face >= 0) & (np.abs(own_depth - front_depth) < 0.013)
        which = np.flatnonzero(alpha > 0.0001)
        if not len(which):
            continue
        # A continuous, currently exposed patch above the brows supplies skin.
        donor_x = np.clip(723 + (x[which] - 723) * 0.57, 694, 758)
        donor_edge = np.interp(donor_x, OLD_SKIN_EDGE[:, 0], OLD_SKIN_EDGE[:, 1])
        donor_y = np.clip(np.maximum(donor_edge + 19, 148 + (y[which] - 110) * 0.42), 145, 179)
        photo_point = photo_xy(np.column_stack((donor_x, donor_y)), inverse=True)
        donor_pixel = np.rint(photo_point).astype(int)
        f = ids[donor_pixel[:, 1], donor_pixel[:, 0]]
        if np.any(f < 0):
            raise ValueError("Pannans hudprov saknar faktisk kroppsyta.")
        tri = faces[f]
        coeff = np.clip(barycentric(photo_point, screen[tri]), 0, 1)
        coeff /= np.maximum(coeff.sum(1, keepdims=True), 1e-9)
        sample_uv = np.einsum("vi,vij->vj", coeff, uv[tri])
        skin = rgb_at(original, sample_uv)
        loc = np.rint(q[which]).astype(int)
        root_distance = distance_from_hair[loc[:, 1], loc[:, 0]]
        # The photographed roots shade the first few millimetres of exposed
        # scalp. Use the real hair-mask distance, not the superseded scalp edge.
        shadow = 0.66 + 0.34 * mix(0, 12, root_distance)
        skin *= shadow[:, None]
        # The warm roots visible through the part have a distinct chroma.
        # Sample only certified hair pixels and feather into the same scalp.
        root_x, root_y = q[which].T
        warmth = mix(689, 708, root_x) * (1 - mix(747, 768, root_x))
        warmth *= (1 - mix(118, 143, root_y)) * (1 - mix(5, 14, root_distance))
        strands = rgb_at(clean_hair, q[which])
        ratios = np.clip(strands / np.maximum(strands[:, :1], 1), [1, 0.57, 0.43], [1, 0.80, 0.70])
        root_color = skin[:, :1] * ratios
        skin += 0.78 * warmth[:, None] * (root_color - skin)
        tx, ty = xx[which], yy[which]
        initial = body[ty, tx].astype(float)
        body[ty, tx] = np.rint(initial + alpha[which, None] * (skin - initial)).clip(0, 255).astype(np.uint8)
        count += len(which)
    out = BytesIO()
    Image.fromarray(body).save(out, format="PNG", compress_level=5)
    image["bufferView"] = glb.buffer(out.getvalue())
    image["mimeType"] = "image/png"
    return count


def build(source, out):
    if sha(BASE) != BASE_SHA or sha(SOURCE_PHOTO) != PHOTO_SHA:
        raise ValueError("Referensscen eller original 03 har en annan kontrollsumma.")
    glb = Glb(source)
    receipt = json.loads(source.with_name("givmatning.json").read_text(encoding="utf-8"))
    if sha(source) != receipt["sceneSha256"]:
        raise ValueError("Scenen och rörelsekvittot skiljer sig åt.")
    ref = json.loads((DEAL / "v3/underlag/ansiktsljus/ljus.json").read_text(encoding="utf-8"))
    if ref["sourceSceneSha256"] != BASE_SHA or ref["frontFrame"] != 0:
        raise ValueError("Fel utgångskamera för den registrerade hårpassningen.")
    cam = ref["cameras"]["0"]
    pose = read_exported_motion(glb, receipt["cardNodeIndex"])[0][0]
    mesh = next(m for m in glb.doc["meshes"] if m.get("name") == "Blond page")
    p = mesh["primitives"][0]
    baseline = Glb(BASE)
    bp = next(m for m in baseline.doc["meshes"] if m.get("name") == "Blond page")["primitives"][0]
    for k in ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"):
        if not np.array_equal(glb.read(p["attributes"][k]), baseline.read(bp["attributes"][k])):
            raise ValueError("Utgångshåret har en annan bindning eller geometri.")
    record, old = image_buffer(glb, p)
    positions, normals, faces, world, _, shape = fit_shell(glb, p, pose, cam)
    _, skin, _ = pose_geometry(glb, p, pose)
    texture, color = hair_texture(old, world, normals @ skin[0, :3, :3].T, cam)
    changed = {p["indices"], p["attributes"]["POSITION"], p["attributes"]["NORMAL"]}
    old_arrays = [glb.read(i) for i in range(len(glb.doc["accessors"]))]
    lining = line_the_locks(glb, mesh, p, world, skin[0], cam, pose)
    # Keep the original accessor numbers for every consumer, including the mesh.
    for key, values, kind, component in (
        ("POSITION", positions, "VEC3", "<f4"),
        ("NORMAL", normals, "VEC3", "<f4"),
        ("indices", faces.ravel(), "SCALAR", "<u2"),
    ):
        i = p["indices"] if key == "indices" else p["attributes"][key]
        new = glb.accessor(np.asarray(values, dtype=component), kind)
        glb.doc["accessors"][i] = glb.doc["accessors"].pop(new)
    retouched = clear_secondary_fringe(glb, pose, cam)
    record["bufferView"] = glb.buffer(texture)
    record["mimeType"] = "image/png"
    appearance = {
        "photoSha256": PHOTO_SHA,
        "sourceSceneSha256": sha(source),
        "hairTextureSha256": digest(texture),
        "secondaryScalpFringeBodyTexels": retouched,
        **shape,
        **color,
        **lining,
    }
    glb.doc["asset"].setdefault("extras", {})["hairOriginal03"] = appearance
    compact(glb)
    with TemporaryDirectory(prefix="paulina-harfaste-") as temp:
        file = glb.save(Path(temp) / "giv.glb")
        checked = Glb(file)
        if any(not np.array_equal(a, checked.read(i)) for i, a in enumerate(old_arrays) if i not in changed):
            raise ValueError("En accessor utanför håret ändrades.")
        data = file.read_bytes()
    output = {
        **receipt,
        "parentSceneSha256": sha(source),
        "sceneSha256": digest(data),
        "hairOriginal03": appearance,
    }
    products = {"giv.glb": data, "givmatning.json": json_bytes(output)}
    if out.resolve().is_relative_to(OUT.resolve()):
        products["hartextur.png"] = texture
    publish(out, products)
    print(out, digest(data), json.dumps(appearance, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--source", default=BASE, type=Path)
    cli.add_argument("--out-dir", type=Path, required=True)
    args = cli.parse_args()
    build(args.source, args.out_dir)
