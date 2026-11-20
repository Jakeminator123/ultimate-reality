"""Gallringens regressionsprov använder endast tillfälliga, nytillverkade filer."""

import os
import hashlib
import json
import py_compile
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import lab
import lab_cleanup


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name)
        self.project = self.parent / "checkout"
        self.project.mkdir()
        checkout = patch.object(lab, "PROJECT", self.project)
        checkout.start()
        self.addCleanup(checkout.stop)
        settings = patch.dict(os.environ, {"ULTIMATE_REALITY_STORAGE": self.temp.name,
                                            "SAM3D_ROOT": self.temp.name})
        settings.start()
        self.addCleanup(settings.stop)
        with lab.storage() as self.root:
            pass

    def fixture(self, seq, days=10):
        name = f"sam-20261101T000000Z-{seq:012x}"
        path = self.root / "runs" / name
        path.mkdir()
        (path / "result.obj").touch()
        stamp = (lab.now() - timedelta(days=days)).isoformat()
        lab.write_json(path / "run.json", dict(schema=lab.SCHEMA, id=name, state="complete",
                       started=stamp, finished=stamp, outputs={"result.obj": lab.sha(path / "result.obj")}))
        return path

    def test_protects_registered_active_legacy_and_changed_runs(self):
        linked, active, unknown, changed, legacy = [self.fixture(i) for i in range(1, 6)]
        registry = self.project / "avatars" / "dealer" / "3d" / "versioner" / "modeller"
        registry.mkdir(parents=True)
        lab.write_json(registry / "model.json", {"run": linked.name})
        for run in (active, legacy):
            data = lab.manifest(run)
            if run == active:
                data["state"] = "running"
            else:
                del data["outputs"]
            lab.write_json(run / "run.json", data)
        (unknown / "eget.txt").write_text("Jakobs")
        (changed / "result.obj").write_bytes(b"edited")
        with lab.storage() as root:
            lab.clean(root)
        for run in (linked, active, unknown, changed, legacy):
            self.assertTrue((run / "result.obj").exists())

    def test_only_exactly_reproducible_bytecode_is_removed(self):
        import _winapi
        source = self.project / "tools" / "sample.py"
        source.parent.mkdir()
        source.write_text("sample = 1")
        cache = Path(py_compile.compile(str(source), doraise=True))
        personal = cache.parent / "mina-anteckningar.txt"
        personal.write_text("behåll")
        external = self.parent / "external"
        external.mkdir()
        outside_source = external / "sample.py"
        outside_source.write_text("sample = 2")
        outside_cache = Path(py_compile.compile(str(outside_source), doraise=True))
        _winapi.CreateJunction(str(external), str(source.parent / "link"))
        lab_cleanup.clean_bytecode(self.project, True)
        self.assertTrue(cache.exists())
        with cache.open("rb"):
            lab_cleanup.clean_bytecode(self.project, False)
        self.assertTrue(cache.exists())
        source.write_text("sample = 3")
        lab_cleanup.clean_bytecode(self.project, False)
        self.assertTrue(cache.exists())
        py_compile.compile(str(source), doraise=True)
        lab_cleanup.clean_bytecode(self.project, False)
        self.assertFalse(cache.exists())
        self.assertTrue(personal.exists())
        self.assertTrue(outside_cache.exists())

    def test_registered_trial_copies_require_intact_sources_and_a_closed_job(self):
        dealer, take = "testdealer", "kortprov"
        trial = self.project / "test" / "dealer" / dealer / take
        stage = trial / "utprovning"
        stage.mkdir(parents=True)
        store = self.project / "avatars" / dealer / "3d" / "versioner"
        (store / "filer").mkdir(parents=True)
        (store / "filmer").mkdir()
        motion, film = b"rig", b"movie"
        m, f = [hashlib.sha256(data).hexdigest() for data in (motion, film)]
        record = json.dumps({"take": take, "motion": m, "sha256": f}).encode()
        receipt = hashlib.sha256(record).hexdigest()
        (store / "filmer" / (receipt + ".json")).write_bytes(record)
        lab.write_json(trial / "registrering.json", {"filmRecord": receipt, "motion": m, "movie": f})
        copies = []
        for name, data, digest in ((dealer + "-" + take + ".glb", motion, m), (take + ".mp4", film, f)):
            copy = stage / name
            copies.append(copy)
            copy.write_bytes(data)
            (trial / name).write_bytes(data)
            (store / "filer" / (digest + copy.suffix)).write_bytes(data)
        (stage / "ruta-9.png").touch()
        def finish(dry):
            lab_cleanup.finish_trial(self.project, dealer, take, stage.name, dry)
        finish(True)
        self.assertTrue(all(p.exists() for p in copies))
        with copies[0].open("rb"), self.assertRaises(OSError):
            finish(False)
        with self.assertRaises(ValueError):
            lab_cleanup.finish_trial(self.project, dealer, take, "../annan", False)
        (trial / copies[1].name).write_bytes(b"changed")
        with self.assertRaises(ValueError):
            finish(False)
        self.assertTrue(all(p.exists() for p in copies))
        (trial / copies[1].name).write_bytes(film)
        copies[1].write_bytes(b"different job")
        with self.assertRaises(ValueError):
            finish(False)
        self.assertEqual(copies[1].read_bytes(), b"different job")
        self.assertTrue(copies[0].exists())
        copies[1].write_bytes(film)
        recipe = trial / "register.py"
        recipe.write_text("raise SystemExit(7)")
        args = ["lab", "finish-trial", dealer, take, stage.name, "--register", recipe.name]
        with patch.object(sys, "argv", args + ["--dry-run"]):
            lab.main()
        with patch.object(sys, "argv", args), self.assertRaises(SystemExit) as failure:
            lab.main()
        self.assertEqual(failure.exception.code, 7)
        self.assertTrue(all(p.exists() for p in copies))
        recipe.write_text("from pathlib import Path\nassert Path('registrering.json').is_file()")
        with patch.object(sys, "argv", args):
            lab.main()
        finish(False)
        self.assertTrue((stage / "ruta-9.png").exists())
        self.assertTrue(all(not p.exists() and (trial / p.name).exists() for p in copies))

    def test_sam_cleans_only_owned_expired_runs(self):
        expired = self.fixture(1)
        fresh = self.fixture(2, days=1)
        unknown = self.fixture(3)
        lab.write_json(unknown / "run.json", {"schema": "another lab"})
        preserved = self.fixture(4)
        with patch.object(sys, "argv", ["lab", "keep", preserved.name]):
            lab.main()
        input_file = self.root / "inputs" / "source.png"
        input_file.write_bytes(b"test fixture")
        order_original = self.root / "orders" / "original.mp4"
        order_original.write_bytes(b"returned film")
        with lab.storage() as root, patch("sam_photo.estimate"):
            lab.clean(root, dry_run=True)
            self.assertTrue(expired.is_dir())
            lab.run_sam(root, [input_file], mesh_only=True)
        self.assertFalse(expired.exists())
        for path in (fresh, unknown, self.root / "saved" / preserved.name):
            self.assertTrue((path / "result.obj").exists())
        self.assertEqual(input_file.read_bytes(), b"test fixture")
        self.assertEqual(order_original.read_bytes(), b"returned film")

    def test_failed_run_can_be_retried_and_active_lock_blocks_cleanup(self):
        photo = self.parent / "source.jpg"
        photo.touch()
        with lab.storage() as root:
            with self.assertRaises(RuntimeError), lab.storage():
                self.fail("En andra körning fick låset")
            with patch("sam_photo.estimate", side_effect=ValueError("provfel")), self.assertRaises(ValueError):
                lab.run_sam(root, [photo], False)
            with patch("sam_photo.estimate"):
                lab.run_sam(root, [photo], False)
        states = {lab.manifest(p)["state"] for p in (root / "runs").iterdir()}
        self.assertEqual(states, {"complete", "failed"})

    def test_unowned_directory_is_preserved(self):
        (self.root / ".owner").unlink()
        with self.assertRaises(ValueError), lab.storage():
            self.fail("Omärkt lagring öppnades")
        self.assertTrue((self.root / "saved").exists())

    def test_junction_cannot_lead_cleanup_outside_a_run(self):
        import _winapi
        run = self.fixture(5)
        external = self.parent / "source-project"
        external.mkdir()
        (external / "source.png").touch()
        _winapi.CreateJunction(str(external), str(run / "ref"))
        with lab.storage() as root:
            lab.clean(root)
        self.assertTrue((external / "source.png").exists())
        self.assertTrue((run / "result.obj").exists())


if __name__ == "__main__":
    unittest.main()
