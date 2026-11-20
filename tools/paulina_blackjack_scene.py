"""Create measured tabletop geometry around the seated actor's fixed coordinates."""

import numpy as np
from PIL import Image
import trimesh


def material(glb, name, colour, roughness=0.75, metal=0):
    materials = glb.doc["materials"]
    materials.append(
        {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": [*colour, 1],
                "metallicFactor": metal,
                "roughnessFactor": roughness,
            },
        }
    )
    return len(materials) - 1


def add_mesh(glb, name, shape, material_index, uv=None):
    points = np.asarray(shape.vertices, dtype="<f4")
    normals = np.asarray(shape.vertex_normals, dtype="<f4")
    attrs = {"POSITION": glb.accessor(points, "VEC3"), "NORMAL": glb.accessor(normals, "VEC3")}
    if uv is not None:
        attrs["TEXCOORD_0"] = glb.accessor(np.asarray(uv, dtype="<f4"), "VEC2")
    indices = glb.accessor(np.asarray(shape.faces, dtype="<u2").ravel(), "SCALAR", True)
    glb.doc["meshes"].append(
        {
            "name": name,
            "primitives": [
                {"attributes": attrs, "indices": indices, "material": material_index, "mode": 4}
            ],
        }
    )
    glb.doc["nodes"].append({"name": name, "mesh": len(glb.doc["meshes"]) - 1})
    node = len(glb.doc["nodes"]) - 1
    glb.doc["scenes"][0]["nodes"].append(node)
    return node


def half_oval(x_radius, z_radius, back_z, top, thickness):
    """A shallow dealer-side cutout leaves room for the filmed right-hand return."""
    a = np.linspace(0, np.pi, 161)
    x = x_radius * np.cos(a)
    player_z = back_z + z_radius * np.sin(a)
    phase = (x + 0.409) / 0.12
    dealer_z = back_z + np.where(np.abs(phase) < 1, 0.025 * (1 + np.cos(np.pi * phase)), 0)
    return rounded_solid(x, dealer_z, player_z, top, thickness)


def player_rail(back_z, top, thickness):
    """The padded player's rail follows the outer rim; the performer's lap clears the underside."""
    arc = np.linspace(0, np.pi, 161)
    x = 0.94 * np.cos(arc)
    outer = back_z + 0.82 * np.sin(arc)
    inner = back_z + 0.735 * np.sqrt(np.maximum(0, 1 - (x / 0.87) ** 2))
    return rounded_solid(x, inner, outer, top, thickness)


def rounded_solid(x, dealer_z, player_z, top, thickness):
    samples = len(x)
    rim = np.column_stack((x, player_z))
    inner = np.column_stack((x[-2:0:-1], dealer_z[-2:0:-1]))
    xz = np.vstack((rim, inner))
    n = len(xz)
    vertices = np.vstack(
        [np.column_stack((xz[:, 0], np.full(n, y), xz[:, 1])) for y in (top, top - thickness)]
    )
    faces = []

    def rear(i):
        return i if i in (0, samples - 1) else n - i

    for i in range(samples - 1):
        quad = [i, i + 1, rear(i + 1), rear(i)]
        for triangle in (quad[:3], [quad[0], quad[2], quad[3]]):
            if len(set(triangle)) == 3:
                faces.append(triangle)
                faces.append([n + j for j in reversed(triangle)])
    for i in range(n):
        j = (i + 1) % n
        faces.extend(([i, j, n + j], [i, n + j, n + i]))
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    mesh.fix_normals()
    return mesh


def horizontal_disk(radius, height, center):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=36)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    mesh.apply_translation(center)
    return mesh


def seat_contact(glb, names):
    attributes = glb.doc["meshes"][0]["primitives"][0]["attributes"]
    xyz = glb.read(attributes["POSITION"])
    ids = glb.read(attributes["JOINTS_0"])
    weights = glb.read(attributes["WEIGHTS_0"])
    near_seat = [
        name in ("root", "c_spine0", "l_upleg", "r_upleg") or "_upleg_twist" in name for name in names
    ]
    under = (np.asarray(near_seat)[ids] * weights).sum(1) > 0.5
    under &= (abs(xyz[:, 0]) < 0.20) & (xyz[:, 2] >= -0.10) & (xyz[:, 2] <= 0.27)
    return float(xyz[under, 1].min() - 0.0005)


def table_cross_section(glb, name):
    node = next(node for node in glb.doc["nodes"] if node["name"] == name)
    surface = glb.doc["meshes"][node["mesh"]]["primitives"][0]
    points = glb.read(surface["attributes"]["POSITION"])
    x, rows = np.unique(points[:, 0], return_inverse=True)
    back = np.full(len(x), np.inf)
    front = np.full(len(x), -np.inf)
    np.minimum.at(back, rows, points[:, 2])
    np.maximum.at(front, rows, points[:, 2])
    return x, back, front, points[:, 1].min(), points[:, 1].max()


def measure_table_contact(glb, hands, card_centres, card_rotations, resting):
    """Test both articulated hands in the actual two closed solids, including the dealer-side cutout."""
    report = {}
    for name in ("Spelyta", "Bordets kant"):
        x, back, front, low, high = table_cross_section(glb, name)
        intersections = {}
        for side, points in hands.items():
            px, y, z = points.transpose(2, 0, 1)
            valid = (px > x[0]) & (px < x[-1]) & (y > low + 1e-6) & (y < high - 1e-6)
            depth = (z > np.interp(px, x, back) + 1e-6) & (z < np.interp(px, x, front) - 1e-6)
            counts = (valid & depth).sum(axis=1)
            intersections[side] = {
                "framesInside": np.flatnonzero(counts).tolist(),
                "maximumVerticesInside": int(counts.max()),
            }
        report[name] = {"heightRangeM": [float(low), float(high)], "hands": intersections}
    if resting is not None:
        x, back, front, _, top = table_cross_section(glb, "Spelyta")
        local = np.array([[sx * 0.0315, -0.00035, sz * 0.0445] for sx in (-1, 1) for sz in (-1, 1)])
        corners = card_centres[resting:, None] + local @ card_rotations[resting:].transpose(0, 2, 1)
        px, y, z = corners.transpose(2, 0, 1)
        margin = np.minimum(z - np.interp(px, x, back), np.interp(px, x, front) - z)
        supported = (px >= x[0]) & (px <= x[-1]) & (margin >= 0) & (abs(y - top) < 0.00025)
        report["stationaryCard"] = {
            "frames": len(corners),
            "minimumSupportedCorners": int(supported.sum(axis=1).min()),
            "minimumLongitudinalEdgeClearanceMm": round(float(margin.min()) * 1000, 3),
            "bottomToFeltRangeMm": np.round(
                np.array([(y - top).min(), (y - top).max()]) * 1000, 3
            ).tolist(),
        }
    return report


def surroundings(glb, height, front_edge, card_texture, seat_top):
    felt = material(glb, "Blackjackfilt · skogsgrön", [0.026, 0.157, 0.091], 0.93)
    rail = material(glb, "Svart läder", [0.029, 0.025, 0.020], 0.55)
    wood = material(glb, "Valnöt", [0.121, 0.053, 0.028], 0.55)
    brass = material(glb, "Mässingsfärg", [0.58, 0.36, 0.108], 0.42, 0.36)
    chair = material(glb, "Stolens stoppning", [0.104, 0.098, 0.091], 0.91)
    foot = material(glb, "Mörkt stål", [0.045, 0.048, 0.047], 0.42, 0.23)
    chips = material(glb, "Röda spelmarker", [0.45, 0.038, 0.032])
    add_mesh(glb, "Bordets kant", player_rail(front_edge - 0.012, height - 0.006, 0.075), rail)
    add_mesh(glb, "Spelyta", half_oval(0.893, 0.76, front_edge, height, 0.030), felt)
    for half_width, depth in ((0.66, 0.06), (0.48, 0.58)):
        for x in (-half_width, half_width):
            leg = trimesh.creation.box(extents=[0.056, height - 0.08, 0.056])
            leg.apply_translation([x, (height - 0.08) / 2, front_edge + depth])
            add_mesh(glb, "Bordsben", leg, wood)
    seat = trimesh.creation.box(extents=[0.405, 0.054, 0.4])
    seat.apply_translation([0, seat_top - 0.027, 0.093])
    add_mesh(glb, "Sits", seat, chair)
    back = trimesh.creation.box(extents=[0.378, 0.37, 0.045])
    back.apply_translation([0, seat_top + 0.17, -0.157])
    add_mesh(glb, "Stolsrygg", back, chair)
    for x in [-0.151, 0.151]:
        for z in [-0.066, 0.241]:
            leg_height = seat_top - 0.054
            leg = trimesh.creation.box(extents=[0.021, leg_height, 0.021])
            leg.apply_translation([x, leg_height / 2, z])
            add_mesh(glb, "Stolsben", leg, foot)
    for x, z in [(-0.52, front_edge + 0.27), (0, front_edge + 0.53), (0.52, front_edge + 0.27)]:
        ring = trimesh.creation.annulus(r_min=0.055, r_max=0.057, height=0.0003, sections=48)
        ring.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
        ring.apply_translation([x, height + 0.0002, z])
        add_mesh(glb, "Satsningscirkel", ring, brass)
    tray = trimesh.creation.box(extents=[0.154, 0.014, 0.063])
    tray.apply_translation([0.49, height + 0.007, front_edge + 0.077])
    add_mesh(glb, "Markerbricka", tray, rail)
    for i in range(3):
        x = 0.443 + i * 0.044
        add_mesh(
            glb,
            "Markerstapel",
            horizontal_disk(
                0.018, 0.012 + i * 0.004, [x, height + 0.017 + i * 0.002, front_edge + 0.075]
            ),
            chips,
        )
        add_mesh(
            glb,
            "Markering på spelmark",
            horizontal_disk(0.012, 0.0006, [x, height + 0.024 + i * 0.004, front_edge + 0.075]),
            brass,
        )
    card = trimesh.creation.box(extents=[0.063, 0.0007, 0.089])
    # The visible red back belongs to one face; retain ivory stock on the reverse and edges.
    tris = np.array(card.vertices)[card.faces]
    verts = tris.reshape(-1, 3)
    tri_ids = np.arange(len(verts)).reshape(-1, 3)
    card = trimesh.Trimesh(verts, tri_ids, process=False)
    uv = np.column_stack((verts[:, 0] / 0.063 + 0.5, 0.5 + verts[:, 2] / 0.089)).clip(0, 1)
    stock = glb.material(
        "Röd kortrygg med orienteringspunkt",
        np.array(Image.open(card_texture).convert("RGB"))
        if not isinstance(card_texture, np.ndarray)
        else card_texture,
        0.79,
    )
    node = add_mesh(glb, "Rött spelkort", card, stock, uv)
    primitives = glb.doc["meshes"][glb.doc["nodes"][node]["mesh"]]["primitives"]
    upper = card.face_normals[:, 1] > 0.9
    primitives[0]["indices"] = glb.accessor(tri_ids[upper].astype("<u2").ravel(), "SCALAR", True)
    primitives.append(
        {
            **primitives[0],
            "attributes": dict(primitives[0]["attributes"]),
            "indices": glb.accessor(tri_ids[~upper].astype("<u2").ravel(), "SCALAR", True),
            "material": material(glb, "Kortets kant och motsida", [0.87, 0.846, 0.78]),
        }
    )
    return node
