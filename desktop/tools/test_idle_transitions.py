import hashlib
import json
import unittest

import cv2
import numpy as np

import generate_idle_transitions as generator


class IdleTransitionsTest(unittest.TestCase):
    def test_inverse_warp_moves_a_shape_to_its_intermediate_position(self):
        source = np.zeros((32, 32, 4), dtype=np.float32)
        source[10:18, 8:16] = 1
        flow = np.zeros((32, 32, 2), dtype=np.float32)
        flow[..., 0] = 8
        midpoint = generator.warp(source, flow, 0.5)
        np.testing.assert_array_equal(midpoint[10:18, 12:20], 1)
        self.assertEqual(np.count_nonzero(midpoint[..., 3]), 64)

    def test_generated_frames_keep_two_separate_eyes(self):
        for name in ("jump", "wave"):
            for index in range(generator.STEPS):
                path = generator.OUTPUT / name / f"return-{index + 1:03}.png"
                with self.subTest(frame=str(path)):
                    pixels = np.asarray(generator.Image.open(path).convert("RGBA"))
                    self.assertEqual(pixels.shape, (256, 256, 4))
                    face = pixels[125:165, 90:180]
                    dark = ((face[..., :3].max(axis=2) < 45) & (face[..., 3] > 230)).astype(np.uint8)
                    count, _, stats, _ = cv2.connectedComponentsWithStats(dark)
                    eyes = [stats[i] for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] > 65]
                    self.assertEqual(len(eyes), 2, "Expected two opaque eyes without duplicate outlines")
                    self.assertGreater(np.count_nonzero(pixels[..., 3] > 250), 19000)

    def test_assets_match_the_current_source_art_and_alignment(self):
        metadata = json.loads((generator.OUTPUT / "generation.json").read_text())
        scale, offset = generator.action_alignment()
        self.assertEqual(metadata["action_scale"], list(scale))
        self.assertEqual(metadata["action_offset_y"], -offset)
        for name, path in generator.source_frames().items():
            self.assertEqual(metadata["sources"][name]["sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
            self.assertEqual(metadata["sources"][name]["path"], str(path.relative_to(generator.DESKTOP)))


if __name__ == "__main__":
    unittest.main()
