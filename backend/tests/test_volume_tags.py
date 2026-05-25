from __future__ import annotations

import unittest

from backend.app.volume_tags import (
    album_loudness,
    applied_value,
    manual_volume_previews,
    parse_ffmpeg_ebur128,
    track_gain_from_loudness,
    LoudnessScan,
)


class VolumeTagTests(unittest.TestCase):
    def test_parse_ffmpeg_ebur128_summary(self) -> None:
        output = """
        [Parsed_ebur128_0 @ 000001] Integrated loudness:
        [Parsed_ebur128_0 @ 000001]     I:         -14.7 LUFS
        [Parsed_ebur128_0 @ 000001] True peak:
        [Parsed_ebur128_0 @ 000001]     Peak:       -1.2 dBFS
        """

        scan = parse_ffmpeg_ebur128(output)

        self.assertAlmostEqual(scan.integrated, -14.7)
        self.assertAlmostEqual(scan.peak or 0, 0.871, places=3)
        self.assertAlmostEqual(track_gain_from_loudness(scan.integrated), -3.3)

    def test_album_loudness_is_duration_weighted(self) -> None:
        loudness = album_loudness(
            [
                (LoudnessScan(integrated=-20.0, peak=0.5), 60),
                (LoudnessScan(integrated=-10.0, peak=0.9), 180),
            ]
        )

        self.assertIsNotNone(loudness)
        self.assertGreater(loudness or -99, -13.0)
        self.assertLess(loudness or 99, -10.0)

    def test_manual_volume_preview_marks_requested_fields(self) -> None:
        previews = manual_volume_previews(
            [
                {
                    "id": 1,
                    "path": "song.flac",
                    "title": "Song",
                    "artist": "Artist",
                    "album": "Album",
                    "replaygain_track_gain_db": None,
                    "replaygain_track_peak": None,
                    "replaygain_album_gain_db": -2.0,
                    "replaygain_album_peak": 0.9,
                }
            ],
            track_gain_db=-4.25,
            track_peak=0.98,
            album_gain_db=None,
            album_peak=None,
        )

        self.assertEqual(previews[0]["proposed_track_gain_db"], -4.25)
        self.assertEqual(previews[0]["proposed_track_peak"], 0.98)
        self.assertIsNone(previews[0]["proposed_album_gain_db"])
        self.assertTrue(previews[0]["changed"])

    def test_manual_blank_values_preserve_existing_applied_values(self) -> None:
        preview = {
            "current_album_gain_db": -2.0,
            "proposed_album_gain_db": None,
        }

        self.assertEqual(applied_value(preview, "proposed_album_gain_db", "current_album_gain_db", True), -2.0)
        self.assertIsNone(applied_value(preview, "proposed_album_gain_db", "current_album_gain_db", False))


if __name__ == "__main__":
    unittest.main()
