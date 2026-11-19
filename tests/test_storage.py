"""Gallringens regressionsprov använder endast tillfälliga, nytillverkade filer."""

import os
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import lab


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.parent = Path(self.temp.name)
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
        lab.write_json(path / "run.json", dict(schema=lab.SCHEMA, id=name, state="complete",
                       started=(lab.now() - timedelta(days=days)).isoformat()))
        (path / "result.obj").touch()
        return path

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
