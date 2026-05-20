from __future__ import annotations

from datetime import datetime
from pathlib import Path

from .config import EXPORT_DIR
from .database import connect, rows_to_dicts


def export_m3u(track_ids: list[int], playlist_path: str | None = None) -> tuple[Path, int]:
    if not track_ids:
        raise ValueError("No tracks selected for export")

    placeholders = ",".join("?" for _ in track_ids)
    with connect() as conn:
        rows = rows_to_dicts(
            conn.execute(
                f"""
                SELECT id, path, title, artist, duration_seconds
                FROM tracks
                WHERE id IN ({placeholders})
                """,
                track_ids,
            )
        )

    by_id = {row["id"]: row for row in rows}
    ordered = [by_id[track_id] for track_id in track_ids if track_id in by_id]
    if not ordered:
        raise ValueError("None of the selected tracks exist in the database")

    if playlist_path:
        output_path = Path(playlist_path).expanduser().resolve()
    else:
        EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_path = EXPORT_DIR / f"autodj-{stamp}.m3u"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["#EXTM3U"]
    for track in ordered:
        duration = int(track["duration_seconds"] or -1)
        artist = track["artist"] or "Unknown Artist"
        title = track["title"] or Path(track["path"]).stem
        lines.append(f"#EXTINF:{duration},{artist} - {title}")
        lines.append(track["path"])
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return output_path, len(ordered)

