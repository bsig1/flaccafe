from __future__ import annotations

import argparse
import http.client
import inspect
import json
import os
import shutil
import sys
import tempfile
import threading
import traceback
from contextlib import ExitStack
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import UnionType
from typing import Any, Literal, get_args, get_origin, get_type_hints
from urllib.parse import urlencode
from unittest.mock import patch
from urllib.error import URLError


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@dataclass(frozen=True)
class HammerFixture:
    root: Path
    db_path: Path
    music_dir: Path
    output_dir: Path
    report_path: Path
    csv_path: Path
    playlist_path: Path
    backup_path: Path
    track_id: int
    second_track_id: int
    third_track_id: int
    album_id: int
    playlist_id: int
    subscription_id: int
    episode_id: int
    profile_id: int
    rule_id: int
    preset_id: int
    definition_id: int
    undo_entry_id: int
    undo_batch_id: str


@dataclass(frozen=True)
class HammerCase:
    kind: Literal["good", "bad"]
    label: str
    method: str
    path: str
    params: dict[str, Any]
    body: Any = None


@dataclass
class HammerFailure:
    route: str
    action: str
    case: HammerCase
    status_code: int | None
    detail: str


PATH_PARAM_DEFAULTS = {
    "track_id": "track_id",
    "album_id": "album_id",
    "playlist_id": "playlist_id",
    "subscription_id": "subscription_id",
    "episode_id": "episode_id",
    "profile_id": "profile_id",
    "rule_id": "rule_id",
    "preset_id": "preset_id",
    "definition_id": "definition_id",
    "entry_id": "undo_entry_id",
    "batch_id": "undo_batch_id",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Hammer every Rust-owned backend route with at least five good and "
            "five bad HTTP-shaped requests against a throwaway SQLite database."
        )
    )
    parser.add_argument("--keep-temp", action="store_true", help="Keep the fake app-data folder for inspection.")
    parser.add_argument("--max-failures", type=int, default=40, help="Number of failures to print before truncating.")
    parser.add_argument("--quiet", action="store_true", help="Only print the final summary.")
    parser.add_argument("--start", type=int, default=1, help="1-based route index to start at.")
    parser.add_argument("--count", type=int, default=None, help="Maximum number of routes to hammer.")
    parser.add_argument(
        "--transport",
        choices=("http", "direct"),
        default="http",
        help="Use a test-only localhost HTTP server, or call the route dispatcher directly.",
    )
    args = parser.parse_args()

    temp_root = Path(tempfile.mkdtemp(prefix="flaccafe-route-hammer-")).resolve()
    os.environ["FLAC_CAFE_DATA_DIR"] = str(temp_root / "appdata")
    os.environ["MUSIC_REC_DB"] = str(temp_root / "initial.sqlite3")
    os.environ["FLAC_CAFE_ROUTE_HAMMER"] = "1"

    from backend.app.worker import _load_actions_module
    from backend.tests.worker_test_client import TestClient

    app_module = _load_actions_module()
    client = TestClient(raise_server_exceptions=True)
    all_routes = client.routes
    start_index = max(1, args.start)
    routes = all_routes[start_index - 1 :]
    if args.count is not None:
        routes = routes[: max(0, args.count)]

    failures: list[HammerFailure] = []
    status_counts: dict[int, int] = {}
    total_cases = 0
    server: ThreadingHTTPServer | None = None
    server_thread: threading.Thread | None = None

    try:
        if args.transport == "http":
            server, server_thread = start_hammer_http_server(client)
        with patched_external_boundaries(app_module):
            for local_index, route in enumerate(routes, start=1):
                index = start_index + local_index - 1
                if not args.quiet:
                    print(f"[{index:03d}/{len(all_routes):03d}] {route.method} {route.template}", flush=True)
                fixture = seed_fake_database(temp_root / f"case-{index:03d}")
                cases = route_cases(app_module, route, fixture)
                good_count = sum(1 for case in cases if case.kind == "good")
                bad_count = sum(1 for case in cases if case.kind == "bad")
                if good_count < 5 or bad_count < 5:
                    failures.append(
                        HammerFailure(
                            route=f"{route.method} {route.template}",
                            action=route.action,
                            case=HammerCase("bad", "case-generation", route.method, route.template, {}),
                            status_code=None,
                            detail=f"Generated {good_count} good and {bad_count} bad cases",
                        )
                    )
                    continue

                for case in cases:
                    os.environ["MUSIC_REC_DB"] = str(fixture.db_path)
                    total_cases += 1
                    try:
                        if args.transport == "http":
                            status_code, response_text = send_http_case(server, case)
                        else:
                            response = client.request(case.method, case.path, params=case.params, json=case.body)
                            status_code, response_text = response.status_code, response.text
                        status_counts[status_code] = status_counts.get(status_code, 0) + 1
                        if status_code >= 500:
                            failures.append(
                                HammerFailure(
                                    route=f"{route.method} {route.template}",
                                    action=route.action,
                                    case=case,
                                    status_code=status_code,
                                    detail=response_text[:1000],
                                )
                            )
                    except Exception as exc:  # noqa: BLE001 - this is a crash finder.
                        failures.append(
                            HammerFailure(
                                route=f"{route.method} {route.template}",
                                action=route.action,
                                case=case,
                                status_code=None,
                                detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc(limit=8)}",
                            )
                        )

        request_label = "HTTP requests" if args.transport == "http" else "HTTP-shaped requests"
        print(f"Hammered {len(routes)} routes with {total_cases} {request_label}.")
        print("Status counts:", json.dumps(dict(sorted(status_counts.items())), sort_keys=True))
        if failures:
            print(f"\nFound {len(failures)} route hammer failures:")
            for failure in failures[: args.max_failures]:
                print_failure(failure)
            if len(failures) > args.max_failures:
                print(f"\n... {len(failures) - args.max_failures} more failures omitted.")
            print(f"\nFake app-data folder: {temp_root}")
            return 1

        print("No route crashes or case-generation gaps found.")
        return 0
    finally:
        client.close()
        if server is not None:
            server.shutdown()
            server.server_close()
        if server_thread is not None:
            server_thread.join(timeout=2)
        os.environ.pop("MUSIC_REC_DB", None)
        os.environ.pop("FLAC_CAFE_ROUTE_HAMMER", None)
        if args.keep_temp:
            print(f"Kept fake app-data folder: {temp_root}")
        else:
            shutil.rmtree(temp_root, ignore_errors=True)


def start_hammer_http_server(client: Any) -> tuple[ThreadingHTTPServer, threading.Thread]:
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self) -> None:  # noqa: N802 - stdlib handler API.
            self._handle()

        def do_HEAD(self) -> None:  # noqa: N802 - stdlib handler API.
            self._handle()

        def do_POST(self) -> None:  # noqa: N802 - stdlib handler API.
            self._handle()

        def do_PATCH(self) -> None:  # noqa: N802 - stdlib handler API.
            self._handle()

        def do_DELETE(self) -> None:  # noqa: N802 - stdlib handler API.
            self._handle()

        def log_message(self, *_: Any) -> None:
            return None

        def _handle(self) -> None:
            try:
                body = read_json_body(self)
                response = client.request(self.command, self.path, json=body)
                content = b"" if self.command == "HEAD" else response.content
                self.send_response(response.status_code, response.reason_phrase)
                for key, value in response.headers.items():
                    if key.lower() == "content-length":
                        continue
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                if content:
                    self.wfile.write(content)
            except Exception as exc:  # noqa: BLE001 - surfacing route crashes is the point.
                content = json.dumps(
                    {"detail": f"{type(exc).__name__}: {exc}", "traceback": traceback.format_exc(limit=8)}
                ).encode("utf-8")
                self.send_response(500, "Internal Server Error")
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(content)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, name="flac-cafe-route-hammer-http", daemon=True)
    thread.start()
    return server, thread


def read_json_body(handler: BaseHTTPRequestHandler) -> Any:
    length = int(handler.headers.get("Content-Length") or "0")
    if length <= 0:
        return None
    raw = handler.rfile.read(length)
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def send_http_case(server: ThreadingHTTPServer | None, case: HammerCase) -> tuple[int, str]:
    if server is None:
        raise RuntimeError("HTTP transport was requested before the test server started")
    target = case.path
    if case.params:
        query = urlencode([(key, value) for key, value in case.params.items() if value is not None], doseq=True)
        if query:
            target = f"{target}?{query}"
    body = None if case.body is None else json.dumps(case.body, default=str).encode("utf-8")
    headers = {"Content-Type": "application/json"} if body is not None else {}
    connection = http.client.HTTPConnection(server.server_address[0], int(server.server_address[1]), timeout=30)
    try:
        connection.request(case.method, target, body=body, headers=headers)
        response = connection.getresponse()
        content = response.read()
        return int(response.status), content.decode("utf-8", errors="replace")
    finally:
        connection.close()


def patched_external_boundaries(app_module: Any) -> ExitStack:
    stack = ExitStack()
    offline = URLError("route hammer runs offline")

    def blocked_urlopen(*_: Any, **__: Any) -> None:
        raise offline

    stack.enter_context(patch.object(app_module.urlrequest, "urlopen", side_effect=blocked_urlopen))

    for module_name in (
        "backend.app.musicbrainz_autotag",
        "backend.app.podcasts",
        "backend.app.scrobbling",
        "backend.app.ffmpeg_install_jobs",
    ):
        try:
            module = __import__(module_name, fromlist=["urlrequest"])
            stack.enter_context(patch.object(module.urlrequest, "urlopen", side_effect=blocked_urlopen))
        except Exception:
            pass

    stack.enter_context(patch.object(app_module, "start_clap_install_job", side_effect=fake_clap_install_job))
    stack.enter_context(patch.object(app_module, "get_clap_install_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "start_audio_analysis_job", side_effect=fake_analysis_job))
    stack.enter_context(patch.object(app_module, "get_audio_analysis_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "pause_audio_analysis_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "resume_audio_analysis_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "cancel_audio_analysis_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "start_ffmpeg_install_job", side_effect=fake_ffmpeg_install_job))
    stack.enter_context(patch.object(app_module, "get_ffmpeg_install_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "start_audio_conversion_job", side_effect=fake_conversion_job))
    stack.enter_context(patch.object(app_module, "get_audio_conversion_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "cancel_audio_conversion_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "start_cd_rip_job", side_effect=fake_cd_rip_job))
    stack.enter_context(patch.object(app_module, "get_cd_rip_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "cancel_cd_rip_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "start_scan_job", side_effect=fake_scan_job))
    stack.enter_context(patch.object(app_module, "get_scan_job", side_effect=fake_get_job))
    stack.enter_context(patch.object(app_module, "lrclib_fetch", side_effect=fake_lrclib_fetch))
    return stack


def fake_get_job(job_id: str, *_: Any, **__: Any) -> dict[str, Any]:
    return {
        "job_id": str(job_id or "hammer-job"),
        "status": "completed",
        "message": "Route hammer fake job",
        "current_step": 1,
        "total_steps": 1,
        "percent": 100.0,
        "started_at": "2026-01-01T00:00:00",
        "finished_at": "2026-01-01T00:00:01",
        "elapsed_seconds": 1.0,
        "errors": [],
        "log": [],
    }


def fake_clap_install_job(*_: Any, device: str = "cpu", force: bool = False, **__: Any) -> dict[str, Any]:
    return {**fake_get_job("hammer-clap-install"), "device": device, "force": force}


def fake_analysis_job(*_: Any, **__: Any) -> dict[str, Any]:
    return {
        **fake_get_job("hammer-analysis"),
        "phase": "finished",
        "total_tracks": 0,
        "processed_tracks": 0,
        "analyzed": 0,
        "skipped": 0,
        "failed_tracks": [],
    }


def fake_ffmpeg_install_job(*_: Any, **__: Any) -> dict[str, Any]:
    return {**fake_get_job("hammer-ffmpeg-install"), "tool_directory": "hammer-tools"}


def fake_conversion_job(request: Any) -> dict[str, Any]:
    return {
        **fake_get_job("hammer-conversion"),
        "target_folder": getattr(request, "target_folder", ""),
        "output_format": getattr(request, "output_format", "flac"),
        "phase": "finished",
        "total_tracks": 0,
        "processed_tracks": 0,
        "converted": 0,
        "skipped": 0,
    }


def fake_cd_rip_job(request: Any) -> dict[str, Any]:
    return {
        **fake_get_job("hammer-cd-rip"),
        "drive_id": getattr(request, "drive_id", "Z:"),
        "output_folder": getattr(request, "output_folder", ""),
        "output_format": getattr(request, "output_format", "flac"),
        "phase": "finished",
        "total_tracks": 0,
        "processed_tracks": 0,
        "ripped_tracks": 0,
        "skipped_tracks": 0,
        "verification": [],
    }


def fake_scan_job(*_: Any, paths: list[str] | None = None, **__: Any) -> dict[str, Any]:
    folder_paths = paths or []
    return {
        **fake_get_job("hammer-scan"),
        "folder_path": folder_paths[0] if folder_paths else "",
        "folder_paths": folder_paths,
        "total_files": 0,
        "processed_files": 0,
        "inserted": 0,
        "updated": 0,
        "removed": 0,
        "skipped": 0,
        "elapsed_seconds": 0.1,
        "eta_seconds": None,
    }


def fake_lrclib_fetch(track: dict[str, Any]) -> Any:
    from backend.app.schemas import LyricsResponse

    return LyricsResponse(
        track_id=int(track.get("id") or track.get("track_id") or 1),
        lyrics="[00:01.00]Hammer lyric",
        source="route-hammer:lrclib",
        is_synced=True,
    )


def seed_fake_database(root: Path) -> HammerFixture:
    from backend.app.database import connect, init_db, set_setting
    from backend.app.scanner import path_key

    root.mkdir(parents=True, exist_ok=True)
    music_dir = root / "Music"
    output_dir = root / "Output"
    music_dir.mkdir()
    output_dir.mkdir()
    first_file = music_dir / "01 - Hammer Song.mp3"
    second_file = music_dir / "02 - Hammer Song.flac"
    third_file = music_dir / "03 - Other Song.ogg"
    first_file.write_bytes(b"ID3\x04\x00\x00\x00\x00\x00\x21hammer")
    second_file.write_bytes(b"fLaChammer")
    third_file.write_bytes(b"OggShammer")
    cover_path = music_dir / "cover.jpg"
    cover_path.write_bytes(b"\xff\xd8\xff\xe0hammer\xff\xd9")
    playlist_path = root / "hammer.m3u"
    playlist_path.write_text(f"#EXTM3U\n{first_file}\n{second_file}\n", encoding="utf-8")
    csv_path = root / "hammer.csv"
    csv_path.write_text("title,artist,album,rating\nHammer Song,Hammer Artist,Hammer Album,4\n", encoding="utf-8")
    report_path = root / "hammer-report.json"
    report_path.write_text(json.dumps({"generated_by": "route-hammer"}), encoding="utf-8")
    backup_path = root / "hammer-backup.json"
    backup_path.write_text(json.dumps({"entries": []}), encoding="utf-8")

    db_path = root / "hammer.sqlite3"
    os.environ["MUSIC_REC_DB"] = str(db_path)
    init_db()

    with connect() as conn:
        album_id = int(
            conn.execute(
                """
                INSERT INTO albums(album, album_artist, year, artwork_path, completion_expected_track_count)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("Hammer Album", "Hammer Artist", 2026, str(cover_path), 3),
            ).lastrowid
        )

        def insert_track(path: Path, title: str, artist: str, rating: float | None, number: int) -> int:
            return int(
                conn.execute(
                    """
                    INSERT INTO tracks(
                      path, path_key, title, artist, album, album_artist, album_id,
                      track_number, disc_number, genre, analysis_provider, analysis_model,
                      analysis_genre, analysis_genre_confidence, analysis_genre_tags,
                      analysis_embedding, year, duration_seconds, bitrate, audio_fingerprint,
                      acoustic_fingerprint, rating, play_count, skip_count, file_modified_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'clap', 'hammer-model',
                            ?, 0.84, ?, ?, 2026, 181.5, 320000, ?, ?, ?, 2, 1,
                            datetime('now'), datetime('now'))
                    """,
                    (
                        str(path),
                        path_key(path),
                        title,
                        artist,
                        "Hammer Album",
                        "Hammer Artist",
                        album_id,
                        number,
                        "Synth Pop",
                        "Synth Pop",
                        json.dumps({"synth pop": 0.84}),
                        json.dumps([0.1, 0.2, 0.3]),
                        f"audio-{number}",
                        f"acoustic-{number}",
                        rating,
                    ),
                ).lastrowid
            )

        track_id = insert_track(first_file, "Hammer Song", "Hammer Artist", 4.0, 1)
        second_track_id = insert_track(second_file, "Hammer Song", "Hammer Artist feat. Friend", 3.5, 2)
        third_track_id = insert_track(third_file, "Other Song", "Other Artist", None, 3)

        playlist_id = int(conn.execute("INSERT INTO playlists(name) VALUES (?)", ("Hammer Playlist",)).lastrowid)
        conn.executemany(
            "INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES (?, ?, ?)",
            [(playlist_id, track_id, 1), (playlist_id, second_track_id, 2)],
        )
        conn.execute(
            "INSERT INTO play_events(track_id, event_type, timestamp, metadata_json) VALUES (?, 'played', datetime('now'), '{}')",
            (track_id,),
        )
        conn.execute(
            "INSERT INTO track_lyrics(track_id, lyrics, source, is_synced) VALUES (?, ?, 'database:manual', 1)",
            (track_id, "[00:01.00]Hammer lyric"),
        )
        conn.execute(
            "INSERT INTO track_inbox_notes(track_id, note) VALUES (?, ?)",
            (track_id, "Hammer note"),
        )
        rule_id = int(
            conn.execute(
                """
                INSERT INTO inbox_auto_review_rules(name, field, match_type, value, note)
                VALUES ('Hammer Rule', 'genre', 'contains', 'Synth', 'Reviewed by hammer')
                """
            ).lastrowid
        )
        preset_id = int(
            conn.execute(
                """
                INSERT INTO regex_tag_presets(name, field, pattern, replacement)
                VALUES ('Hammer Preset', 'title', 'Hammer', 'Route Hammer')
                """
            ).lastrowid
        )
        definition_id = int(
            conn.execute(
                "INSERT INTO virtual_tag_definitions(name, expression) VALUES ('Hammer Virtual', '{artist} - {title}')"
            ).lastrowid
        )
        profile_id = int(
            conn.execute(
                """
                INSERT INTO recommendation_profiles(name, settings_json, is_default)
                VALUES ('Hammer Profile', ?, 1)
                """,
                (
                    json.dumps(
                        {
                            "queue_length": 5,
                            "temperature": 0.8,
                            "artist_cooldown": 1,
                            "album_cooldown": 2,
                            "unrated_exploration_percent": 10.0,
                        }
                    ),
                ),
            ).lastrowid
        )
        subscription_id = int(
            conn.execute(
                """
                INSERT INTO podcast_subscriptions(title, feed_url, download_folder)
                VALUES ('Hammer Cast', 'https://example.invalid/feed.xml', ?)
                """,
                (str(root / "Podcasts"),),
            ).lastrowid
        )
        episode_id = int(
            conn.execute(
                """
                INSERT INTO podcast_episodes(subscription_id, guid, title, audio_url, duration_seconds)
                VALUES (?, 'hammer-episode', 'Hammer Episode', 'https://example.invalid/episode.mp3', 60)
                """,
                (subscription_id,),
            ).lastrowid
        )
        undo_batch_id = "hammer-batch"
        undo_entry_id = int(
            conn.execute(
                """
                INSERT INTO bulk_action_undo_log(batch_id, action_type, summary, payload_json)
                VALUES (?, 'track_remove', 'Hammer undo entry', '{}')
                """,
                (undo_batch_id,),
            ).lastrowid
        )
        set_setting(conn, "library_path", str(music_dir))
        set_setting(conn, "library_paths", json.dumps([str(music_dir)]))
        set_setting(conn, "auto_write_fetched_lyrics_sidecars", "0")
        set_setting(conn, "cd_auto_lookup_metadata", "0")
        conn.commit()

    return HammerFixture(
        root=root,
        db_path=db_path,
        music_dir=music_dir,
        output_dir=output_dir,
        report_path=report_path,
        csv_path=csv_path,
        playlist_path=playlist_path,
        backup_path=backup_path,
        track_id=track_id,
        second_track_id=second_track_id,
        third_track_id=third_track_id,
        album_id=album_id,
        playlist_id=playlist_id,
        subscription_id=subscription_id,
        episode_id=episode_id,
        profile_id=profile_id,
        rule_id=rule_id,
        preset_id=preset_id,
        definition_id=definition_id,
        undo_entry_id=undo_entry_id,
        undo_batch_id=undo_batch_id,
    )


def route_cases(app_module: Any, route: Any, fixture: HammerFixture) -> list[HammerCase]:
    function = getattr(app_module, route.action)
    body_model = action_body_model(function)
    base_body = model_body(body_model, fixture) if body_model is not None else None
    good_path = render_path(route.template, fixture, good=True)
    query = required_query_params(function, route.template, fixture)

    good_cases: list[HammerCase] = []
    if route.method in {"GET", "HEAD"}:
        good_cases = [
            HammerCase("good", "base", route.method, good_path, query),
            HammerCase("good", "small-limit", route.method, good_path, {**query, "limit": 1}),
            HammerCase("good", "paged", route.method, good_path, {**query, "limit": 5, "offset": 0}),
            HammerCase("good", "search", route.method, good_path, {**query, "search": "Hammer"}),
            HammerCase("good", "refresh", route.method, good_path, {**query, "refresh": False}),
        ]
    else:
        good_cases = [
            HammerCase("good", "base", route.method, good_path, query, base_body),
            HammerCase("good", "with-limit", route.method, good_path, query, body_variant(base_body, fixture, 1)),
            HammerCase("good", "alternate-track", route.method, good_path, query, body_variant(base_body, fixture, 2)),
            HammerCase("good", "explicit-preview", route.method, good_path, query, body_variant(base_body, fixture, 3)),
            HammerCase("good", "extra-field", route.method, good_path, query, body_variant(base_body, fixture, 4)),
        ]

    bad_path = render_path(route.template, fixture, good=False)
    bad_cases = [
        HammerCase("bad", "bad-path-param", route.method, bad_path, query, base_body),
        HammerCase("bad", "bad-limit-zero", route.method, good_path, {**query, "limit": 0}, base_body),
        HammerCase("bad", "bad-limit-large", route.method, good_path, {**query, "limit": 999999999}, base_body),
        HammerCase("bad", "empty-body", route.method, good_path, query, {}),
        HammerCase("bad", "wrong-body-type", route.method, good_path, query, ["not", "an", "object"]),
    ]
    if route.method in {"GET", "HEAD"}:
        bad_cases[3] = HammerCase("bad", "bad-required-query", route.method, good_path, bad_required_query(query), None)
        bad_cases[4] = HammerCase("bad", "bad-boolean-query", route.method, good_path, {**query, "refresh": "definitely"}, None)
    return good_cases + bad_cases


def action_body_model(function: Any) -> type[Any] | None:
    hints = get_type_hints(function)
    for name, parameter in inspect.signature(function).parameters.items():
        annotation = hints.get(name, parameter.annotation)
        model = model_from_annotation(annotation)
        if model is not None:
            return model
    return None


def model_from_annotation(annotation: Any) -> type[Any] | None:
    from pydantic import BaseModel

    if annotation is inspect.Parameter.empty:
        return None
    try:
        if inspect.isclass(annotation) and issubclass(annotation, BaseModel):
            return annotation
    except TypeError:
        pass
    origin = get_origin(annotation)
    if origin in (UnionType, getattr(sys.modules.get("typing"), "Union", object)):
        for arg in get_args(annotation):
            model = model_from_annotation(arg)
            if model is not None:
                return model
    return None


def required_query_params(function: Any, template: str, fixture: HammerFixture) -> dict[str, Any]:
    from backend.app.worker_types import ActionParam, WorkerContext

    path_params = {part[1:-1] for part in template.split("/") if part.startswith("{") and part.endswith("}")}
    hints = get_type_hints(function)
    query: dict[str, Any] = {}
    for name, parameter in inspect.signature(function).parameters.items():
        annotation = hints.get(name, parameter.annotation)
        if name in path_params or annotation is WorkerContext or model_from_annotation(annotation) is not None:
            continue
        default = parameter.default
        if isinstance(default, ActionParam):
            if default.required:
                query[name] = scalar_example(name, annotation, fixture)
        elif default is inspect.Parameter.empty:
            query[name] = scalar_example(name, annotation, fixture)
    return query


def render_path(template: str, fixture: HammerFixture, good: bool) -> str:
    path = template
    for name in [part[1:-1] for part in template.split("/") if part.startswith("{") and part.endswith("}")]:
        value = path_param_value(name, fixture, good)
        path = path.replace("{" + name + "}", str(value))
    return path


def path_param_value(name: str, fixture: HammerFixture, good: bool) -> Any:
    if not good:
        if name.endswith("_id") or name in {"track_id", "album_id", "playlist_id"}:
            return "not-an-integer"
        return "%%%"
    attribute = PATH_PARAM_DEFAULTS.get(name)
    if attribute:
        return getattr(fixture, attribute)
    if name == "job_id":
        return "hammer-job"
    if name == "service":
        return "listenbrainz"
    return "hammer"


def model_body(model: type[Any], fixture: HammerFixture) -> dict[str, Any]:
    body: dict[str, Any] = {}
    for name, field in model.model_fields.items():
        body[name] = field_example(name, field.annotation, fixture)
    body.update(model_specific_overrides(model.__name__, fixture))
    return body


def model_specific_overrides(model_name: str, fixture: HammerFixture) -> dict[str, Any]:
    if model_name == "DuplicateActionRequest":
        return {"action": "ignore", "ignore_key": "hammer-duplicates", "ignore_label": "Hammer duplicates"}
    if model_name == "TagFieldCopySwapRequest":
        return {"action": "copy", "source_field": "title", "target_field": "artist"}
    if model_name == "CustomTagBatchRequest":
        return {"action": "set", "tag_key": "mood", "value": "focused"}
    if model_name == "VolumeTagRequest":
        return {"mode": "manual", "manual_track_gain_db": -3.0, "manual_track_peak": 0.95}
    if model_name == "AutoTagRequest":
        return {"mode": "track", "track_ids": [fixture.track_id], "apply": False}
    if model_name == "RecommendationProfileRequest":
        return {
            "name": "Hammer Profile Copy",
            "settings": {
                "queue_length": 5,
                "temperature": 0.8,
                "artist_cooldown": 1,
                "album_cooldown": 2,
                "unrated_exploration_percent": 10.0,
            },
        }
    if model_name == "RecommendationProfileComparisonImportRequest":
        return {"report_path": str(fixture.report_path)}
    if model_name == "LocalDataResetRequest":
        return {"confirmation": "RESET"}
    if model_name == "LibraryStatsImportRequest":
        return {"source": "musicbee", "import_path": str(fixture.csv_path)}
    if model_name == "ScrobbleHistoryImportRequest":
        return {"csv_path": str(fixture.csv_path)}
    if model_name == "TrackRestoreRequest":
        return {"path": str(fixture.music_dir / "01 - Hammer Song.mp3"), "rating": 4.0}
    if model_name == "ExportRequest":
        return {"track_ids": [fixture.track_id, fixture.second_track_id]}
    return {}


def body_variant(body: Any, fixture: HammerFixture, variant: int) -> Any:
    if not isinstance(body, dict):
        return body
    changed = dict(body)
    if variant == 1:
        changed["limit"] = 1
        changed["candidate_limit"] = 1
    elif variant == 2:
        changed["track_ids"] = [fixture.second_track_id]
        changed["track_id"] = fixture.second_track_id
    elif variant == 3:
        changed["apply"] = False
        changed["missing_only"] = False
        changed["write_to_file"] = False
    elif variant == 4:
        changed["_hammer_extra"] = "ignored"
        changed["seed"] = 12345
    return changed


def bad_required_query(query: dict[str, Any]) -> dict[str, Any]:
    if not query:
        return {"limit": "", "name": ""}
    return {key: "" for key in query}


def field_example(name: str, annotation: Any, fixture: HammerFixture) -> Any:
    overrides = {
        "track_id": fixture.track_id,
        "track_ids": [fixture.track_id, fixture.second_track_id],
        "album_id": fixture.album_id,
        "playlist_id": fixture.playlist_id,
        "playlist_ids": [fixture.playlist_id],
        "subscription_id": fixture.subscription_id,
        "episode_id": fixture.episode_id,
        "profile_id": fixture.profile_id,
        "profile_ids": [fixture.profile_id],
        "rule_id": fixture.rule_id,
        "preset_id": fixture.preset_id,
        "definition_id": fixture.definition_id,
        "entry_id": fixture.undo_entry_id,
        "batch_id": fixture.undo_batch_id,
        "folder_path": str(fixture.music_dir),
        "folder_paths": [str(fixture.music_dir)],
        "save_library_paths": [str(fixture.music_dir)],
        "target_folder": str(fixture.output_dir),
        "output_folder": str(fixture.output_dir),
        "base_folder": str(fixture.output_dir),
        "download_folder": str(fixture.output_dir),
        "csv_path": str(fixture.csv_path),
        "import_path": str(fixture.csv_path),
        "report_path": str(fixture.report_path),
        "backup_path": str(fixture.backup_path),
        "playlist_path": str(fixture.playlist_path),
        "fpcalc_path": str(ROOT / "backend" / "tools" / "chromaprint" / "fpcalc.exe"),
        "ffmpeg_path": str(fixture.output_dir / "ffmpeg.exe"),
        "path": str(fixture.music_dir),
        "name": "Hammer Name",
        "title": "Hammer Song",
        "artist": "Hammer Artist",
        "album": "Hammer Album",
        "album_artist": "Hammer Artist",
        "feed_url": "https://example.invalid/feed.xml",
        "site_url": "https://example.invalid",
        "audio_url": "https://example.invalid/audio.mp3",
        "homepage_url": "https://example.invalid",
        "stream_url": "https://example.invalid/stream.mp3",
        "source_url": "https://example.invalid/ffmpeg.zip",
        "source": "musicbee",
        "service": "listenbrainz",
        "field": "title",
        "source_field": "title",
        "target_field": "artist",
        "pattern": "Hammer",
        "replacement": "Route Hammer",
        "expression": "{artist} - {title}",
        "scope": "track",
        "value": "Hammer Artist",
        "token": "hammer-token",
        "api_key": "hammer-api-key",
        "api_secret": "hammer-api-secret",
        "session_key": "hammer-session",
        "username": "hammer-user",
        "confirmation": "RESET",
        "direction": "down",
        "drive_id": "Z:",
        "track_number": 1,
        "track_numbers": [1],
        "chosen_label": "A",
        "test_id": "hammer-test",
        "event_type": "manual_play",
        "rating": 4.0,
        "lyrics": "[00:01.00]Hammer lyric",
        "is_synced": True,
        "target": "database",
        "output_format": "flac",
        "mode": "track",
        "action": "copy",
        "release_id": "hammer-release",
        "max_bytes": 1024,
        "limit": 5,
        "offset": 0,
        "queue_length": 5,
        "temperature": 0.8,
        "duration_seconds": 181.5,
        "position_seconds": 12.5,
        "year": 2026,
        "track_number": 1,
        "disc_number": 1,
        "bitrate_kbps": 192,
        "sample_rate_hz": 44100,
        "manual_track_gain_db": -3.0,
        "manual_track_peak": 0.95,
        "manual_album_gain_db": -3.0,
        "manual_album_peak": 0.95,
    }
    if name in overrides:
        return overrides[name]

    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin is Literal:
        return args[0]
    if origin in (list, tuple, set):
        inner = args[0] if args else Any
        return [field_example(name.rstrip("s"), inner, fixture)]
    if origin is dict:
        return {}
    if origin in (UnionType, getattr(sys.modules.get("typing"), "Union", object)):
        non_none = [arg for arg in args if arg is not type(None)]
        return field_example(name, non_none[0], fixture) if non_none else None

    model = model_from_annotation(annotation)
    if model is not None:
        return model_body(model, fixture)
    return scalar_example(name, annotation, fixture)


def scalar_example(name: str, annotation: Any, fixture: HammerFixture) -> Any:
    if annotation is bool:
        return False
    if annotation is int:
        return 1
    if annotation is float:
        return 1.0
    if annotation is str:
        if name.endswith("_url"):
            return f"https://example.invalid/{name}"
        if name.endswith("_path") or name in {"path", "folder", "directory"}:
            return str(fixture.music_dir / "01 - Hammer Song.mp3")
        return "Hammer Name" if name == "name" else f"hammer-{name}"
    return "hammer"


def print_failure(failure: HammerFailure) -> None:
    print(f"\n[{failure.status_code or 'EXC'}] {failure.route} -> {failure.action}")
    print(f"  case: {failure.case.kind}/{failure.case.label}")
    print(f"  request: {failure.case.method} {failure.case.path} params={failure.case.params}")
    if failure.case.body is not None:
        print(f"  body: {json.dumps(failure.case.body, default=str)[:800]}")
    print(f"  detail: {failure.detail.rstrip()[:1600]}")


if __name__ == "__main__":
    raise SystemExit(main())
