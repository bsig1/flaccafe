from __future__ import annotations

import re
from pathlib import Path
from typing import Any


METADATA_FIELDS = {
    "title",
    "artist",
    "album",
    "album_artist",
    "track_number",
    "disc_number",
    "genre",
    "year",
}

TOKEN_FIELD_ALIASES = {
    "title": "title",
    "artist": "artist",
    "album": "album",
    "album artist": "album_artist",
    "albumartist": "album_artist",
    "album_artist": "album_artist",
    "track": "track_number",
    "track#": "track_number",
    "track number": "track_number",
    "track_number": "track_number",
    "disc": "disc_number",
    "disc#": "disc_number",
    "disc number": "disc_number",
    "disc_number": "disc_number",
    "genre": "genre",
    "year": "year",
    "date": "year",
}

NUMBER_FIELDS = {"track_number", "disc_number", "year"}
WINDOWS_RESERVED_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}


def clean_token(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("_", " ").strip().casefold())


def token_field(token: str) -> str | None:
    return TOKEN_FIELD_ALIASES.get(clean_token(token))


def normalize_text(value: object) -> str | None:
    text = re.sub(r"\s+", " ", str(value or "").strip())
    return text or None


def normalize_number(value: object) -> int | None:
    match = re.search(r"\d{1,4}", str(value or ""))
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def metadata_from_match(match: re.Match[str]) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for group, value in match.groupdict().items():
        field = group.rsplit("__", 1)[0]
        if field not in METADATA_FIELDS or value is None:
            continue
        metadata[field] = normalize_number(value) if field in NUMBER_FIELDS else normalize_text(value)
    return {key: value for key, value in metadata.items() if value not in (None, "")}


def compile_filename_pattern(pattern: str) -> re.Pattern[str]:
    parts: list[str] = []
    used_fields: dict[str, int] = {}
    cursor = 0
    for match in re.finditer(r"<([^>]+)>", pattern):
        literal = pattern[cursor:match.start()]
        parts.append(re.escape(literal).replace(r"\/", r"[\\/]").replace(r"\\", r"[\\/]"))
        field = token_field(match.group(1))
        if field is None:
            parts.append(re.escape(match.group(0)))
        else:
            index = used_fields.get(field, 0) + 1
            used_fields[field] = index
            group_name = f"{field}__{index}"
            if field in NUMBER_FIELDS:
                parts.append(fr"(?P<{group_name}>\d{{1,4}}(?:\s*/\s*\d{{1,4}})?)")
            else:
                parts.append(fr"(?P<{group_name}>.+?)")
        cursor = match.end()
    literal = pattern[cursor:]
    parts.append(re.escape(literal).replace(r"\/", r"[\\/]").replace(r"\\", r"[\\/]"))
    return re.compile("^" + "".join(parts) + "$", re.IGNORECASE)


def path_without_suffix_text(path: Path) -> str:
    without_suffix = path.with_suffix("")
    return "/".join(without_suffix.parts)


def candidate_path_texts(path: Path, library_root: Path | None) -> list[str]:
    candidates: list[str] = []
    if library_root is not None:
        try:
            candidates.append(path_without_suffix_text(path.resolve().relative_to(library_root.resolve())))
        except ValueError:
            pass
    candidates.append(path_without_suffix_text(path))
    candidates.append(path.stem)
    unique: list[str] = []
    for candidate in candidates:
        normalized = candidate.replace("\\", "/")
        if normalized not in unique:
            unique.append(normalized)
    return unique


def infer_metadata_from_filename(path: Path, pattern: str, library_root: Path | None = None) -> dict[str, Any] | None:
    compiled = compile_filename_pattern(pattern.replace("\\", "/"))
    for candidate in candidate_path_texts(path, library_root):
        match = compiled.match(candidate)
        if match:
            return metadata_from_match(match)
    return None


def changed_metadata(current: dict[str, Any], inferred: dict[str, Any], missing_only: bool) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    for field, value in inferred.items():
        if field not in METADATA_FIELDS:
            continue
        current_value = current.get(field)
        if missing_only and current_value not in (None, ""):
            continue
        if current_value != value:
            changes[field] = value
    return changes


def sanitize_path_component(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    if not cleaned:
        cleaned = "Unknown"
    if cleaned.casefold() in WINDOWS_RESERVED_NAMES:
        cleaned = f"_{cleaned}"
    return cleaned[:160].rstrip(" .") or "Unknown"


def render_template_value(track: dict[str, Any], token: str) -> str:
    field = token_field(token)
    if field == "track_number":
        value = track.get("track_number")
        return f"{int(value):02d}" if isinstance(value, int) else "00"
    if field == "disc_number":
        value = track.get("disc_number")
        return str(int(value)) if isinstance(value, int) else "1"
    if field == "year":
        return str(track.get("year") or "Unknown Year")
    if field == "album_artist":
        return str(track.get("album_artist") or track.get("artist") or "Unknown Artist")
    if field:
        return str(track.get(field) or f"Unknown {field.replace('_', ' ').title()}")
    return f"<{token}>"


def render_file_template(track: dict[str, Any], template: str) -> list[str]:
    components = [component for component in re.split(r"[\\/]+", template.strip()) if component.strip()]
    if not components:
        components = ["<Album Artist>", "<Album>", "<Track#> - <Title>"]

    rendered: list[str] = []
    for component in components:
        text = re.sub(r"<([^>]+)>", lambda match: render_template_value(track, match.group(1)), component)
        text = re.sub(r"\s+\)", ")", text)
        text = re.sub(r"\(\s+", "(", text)
        rendered.append(sanitize_path_component(text))
    return rendered


def organization_target_path(track: dict[str, Any], base_folder: Path, template: str) -> Path:
    parts = render_file_template(track, template)
    suffix = Path(str(track.get("path") or "")).suffix
    filename = parts[-1]
    if suffix and not filename.casefold().endswith(suffix.casefold()):
        filename = f"{filename}{suffix}"
    return base_folder.joinpath(*parts[:-1], filename).resolve()
