"""Versionskopplingar provas med små syntetiska källor, även när ett arbetsnamn återanvänds."""
import json
import struct
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import material_versions as versions


class MaterialTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.store = self.root / "mira/3d/versioner"
        self.edition = self.root / "mira/fas-1/v1"
        self.photo = self.edition / "sittande/front.png"
        self.photo.parent.mkdir(parents=True)
        Image.new("RGB", (14, 19), "blue").save(self.photo)
        self.photo_sha = versions.sha(self.photo)
        (self.edition / "bildregister.json").write_bytes(versions.json_bytes(dict(avatar="Mira", fas=1, utgava=1,
            bilder=[dict(fil="sittande/front.png", sha256=self.photo_sha)])))
        self.run = self.root / "sam-test"
        self.run.mkdir()
        (self.run / "run.json").write_bytes(versions.json_bytes(dict(id=self.run.name, state="complete",
            method="SAM 3D Body / DINOv3", inputs=[dict(sha256=self.photo_sha)])))
        np.savez(self.run / "01.npz", original_size=(14, 19), inference_size=(12, 16),
                 body_crop_size=(8, 9), hand_crop_size=(7, 6), sam_config_sha256="1" * 64)
        self.views = [dict(index=1, photo="front.png", photoSha256=self.photo_sha, estimate="01.npz",
                           estimateSha256=versions.sha(self.run / "01.npz"))]
        self.body = self.make_model("rigg", dict(run=self.run.name, inputIndex=1, sourceViews=self.views))
        self.look = self.make_model("yta", dict(sourceModelSHA256=self.body,
            appearanceInputSHA256={"sittande/front.png": self.photo_sha}))

    def make_model(self, name, extras):
        data = json.dumps({"asset": {"version": "2.0", "extras": extras}}).encode()
        data += b" " * (-len(data) % 4)
        file = self.root / (name + ".glb")
        file.write_bytes(struct.pack("<4sIIII", b"glTF", 2, len(data) + 20, len(data), 0x4e4f534a) + data)
        return versions.register_model(self.store, file, self.run)

    def activate(self, geometry, appearance):
        versions.activate(self.store, "fas-1/v1", "mira-v1", "Mira v1", geometry, appearance)

    def test_exact_measurements_and_immutable_sources(self):
        self.activate(self.body, self.look)
        release = versions.read_json(self.store / "aktiv.json")
        model = versions.read_json(self.store / "modeller" / (self.body + ".json"))
        processing = model["sources"][0]["processing"]
        self.assertEqual(processing["prepared"], [12, 16])
        self.assertEqual((processing["crop"]["body"], processing["crop"]["hand"]), ([8, 9], [7, 6]))
        self.assertEqual(processing["crop"]["evidence"], "saved-run")
        self.assertEqual(release["geometryRecord"], versions.sha(self.store / "modeller" / (self.body + ".json")))
        Image.new("RGB", (10, 12), "green").save(self.photo)
        with self.assertRaisesRegex(ValueError, "utgåvan"):
            self.activate(self.body, self.look)
        self.assertEqual(versions.sha(self.store / "filer" / (self.photo_sha + ".png")), self.photo_sha)
        self.assertEqual(versions.read_json(self.store / "aktiv.json"), release)

    def test_other_geometry_cannot_replace_approved_pair(self):
        self.activate(self.body, self.look)
        old = (self.store / "aktiv.json").read_bytes()
        different = self.make_model("annan", {})
        with self.assertRaisesRegex(ValueError, "annan rigg"):
            self.activate(different, self.look)
        self.assertEqual((self.store / "aktiv.json").read_bytes(), old)
        self.activate(different, None)
        self.assertEqual(len(list((self.store / "utgavor").glob("*.json"))), 2)

    def test_concurrent_exports_preserve_both_contents(self):
        name = self.root / "export.glb"
        versions.save_version(name, b"first")
        with ThreadPoolExecutor(max_workers=4) as workers:
            results = list(workers.map(lambda _: versions.save_version(name, b"second"), range(4)))
        self.assertEqual(len(set(results)), 1)
        self.assertEqual(name.read_bytes(), b"first")
        self.assertEqual(results[0].read_bytes(), b"second")

    def test_animation_timeline_is_read_from_glb(self):
        extras = dict(motionBaseSHA256=self.look, geometrySHA256=self.body)
        document = dict(asset=dict(version="2.0", extras=extras), nodes=[{}], buffers=[dict(byteLength=48)],
                        bufferViews=[dict(buffer=0, byteLength=12), dict(buffer=0, byteOffset=12, byteLength=36)],
                        accessors=[dict(bufferView=0, componentType=5126, type="SCALAR", count=3),
                                   dict(bufferView=1, componentType=5126, type="VEC3", count=3)],
                        animations=[dict(samplers=[dict(input=0, output=1)],
                                         channels=[dict(sampler=0, target=dict(node=0, path="translation"))])])
        keys = struct.pack("<12f", 0, .25, .5, 0, 0, 0, 1, 0, 0, 2, 0, 0)

        def animated_file(take, card, path_key, **sources):
            document["asset"]["extras"] = dict(extras, take=take, card=card, **{path_key: "a" * 64}, **sources)
            chunk = json.dumps(document).encode()
            chunk += b" " * (-len(chunk) % 4)
            file = self.root / (take + ".glb")
            file.write_bytes(struct.pack("<4sIIII", b"glTF", 2, 28+len(chunk)+len(keys), len(chunk), 0x4e4f534a) +
                             chunk + struct.pack("<I4s", len(keys), b"BIN\0") + keys)
            return file

        sources = []
        for take, card, path_key in (("kortdrag", "KORT-02", "cardPathSHA256"), ("blink", None, "motionPathSHA256")):
            with self.subTest(take=take):
                fingerprint = versions.register_model(self.store, animated_file(take, card, path_key))
                sources.append(fingerprint)
                receipt = versions.read_json(self.store / "modeller" / (fingerprint + ".json"))
                self.assertEqual(receipt["kind"], "motion")
                self.assertEqual((receipt["motion"]["keyframes"], receipt["motion"]["end"]), (3, .5))
                self.assertEqual(receipt["motion"]["appearance"], self.look)
                self.assertEqual((receipt["motion"]["card"], receipt["motion"]["pathSha256"]), (card, "a" * 64))
        combined = animated_file("samspel", "KORT-02", "cardPathSHA256", componentMotionsSHA256=sources)
        self.assertEqual(versions.registered_motion(self.store, versions.register_model(self.store, combined))["components"], sources)
        with self.assertRaisesRegex(ValueError, "underlag saknas"):
            versions.register_model(self.store, animated_file("annan", "KORT-02", "cardPathSHA256", componentMotionsSHA256=["f" * 64]))
        with self.assertRaisesRegex(ValueError, "fotounderlag"):
            versions.register_model(self.store, animated_file("fel-fotoyta", "KORT-02", "cardPathSHA256",
                faceSurface=dict(baseAppearanceSHA256=self.look, photos={"sittande/front.png": "0" * 64})))
        self.assertEqual(len(list((self.store / "rorelser").glob("*.json"))), 3)

    def test_film_frame_times_and_review_belong_to_one_take(self):
        file = self.root / "test.mp4"
        file.write_bytes(b"anonymous-movie-fixture")
        capture = dict(videoSha256=versions.sha(file), take="kameraprov", title="Vridning", geometry=self.body,
            appearance=self.look, marks=[dict(frame=2, label="Profil")],
            cameras=[dict(id="Modellkameran", projection="ortografisk",
            samples=[dict(frame=0, azimuth=0, elevation=0, distance=3), dict(frame=2, azimuth=90, elevation=0, distance=3)])])
        probe = dict(streams=[dict(width=14, height=12, avg_frame_rate="24/1", codec_name="h264")],
                     frames=[dict(best_effort_timestamp_time=t) for t in ("0.100", "0.125", "0.170")])
        with patch.object(versions.subprocess, "check_output", return_value=json.dumps(probe).encode()):
            key = versions.register_film(self.store, file, capture)
            self.assertEqual(versions.register_film(self.store, file, capture), key)
            receipt = versions.read_json(self.store / "filmer" / (key + ".json"))
            self.assertAlmostEqual(receipt["marks"][0]["seconds"], .07)
            self.assertNotIn("poses", receipt)
            pose_receipts = []
            for end_pose in ("A1", "A2.3"):
                poses = {"start": "A2.3", "end": end_pose}
                pose_key = versions.register_film(self.store, file, dict(capture, poses=poses))
                self.assertEqual(versions.read_json(self.store / "filmer" / (pose_key + ".json"))["poses"], poses)
                pose_receipts.append(pose_key)
            self.assertEqual(len({key, *pose_receipts}), 3)
            contacts = dict(targetSeat=4, landingFrame=1, releaseFrame=2)
            with self.assertRaisesRegex(ValueError, "målplats"):
                versions.register_film(self.store, file, dict(capture, deal=contacts))
            motion_capture = dict(capture, motion="a" * 64, card="KORT-02", deal=contacts)
            with patch.object(versions, "registered_motion", return_value=motion_capture):
                motion_key = versions.register_film(self.store, file, motion_capture)
                saved = versions.read_json(self.store / "filmer" / (motion_key + ".json"))
                self.assertEqual(saved["deal"], contacts)
                layer = dict(sourceFilm=motion_key, sourceMotion=motion_capture["motion"], parts=["Hår"])
                look_capture = dict(capture, motion="b" * 64, card="KORT-02", photoLayer=layer)
                look_key = versions.register_film(self.store, file, look_capture)
                self.assertEqual(versions.read_json(self.store / "filmer" / (look_key + ".json"))["photoLayer"], layer)
                for wrong in (dict(layer, sourceFilm="f" * 64), dict(layer, sourceMotion="f" * 64), dict(layer, parts=["", "Hår"])):
                    with self.assertRaisesRegex(ValueError, "Fotoytans"):
                        versions.register_film(self.store, file, dict(look_capture, photoLayer=wrong))
                applied = dict(motion_capture, appearanceStudy=look_key)
                with patch.object(versions, "photographic_atlases", return_value={"body": ["c" * 64], "hair": ["d" * 64]}):
                    applied_key = versions.register_film(self.store, file, applied)
                self.assertEqual(versions.read_json(self.store / "filmer" / (applied_key + ".json"))["appearanceStudy"], look_key)
                with patch.object(versions, "photographic_atlases", side_effect=[{"body": ["c" * 64]}, {"body": ["e" * 64]}]):
                    with self.assertRaisesRegex(ValueError, "fototexturer avviker"):
                        versions.register_film(self.store, file, applied)
                with self.assertRaisesRegex(ValueError, "fotoyteprov"):
                    versions.register_film(self.store, file, dict(applied, appearanceStudy=motion_key))
                for invalid in (dict(contacts, targetSeat=False), dict(contacts, releaseFrame=3), dict(contacts, landingFrame=2)):
                    with self.assertRaisesRegex(ValueError, "målplats"):
                        versions.register_film(self.store, file, dict(motion_capture, deal=invalid))
            with self.assertRaisesRegex(ValueError, "slutpose"):
                versions.register_film(self.store, file, dict(capture, poses={"start": "A2.3"}))
            versions.register_review(self.store, key, "Modellkameran", [2], "Hela skon syns.")
            with self.assertRaisesRegex(ValueError, "kamera"):
                versions.register_review(self.store, key, "Annan kamera", [2], "Hela skon syns.")
            with self.assertRaisesRegex(ValueError, "Granskningsrutan"):
                versions.register_film(self.store, file, dict(capture, marks=[dict(frame=3, label="Grepp")]))
            with self.assertRaisesRegex(ValueError, "annan rigg"):
                versions.register_film(self.store, file, dict(capture, geometry=self.make_model("annan", {})))
