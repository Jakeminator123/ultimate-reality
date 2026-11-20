import sys
import unittest
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from arm_rotation_check import rotation_steps


class ArmRotationTests(unittest.TestCase):
    def test_measures_true_rotation_across_signed_angle_and_quaternion_boundaries(self):
        times = np.arange(3) / 24
        rotations = Rotation.from_euler("z", [[179], [-179], [-9]], degrees=True).as_quat()
        rotations[1] *= -1
        np.testing.assert_allclose(rotation_steps(times, rotations, times), [2, 170], atol=1e-7)
