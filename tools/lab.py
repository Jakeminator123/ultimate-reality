"""Fristående Windows-labb för fotoprov. Endast märkta körningar får gallras."""

import argparse
import hashlib
import json
import msvcrt
import os
import re
import shutil
import stat
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
SCHEMA = "ultimate-reality-lab/v1"
RETENTION = timedelta(days=7)
RUN_ID = re.compile(r"sam-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}")


def now():
    return datetime.now(timezone.utc)


def write_json(path, data):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


def reject_link(path):
    if path.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        raise ValueError(f"Länk eller junction i labblagringen: {path}")


@contextmanager
def storage():
    parent = Path(os.environ.get("ULTIMATE_REALITY_STORAGE", "D:/" if Path("D:/").is_dir() else PROJECT / ".lab-data"))
    if not parent.is_absolute():
        raise ValueError("ULTIMATE_REALITY_STORAGE ska vara en absolut sökväg.")
    root = parent / "ultimate-reality-lab"
    for ancestor in [*reversed(root.parents), root]:
        if ancestor.exists() or ancestor.is_symlink():
            reject_link(ancestor)
    root.mkdir(parents=True, exist_ok=True)
    marker = root / ".owner"
    if not marker.exists():
        if any(root.iterdir()):
            raise ValueError(f"Omärkt, upptagen mapp: {root}")
        with marker.open("x", encoding="utf-8") as file:
            file.write(SCHEMA)
    reject_link(marker)
    if marker.read_text(encoding="utf-8") != SCHEMA:
        raise ValueError(f"Okänd ägare: {root}")
    guard = root / ".lock"
    if guard.exists() or guard.is_symlink():
        reject_link(guard)
    with guard.open("a+b") as lock:
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise RuntimeError("Labbet används av ett annat kommando. Försök när det är klart.") from exc
        try:
            for name in ("inputs", "orders", "runs", "saved"):
                folder = root / name
                folder.mkdir(exist_ok=True)
                reject_link(folder)
            yield root
        finally:
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)


def manifest(run):
    if not RUN_ID.fullmatch(run.name) or not run.is_dir():
        raise ValueError("Okänt körnings-ID.")
    reject_link(run)
    metadata = run / "run.json"
    reject_link(metadata)
    data = json.loads(metadata.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schema") != SCHEMA or data.get("id") != run.name:
        raise ValueError("Ogiltig körningsmärkning.")
    if data.get("state") not in ("running", "complete", "failed"):
        raise ValueError("Okänd körningsstatus.")
    return data


def check_tree(run, runs):
    if run.resolve().parent != runs.resolve():
        raise ValueError("Körningen ligger utanför testytan.")
    def fail(error):
        raise error
    for folder, dirs, files in os.walk(run, followlinks=False, onerror=fail):
        for name in dirs + files:
            reject_link(Path(folder) / name)


def clean(root, dry_run=False):
    runs = root / "runs"
    for run in sorted(runs.iterdir()):
        if not RUN_ID.fullmatch(run.name):
            continue
        try:
            data = manifest(run)
            stamp = datetime.fromisoformat(data.get("finished") or data["started"])
            if now() - stamp < RETENTION:
                continue
            check_tree(run, runs)
            if dry_run:
                print(f"Kan gallras: {run}")
            else:
                # The process holds the lab lock. Preserve run.json until payload removal succeeds.
                for item in run.iterdir():
                    if item.name == "run.json":
                        continue
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()
                (run / "run.json").unlink()
                run.rmdir()
                print(f"Gallrad: {run}")
        except (KeyError, OSError, TypeError, ValueError) as exc:
            print(f"Hoppade över {run.name}: {exc}", file=sys.stderr)


def run_sam(root, inputs, mesh_only):
    from sam_photo import estimate

    sam = Path(os.environ.get("SAM3D_ROOT", PROJECT.parent / "sam-3d-body")).resolve(strict=True)
    sources = [path.resolve(strict=True) for path in inputs]
    for path in sources:
        if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise ValueError(f"Välj ett foto i JPG, PNG eller WebP: {path}")
        if path.is_relative_to((root / "runs").resolve()):
            raise ValueError("Spara en tidigare körning med keep innan den används som underlag.")
    clean(root)
    started = now()
    name = f"sam-{started:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:12]}"
    run = root / "runs" / name
    data = dict(schema=SCHEMA, id=name, method="SAM 3D Body / DINOv3", started=started.isoformat(),
                sam_root=str(sam), mesh_only=mesh_only, state="running", inputs=[])
    for source in sources:
        with source.open("rb") as file:
            data["inputs"].append(dict(path=str(source), sha256=hashlib.file_digest(file, "sha256").hexdigest()))
    run.mkdir()
    write_json(run / "run.json", data)
    print(f"Körning: {run}", flush=True)
    try:
        estimate(sam, sources, run, mesh_only)
        data["state"] = "complete"
    except BaseException as exc:
        data.update(state="failed", error=str(exc))
        raise
    finally:
        data["finished"] = now().isoformat()
        write_json(run / "run.json", data)
    print(f"Färdig: {run}")


def export_front_model(mesh, landmarks, pose):
    """Keep SAM's vertical axis and turn the hips toward a level front camera."""
    import numpy as np
    import trimesh

    joints = landmarks * [1, -1, -1]
    hip = joints[[9, 10]].mean(axis=0)
    for left, right in ((9, 10), (5, 6)):
        lateral = joints[left] - joints[right]
        lateral[1] = 0
        span = np.linalg.norm(lateral)
        if np.isfinite(span) and span > 1e-5:
            break
    else:
        return  # This pose does not establish a horizontal front direction.
    lateral /= span
    up = np.array([0., 1., 0.])
    axes = np.column_stack((lateral, up, np.cross(lateral, up)))
    vertices = (mesh.vertices - hip) @ axes
    vertices[:, 1] -= vertices[:, 1].min()
    front = trimesh.Trimesh(vertices=vertices, faces=mesh.faces, process=False)
    output = pose.with_name(pose.stem + "-front.glb")
    temp = output.with_name(output.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        temp.write_bytes(front.export(file_type="glb"))
        temp.replace(output)
    finally:
        temp.unlink(missing_ok=True)


def export_views(root, name):
    import numpy as np
    import trimesh
    from trimesh.viewer.notebook import scene_to_html

    if not RUN_ID.fullmatch(name):
        raise ValueError("Ogiltigt körnings-ID.")
    run = root / "saved" / name
    if not run.exists():
        run = root / "runs" / name
    if manifest(run)["state"] != "complete":
        raise ValueError("3D-vyn kräver en slutförd körning.")
    check_tree(run, run.parent)
    for pose in sorted(run.glob("*.npz")):
        with np.load(pose, allow_pickle=False) as data:
            # SAM uses image coordinates. glTF uses Y up and the camera looks along -Z.
            mesh = trimesh.Trimesh(vertices=data["pred_vertices"] * [1, -1, -1],
                                   faces=data["faces"], process=False)
            if "pred_keypoints_3d" in data:
                export_front_model(mesh, data["pred_keypoints_3d"], pose)
        page = pose.with_suffix(".html")
        staged = page.with_suffix(".tmp")
        staged.write_text(scene_to_html(mesh.scene()), encoding="utf-8")
        staged.replace(page)
        print(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    sam = commands.add_parser("sam", help="Uppskatta kropp och händer från ett eller flera foton.")
    sam.add_argument("photos", nargs="+", type=Path)
    sam.add_argument("--mesh-only", action="store_true", help="Exportera geometri utan bildark.")
    keep = commands.add_parser("keep", help="Bevara en körning i saved.")
    keep.add_argument("id")
    view = commands.add_parser("view", help="Skapa en lokalt öppningsbar, vridbar HTML-vy av varje foto.")
    view.add_argument("id")
    tidy = commands.add_parser("clean", help="Gallra temporära körningar som är minst sju dygn gamla.")
    tidy.add_argument("--dry-run", action="store_true")
    commands.add_parser("list", help="Visa körningar och lagringsplats.")
    args = parser.parse_args()
    with storage() as root:
        if args.action == "sam":
            run_sam(root, args.photos, args.mesh_only)
        elif args.action == "clean":
            clean(root, args.dry_run)
        elif args.action == "view":
            export_views(root, args.id)
        elif args.action == "keep":
            if not RUN_ID.fullmatch(args.id):
                parser.error("Ogiltigt körnings-ID.")
            target = root / "saved" / args.id
            if target.exists():
                manifest(target)
            else:
                run = root / "runs" / args.id
                manifest(run)
                check_tree(run, root / "runs")
                run.rename(target)
            print(target)
        else:
            print(f"Labbrot: {root}")
            print(f"Källmaterial: {root / 'inputs'}")
            print(f"Beställningar: {root / 'orders'}")
            for name in ("runs", "saved"):
                for run in sorted((root / name).iterdir()):
                    if RUN_ID.fullmatch(run.name):
                        try:
                            print(name, run.name, manifest(run)["state"])
                        except (OSError, KeyError, ValueError) as exc:
                            print(f"Hoppade över {run.name}: {exc}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError) as error:
        sys.exit(str(error))
