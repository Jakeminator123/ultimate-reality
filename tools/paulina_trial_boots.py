"""Fit the photographed ankle boots at the trouser hem of Paulina's seated MHR mesh.

The foot triangles are replaced up to one existing edge loop per ankle. The
two primitives of each boot partition one surface into leather and rubber.
All coordinates are in the same posed glTF bind space (metres, +Y up).
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from scipy.spatial import cKDTree

from paulina_utseende import CORRECTED_PROFILE_SHA, sha


PROFILE = Path(__file__).resolve().parents[1] / "avatars/paulina/fas-1/v1/granskning/sittprofil-front-v3/profil.png"
# The near boot in the registered 1083 × 1452 profile faces left. The chair
# leg begins to its right. The crops and endpoints are in source pixels.
CROP = (91, 1201, 334, 1375)
PROFILE_HEEL_X, PROFILE_TOE_X, PROFILE_FLOOR_Y = 329, 98, 1370
HEM_HEIGHT = .160


def leather_texture():
    if sha(PROFILE) != CORRECTED_PROFILE_SHA:
        raise ValueError("Boot texture landmarks require the measured sitting profile v3.")
    image = np.array(Image.open(PROFILE).convert("RGB").crop(CROP))
    inside = (image.max(axis=2) < 150).astype(np.uint8)
    _, labels, stats, _ = cv2.connectedComponentsWithStats(inside)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    inside = cv2.erode((labels == largest).astype(np.uint8), np.ones((5, 5), np.uint8))
    nearest = distance_transform_edt(~inside.astype(bool), return_distances=False, return_indices=True)
    return image[nearest[0], nearest[1]]


def rim(vertices, removed_faces, sam_ids, sign, along, across):
    canonical = sam_ids[removed_faces]
    edges = np.sort(canonical[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2), axis=1)
    edges, count = np.unique(edges, axis=0, return_counts=True)
    inv = np.zeros(int(sam_ids.max()) + 1, dtype=int)
    inv[sam_ids] = np.arange(len(sam_ids))
    boundary = inv[edges[count == 1]]
    boundary = boundary[(vertices[boundary[:, 0], 0] * sign) > 0]
    ids, degrees = np.unique(boundary, return_counts=True)
    if len(ids) < 12 or np.any(degrees != 2):
        raise ValueError("Expected a closed ankle rim at the trouser hem.")
    planar = np.column_stack((vertices[ids] @ across, vertices[ids] @ along))
    centre = (planar.min(0) + planar.max(0)) / 2
    radial = (planar - centre) / (np.ptp(planar, axis=0) / 2)
    angles = np.arctan2(radial[:, 0], radial[:, 1]) % (2 * np.pi)
    order = np.argsort(angles)
    loop = ids[order]
    expected = set(map(tuple, np.sort(boundary, axis=1)))
    if set(map(tuple, np.sort(np.column_stack((loop, np.roll(loop, -1))), axis=1))) != expected:
        # A photographed trouser cuff can fold back over the same azimuth.
        neighbours = {int(i): [] for i in ids}
        for a, b in boundary:
            neighbours[a].append(b)
            neighbours[b].append(a)
        chain = [loop[0]]
        nxt = min(neighbours[chain[0]], key=lambda i: (angles[np.searchsorted(ids, i)] - angles[order[0]]) % (2*np.pi))
        while nxt != chain[0] and len(chain) < len(loop):
            chain.append(nxt)
            nxt = next(q for q in neighbours[nxt] if q != chain[-2])
        if nxt != chain[0] or len(chain) != len(loop):
            raise ValueError("Unexpected topology at the ankle.")
        loop = np.asarray(chain)
        path = vertices[loop]
        arcs = np.linalg.norm(path - np.roll(path, 1, axis=0), axis=1)
        return loop, np.r_[0., np.cumsum(arcs[1:])] / arcs.sum() * (2*np.pi)
    return loop, angles[order]


def join_loops(top, top_angles, bottom, bottom_angles):
    """Triangulate a band without introducing unmatched vertices along either rim."""
    i = j = 0
    faces = []
    while i < len(top) or j < len(bottom):
        a, b = top[i % len(top)], bottom[j % len(bottom)]
        t = top_angles[i + 1] if i + 1 < len(top) else 2*np.pi + top_angles[0]
        u = bottom_angles[j + 1] if j + 1 < len(bottom) else 2*np.pi + bottom_angles[0]
        if i < len(top) and (t < u or j == len(bottom)):
            faces.append([a, b, top[(i+1) % len(top)]])
            i += 1
        else:
            faces.append([a, b, bottom[(j+1) % len(bottom)]])
            j += 1
    return faces


def transfer_weights(old_points, old_joints, old_weights, new_points):
    # Interpolate in posed space, retaining the four largest MHR influences per vertex.
    distances, closest = cKDTree(old_points).query(new_points, k=4)
    factors = 1 / np.maximum(distances, .0001) ** 2
    factors /= factors.sum(axis=1, keepdims=True)
    blended = np.zeros((len(new_points), int(old_joints.max()) + 1))
    rows = np.broadcast_to(np.arange(len(new_points))[:, None, None], old_joints[closest].shape)
    np.add.at(blended, (rows, old_joints[closest]), old_weights[closest] * factors[:, :, None])
    joints = np.argsort(blended, axis=1)[:, -4:][:, ::-1]
    weights = np.take_along_axis(blended, joints, axis=1)
    return joints.astype("<u2"), (weights / weights.sum(axis=1, keepdims=True)).astype("<f4")


def write_primitive(glb, points, faces, joints, weights, material, uv=None):
    used, index = np.unique(faces, return_inverse=True)
    triangles = index.reshape(-1, 3)
    sub = points[used]
    a, b, c = sub[triangles].transpose(1, 0, 2)
    face_vectors = np.cross(b-a, c-a)
    normals = np.zeros_like(sub)
    for column in triangles.T:
        np.add.at(normals, column, face_vectors)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    attrs = {"POSITION": glb.accessor(sub.astype("<f4"), "VEC3"),
             "NORMAL": glb.accessor(normals.astype("<f4"), "VEC3"),
             "JOINTS_0": glb.accessor(joints[used], "VEC4"), "WEIGHTS_0": glb.accessor(weights[used], "VEC4")}
    if uv is not None:
        attrs["TEXCOORD_0"] = glb.accessor(uv[used].astype("<f4"), "VEC2")
    return {"attributes": attrs, "indices": glb.accessor(triangles.astype("<u2").ravel(), "SCALAR", True),
            "material": material, "mode": 4}


def shoe(glb, attr, removed_faces, side, joints_world, material, rubber):
    positions, sam_ids = attr["POSITION"], attr["_SAM_INDEX"].ravel()
    sign = -1 if side == "r" else 1
    ankle = joints_world[side+"_foot"]
    forward = joints_world[side+"_ball"] - joints_world[side+"_subtalar"]
    forward[1] = 0
    forward /= np.linalg.norm(forward)
    across = np.array([forward[2], 0., -forward[0]])
    up = np.array([0., 1., 0.])
    seam, seam_angles = rim(positions, removed_faces, sam_ids, sign, forward, across)
    # A threshold through the original ankle grid makes a stair-step hem.
    # Level the shared sewing edge while preserving the drape of the trouser leg.
    old_hem = positions[seam, 1].copy()
    hem = np.median(old_hem) + .0018 * np.cos(seam_angles) + sign * .001 * np.sin(seam_angles)
    for original, height in zip(sam_ids[seam], hem):
        positions[sam_ids == original, 1] = height
    source = np.unique(removed_faces)
    source = source[positions[source, 0] * sign > 0]
    depth = positions[source] @ forward
    heel, toe = depth.min() - .005, depth.max() + .007
    length = toe - heel
    centre = ankle @ across
    # Additional opposing stations create a short vertical block-heel face before the arch.
    half = np.unique(np.r_[np.linspace(0, np.pi, 37), np.arccos(2*np.array([.278, .284, .34, .51, .56])-1)])
    angles = np.r_[half, 2*np.pi - half[-2:0:-1]]
    fore = (1 + np.cos(angles)) / 2
    width_profile = np.interp(fore, [0, .20, .40, .64, .81, 1], [.82, .82, .80, 1.0, 1.0, .90])
    transverse = np.sign(np.sin(angles)) * np.abs(np.sin(angles)) ** .69
    upper_sole = np.interp(fore, [0, .29, .45, .67, .91, 1], [.030, .029, .025, .021, .023, .027])
    bottom = np.interp(fore, [0, .035, .278, .284, .34, .51, .56, .91, 1],
                       [.0015, 0, 0, .013, .014, .004, 0, 0, .0055])
    # Height, rear and front fractions of the boot's length and half-width as a
    # fraction of length. The rising vamp reaches the original ankle cuff.
    stations = [(.135, .085, .43, .151), (.117, .075, .46, .155), (.099, .067, .505, .156),
                (.084, .048, .562, .161), (.070, .032, .638, .165), (.059, .027, .713, .172),
                (.051, .022, .797, .179), (.045, .019, .890, .184), (.039, .015, .952, .189),
                (upper_sole + .002, .014, .982, .191), (upper_sole, .002, .998, .198),
                (upper_sole - .0025, 0, 1, .199), (bottom + .0023, .003, .997, .198),
                (bottom, .012, .988, .193)]
    chunks = [positions[seam]]
    previous = np.arange(len(seam))
    previous_angles = seam_angles
    leather_faces, sole_faces = [], []
    for layer, (height, back, front, width) in enumerate(stations):
        z = heel + length * (back + (front - back) * fore)
        x = centre + length * width * transverse * width_profile
        ring = x[:, None]*across + z[:, None]*forward + np.broadcast_to(height, fore.shape)[:, None]*up
        offset = sum(len(chunk) for chunk in chunks)
        current = np.arange(offset, offset+len(angles))
        faces = join_loops(previous, previous_angles, current, angles)
        (leather_faces if layer < 10 else sole_faces).extend(faces)
        chunks.append(ring)
        previous, previous_angles = current, angles
    count = len(previous)
    for j in range(len(half) - 1):
        a, b = previous[j], previous[j+1]
        c, d = previous[-(j+1) % count], previous[-j % count]
        if b != c:
            sole_faces.append([a, c, b])
        if a != d:
            sole_faces.append([a, d, c])
    points = np.vstack(chunks)
    leather_faces, sole_faces = np.array(leather_faces), np.array(sole_faces)
    joints, weights = transfer_weights(positions[source], attr["JOINTS_0"][source], attr["WEIGHTS_0"][source], points)
    joints[:len(seam)], weights[:len(seam)] = attr["JOINTS_0"][seam], attr["WEIGHTS_0"][seam]
    scale = (PROFILE_HEEL_X - PROFILE_TOE_X) / length
    ux = PROFILE_HEEL_X - (points @ forward - heel) * scale
    vy = PROFILE_FLOOR_Y - points[:, 1] * scale
    uv = (np.column_stack((ux, vy)) - CROP[:2]) / (np.array(CROP[2:]) - CROP[:2] - 1)
    uv = uv.clip(0, 1)
    primitives = [write_primitive(glb, points, leather_faces, joints, weights, material, uv),
                  write_primitive(glb, points, sole_faces, joints, weights, rubber, uv)]
    ground = points[sole_faces][np.max(points[sole_faces, 1], axis=1) < .0001]
    contact_normals = np.cross(ground[:, 1]-ground[:, 0], ground[:, 2]-ground[:, 0])
    ground_area = np.linalg.norm(contact_normals, axis=1).sum()/2
    all_faces = np.vstack((leather_faces, sole_faces))
    edges, counts = np.unique(np.sort(all_faces[:, [0,1,1,2,2,0]].reshape(-1,2), axis=1), axis=0, return_counts=True)
    open_edges = set(map(tuple, edges[counts == 1]))
    intended = set(map(tuple, np.sort(np.column_stack((np.arange(len(seam)), np.roll(np.arange(len(seam)), -1))), axis=1)))
    if (open_edges != intended or counts.max() != 2 or ground_area < .004
            or np.any(contact_normals[:, 1] >= 0) or not np.allclose(weights.sum(1), 1)):
        raise ValueError("Boot surface or contact patch failed its fit check.")
    heel_edge = np.argmin(np.abs(fore-.278))
    arch_edge = np.argmin(np.abs(fore-.284))
    return primitives, {"cuffVertices": len(seam), "lengthMm": round(float(length)*1000, 1),
                        "maxHemAdjustmentMm": round(float(np.max(np.abs(hem-old_hem)))*1000, 1),
                        "widthMm": round(float(np.ptp(points @ across))*1000, 1),
                        "groundYmm": round(float(points[:, 1].min())*1000, 2),
                        "flatContactCm2": round(float(ground_area)*10000, 1),
                        "frontHeelFaceMm": round(float(bottom[arch_edge] - bottom[heel_edge])*1000, 1),
                        "heelHeightMm": round(float(upper_sole[heel_edge])*1000, 1),
                        "archGapMm": round(float(bottom.max())*1000, 1),
                        "leatherTriangles": len(leather_faces), "soleTriangles": len(sole_faces)}


def fit_boots(glb):
    mesh = glb.doc["meshes"][0]
    if mesh["name"] != "Seated body" or len(mesh["primitives"]) != 1:
        raise ValueError("Boot fitting expects the original seated body's single textured primitive.")
    body = mesh["primitives"][0]
    attr = {key: glb.read(value) for key, value in body["attributes"].items()}
    faces = glb.read(body["indices"]).reshape(-1, 3)
    removed = (attr["POSITION"][faces, 1] < HEM_HEIGHT).all(axis=1)
    skin = glb.doc["skins"][0]
    bind = glb.read(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
    centres = np.linalg.inv(bind)[:, :3, 3]
    names = [glb.doc["nodes"][joint]["name"] for joint in skin["joints"]]
    joints_world = dict(zip(names, centres))
    leather = glb.material("Ankelstövlarnas läder · vald sittprofil v3", leather_texture(), .48)
    rubber = len(glb.doc["materials"])
    sole_texture = glb.doc["materials"][leather]["pbrMetallicRoughness"]["baseColorTexture"]
    glb.doc["materials"].append({"name": "Stövlarnas gummisula", "pbrMetallicRoughness":
                                {"baseColorTexture": sole_texture, "metallicFactor": 0, "roughnessFactor": .76}})
    metrics = {"leatherSourceSha256": CORRECTED_PROFILE_SHA, "removedFootTriangles": int(removed.sum()),
               "sourceCropPx": list(CROP), "units": "metres in the GLB bind pose"}
    for side in ("l", "r"):
        additions, metrics[side] = shoe(glb, attr, faces[removed], side, joints_world, leather, rubber)
        mesh["primitives"].extend(additions)
    used, index = np.unique(faces[~removed], return_inverse=True)
    for key, accessor in list(body["attributes"].items()):
        body["attributes"][key] = glb.accessor(attr[key][used], glb.doc["accessors"][accessor]["type"])
    body["indices"] = glb.accessor(index.astype("<u2").ravel(), "SCALAR", True)
    return metrics
