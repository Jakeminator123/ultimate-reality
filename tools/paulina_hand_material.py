"""Bake registered photographed skin, ten nail plates and the original hand tattoos onto the seated dealer."""

import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import cv2
import numpy as np
import trimesh
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import distance_transform_edt
from scipy.spatial import cKDTree

from material_versions import put, sha
from paulina_motion_trial import Glb, hierarchy, world_matrices
from paulina_trial_surface import PALM_LANDMARKS, image_buffer
from paulina_utseende import HAND_MARKS, barycentric, mix, rgb_at, triangles_at, unit

ROOT = Path(__file__).resolve().parents[1]
AVATAR = ROOT / "avatars/paulina"
DEAL = AVATAR / "giv-plats-4"
BASE = DEAL / "v1/rigg/giv.glb"
BASE_HASH = "7b9691a5665f174da939ea545a6f6f90edf7c3c7f70c85fe40121c1ef51e034a"
BASE_DIR = DEAL / "v2/underlag/handpass"
ORIGINAL = AVATAR / "03_sittande_bakgrund.png"
BACK = AVATAR / "fas-1/v1/hander/handryggar.png"
PALM = AVATAR / "prov-70/v1/referenser/handflator-och-fingerblommor.png"
DIGITS = ("thumb", "index", "middle", "ring", "pinky")
TEXTURE_SIZE = 4096

# Native pixels of the supplied photograph 03, checked against the dorsal hands and their wrists.
# On the front photo Paulina's anatomical right hand is on the left in the image.
ORIGINAL_MARKS = {
    "r": {
        "wrist": [534, 833],
        "thumb": [(604, 850), (636, 872), (656, 887), (674, 896)],
        "index": [(610, 854), (634, 883), (648, 906), (657, 923)],
        "middle": [(590, 859), (614, 887), (632, 908), (642, 928)],
        "ring": [(569, 867), (588, 895), (607, 913), (618, 928)],
        "pinky": [(546, 873), (563, 897), (579, 913), (586, 923)],
    },
    "l": {
        "wrist": [914, 833],
        "thumb": [(840, 850), (812, 871), (789, 886), (774, 896)],
        "index": [(835, 854), (812, 884), (798, 905), (787, 924)],
        "middle": [(856, 859), (832, 886), (812, 908), (801, 928)],
        "ring": [(877, 866), (858, 892), (839, 912), (827, 928)],
        "pinky": [(902, 872), (882, 897), (870, 912), (862, 923)],
    },
}

# Two observed marks on each of the eight exposed fingers in the supplied
# original. The opposed thumb's far side carries no inferred ink.
FINGER_INK = {
    "r": {
        "index": [(629, 870), (643, 896)],
        "middle": [(605, 875), (619, 899)],
        "ring": [(581, 885), (598, 903)],
        "pinky": [(558, 889), (570, 903)],
    },
    "l": {
        "index": [(816, 869), (804, 895)],
        "middle": [(843, 874), (824, 898)],
        "ring": [(863, 885), (849, 899)],
        "pinky": [(889, 891), (880, 902)],
    },
}
MATERIAL_VERSION = 5

# Centre of each cuticle, free edge and half-width, measured separately on the 1536 × 1024 hand photograph.
NAILS = {
    "l": {
        "thumb": [(562, 405), (586, 347), 18],
        "index": [(446, 149), (450, 89), 23],
        "middle": [(356, 101), (358, 37), 23],
        "ring": [(269, 143), (275, 81), 22],
        "pinky": [(177, 234), (179, 184), 17],
    },
    "r": {
        "thumb": [(712, 406), (684, 348), 18],
        "index": [(841, 143), (839, 84), 20],
        "middle": [(933, 101), (934, 37), 23],
        "ring": [(1018, 144), (1017, 83), 22],
        "pinky": [(1104, 234), (1102, 185), 17],
    },
}
NAIL_LENGTH = dict(thumb=0.0144, index=0.0119, middle=0.0134, ring=0.0124, pinky=0.0103)
PHOTO_WIDTH = dict(
    thumb=(41, 34, 28, 20),
    index=(33, 29, 25, 18),
    middle=(38, 33, 28, 20),
    ring=(33, 29, 25, 17),
    pinky=(26, 23, 19, 14),
)
IDENTITY = "5a48e0e6e1286b5310ee42f8c93fad33d3f3d663076f3461d223bc64a09a71d9"
PHOTO_PROJECTION = BASE_DIR / "referenser/03-projektion/01-03_sittande_bakgrund.npz"
NATIVE_BODY = AVATAR / "prov-70/v1/modell/kropp.glb"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(document):
    return (json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def registry_sources():
    frame = json.loads((AVATAR / "fas-1/v1/bildregister.json").read_text(encoding="utf8"))
    known_back = next(row["sha256"] for row in frame["bilder"] if row["fil"] == "hander/handryggar.png")
    palm_registry = json.loads((PALM.parent / "bildregister.json").read_text(encoding="utf8"))
    known_palm = next(
        row["sha256"] for row in palm_registry["entries"] if row["path"] == "referenser/" + PALM.name
    )
    fingerprints = {"original03": sha(ORIGINAL), "handryggar": sha(BACK), "handflator": sha(PALM)}
    if (
        fingerprints["original03"] != IDENTITY
        or fingerprints["handryggar"] != known_back
        or fingerprints["handflator"] != known_palm
    ):
        raise ValueError("Handkällorna stämmer inte med sina registrerade filversioner.")
    return fingerprints


def marks(series, side):
    if series == "original":
        return {key: np.asarray(v, dtype=float) for key, v in ORIGINAL_MARKS[side].items()}
    if series == "back":
        return {key: np.asarray(v, dtype=float) * 2.4 for key, v in HAND_MARKS[side].items()}
    points = np.asarray(PALM_LANDMARKS[side], dtype=float) * 2
    return {"wrist": points[0], **{d: points[1 + 4 * i : 5 + 4 * i] for i, d in enumerate(DIGITS)}}


class CleanPhoto:
    def __init__(self, image, side, view):
        rgb = np.asarray(image.convert("RGB"))
        self.marks = marks(view, side)
        if view == "original":
            x0, y0, x1, y1 = (496, 817, 680, 934) if side == "r" else (765, 817, 956, 934)
        elif view == "back":
            x0, y0, x1, y1 = (125, 28, 617, 863) if side == "l" else (655, 28, 1152, 871)
        else:
            x0, y0, x1, y1 = (170, 14, 731, 864) if side == "r" else (792, 14, 1365, 868)
        self.offset = np.array([x0, y0])
        part = rgb[y0:y1, x0:x1]
        colour = part.astype(np.int16)
        red, green, blue = colour.transpose(2, 0, 1)
        tissue = (red > 58) & (red - blue > 21) & (red - green > 8)
        kernel = np.ones((3, 3) if view == "original" else (7, 7), np.uint8)
        closed = cv2.morphologyEx(tissue.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        component = np.zeros_like(closed)
        cv2.drawContours(component, [max(contours, key=cv2.contourArea)], -1, 1, -1)
        # The photographed tabletop is mauve, also between adjacent fingers. A
        # filled contour alone would admit that enclosed grey background. Keep
        # muted dark tattoo pigment only inside true skin on every side.
        inner = cv2.erode(component, np.ones((5, 5) if view == "original" else (9, 9), np.uint8)).astype(bool)
        near_tissue = cv2.morphologyEx(tissue.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool)
        dark_ink = inner & near_tissue & (red < 147) & (red > 48) & (red - blue > 6) & (red - green > 1)
        safe = cv2.erode(component, np.ones((3, 3) if view == "original" else (7, 7), np.uint8)).astype(bool) & (
            tissue | dark_ink
        )
        distance, nearest = distance_transform_edt(~safe, return_indices=True)
        self.rgb = np.ascontiguousarray(part[nearest[0], nearest[1]])
        self.distance = distance.astype(np.float32)
        self.interior = distance_transform_edt(safe).astype(np.float32)
        self.micro = self.rgb.astype(np.float32) - cv2.GaussianBlur(self.rgb.astype(np.float32), (0, 0), 2.15)
        if view == "original":
            native = self.rgb.astype(np.float32)
            self.rgb = np.clip(native + 0.52 * (native - cv2.GaussianBlur(native, (0, 0), 1.15)), 0, 255)
        bright = safe & (colour[..., 0] > 155) & (colour[..., 1] > 88) & (colour[..., 2] < colour[..., 0] - 15)
        self.tone = np.median(part[bright], axis=0)

    def fetch(self, coordinates, micro=False):
        return rgb_at(self.micro if micro else self.rgb, coordinates - self.offset)

    def boundary(self, coordinates):
        xy = np.rint(coordinates - self.offset).astype(int)
        x = np.clip(xy[:, 0], 0, self.distance.shape[1] - 1)
        y = np.clip(xy[:, 1], 0, self.distance.shape[0] - 1)
        over = np.linalg.norm(xy - np.column_stack((x, y)), axis=1)
        return self.distance[y, x] + over - self.interior[y, x]


def source_projection(positions, hand_vertices):
    if not PHOTO_PROJECTION.is_file():
        from sam_photo import estimate

        from os import environ

        sam_repo = Path(environ.get("SAM_3D_BODY_REPO", Path.home() / "dev/sam-3d-body"))
        with TemporaryDirectory(prefix="paulina-original03-") as scratch:
            estimate(sam_repo, [ORIGINAL], Path(scratch), mesh_only=True)
            data = (Path(scratch) / PHOTO_PROJECTION.name).read_bytes()
            publish(PHOTO_PROJECTION.parent, {PHOTO_PROJECTION.name: data})
    original_body = Glb(NATIVE_BODY)
    p = original_body.doc["meshes"][0]["primitives"][0]
    original_vertices = original_body.read(p["attributes"]["POSITION"])
    distance, old_ids = cKDTree(original_vertices).query(positions)
    if np.any(distance[hand_vertices] > 2e-7):
        raise ValueError("En handspets saknar motsvarighet i ursprungskroppens topologi.")
    with np.load(PHOTO_PROJECTION) as photo:
        camera_vertices = photo["pred_vertices"] + photo["pred_cam_t"]
        if len(original_vertices) != len(camera_vertices):
            raise ValueError("Original 03 har en annan SAM-topologi.")
        if not np.array_equal(
            np.sort(original_body.read(p["indices"]).reshape(-1, 3), axis=1), np.sort(photo["faces"], axis=1)
        ):
            raise ValueError("Original 03:s trianglar motsvarar inte grundkroppen.")
        factor = photo["focal_length"] * photo["original_size"] / photo["inference_size"]
        projected = camera_vertices[:, :2] / camera_vertices[:, 2:] * factor + photo["original_size"] * 0.5
        normals = trimesh.Trimesh(camera_vertices, photo["faces"], process=False).vertex_normals
        front = (normals * unit(-camera_vertices)).sum(1)
        width, height = photo["original_size"]
        faces = photo["faces"]
        depth = camera_vertices[:, 2]
        depth_order = np.argsort(depth[faces].mean(1))[::-1]
        target = triangles_at(projected, faces, width, height, depth_order)
        sample = np.clip(np.rint(projected).astype(int), [0, 0], [width - 1, height - 1])
        surface = target[sample[:, 1], sample[:, 0]]
        surface_faces = faces[np.maximum(0, surface)]
        weights = np.clip(barycentric(projected, projected[surface_faces]), 0, 1)
        weights /= np.maximum(weights.sum(1, keepdims=True), 1e-9)
        difference = depth - (weights * depth[surface_faces]).sum(1)
        visibility = (surface >= 0) * mix(0.035, 0.48, front) * (1 - mix(0.002, 0.008, difference))
    return projected[old_ids], visibility[old_ids]


def side_coordinates(xyz, normal, weights, joints, names, world, side, photos, original_projection):
    bone_names = np.asarray(names)
    side_ids = {digit: np.char.startswith(bone_names, side + "_" + digit) for digit in DIGITS}
    hand_bones = np.char.startswith(bone_names, side + "_wrist") | np.logical_or.reduce(list(side_ids.values()))
    mass = (hand_bones[joints] * weights).sum(axis=1)

    def location(bone):
        return world[names.index(side + "_" + bone), :3, 3]

    wrist = location("wrist")
    bones = {"wrist": wrist}
    for digit in DIGITS:
        bones[digit] = np.stack([location(digit + level) for level in ("1", "2", "3", "_null")])
    forward = unit(bones["middle"][0] - wrist)
    cross_hand = unit(bones["index"][0] - bones["pinky"][0])
    dorsal = unit(np.cross(forward, cross_hand))
    if dorsal[1] < 0:
        dorsal = -dorsal
    anchors = np.vstack([wrist, *[bones[d] for d in DIGITS]])
    models = {}
    for view, source in photos.items():
        if view == "original":
            continue
        ref = np.vstack([source.marks["wrist"], *[source.marks[d] for d in DIGITS]])
        models[view] = RBFInterpolator(
            np.vstack([anchors, anchors + 0.014 * dorsal]) * 100, np.vstack([ref, ref]), smoothing=0.05
        )
    eligible = mass > 0.001
    store = {view: np.zeros((len(xyz), 2)) for view in photos}
    for view, model in models.items():
        store[view][eligible] = model(xyz[eligible] * 100)
    # The oblique hand in photograph 03 has its own camera. Its true projected
    # MHR surface preserves the round central rose and the foreshortened knuckles.
    store["original"][eligible] = original_projection[eligible]
    facing = normal @ dorsal
    along = (xyz - wrist) @ forward
    distal = np.zeros(len(xyz))
    nail_data, nail_specs = {}, {}
    for d in DIGITS:
        influence = (side_ids[d][joints] * weights).sum(axis=1)
        active = influence > 0.005
        p = xyz[active]
        chain = bones[d]
        dxyz = np.diff(chain, axis=0)
        lengths = np.linalg.norm(dxyz, axis=1)
        direction = dxyz / lengths[:, None]
        nref = dorsal if d != "thumb" else unit(0.67 * dorsal + 0.82 * cross_hand)
        tops = unit(nref - direction * (direction @ nref)[:, None])
        across = unit(np.cross(direction, tops))
        across *= np.where(across @ cross_hand >= 0, 1, -1)[:, None]
        delta = p[:, None] - chain[None, :3]
        projected = np.einsum("vij,ij->vi", delta, direction)
        t = np.clip(projected / lengths, 0, 1)
        nearest = chain[None, :3] + t[..., None] * dxyz
        segment = np.linalg.norm(p[:, None] - nearest, axis=2).argmin(1)
        serial = np.arange(len(p))
        t = t[serial, segment]
        lateral = np.einsum("vi,vi->v", p - nearest[serial, segment], across[segment])
        dominant = influence[active] > 0.56
        spans = []
        mids = []
        for seg in range(3):
            sample = lateral[(segment == seg) & dominant]
            lo, hi = np.quantile(sample, [0.015, 0.985])
            spans.append(max((hi - lo) * 0.5, 0.004))
            mids.append((lo + hi) * 0.5)
        width = np.asarray(spans)[segment]
        relative = np.clip((lateral - np.asarray(mids)[segment]) / width, -1.0, 1.0)
        relnormal = np.einsum("vi,vi->v", normal[active], tops[segment])
        factor = mix(0.09, 0.72, influence[active])
        facing[active] += (relnormal - facing[active]) * factor
        longitudinal = (segment + t) / 3
        distal[active] = np.maximum(distal[active], mix(0.66, 0.94, longitudinal) * factor)
        for view, source in photos.items():
            pts = source.marks[d]
            if view == "original":
                serial_pos = segment + t
                measured = []
                for level in range(4):
                    # Match the visible dorsal skin to its landmark, not the joint
                    # centre behind the skin. The central hand keeps its measured projection.
                    eligible_landmark = dominant & (relnormal > 0.48) & (np.abs(relative) < 0.66)
                    cost = abs(serial_pos - level) + 0.15 * abs(relative)
                    near = np.flatnonzero(eligible_landmark)
                    near = near[np.argsort(cost[near])[: min(12, len(near))]]
                    measured.append(np.median(original_projection[active][near], axis=0))
                shifts = np.asarray(pts) - np.asarray(measured)
                shifts[0] *= 0.17
                shift = shifts[segment] * (1 - t[:, None]) + shifts[segment + 1] * t[:, None]
                store[view][active] += shift * factor[:, None]
            rays = unit(np.diff(pts, axis=0))
            transverse = np.column_stack((-rays[:, 1], rays[:, 0]))
            toward_index = unit(source.marks["index"][0] - source.marks["pinky"][0])
            transverse *= np.where(transverse @ toward_index >= 0, 1, -1)[:, None]
            scale = 0.27 if view == "original" else 1.10 if view == "palm" else 1.0
            widths = np.asarray(PHOTO_WIDTH[d]) * scale
            source_width = widths[segment] * (1 - t) + widths[segment + 1] * t
            coords = (
                pts[segment] * (1 - t[:, None])
                + pts[segment + 1] * t[:, None]
                + transverse[segment] * (source_width * relative)[:, None]
            )
            zone = factor
            if view == "original":
                # A finger has a separate local photographic axis. Adjacent
                # fingers and their symbols in the oblique photograph overlap.
                zone = factor * mix(0.02, 0.34, segment + t)
                if d in FINGER_INK[side]:
                    q = segment + t
                    p1, p2 = FINGER_INK[side][d]
                    schedule = [0, 0.55, 1, 1.52, 2, 3]
                    controls = np.stack([pts[0], p1, pts[1], p2, pts[2], pts[3]])
                    aim = np.column_stack([np.interp(q, schedule, controls[:, axis]) for axis in (0, 1)])
                    coords = aim + transverse[segment] * (source_width * relative)[:, None]
            store[view][active] += (coords - store[view][active]) * zone[:, None]
        terminal = (xyz - chain[2]) @ direction[2]
        extent = float(np.quantile(terminal[active][dominant], 0.999))
        strip = (terminal > extent - NAIL_LENGTH[d] * 1.27) & (influence > 0.55)
        lateral = (xyz - chain[2]) @ across[2]
        lo, hi = np.quantile(lateral[strip], [0.01, 0.99])
        mid = (lo + hi) * 0.5
        nail_width = (hi - lo) * (0.36 if d == "thumb" else 0.365)
        end = extent - (0.0011 if d == "thumb" else 0.00065)
        uv = np.column_stack(
            (
                (lateral - mid) / nail_width,
                (terminal - (end - NAIL_LENGTH[d])) / NAIL_LENGTH[d],
                (xyz - chain[2]) @ tops[2],
                normal @ tops[2],
                influence,
            )
        )
        nail_data[d] = uv
        nail_specs[d] = {
            "physicalLengthMm": round(NAIL_LENGTH[d] * 1000, 2),
            "physicalWidthMm": round(2 * nail_width * 1000, 2),
            "photoCuticleEdgeAndHalfWidthPx": NAILS[side][d],
        }
    return mass, store, facing, along, distal, nail_data, nail_specs


def png(image):
    ok, data = cv2.imencode(
        ".png",
        cv2.cvtColor(image, cv2.COLOR_RGB2BGR) if image.ndim == 3 else image,
        [cv2.IMWRITE_PNG_COMPRESSION, 4],
    )
    if not ok:
        raise ValueError("PNG-kodning misslyckades.")
    return data.tobytes()


def bake(glb):
    primitive = glb.doc["meshes"][0]["primitives"][0]
    attr = {key: glb.read(index) for key, index in primitive["attributes"].items()}
    faces = glb.read(primitive["indices"]).ravel().reshape(-1, 3)
    image_record, baseline = image_buffer(glb, primitive)
    height, width = baseline.shape[:2]
    if height != width or height != 2048:
        raise ValueError("Den registrerade kroppens UV-utgångspunkt stämmer inte.")
    rgb = cv2.resize(baseline, (TEXTURE_SIZE, TEXTURE_SIZE), interpolation=cv2.INTER_LINEAR)
    roughness = np.full((TEXTURE_SIZE, TEXTURE_SIZE), 255, np.uint8)
    uv = attr["TEXCOORD_0"] * (TEXTURE_SIZE - 1)
    names, _, parents, rest = hierarchy(glb)
    world = world_matrices(rest, parents)
    hand_joint = np.array(
        [name[0:2] in ("l_", "r_") and name[2:].startswith(("wrist", *DIGITS)) for name in names]
    )
    hand_vertices = (hand_joint[attr["JOINTS_0"]] * attr["WEIGHTS_0"]).sum(1) > 0.001
    original_projection, original_visibility = source_projection(attr["POSITION"], hand_vertices)
    original = Image.open(ORIGINAL)
    back = Image.open(BACK)
    palms = Image.open(PALM)
    stats = {}
    for side in ("l", "r"):
        thumb_joints = np.char.startswith(np.asarray(names), side + "_thumb")
        thumb_weight = (thumb_joints[attr["JOINTS_0"]] * attr["WEIGHTS_0"]).sum(1)
        photos = {
            k: CleanPhoto(img, side, k) for k, img in (("original", original), ("back", back), ("palm", palms))
        }
        mass, coord, face, longitudinal, ends, nails, specification = side_coordinates(
            attr["POSITION"],
            attr["NORMAL"],
            attr["WEIGHTS_0"],
            attr["JOINTS_0"],
            names,
            world,
            side,
            photos,
            original_projection,
        )
        selected = np.flatnonzero(mass[faces].max(1) > 0.07)
        verts = uv[faces[selected].ravel()]
        lo = np.maximum(np.floor(verts.min(0)).astype(int) - 2, 0)
        hi = np.minimum(np.ceil(verts.max(0)).astype(int) + 3, TEXTURE_SIZE)
        labels = triangles_at(
            uv - lo, faces[selected], int(hi[0] - lo[0]), int(hi[1] - lo[1]), np.arange(len(selected))
        )
        used = 0
        plate_counts = {d: 0 for d in DIGITS}
        tissue_tone = {
            view: np.clip(photos["original"].tone - source.tone, [-12, -10, -10], [12, 16, 23])
            for view, source in photos.items()
        }
        for line in range(0, len(labels), 48):
            area = labels[line : line + 48]
            yy, xx = np.nonzero(area >= 0)
            if not len(xx):
                continue
            corners = faces[selected[area[yy, xx]]]
            x, y = xx + lo[0], yy + lo[1] + line
            bw = np.clip(barycentric(np.column_stack((x, y)), uv[corners]), 0, 1)
            bw /= np.maximum(bw.sum(1, keepdims=True), 1e-10)

            def sample(value):
                return np.einsum("vi,vi...->v...", bw, value[corners])

            coords = {view: sample(value) for view, value in coord.items()}
            old = rgb[y, x].astype(float)
            source = photos["back"].fetch(coords["back"]) + tissue_tone["back"]
            pad = photos["palm"].fetch(coords["palm"]) + tissue_tone["palm"]
            identity = photos["original"].fetch(coords["original"])
            detail = np.clip(photos["back"].fetch(coords["back"], micro=True), -4.5, 4.5)
            exact = (1 - mix(-2.5, 0.8, photos["original"].boundary(coords["original"]))) * (1 - sample(ends))
            palm_direction = sample(face)
            visibility = sample(original_visibility)
            thumb = mix(0.12, 0.74, sample(thumb_weight))
            exact *= mix(0.00, 0.57, palm_direction) * visibility * (1 - 0.84 * thumb)
            dorsal = source + exact[:, None] * (identity + 0.81 * detail - source)
            # The opposed side of either thumb is behind the index on photo
            # 03. Choose continuous skin from that same thumb in the palm view.
            dorsal += (0.78 * thumb * (1 - visibility))[:, None] * (pad - dorsal)
            top = mix(-0.38, 0.40, palm_direction)
            painted = pad + top[:, None] * (dorsal - pad)
            # A pale, cool pixel between fingers on the original belongs to
            # the tabletop. Replace any residue after filtering with measured
            # lateral skin, while admitting the darker neutral tattoo ink.
            pale = mix(104, 156, painted[:, 0]) * (1 - mix(12, 29, painted[:, 0] - painted[:, 2]))
            painted += pale[:, None] * (pad - painted)
            hand_cover = mix(0.16, 0.73, sample(mass)) * mix(-0.010, 0.024, sample(longitudinal))
            # Signed source coordinates keep every individual nail on its own dorsal distal phalanx.
            nail_cover = np.zeros(len(x))
            for finger, value in nails.items():
                transverse, t, radial, dot, owner = sample(value).T
                outline = (abs(transverse) ** 2.8 + abs((t - 0.5) * 2) ** 3.3) ** (1 / 2.9)
                alpha = (
                    (1 - mix(0.95, 1.065, outline))
                    * mix(0.06, 0.64, dot)
                    * mix(-0.0004, 0.0021, radial)
                    * mix(0.15, 0.70, owner)
                )
                pick = np.flatnonzero(alpha > 0.0001)
                if not len(pick):
                    continue
                cut, tip, w = NAILS[side][finger]
                cut, tip = np.array(cut), np.array(tip)
                dx = unit(tip - cut)
                across = np.array([-dx[1], dx[0]])
                if across @ (photos["back"].marks["index"][0] - photos["back"].marks["pinky"][0]) < 0:
                    across = -across
                source_xy = (
                    cut
                    + (tip - cut) * np.clip(t[pick], 0, 1)[:, None]
                    + across * (np.clip(transverse[pick], -1, 1) * w)[:, None]
                )
                genuine = photos["back"].fetch(source_xy) + tissue_tone["back"]
                painted[pick] += (genuine - painted[pick]) * alpha[pick, None]
                nail_cover[pick] = np.maximum(nail_cover[pick], alpha[pick])
                plate_counts[finger] += int(np.sum(alpha > 0.45))
            rgb[y, x] = np.uint8(np.clip(np.rint(old + (painted - old) * hand_cover[:, None]), 0, 255))
            roughness[y, x] = np.uint8(np.clip(np.rint(255 - hand_cover * (15 + 125 * nail_cover)), 0, 255))
            used += int(np.sum(hand_cover > 0.5))
        stats[side] = {
            "skinTexelsOverHalfCoverage": used,
            "nailTexels": plate_counts,
            "nails": specification,
            "original03ToneRGB": np.round(photos["original"].tone, 1).tolist(),
        }
    return image_record, png(rgb), png(roughness), stats


def raw_view(glb, index):
    view = glb.doc["bufferViews"][index]
    start = view.get("byteOffset", 0)
    return bytes(glb.data[start : start + view["byteLength"]])


def array_hash(glb, indices):
    hashed = hashlib.sha256()
    for i in indices:
        acc = glb.doc["accessors"][i]
        data = glb.read(i)
        hashed.update(json.dumps([i, acc["type"], acc["componentType"], acc["count"]]).encode())
        hashed.update(data.tobytes())
    return hashed.hexdigest()


def physics_hashes(glb):
    grouped = {}
    for mesh in glb.doc["meshes"]:
        for primitive in mesh["primitives"]:
            grouped.setdefault("indices", set()).add(primitive["indices"])
            for name, index in primitive["attributes"].items():
                grouped.setdefault(name, set()).add(index)
    grouped["inverseBindMatrices"] = {skin["inverseBindMatrices"] for skin in glb.doc["skins"]}
    grouped["animationClocksAndValues"] = {
        s[key] for clip in glb.doc.get("animations", []) for s in clip["samplers"] for key in ("input", "output")
    }
    hashes = {name: array_hash(glb, sorted(ids)) for name, ids in grouped.items()}
    hashes["allAccessors"] = array_hash(glb, range(len(glb.doc["accessors"])))
    for key in ("scenes", "nodes", "meshes", "skins", "animations"):
        hashes[key + "Json"] = digest(json_bytes(glb.doc[key]))
    return hashes


def body_hash(glb):
    body = glb.doc["meshes"][0]["primitives"][0]
    ids = [body["indices"], *body["attributes"].values(), glb.doc["skins"][0]["inverseBindMatrices"]]
    return array_hash(glb, sorted(ids))


def publish(folder, records):
    for name, data in records.items():
        destination = folder / name
        if destination.exists() and sha(destination) != digest(data):
            raise FileExistsError(f"{destination} tillhör en annan utgåva. Välj en separat mapp.")
    for name, data in records.items():
        put(folder / name, data, digest(data))


def package_material(glb, folder, fingerprints):
    baseline_body = body_hash(glb)
    receipt = folder / "handmaterial.json"
    if receipt.is_file():
        material = json.loads(receipt.read_text(encoding="utf8"))
        if (
            material["version"] != MATERIAL_VERSION
            or material["sourceSHA256"] != fingerprints
            or material["neutralBodyAccessorSha256"] != baseline_body
            or material["nativeTopologySceneSha256"] != sha(NATIVE_BODY)
            or (PHOTO_PROJECTION.is_file() and material["original03ProjectionSha256"] != sha(PHOTO_PROJECTION))
        ):
            raise ValueError("Materialet tillhör andra foton eller en annan bindgeometri.")
        albedo = (folder / "hud-och-naglar.png").read_bytes()
        rough = (folder / "nagelglans.png").read_bytes()
        if digest(albedo) != material["albedoSha256"] or digest(rough) != material["roughnessSha256"]:
            raise ValueError("Den sparade handtexturen stämmer inte med materialets kvitto.")
        return albedo, rough, material
    _, albedo, rough, stats = bake(glb)
    if min(m["nailTexels"][finger] for m in stats.values() for finger in DIGITS) < 450:
        raise ValueError("Minst en nagel saknar tillräcklig yttäckning.")
    material = {
        "version": MATERIAL_VERSION,
        "width": TEXTURE_SIZE,
        "height": TEXTURE_SIZE,
        "originalBodyTextureSize": 2048,
        "neutralBodyAccessorSha256": baseline_body,
        "original03ProjectionSha256": sha(PHOTO_PROJECTION),
        "nativeTopologySceneSha256": sha(NATIVE_BODY),
        "sourceSHA256": fingerprints,
        "sources": {
            "original03": ORIGINAL.relative_to(ROOT).as_posix(),
            "handryggar": BACK.relative_to(ROOT).as_posix(),
            "handflator": PALM.relative_to(ROOT).as_posix(),
        },
        "sourceRoles": {
            "original03": "Tillfört original. Båda handryggarnas motiv och fingertecken.",
            "handryggar": "Registrerad genererad detaljbild. Tio individuella nagelplattor, hudveck och nagelband.",
            "handflator": "Registrerad genererad komplettering. Handflator och fingerblommor.",
        },
        "albedoSha256": digest(albedo),
        "roughnessSha256": digest(rough),
        "coverage": stats,
    }
    publish(
        folder, {"hud-och-naglar.png": albedo, "nagelglans.png": rough, "handmaterial.json": json_bytes(material)}
    )
    return albedo, rough, material


def apply_material(glb, albedo, rough):
    p = glb.doc["meshes"][0]["primitives"][0]
    body = glb.doc["materials"][p["material"]]
    pbr = body["pbrMetallicRoughness"]
    texture = glb.doc["textures"][pbr["baseColorTexture"]["index"]]
    rgb = glb.doc["images"][texture["source"]]
    view = rgb["bufferView"]
    chunks = [raw_view(glb, i) for i in range(len(glb.doc["bufferViews"]))]
    chunks[view] = albedo
    rgb["mimeType"] = "image/png"
    rgb["name"] = "Paulina · original 03, handhud och tio nagelplattor"
    glb.data = bytearray()
    for record, chunk in zip(glb.doc["bufferViews"], chunks):
        glb.data.extend(b"\0" * (-len(glb.data) % 4))
        record["byteOffset"], record["byteLength"] = len(glb.data), len(chunk)
        glb.data.extend(chunk)
    rough_image = len(glb.doc["images"])
    glb.doc["images"].append(
        {"name": "Handhud och nagelplattors glans", "bufferView": glb.buffer(rough), "mimeType": "image/png"}
    )
    pbr["metallicRoughnessTexture"] = {"index": len(glb.doc["textures"])}
    glb.doc["textures"].append({"source": rough_image})


def build(source, folder, material_dir, source_receipt=None):
    if sha(BASE) != BASE_HASH:
        raise ValueError("Den godkända v1-GLB:n stämmer inte med sin kontrollsumma.")
    original = Glb(BASE)
    glb = Glb(source)
    if body_hash(original) != body_hash(glb):
        raise ValueError("UV, positioner, trianglar eller hudbindning skiljer sig från den godkända modellen.")
    source_hash = sha(source)
    info = json.loads((source_receipt or source.with_name("givmatning.json")).read_text(encoding="utf8"))
    if info["sceneSha256"] != source_hash:
        raise ValueError("Rörelsekvittot tillhör en annan GLB.")
    original_physics = physics_hashes(glb)
    albedo, rough, material = package_material(original, material_dir, registry_sources())
    apply_material(glb, albedo, rough)
    material_sha = digest(json_bytes(material))
    glb.doc["asset"].setdefault("extras", {})["handAppearance"] = {
        "parentSceneSha256": source_hash,
        "materialSha256": material_sha,
    }
    with TemporaryDirectory(prefix="paulina-handhud-") as temp:
        path = glb.save(Path(temp) / "giv.glb")
        checked = Glb(path)
        physical = physics_hashes(checked)
        if physical != original_physics:
            raise ValueError("Kropp, rigg, UV, kort, ledanimation eller spelmål har ändrats.")
        result = path.read_bytes()
    info["sceneSha256"] = digest(result)
    info["parentSceneSha256"] = source_hash
    info["appearanceMaterialSha256"] = material_sha
    info["appearance"] = {
        "sourceReferenceSceneSha256": BASE_HASH,
        "verifiedAgainstParent": True,
        "geometryAndAnimationSha256": physical,
        "material": material,
        "comparisonReference": {"frame": 92, "fps": 24, "timeSeconds": 92 / 24},
    }
    publish(folder, {"giv.glb": result, "givmatning.json": json_bytes(info)})
    print(folder / "giv.glb", info["sceneSha256"], "material", material_sha, flush=True)
    print({s: v["nailTexels"] for s, v in material["coverage"].items()}, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=BASE)
    parser.add_argument("--source-receipt", type=Path)
    parser.add_argument("--out-dir", type=Path, default=BASE_DIR)
    parser.add_argument("--material-dir", type=Path, default=BASE_DIR / "material")
    args = parser.parse_args()
    build(args.source, args.out_dir, args.material_dir, args.source_receipt)
