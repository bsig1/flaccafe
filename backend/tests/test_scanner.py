from __future__ import annotations

import unittest

from backend.app.scanner import parse_replaygain_gain, parse_replaygain_peak


class ScannerMetadataTests(unittest.TestCase):
    def test_parse_replaygain_gain_accepts_common_tag_shapes(self) -> None:
        self.assertEqual(parse_replaygain_gain({"gain": "-6.20 dB"}, "gain"), -6.2)
        self.assertEqual(parse_replaygain_gain({"gain": ["+3.00 dB"]}, "gain"), 3.0)
        self.assertEqual(parse_replaygain_gain({"gain": ("1.5",)}, "gain"), 1.5)

    def test_parse_replaygain_gain_ignores_missing_or_invalid_values(self) -> None:
        self.assertIsNone(parse_replaygain_gain({}, "gain"))
        self.assertIsNone(parse_replaygain_gain({"gain": []}, "gain"))
        self.assertIsNone(parse_replaygain_gain({"gain": "not a gain"}, "gain"))

    def test_parse_replaygain_peak_accepts_positive_values_only(self) -> None:
        self.assertEqual(parse_replaygain_peak({"peak": "0.987654"}, "peak"), 0.987654)
        self.assertIsNone(parse_replaygain_peak({"peak": "0"}, "peak"))
        self.assertIsNone(parse_replaygain_peak({"peak": "-1"}, "peak"))


if __name__ == "__main__":
    unittest.main()
