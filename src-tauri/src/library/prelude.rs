use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection};
use serde_json::json;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(not(windows))]
const CREATE_NO_WINDOW: u32 = 0;

pub(crate) mod album_artwork;
pub(crate) mod analysis;
pub(crate) mod artist_info;
pub(crate) mod audio_conversion;
pub(crate) mod audiobooks;
pub(crate) mod cd;
pub(crate) mod extensions;
pub(crate) mod file_organization;
pub(crate) mod folder_watch;
pub(crate) mod health;
pub(crate) mod history;
pub(crate) mod inbox;
pub(crate) mod library_importers;
pub(crate) mod library_tools;
pub(crate) mod lyrics;
pub(crate) mod lyrics_bulk;
pub(crate) mod maintenance;
pub(crate) mod media_protocol;
pub(crate) mod metadata;
pub(crate) mod metadata_csv;
pub(crate) mod online_matching;
pub(crate) mod playlist_files;
pub(crate) mod playlists;
pub(crate) mod podcasts;
pub(crate) mod radio;
pub(crate) mod recommendation_profiles;
pub(crate) mod recommendations;
pub(crate) mod reports;
mod rows;
pub(crate) mod scan;
mod schema;
pub(crate) mod scrobbling;
mod search;
mod storage;
pub(crate) mod tools;
pub(crate) mod track_management;
mod types;
pub(crate) mod volume_tags;

pub use self::artist_info::{
    artist_info_blocking as artist_info, artist_local_tracks_blocking as artist_local_tracks,
    clear_artist_cache_blocking as clear_artist_cache,
};
pub use self::file_organization::file_organization_preview;
use self::file_organization::{album_tracks_by_id, clear_library_query_cache};
use self::health::tracks_by_id_map;
pub use self::health::{duplicate_action, duplicate_review, library_health};
pub use self::playlist_files::{export_m3u, import_playlist, parse_playlist};
pub use self::playlists::{
    add_playlist_tracks, create_playlist, delete_playlist, move_playlist_track, playlist_tracks,
    playlists, remove_playlist_track,
};
use self::playlists::{compact_playlist_positions, playlist_summary_by_id};
use self::recommendations::{
    autodj_settings, cosine_similarity, normalize_token, round4, similarity_adjustment,
};
use self::rows::{
    audiobook_bookmark_from_row, audiobook_chapter_from_row, audiobook_where_clause,
    clean_optional_text, clean_required_text, progress_percent, qualified_track_columns,
    radio_station_from_row, track_from_row, TRACK_COLUMNS,
};
use self::search::{
    csv_ints, fuzzy_sql_parts, music_only_clause, sort_expression, track_where_clause,
};
pub(super) use self::storage::{
    app_storage_root, database_path, get_setting, local_app_data, open_database, repo_root,
    set_setting, suggested_music_path, truthy_setting,
};
pub use self::types::*;
pub use self::volume_tags::volume_tags_preview;

