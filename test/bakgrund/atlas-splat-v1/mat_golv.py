"""Measure the centre of the floor in the original coordinate system of two Atlas SPZs."""
import gzip
import hashlib
import json
import struct
from pathlib import Path

import numpy as np

folder = Path(__file__).resolve().parent
sources = folder.parent / "atlas-chisel-v1"


def positions(file):
    with gzip.open(file, "rb") as stream:
        magic, version, count, sh_degree, bits, flags, reserved = struct.unpack("<4sIIBBBB", stream.read(16))
        if magic != b"NGSP" or version not in (2, 3) or not 0 < bits < 20:
            raise ValueError(f"Unsupported SPZ header in {file.name}: {magic!r}, {version}, {bits}")
        data = np.frombuffer(stream.read(9 * count), dtype=np.uint8).reshape(count, 3, 3)
        signed = data[:, :, 2].view(np.int8).astype(np.int32) << 16
        signed |= data[:, :, 1].astype(np.int32) << 8
        signed |= data[:, :, 0]
        coords = signed.astype(np.float32) / (1 << bits)
    return coords, {"version": version, "count": count, "shDegree": sh_degree, "fractionalBits": bits,
                    "flags": flags, "reserved": reserved}


def measure(file):
    coords, header = positions(file)
    x, y, z = coords.T
    # Only sample the empty central floor of this room, below the reference felt.
    central = coords[(np.abs(x) < .6) & (np.abs(z) < .6) & (y < 0) & (y > -1.5)]
    if len(central) < 30:
        raise ValueError(f"Too few central floor points in {file.name}: {len(central)}")
    counts, edges = np.histogram(central[:, 1], bins=np.arange(-1.50, .021, .02))
    peak = float(edges[counts.argmax()] + .01)
    near_floor = central[np.abs(central[:, 1] - peak) < .07]
    median = float(np.median(near_floor[:, 1]))
    x, y, z = near_floor.T
    tile_medians = []
    for xx in range(4):
        for zz in range(4):
            tile = y[(x >= -.6 + xx * .3) & (x < -.3 + xx * .3)
                     & (z >= -.6 + zz * .3) & (z < -.3 + zz * .3)]
            if len(tile) >= 3:
                tile_medians.append(float(np.median(tile)))
    if len(tile_medians) < 8:
        raise ValueError(f"The floor is insufficiently covered in {file.name} ({len(tile_medians)} of 16 tiles).")
    with file.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return {
        "file": file.name, "bytes": file.stat().st_size, "sha256": digest, **header,
        "axisP01": np.percentile(coords, 1, axis=0).round(4).tolist(),
        "axisP99": np.percentile(coords, 99, axis=0).round(4).tolist(),
        "centreBelowFeltPoints": len(central), "centreBelowFeltMedianY": float(np.median(central[:, 1])),
        "floorModeBinY": round(peak, 4), "floorPoints": len(y), "floorY": round(median, 6),
        "floorP05P95": np.percentile(y, [5, 95]).round(6).tolist(),
        "tileCoverage": len(tile_medians), "tileMedianRange": [min(tile_medians), max(tile_medians)],
    }


if __name__ == "__main__":
    values = {"quick": measure(sources / "forhandsvisning-v1.spz"), "full": measure(sources / "full-splat-v1.spz")}
    file = folder / "matning.json"
    temp = file.with_suffix(".tmp")
    temp.write_text(json.dumps(values, indent=2) + "\n", encoding="utf-8")
    temp.replace(file)
    for version, data in values.items():
        print(version, data["count"], data["sha256"], data["floorY"], data["tileCoverage"])
