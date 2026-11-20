"""Report coincident triangles and their materials in the default scene of a GLB."""

import argparse
import hashlib
import json
from itertools import combinations
import math
from pathlib import Path
import struct

IDENTITY = (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)


def read_glb(file):
    raw = file.read_bytes()
    magic, version, total, json_length, chunk = struct.unpack_from("<4sIIII", raw)
    if (magic, version, total, chunk) != (b"glTF", 2, len(raw), 0x4e4f534a):
        raise ValueError("Ogiltig GLB 2.")
    data_start = 28 + json_length
    length, chunk = struct.unpack_from("<I4s", raw, data_start - 8)
    if chunk != b"BIN\0" or length > total - data_start:
        raise ValueError("GLB-filen saknar en giltig binärdel.")
    doc = json.loads(raw[20:data_start - 8])
    return doc, memoryview(raw)[data_start:data_start + length], hashlib.sha256(raw).hexdigest()


def read_accessor(doc, data, index, formats):
    accessor = doc["accessors"][index]
    kind = formats.get((accessor["type"], accessor["componentType"]))
    if not kind or "sparse" in accessor or "bufferView" not in accessor:
        raise ValueError(f"Accessor {index} har ett format som kontrollen inte stöder.")
    view = doc["bufferViews"][accessor["bufferView"]]
    if view["buffer"] != 0 or "EXT_meshopt_compression" in view.get("extensions", {}):
        raise ValueError(f"Accessor {index} kräver en separat eller komprimerad buffert.")
    view_start = view.get("byteOffset", 0)
    view_end = view_start + view["byteLength"]
    values = struct.Struct(kind)
    start = view_start + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", values.size)
    count = accessor["count"]
    if count < 1 or stride < values.size or start < view_start or view_end > len(data) or (
        start + (count - 1) * stride + values.size > view_end
    ):
        raise ValueError(f"Accessor {index} ligger utanför sin buffert.")
    return [values.unpack_from(data, start + pos * stride) for pos in range(count)]


def node_matrix(node):
    if "matrix" in node:
        return node["matrix"]
    x, y, z, w = node.get("rotation", (0, 0, 0, 1))
    sx, sy, sz = node.get("scale", (1, 1, 1))
    tx, ty, tz = node.get("translation", (0, 0, 0))
    # glTF stores each column contiguously.
    return (
        sx * (1 - 2 * (y * y + z * z)), sx * 2 * (x * y + z * w), sx * 2 * (x * z - y * w), 0,
        sy * 2 * (x * y - z * w), sy * (1 - 2 * (x * x + z * z)), sy * 2 * (y * z + x * w), 0,
        sz * 2 * (x * z + y * w), sz * 2 * (y * z - x * w), sz * (1 - 2 * (x * x + y * y)), 0,
        tx, ty, tz, 1,
    )


def scene_nodes(doc):
    def walk(node_index, parent_matrix):
        node = doc["nodes"][node_index]
        if "EXT_mesh_gpu_instancing" in node.get("extensions", {}):
            raise ValueError("Kontrollen stöder inte instansiering på grafikkortet.")
        local = node_matrix(node)
        world = tuple(
            sum(parent_matrix[k * 4 + row] * local[col * 4 + k] for k in range(4))
            for col in range(4) for row in range(4)
        )
        if "mesh" in node:
            yield node_index, node, world
        for child in node.get("children", []):
            yield from walk(child, world)

    for root in doc["scenes"][doc.get("scene", 0)].get("nodes", []):
        yield from walk(root, IDENTITY)


def surface(doc, data, primitive, world):
    if primitive.get("mode", 4) != 4 or "KHR_draco_mesh_compression" in primitive.get("extensions", {}):
        raise ValueError("Kontrollen kräver okomprimerade GLB-trianglar (TRIANGLES).")
    positions = read_accessor(doc, data, primitive["attributes"]["POSITION"], {("VEC3", 5126): "<3f"})
    points = [
        tuple(world[row] * x + world[row + 4] * y + world[row + 8] * z + world[row + 12] for row in range(3))
        for x, y, z in positions
    ]
    if not all(math.isfinite(value) for point in points for value in point):
        raise ValueError("Ogiltiga hörnkoordinater.")
    indices = range(len(points))
    if "indices" in primitive:
        formats = {("SCALAR", 5121): "<B", ("SCALAR", 5123): "<H", ("SCALAR", 5125): "<I"}
        indices = [value for value, in read_accessor(doc, data, primitive["indices"], formats)]
    if len(indices) % 3 or any(index >= len(points) for index in indices):
        raise ValueError("Ogiltiga triangelindex.")
    triangles = {}
    repeated = degenerate = 0
    for face in range(0, len(indices), 3):
        corners = tuple(points[indices[face + offset]] for offset in range(3))
        if len(set(corners)) < 3:
            degenerate += 1
            continue
        triangle = tuple(sorted(corners))
        repeated += triangle in triangles
        triangles[triangle] = corners
    return len(points), len(indices) // 3, triangles, repeated, degenerate


def near_centres(source, target, distance):
    """Count centroids that project inside a nearby triangle with the same facing."""
    import numpy as np
    from scipy.spatial import cKDTree

    source = np.asarray(list(source.values()))
    target = np.asarray(list(target.values()))
    centres = source.mean(axis=1)
    normals = np.cross(source[:, 1] - source[:, 0], source[:, 2] - source[:, 0])
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-30)
    target_centres = target.mean(axis=1)
    radii = np.linalg.norm(target - target_centres[:, None], axis=2).max(axis=1)
    u = target[:, 1] - target[:, 0]
    v = target[:, 2] - target[:, 0]
    perpendicular = np.cross(u, v)
    areas = np.linalg.norm(perpendicular, axis=1)
    usable = areas > 0
    perpendicular /= np.maximum(areas[:, None], 1e-30)
    minimum_alignment = math.cos(math.radians(20))
    matched = np.zeros(len(centres), dtype=bool)

    def dot(a, b):
        return np.einsum("ij,ij->i", a, b)

    # Keep the search radius local to similarly sized triangles.
    radius_groups = np.frexp(radii)[1]
    for group in np.unique(radius_groups[usable]):
        targets = np.flatnonzero(usable & (radius_groups == group))
        radius = radii[targets].max() + distance
        tree = cKDTree(target_centres[targets])
        remaining = np.flatnonzero(~matched)
        for start in range(0, len(remaining), 4096):
            window = remaining[start:start + 4096]
            candidates = tree.query_ball_point(centres[window], radius, workers=4)
            src = np.repeat(window, [len(row) for row in candidates])
            dst = targets[np.fromiter((index for row in candidates for index in row), dtype=np.intp)]
            offsets = centres[src] - target[dst, 0]
            eligible = ((np.abs(dot(offsets, perpendicular[dst])) <= distance)
                        & (dot(normals[src], perpendicular[dst]) >= minimum_alignment))
            src, dst, offsets = src[eligible], dst[eligible], offsets[eligible]
            # Barycentric coordinates of the orthogonal projection onto the target face.
            a = dot(np.cross(offsets, v[dst]), perpendicular[dst]) / areas[dst]
            b = dot(np.cross(u[dst], offsets), perpendicular[dst]) / areas[dst]
            inside = (a >= -1e-8) & (b >= -1e-8) & (a + b <= 1 + 1e-8)
            matched[src[inside]] = True
    hit_count = int(matched.sum())
    return dict(matching=hit_count, total=len(centres), percent=round(100 * hit_count / len(centres), 2))


def surface_report(file, near_mm=None):
    doc, data, fingerprint = read_glb(file)
    materials = doc.get("materials", [])
    parts = []
    used = set()
    for node_index, node, world in scene_nodes(doc):
        mesh = doc["meshes"][node["mesh"]]
        for primitive_index, primitive in enumerate(mesh["primitives"]):
            vertices, count, faces, repeated, degenerate = surface(doc, data, primitive, world)
            material = primitive.get("material")
            material_data = {}
            if material is not None:
                used.add(material)
                material_data = materials[material]
            part = dict(id=len(parts), node=node_index, mesh=node["mesh"], name=mesh.get("name"),
                        part=mesh.get("extras", {}).get("appearancePart"), primitive=primitive_index,
                        material=material, materialName=material_data.get("name"),
                        alphaMode=material_data.get("alphaMode", "OPAQUE"), skin=node.get("skin"),
                        morphTargets=len(primitive.get("targets", [])), vertices=vertices, triangles=count,
                        uniqueTriangles=len(faces), repeatedTriangles=repeated, collapsedTriangles=degenerate)
            parts.append((part, faces))

    comparisons = []
    for (first, left), (second, right) in combinations(parts, 2):
        overlap = len(left.keys() & right.keys())
        relation = "distinct"
        if overlap:
            relation = "same" if overlap == len(left) == len(right) else "partial"
        comparison = dict(primitives=[first["id"], second["id"]], sharedTriangles=overlap, relation=relation)
        if near_mm is not None and left and right and first["node"] == second["node"] and relation != "same":
            comparison["nearCentres"] = [
                near_centres(left, right, near_mm / 1000), near_centres(right, left, near_mm / 1000),
            ]
        comparisons.append(comparison)
    unused = [dict(index=index, name=material.get("name"))
              for index, material in enumerate(materials) if index not in used]
    return dict(modelSHA256=fingerprint, scene=doc.get("scene", 0), nearMm=near_mm,
                primitives=[part for part, _ in parts],
                unusedMaterials=unused, comparisons=comparisons)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("--near-mm", type=float, help="Centrumtest för GLB i meter. Kräver NumPy och SciPy.")
    args = parser.parse_args()
    if args.near_mm is not None and (not math.isfinite(args.near_mm) or args.near_mm <= 0):
        parser.error("--near-mm ska vara ett positivt ändligt avstånd.")
    try:
        report = surface_report(args.model, args.near_mm)
    except (ValueError, OSError, IndexError, KeyError, ImportError, struct.error) as error:
        parser.exit(1, f"{args.model.name}: {error}\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
