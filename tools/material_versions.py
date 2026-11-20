"""Lokala, innehållsadresserade versioner av modeller och deras renderade filmer."""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import struct
import subprocess
import tempfile
from fractions import Fraction
from io import BytesIO
from pathlib import Path

AVATARS = Path(__file__).resolve().parents[1] / "avatars"
SHA = re.compile(r"[a-f0-9]{64}")
SLUG = re.compile(r"[a-z0-9][a-z0-9-]*")


def sha(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def json_bytes(record):
    return (json.dumps(record, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def read_json(file):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def check(condition, message):
    if not condition:
        raise ValueError(message)


def store_for(dealer):
    check(SLUG.fullmatch(dealer), "Ogiltigt dealernamn.")
    return AVATARS / dealer / "3d" / "versioner"


def put(destination, source, expected, *, activate=False):
    """Publicera en hel fil atomiskt. Samtidiga försök med samma innehåll återanvänds."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not activate and destination.exists():
        check(sha(destination) == expected, f"Versionskonflikt i {destination.name}")
        return
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as tmp:
        stage = Path(tmp.name)
    try:
        if isinstance(source, bytes):
            stage.write_bytes(source)
        else:
            shutil.copyfile(source, stage)
        check(sha(stage) == expected, "Källfilen ändrades under registreringen.")
        if activate:
            os.replace(stage, destination)
        else:
            try:
                os.link(stage, destination)
            except FileExistsError:
                check(sha(destination) == expected, f"Versionskonflikt i {destination.name}")
    finally:
        stage.unlink(missing_ok=True)


def glb(file):
    with file.open("rb") as stream:
        magic, version, total, length, chunk = struct.unpack("<4sIIII", stream.read(20))
        check(magic == b"glTF" and version == 2 and total == file.stat().st_size and chunk == 0x4e4f534a,
              "Ogiltig GLB.")
        document = json.loads(stream.read(length))
        binary = stream.tell() + 8
        atlas = None
        for mesh in document.get("meshes", []):
            if mesh.get("extras", {}).get("appearancePart") != "body":
                continue
            material = document["materials"][mesh["primitives"][0]["material"]]
            texture = material.get("pbrMetallicRoughness", {}).get("baseColorTexture", {})
            if "index" in texture:
                image = document["images"][document["textures"][texture["index"]]["source"]]
                if "bufferView" in image:
                    from PIL import Image
                    view = document["bufferViews"][image["bufferView"]]
                    stream.seek(binary + view.get("byteOffset", 0))
                    with Image.open(BytesIO(stream.read(view["byteLength"]))) as embedded:
                        atlas = list(embedded.size)
        return document, atlas


def animation_times(document, file):
    """Läs de samplade tidsvärdena för alla animationsspår ur GLB:s binärdel."""
    indices = {clip["samplers"][channel["sampler"]]["input"] for clip in document.get("animations", [])
               for channel in clip.get("channels", []) if channel.get("target", {}).get("path") in
               ("rotation", "translation", "scale", "weights")}
    check(indices, "Rörelseversionen saknar animationsspår.")
    times = set()
    with file.open("rb") as stream:
        stream.seek(12)
        start = 28 + struct.unpack("<I", stream.read(4))[0]
        for index in indices:
            accessor = document["accessors"][index]
            view = document["bufferViews"][accessor["bufferView"]]
            check(accessor["type"] == "SCALAR" and accessor["componentType"] == 5126, "Ogiltig animationstid.")
            offset = start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            step = view.get("byteStride", 4)
            stream.seek(offset)
            raw = stream.read((accessor["count"]-1)*step + 4)
            values = [struct.unpack_from("<f", raw, i*step)[0] for i in range(accessor["count"])]
            check(values and all(math.isfinite(t) for t in values) and values == sorted(set(values)), "Ogiltiga animationstider.")
            times.update(values)
    return sorted(times)


def save_version(destination, data):
    """Behåll även arbetsoriginalet om en ny export använder samma filnamn."""
    fingerprint = hashlib.sha256(data).hexdigest()
    try:
        put(destination, data, fingerprint)
        return destination
    except ValueError:
        if not destination.is_file() or sha(destination) == fingerprint:
            raise
    alternate = destination.with_name(destination.stem + "-" + fingerprint[:12] + destination.suffix)
    put(alternate, data, fingerprint)
    return alternate


def pixels(values):
    size = [int(value) for value in values]
    check(len(size) == 2 and min(size) > 0, "Ogiltiga bildmått.")
    return size


def legacy_crops(manifest):
    # Older NPZ files lack a crop field. Identify the installed configuration separately.
    if manifest["method"] != "SAM 3D Body / DINOv3" or not manifest.get("sam_root"):
        return None
    root = Path(manifest["sam_root"])
    file = root / "checkpoints/sam-3d-body-dinov3/model_config.yaml"
    estimator = root / "sam_3d_body/sam_3d_body_estimator.py"
    if not file.is_file() or not estimator.is_file():
        return None
    import yaml
    # Both the body and the separate hand transforms must actually use MODEL.IMAGE_SIZE.
    code = estimator.read_text(encoding="utf8")
    for name in ("transform", "transform_hand"):
        match = re.search(rf"self\.{name}\s*=\s*Compose\((.*?)\n\s*\)", code, re.S)
        if not match or "TopdownAffine(input_size=self.cfg.MODEL.IMAGE_SIZE" not in match[1]:
            return None
    size = pixels(yaml.safe_load(file.read_bytes())["MODEL"]["IMAGE_SIZE"])
    return dict(body=size, hand=size, evidence="installed-config", configSha256=sha(file),
                estimatorSha256=sha(estimator))


def input_evidence(view, run, manifest, fallback):
    import numpy as np
    name = view["estimate"]
    index = view["index"]
    check(Path(name).name == name and 1 <= index <= len(manifest["inputs"]), "Ogiltig SAM-referens.")
    file = run / name
    check(sha(file) == view["estimateSha256"] and
          manifest["inputs"][index-1]["sha256"] == view["photoSha256"], "SAM-källan avviker.")
    with np.load(file, allow_pickle=False) as data:
        crop = fallback
        if "body_crop_size" in data:
            crop = dict(body=pixels(data["body_crop_size"]), hand=pixels(data["hand_crop_size"]),
                        evidence="saved-run", configSha256=str(data["sam_config_sha256"].item()))
        return dict(estimateSha256=view["estimateSha256"], original=pixels(data["original_size"]),
                    prepared=pixels(data["inference_size"]), crop=crop)


def register_model(store, file, run=None):
    fingerprint = sha(file)
    document, atlas = glb(file)
    extras = document.get("asset", {}).get("extras", {})
    look = extras.get("appearanceInputSHA256", {})
    motion_base = extras.get("motionBaseSHA256")
    views = extras.get("sourceViews", [])
    evidence = {}
    if run and views and not look and not motion_base:
        manifest = read_json(run / "run.json")
        check(manifest["state"] == "complete" and manifest["id"] == extras.get("run"), "Fel SAM-körning.")
        fallback = None
        # Only historical runs need the configuration installed at the time of registration.
        import numpy as np
        for view in views:
            check(Path(view["estimate"]).name == view["estimate"], "Ogiltig NPZ-referens.")
            with np.load(run / view["estimate"], allow_pickle=False) as data:
                if "body_crop_size" not in data:
                    fallback = legacy_crops(manifest)
                    break
        evidence = {view["photoSha256"]: input_evidence(view, run, manifest, fallback) for view in views}
    sources = []
    if motion_base:
        registered_pair(store, extras["geometrySHA256"], motion_base if motion_base != extras["geometrySHA256"] else None)
    elif look:
        sources = [dict(photo=key, sha256=value, role="surface") for key, value in look.items()]
    elif views:
        sources = [dict(photo=v["photo"], sha256=v["photoSha256"],
                        role="geometry" if v["index"] == extras["inputIndex"] else "posture",
                        processing=evidence.get(v["photoSha256"])) for v in views]
    elif extras.get("sha256"):
        sources = [dict(photo=extras.get("input", ""), sha256=extras["sha256"], role="geometry")]
    parent = motion_base or extras.get("sourceModelSHA256")
    check(all(SHA.fullmatch(s["sha256"]) for s in sources) and (not parent or SHA.fullmatch(parent)),
          "Ogiltigt fingeravtryck i modellen.")
    check(not look or parent, "Fotoytan saknar en versionsbunden grundmodell.")
    record = dict(schema=1, sha256=fingerprint, kind="motion" if motion_base else "appearance" if look else "geometry", parent=parent,
                  run=extras.get("run"), sources=sources, joints=max((len(s["joints"]) for s in document.get("skins", [])), default=0),
                  atlas=atlas)
    if motion_base:
        times = animation_times(document, file)
        card = extras.get("card")
        take = extras.get("take")
        path_hash = extras.get("cardPathSHA256")
        if card is None:
            path_hash = extras.get("motionPathSHA256", path_hash)
        check(isinstance(take, str) and SLUG.fullmatch(take) and isinstance(path_hash, str) and SHA.fullmatch(path_hash),
              "Rörelsens tagning eller tidslinje avviker.")
        record["motion"] = dict(geometry=extras["geometrySHA256"], appearance=motion_base if motion_base != extras["geometrySHA256"] else None,
                                take=take, card=card, pathSha256=path_hash,
                                start=times[0], end=times[-1], keyframes=len(times))
        if "componentMotionsSHA256" in extras:
            components = extras["componentMotionsSHA256"]
            check(isinstance(components, list) and components and all(isinstance(c, str) for c in components)
                  and len(set(components)) == len(components), "Ogiltiga källtagningar.")
            for component in components:
                source = registered_motion(store, component)
                check(all(source.get(k) == record["motion"][k] for k in ("geometry", "appearance")),
                      "Källtagningen hör till en annan kropp eller fotoyta.")
            record["motion"]["components"] = components
    receipt = store / "modeller" / (fingerprint + ".json")
    if receipt.exists():
        # A published receipt remains reproducible when today's installed SAM config changes.
        previous = read_json(receipt)
        structural = lambda rows: [{key: v for key, v in row.items() if key != "processing"} for row in rows]
        check(previous["sha256"] == fingerprint and previous["parent"] == parent and
              structural(previous["sources"]) == structural(sources), "Versionsregistret avviker från GLB-filen.")
    else:
        check(not views or look or motion_base or run is not None, "Ange den sparade SAM-körningen för modellens bildmått.")
    put(store / "filer" / (fingerprint + ".glb"), file, fingerprint)
    if not receipt.exists():
        data = json_bytes(record)
        put(receipt, data, hashlib.sha256(data).hexdigest())
    if motion_base:
        key = sha(receipt)
        put(store / "rorelser" / (key + ".json"), receipt, key)
    return fingerprint


def registered_pair(store, geometry, appearance):
    def model(fingerprint, kind):
        check(isinstance(fingerprint, str) and SHA.fullmatch(fingerprint), "Ogiltig modellversion.")
        record = read_json(store / "modeller" / (fingerprint + ".json"))
        check(record["schema"] == 1 and record["kind"] == kind and record["sha256"] == fingerprint and
              sha(store / "filer" / (fingerprint + ".glb")) == fingerprint, "Modellversionen avviker.")
        return record
    model(geometry, "geometry")
    if appearance:
        check(model(appearance, "appearance")["parent"] == geometry, "Fotoytan hör till en annan rigg.")


def activate(store, edition, identifier, name, geometry, appearance):
    check(SLUG.fullmatch(identifier) and name.strip() and re.fullmatch(r"fas-[1-9]\d*/v[1-9]\d*", edition),
          "Ogiltig utgåva eller visningsidentitet.")
    registered_pair(store, geometry, appearance)
    directory = store.parents[1] / edition
    register = directory / "bildregister.json"
    register_bytes = register.read_bytes()
    register_key = hashlib.sha256(register_bytes).hexdigest()
    book = json.loads(register_bytes.decode("utf-8-sig"))
    check(str(book["avatar"]).casefold() == store.parents[1].name and
          edition == f"fas-{book['fas']}/v{book['utgava']}", "Bildutgåvans identitet avviker.")
    photos = {}
    for row in book["bilder"]:
        photo = (directory / row["fil"]).resolve()
        check(photo.is_relative_to(directory.resolve()) and sha(photo) == row["sha256"], "Bilden avviker från utgåvan.")
        photos[row["sha256"]] = photo
        put(store / "filer" / (row["sha256"] + photo.suffix.lower()), photo, row["sha256"])
    for fingerprint in filter(None, (geometry, appearance)):
        for source in read_json(store / "modeller" / (fingerprint + ".json"))["sources"]:
            check(source["sha256"] in photos, "Modellens källbild saknas i den valda bildutgåvan.")
    put(store / "bildregister" / (register_key + ".json"), register_bytes, register_key)
    record = dict(schema=1, id=identifier, name=name, edition=edition, geometry=geometry, appearance=appearance,
                  photoRegister=register_key, geometryRecord=sha(store / "modeller" / (geometry + ".json")),
                  appearanceRecord=sha(store / "modeller" / (appearance + ".json")) if appearance else None)
    data = json_bytes(record)
    label = hashlib.sha256(data).hexdigest()
    put(store / "utgavor" / (label + ".json"), data, label)
    put(store / "aktiv.json", data, label, activate=True)


def registered_motion(store, fingerprint):
    check(isinstance(fingerprint, str) and SHA.fullmatch(fingerprint), "Ogiltig animationsversion.")
    receipt = store / "modeller" / (fingerprint + ".json")
    check(receipt.is_file(), "Animationsversionens underlag saknas.")
    record = read_json(receipt)
    key = sha(receipt)
    locked = store / "rorelser" / (key + ".json")
    binary = store / "filer" / (fingerprint + ".glb")
    check(record["kind"] == "motion" and record["sha256"] == fingerprint and locked.is_file()
          and sha(locked) == key and binary.is_file() and sha(binary) == fingerprint,
          "Animationsversionens underlag avviker.")
    return record["motion"]


def register_film(store, movie, capture):
    check(movie.suffix.lower() == ".mp4" and capture.get("videoSha256") == sha(movie), "Filmen avviker från exporten.")
    registered_pair(store, capture["geometry"], capture.get("appearance"))
    motion = capture.get("motion")
    if motion:
        animated = registered_motion(store, motion)
        check(all(animated.get(k) == capture.get(k) for k in ("geometry", "appearance", "take", "card")),
              "Animationsfilen hör till en annan rigg, fotoyta, tagning eller kort.")
    check(SLUG.fullmatch(capture["take"]) and capture["title"].strip() and capture["cameras"], "Ofullständig tagning.")
    probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames",
        "-show_entries", "stream=width,height,avg_frame_rate,codec_name:frame=best_effort_timestamp_time",
        "-of", "json", str(movie)]))
    stream = probe["streams"][0]
    times = [float(f["best_effort_timestamp_time"]) for f in probe["frames"]]
    count = len(times)
    check(count > 0 and all(math.isfinite(t) for t in times) and times == sorted(times), "Ogiltiga bildrutetider.")
    def frames(rows):
        return [row["frame"] for row in rows]
    def valid(numbers):
        return all(type(n) is int and 0 <= n < count for n in numbers)
    check(valid(frames(capture.get("marks", []))), "Granskningsrutan finns inte i filmen.")
    for camera in capture["cameras"]:
        samples = camera["samples"]
        numbers = frames(samples)
        check(camera["id"].strip() and camera.get("projection") in ("ortografisk", "perspektiv") and
              numbers and numbers[0] == 0 and numbers == sorted(set(numbers)) and valid(numbers),
              "Ogiltiga kamerarutor.")
        for sample in samples:
            check(all(isinstance(sample.get(key), (int, float)) and math.isfinite(sample[key])
                      for key in ("azimuth", "elevation", "distance")) and sample["distance"] > 0,
                  "Kamerans vinkel eller avstånd saknas.")
    marks = [dict(frame=m["frame"], label=m["label"], seconds=times[m["frame"]]-times[0])
             for m in capture.get("marks", [])]
    record = dict(schema=1, take=capture["take"], title=capture["title"], geometry=capture["geometry"],
                  appearance=capture.get("appearance"), card=capture.get("card"), cameras=capture["cameras"],
                  marks=marks, sha256=capture["videoSha256"], frames=count,
                  width=stream["width"], height=stream["height"], fps=str(Fraction(stream["avg_frame_rate"])), codec=stream["codec_name"])
    if motion:
        record["motion"] = motion
    data = json_bytes(record)
    key = hashlib.sha256(data).hexdigest()
    put(store / "filer" / (record["sha256"] + ".mp4"), movie, record["sha256"])
    put(store / "filmer" / (key + ".json"), data, key)
    return key


def register_review(store, film, camera, frames, note):
    check(SHA.fullmatch(film), "Ogiltig filmversion.")
    file = store / "filmer" / (film + ".json")
    check(sha(file) == film, "Filmregistret har ändrats.")
    movie = read_json(file)
    check(camera in [c["id"] for c in movie["cameras"]] and frames and note.strip() and
          all(0 <= f < movie["frames"] for f in frames), "Ange en kamera och bildrutor som finns i tagningen.")
    data = json_bytes(dict(schema=1, film=film, camera=camera, frames=sorted(set(frames)), note=note.strip()))
    key = hashlib.sha256(data).hexdigest()
    put(store / "granskningar" / (key + ".json"), data, key)
    return key


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--dealer", required=True)
    actions = cli.add_subparsers(dest="action", required=True)
    model = actions.add_parser("model")
    model.add_argument("file", type=Path)
    model.add_argument("--run", type=Path)
    active = actions.add_parser("activate")
    for key in ("geometry", "edition", "id", "name"):
        active.add_argument("--" + key, required=True)
    active.add_argument("--appearance")
    film = actions.add_parser("film")
    film.add_argument("--file", type=Path, required=True)
    film.add_argument("--capture", type=Path, required=True)
    review = actions.add_parser("review")
    review.add_argument("--film", required=True)
    review.add_argument("--camera", required=True)
    review.add_argument("--frames", type=int, nargs="+", required=True)
    review.add_argument("--note", required=True)
    args = cli.parse_args()
    store = store_for(args.dealer)
    if args.action == "model":
        print(register_model(store, args.file, args.run))
    elif args.action == "activate":
        activate(store, args.edition, args.id, args.name, args.geometry, args.appearance)
    elif args.action == "film":
        print(register_film(store, args.file, read_json(args.capture)))
    else:
        print(register_review(store, args.film, args.camera, args.frames, args.note))


if __name__ == "__main__":
    main()
