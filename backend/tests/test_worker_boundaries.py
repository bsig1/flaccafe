import importlib
import sys
import unittest

from backend.app.worker import PYTHON_ACTIONS


class WorkerBoundaryTests(unittest.TestCase):
    def test_rust_owned_domains_do_not_fall_back_to_python(self) -> None:
        forbidden_actions = {
            "auto_tag_musicbrainz",
            "lookup_album_completion",
            "list_album_artwork_candidates",
            "search_album_artwork",
            "artwork_collision_repair",
            "get_chromaprint_setup",
            "update_chromaprint_setup",
            "run_acoustic_fingerprint_pass",
            "get_podcast_subscriptions",
            "create_podcast_subscription",
            "update_podcast_subscription",
            "remove_podcast_subscription",
            "ensure_podcast_subscription_folder_route",
            "get_podcast_episodes",
            "refresh_podcast_subscription_route",
            "download_podcast_episode_route",
            "delete_podcast_episode_download_route",
            "ensure_podcast_episode_track_route",
            "delete_track",
            "delete_tracks",
            "restore_track",
            "sync_track_metadata_from_files",
            "apply_duplicate_action",
            "list_bulk_undo_log",
            "list_bulk_undo_batches",
            "restore_bulk_undo_batch",
            "restore_bulk_undo_log_entry",
            "get_scrobble_accounts",
            "update_scrobble_account",
            "get_scrobble_outbox",
            "queue_scrobbling_history",
            "submit_scrobbling_outbox",
            "start_lastfm_login_route",
            "complete_lastfm_login_route",
            "import_scrobbling_history",
            "import_external_library_stats",
        }

        self.assertFalse(forbidden_actions & PYTHON_ACTIONS)

    def test_importing_python_action_surface_does_not_eagerly_load_replaced_domains(self) -> None:
        replaced_modules = {
            "backend.app.library_importers",
            "backend.app.musicbrainz_autotag",
            "backend.app.podcasts",
            "backend.app.scrobbling",
        }
        for module_name in replaced_modules | {"backend.app.main"}:
            sys.modules.pop(module_name, None)

        importlib.import_module("backend.app.main")

        self.assertFalse(replaced_modules & sys.modules.keys())

    def test_importing_cd_helpers_does_not_eagerly_load_online_matching(self) -> None:
        for module_name in {"backend.app.cd_ripping", "backend.app.musicbrainz_autotag"}:
            sys.modules.pop(module_name, None)

        importlib.import_module("backend.app.cd_ripping")

        self.assertNotIn("backend.app.musicbrainz_autotag", sys.modules)


if __name__ == "__main__":
    unittest.main()
