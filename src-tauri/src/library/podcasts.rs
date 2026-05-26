use super::types::*;
use super::{local_app_data, metadata, open_database, scan, track_by_id};
use rusqlite::{params, Connection};
use serde_json::{json, Map, Value as JsonValue};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::State;

const PODCAST_TIMEOUT_SECONDS: u64 = 20;

#[cfg(debug_assertions)]
fn repo_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
}

fn export_dir() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        if let Some(root) = repo_root() {
            return root.join("backend").join("exports");
        }
    }
    local_app_data("FLAC Cafe")
        .unwrap_or_else(|| PathBuf::from("backend"))
        .join("exports")
}

fn safe_component(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .map(|character| {
            if character.is_control() || "<>:\"/\\|?*".contains(character) {
                '_'
            } else {
                character
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "Podcast".to_string()
    } else {
        trimmed.to_string()
    }
}

fn clean_text(value: Option<&str>) -> Option<String> {
    value
        .map(|text| text.split_whitespace().collect::<Vec<_>>().join(" "))
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

fn podcast_base_folder(download_folder: Option<String>) -> PathBuf {
    download_folder
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| export_dir().join("podcasts"))
}

fn subscription_folder(title: &str, download_folder: Option<String>) -> PathBuf {
    podcast_base_folder(download_folder).join(safe_component(title))
}

fn subscription_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopPodcastSubscription> {
    let title = row.get::<_, Option<String>>("title")?.unwrap_or_default();
    let download_folder = row.get::<_, Option<String>>("download_folder")?;
    let effective_download_folder = Some(
        subscription_folder(&title, download_folder.clone())
            .to_string_lossy()
            .to_string(),
    );
    Ok(DesktopPodcastSubscription {
        id: row.get("id")?,
        title,
        feed_url: row
            .get::<_, Option<String>>("feed_url")?
            .unwrap_or_default(),
        site_url: row.get("site_url")?,
        description: row.get("description")?,
        auto_download: row.get::<_, Option<i64>>("auto_download")?.unwrap_or(0) != 0,
        download_folder,
        effective_download_folder,
        last_checked_at: row.get("last_checked_at")?,
        episode_count: row.get::<_, Option<i64>>("episode_count")?.unwrap_or(0),
        downloaded_count: row.get::<_, Option<i64>>("downloaded_count")?.unwrap_or(0),
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn episode_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopPodcastEpisode> {
    Ok(DesktopPodcastEpisode {
        id: row.get("id")?,
        subscription_id: row.get("subscription_id")?,
        subscription_title: row.get("subscription_title")?,
        track_id: row.get("track_id")?,
        guid: row.get::<_, Option<String>>("guid")?.unwrap_or_default(),
        title: row.get::<_, Option<String>>("title")?.unwrap_or_default(),
        description: row.get("description")?,
        audio_url: row.get("audio_url")?,
        published_at: row.get("published_at")?,
        duration_seconds: row.get("duration_seconds")?,
        local_path: row.get("local_path")?,
        download_status: row
            .get::<_, Option<String>>("download_status")?
            .unwrap_or_else(|| "remote".to_string()),
        downloaded_at: row.get("downloaded_at")?,
        created_at: row
            .get::<_, Option<String>>("created_at")?
            .unwrap_or_default(),
        updated_at: row
            .get::<_, Option<String>>("updated_at")?
            .unwrap_or_default(),
    })
}

fn episode_with_subscription(
    connection: &Connection,
    episode_id: i64,
) -> Result<DesktopPodcastEpisode, String> {
    connection
        .query_row(
            r#"
            SELECT podcast_episodes.*, podcast_subscriptions.title AS subscription_title
            FROM podcast_episodes
            JOIN podcast_subscriptions ON podcast_subscriptions.id = podcast_episodes.subscription_id
            WHERE podcast_episodes.id = ?
            "#,
            params![episode_id],
            episode_from_row,
        )
        .map_err(|_| "Podcast episode not found".to_string())
}

fn subscription_download_folder(
    connection: &Connection,
    subscription_id: i64,
) -> Result<PathBuf, String> {
    let subscription = subscription_by_id(connection, subscription_id)?;
    Ok(subscription_folder(
        &subscription.title,
        subscription.download_folder,
    ))
}

fn subscription_by_id(
    connection: &Connection,
    subscription_id: i64,
) -> Result<DesktopPodcastSubscription, String> {
    connection
        .query_row(
            r#"
            SELECT podcast_subscriptions.*,
                   COUNT(podcast_episodes.id) AS episode_count,
                   SUM(CASE WHEN podcast_episodes.download_status = 'downloaded' THEN 1 ELSE 0 END) AS downloaded_count
            FROM podcast_subscriptions
            LEFT JOIN podcast_episodes ON podcast_episodes.subscription_id = podcast_subscriptions.id
            WHERE podcast_subscriptions.id = ?
            GROUP BY podcast_subscriptions.id
            "#,
            params![subscription_id],
            subscription_from_row,
        )
        .map_err(|_| "Podcast subscription not found".to_string())
}

#[tauri::command]
pub fn podcast_subscriptions(
    _state: State<'_, DesktopLibraryState>,
) -> Result<Vec<DesktopPodcastSubscription>, String> {
    let connection = open_database()?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT podcast_subscriptions.*,
                   COUNT(podcast_episodes.id) AS episode_count,
                   SUM(CASE WHEN podcast_episodes.download_status = 'downloaded' THEN 1 ELSE 0 END) AS downloaded_count
            FROM podcast_subscriptions
            LEFT JOIN podcast_episodes ON podcast_episodes.subscription_id = podcast_subscriptions.id
            GROUP BY podcast_subscriptions.id
            ORDER BY lower(podcast_subscriptions.title)
            "#,
        )
        .map_err(|error| format!("Could not prepare Rust podcast subscription query: {error}"))?;
    let rows = statement
        .query_map([], subscription_from_row)
        .map_err(|error| format!("Could not read Rust podcast subscriptions: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust podcast subscriptions: {error}"))
}

#[tauri::command]
pub fn save_podcast_subscription(
    _state: State<'_, DesktopLibraryState>,
    subscription_id: Option<i64>,
    title: Option<String>,
    feed_url: String,
    site_url: Option<String>,
    description: Option<String>,
    auto_download: Option<bool>,
    download_folder: Option<String>,
) -> Result<DesktopPodcastSubscription, String> {
    let feed_url = feed_url.trim().to_string();
    if feed_url.is_empty() {
        return Err("Podcast feed URL is required".to_string());
    }
    let title = title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| feed_url.clone());
    let connection = open_database()?;
    let row_id = if let Some(subscription_id) = subscription_id {
        let updated = connection
            .execute(
                r#"
                UPDATE podcast_subscriptions
                SET title = ?, feed_url = ?, site_url = ?, description = ?, auto_download = ?,
                    download_folder = ?, updated_at = datetime('now')
                WHERE id = ?
                "#,
                params![
                    title,
                    feed_url,
                    site_url,
                    description,
                    if auto_download.unwrap_or(false) { 1 } else { 0 },
                    download_folder,
                    subscription_id
                ],
            )
            .map_err(|error| format!("Could not update Rust podcast subscription: {error}"))?;
        if updated == 0 {
            return Err("Podcast subscription not found".to_string());
        }
        subscription_id
    } else {
        connection
            .execute(
                r#"
                INSERT INTO podcast_subscriptions(title, feed_url, site_url, description, auto_download, download_folder)
                VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(feed_url) DO UPDATE SET
                  title = excluded.title,
                  site_url = excluded.site_url,
                  description = excluded.description,
                  auto_download = excluded.auto_download,
                  download_folder = excluded.download_folder,
                  updated_at = datetime('now')
                "#,
                params![
                    title,
                    feed_url,
                    site_url,
                    description,
                    if auto_download.unwrap_or(false) { 1 } else { 0 },
                    download_folder
                ],
            )
            .map_err(|error| format!("Could not save Rust podcast subscription: {error}"))?;
        connection
            .query_row(
                "SELECT id FROM podcast_subscriptions WHERE feed_url = ?",
                params![feed_url],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("Could not read saved Rust podcast subscription: {error}"))?
    };
    subscription_by_id(&connection, row_id)
}

#[tauri::command]
pub fn delete_podcast_subscription(
    _state: State<'_, DesktopLibraryState>,
    subscription_id: i64,
    delete_files: Option<bool>,
) -> Result<DesktopPodcastSubscriptionDeleteResponse, String> {
    let mut connection = open_database()?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Could not start Rust podcast delete: {error}"))?;
    let mut statement = transaction
        .prepare("SELECT id, local_path, track_id FROM podcast_episodes WHERE subscription_id = ?")
        .map_err(|error| format!("Could not prepare Rust podcast episode delete query: {error}"))?;
    let rows = statement
        .query_map(params![subscription_id], |row| {
            Ok((
                row.get::<_, i64>("id")?,
                row.get::<_, Option<String>>("local_path")?,
                row.get::<_, Option<i64>>("track_id")?,
            ))
        })
        .map_err(|error| format!("Could not read Rust podcast episodes for delete: {error}"))?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust podcast episodes for delete: {error}"))?;
    drop(statement);
    let exists = !rows.is_empty()
        || transaction
            .query_row(
                "SELECT id FROM podcast_subscriptions WHERE id = ?",
                params![subscription_id],
                |row| row.get::<_, i64>(0),
            )
            .is_ok();
    if !exists {
        return Ok(DesktopPodcastSubscriptionDeleteResponse {
            deleted: false,
            deleted_files: 0,
            missing_files: 0,
            removed_tracks: 0,
        });
    }
    let mut deleted_files = 0i64;
    let mut missing_files = 0i64;
    let mut removed_tracks = 0i64;
    if delete_files.unwrap_or(false) {
        for (_, local_path, track_id) in rows {
            if let Some(local_path) = local_path {
                let path = PathBuf::from(local_path);
                if path.exists() && path.is_file() {
                    trash::delete(&path).map_err(|error| {
                        format!(
                            "Could not send podcast file {} to the recycle bin: {error}",
                            path.display()
                        )
                    })?;
                    deleted_files += 1;
                } else {
                    missing_files += 1;
                }
            }
            if let Some(track_id) = track_id {
                transaction
                    .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
                    .map_err(|error| format!("Could not remove podcast track: {error}"))?;
                removed_tracks += 1;
            }
        }
    }
    let deleted = transaction
        .execute(
            "DELETE FROM podcast_subscriptions WHERE id = ?",
            params![subscription_id],
        )
        .map_err(|error| format!("Could not delete Rust podcast subscription: {error}"))?
        > 0;
    transaction
        .commit()
        .map_err(|error| format!("Could not commit Rust podcast delete: {error}"))?;
    Ok(DesktopPodcastSubscriptionDeleteResponse {
        deleted,
        deleted_files,
        missing_files,
        removed_tracks,
    })
}

#[tauri::command]
pub fn podcast_subscription_folder(
    _state: State<'_, DesktopLibraryState>,
    subscription_id: i64,
) -> Result<DesktopPodcastFolderResponse, String> {
    let connection = open_database()?;
    let subscription = subscription_by_id(&connection, subscription_id)?;
    let path = subscription_folder(&subscription.title, subscription.download_folder);
    let existed = path.exists();
    std::fs::create_dir_all(&path).map_err(|error| {
        format!(
            "Could not create podcast folder {}: {error}",
            path.display()
        )
    })?;
    Ok(DesktopPodcastFolderResponse {
        path: path.to_string_lossy().to_string(),
        created: !existed,
    })
}

#[tauri::command]
pub fn podcast_episodes(
    _state: State<'_, DesktopLibraryState>,
    subscription_id: Option<i64>,
    limit: Option<usize>,
) -> Result<Vec<DesktopPodcastEpisode>, String> {
    let connection = open_database()?;
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    let mut sql = String::from(
        r#"
        SELECT podcast_episodes.*, podcast_subscriptions.title AS subscription_title
        FROM podcast_episodes
        JOIN podcast_subscriptions ON podcast_subscriptions.id = podcast_episodes.subscription_id
        "#,
    );
    if subscription_id.is_some() {
        sql.push_str(" WHERE podcast_episodes.subscription_id = ? ");
    }
    sql.push_str(
        " ORDER BY coalesce(podcast_episodes.published_at, podcast_episodes.created_at) DESC, podcast_episodes.id DESC LIMIT ?",
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Could not prepare Rust podcast episode query: {error}"))?;
    let rows = if let Some(subscription_id) = subscription_id {
        statement.query_map(params![subscription_id, limit as i64], episode_from_row)
    } else {
        statement.query_map(params![limit as i64], episode_from_row)
    }
    .map_err(|error| format!("Could not read Rust podcast episodes: {error}"))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Could not decode Rust podcast episodes: {error}"))
}

#[tauri::command]
pub fn refresh_podcast_subscription(
    _state: State<'_, DesktopLibraryState>,
    subscription_id: i64,
) -> Result<DesktopPodcastRefreshResponse, String> {
    let connection = open_database()?;
    let subscription = subscription_by_id(&connection, subscription_id)?;
    let feed = fetch_and_parse_feed(&subscription.feed_url)?;
    let title = feed.title.clone().unwrap_or(subscription.title);
    connection
        .execute(
            "UPDATE podcast_subscriptions
             SET title = ?, site_url = ?, description = ?,
                 last_checked_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?",
            params![title, feed.site_url, feed.description, subscription_id],
        )
        .map_err(|error| format!("Could not update podcast feed metadata: {error}"))?;

    let mut inserted = 0i64;
    let mut updated = 0i64;
    for episode in &feed.episodes {
        let existed = connection
            .query_row(
                "SELECT id FROM podcast_episodes WHERE subscription_id = ? AND guid = ?",
                params![subscription_id, episode.guid],
                |row| row.get::<_, i64>(0),
            )
            .ok()
            .is_some();
        connection
            .execute(
                "INSERT INTO podcast_episodes(subscription_id, guid, title, description, audio_url, published_at, duration_seconds)
                 VALUES(?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(subscription_id, guid) DO UPDATE SET
                   title = excluded.title,
                   description = excluded.description,
                   audio_url = excluded.audio_url,
                   published_at = excluded.published_at,
                   duration_seconds = excluded.duration_seconds,
                   updated_at = datetime('now')",
                params![
                    subscription_id,
                    episode.guid,
                    episode.title,
                    episode.description,
                    episode.audio_url,
                    episode.published_at,
                    episode.duration_seconds
                ],
            )
            .map_err(|error| format!("Could not save podcast episode: {error}"))?;
        if existed {
            updated += 1;
        } else {
            inserted += 1;
        }
    }
    Ok(DesktopPodcastRefreshResponse {
        subscription: subscription_by_id(&connection, subscription_id)?,
        inserted,
        updated,
        total: feed.episodes.len() as i64,
    })
}

#[tauri::command]
pub fn download_podcast_episode(
    _state: State<'_, DesktopLibraryState>,
    episode_id: i64,
    download_folder: Option<String>,
) -> Result<DesktopPodcastEpisode, String> {
    let connection = open_database()?;
    let episode = episode_with_subscription(&connection, episode_id)?;
    let audio_url = episode
        .audio_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Episode has no downloadable audio URL".to_string())?;
    let base_folder = download_folder
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            subscription_download_folder(&connection, episode.subscription_id)
                .unwrap_or_else(|_| export_dir().join("podcasts"))
        });
    let target = base_folder.join(format!(
        "{}{}",
        safe_component(&episode.title),
        episode_extension(audio_url)
    ));
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create podcast download folder: {error}"))?;
    }
    download_to_file(audio_url, &target)?;
    connection
        .execute(
            "UPDATE podcast_episodes
             SET local_path = ?, download_status = 'downloaded',
                 downloaded_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ?",
            params![target.to_string_lossy().to_string(), episode_id],
        )
        .map_err(|error| format!("Could not save podcast download: {error}"))?;
    let default_root = export_dir().join("podcasts");
    if target.starts_with(&default_root) {
        let _ = ensure_episode_track_for_connection(&connection, episode_id);
    }
    episode_with_subscription(&connection, episode_id)
}

#[tauri::command]
pub fn delete_podcast_episode_download(
    _state: State<'_, DesktopLibraryState>,
    episode_id: i64,
) -> Result<DesktopPodcastDeleteDownloadResponse, String> {
    let connection = open_database()?;
    let episode = episode_with_subscription(&connection, episode_id)?;
    let mut deleted_file = false;
    let mut missing_file = false;
    if let Some(local_path) = episode
        .local_path
        .as_deref()
        .filter(|value| !value.is_empty())
    {
        let path = PathBuf::from(local_path);
        if path.exists() {
            if !path.is_file() {
                return Err("Podcast download path is not a file".to_string());
            }
            trash::delete(&path).map_err(|error| {
                format!(
                    "Could not send podcast download {} to the recycle bin: {error}",
                    path.display()
                )
            })?;
            deleted_file = true;
        } else {
            missing_file = true;
        }
    }
    let removed_track = episode.track_id.is_some();
    if let Some(track_id) = episode.track_id {
        connection
            .execute("DELETE FROM tracks WHERE id = ?", params![track_id])
            .map_err(|error| format!("Could not remove podcast track: {error}"))?;
    }
    connection
        .execute(
            "UPDATE podcast_episodes
             SET local_path = NULL, download_status = 'remote', downloaded_at = NULL,
                 track_id = NULL, updated_at = datetime('now')
             WHERE id = ?",
            params![episode_id],
        )
        .map_err(|error| format!("Could not update podcast episode after delete: {error}"))?;
    scan::cleanup_orphan_albums(&connection)?;
    scan::clear_library_query_cache(&connection);
    Ok(DesktopPodcastDeleteDownloadResponse {
        episode: episode_with_subscription(&connection, episode_id)?,
        deleted_file,
        missing_file,
        removed_track,
    })
}

#[tauri::command]
pub fn ensure_podcast_episode_track(
    _state: State<'_, DesktopLibraryState>,
    episode_id: i64,
) -> Result<DesktopTrack, String> {
    let connection = open_database()?;
    let track_id = ensure_episode_track_for_connection(&connection, episode_id)?;
    track_by_id(&connection, track_id)
}

fn ensure_episode_track_for_connection(
    connection: &Connection,
    episode_id: i64,
) -> Result<i64, String> {
    let episode = episode_with_subscription(connection, episode_id)?;
    if let Some(track_id) = episode.track_id {
        if connection
            .query_row(
                "SELECT id FROM tracks WHERE id = ?",
                params![track_id],
                |row| row.get::<_, i64>(0),
            )
            .ok()
            .is_some()
        {
            return Ok(track_id);
        }
    }
    let path_text = episode
        .local_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            "Download the episode before adding it to the local collection".to_string()
        })?;
    let path = PathBuf::from(path_text);
    if !path.exists() || !path.is_file() {
        return Err("Downloaded podcast file is missing".to_string());
    }
    let mut metadata_map = podcast_metadata_from_file(&path, &episode);
    metadata_map.insert("genre".to_string(), json!("Podcast"));
    metadata_map.insert("album".to_string(), JsonValue::Null);
    metadata_map.insert("album_artist".to_string(), JsonValue::Null);
    metadata_map.insert(
        "title".to_string(),
        json!(json_text(metadata_map.get("title")).unwrap_or_else(|| episode.title.clone())),
    );
    metadata_map.insert(
        "artist".to_string(),
        json!(episode.subscription_title.clone()),
    );
    if metadata_map
        .get("duration_seconds")
        .and_then(JsonValue::as_f64)
        .is_none()
    {
        metadata_map.insert(
            "duration_seconds".to_string(),
            json!(episode.duration_seconds),
        );
    }
    scan::upsert_track(connection, &metadata_map)?;
    let path_key = metadata_map
        .get("path_key")
        .and_then(JsonValue::as_str)
        .ok_or_else(|| "Podcast metadata did not produce a path key".to_string())?;
    let track_id = connection
        .query_row(
            "SELECT id FROM tracks WHERE path_key = ?",
            params![path_key],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("Could not read podcast track: {error}"))?;
    connection
        .execute(
            "UPDATE podcast_episodes SET track_id = ?, updated_at = datetime('now') WHERE id = ?",
            params![track_id, episode_id],
        )
        .map_err(|error| format!("Could not link podcast track: {error}"))?;
    scan::clear_library_query_cache(connection);
    Ok(track_id)
}

struct ParsedFeed {
    title: Option<String>,
    description: Option<String>,
    site_url: Option<String>,
    episodes: Vec<ParsedEpisode>,
}

struct ParsedEpisode {
    guid: String,
    title: String,
    description: Option<String>,
    audio_url: Option<String>,
    published_at: Option<String>,
    duration_seconds: Option<f64>,
}

fn fetch_and_parse_feed(feed_url: &str) -> Result<ParsedFeed, String> {
    let response = ureq::get(feed_url)
        .set("User-Agent", "FLAC Cafe/0.5 podcast module")
        .timeout(std::time::Duration::from_secs(PODCAST_TIMEOUT_SECONDS))
        .call()
        .map_err(|error| format!("Could not fetch podcast feed: {error}"))?;
    let payload = response
        .into_string()
        .map_err(|error| format!("Could not read podcast feed: {error}"))?;
    parse_feed(&payload, feed_url)
}

fn parse_feed(payload: &str, feed_url: &str) -> Result<ParsedFeed, String> {
    let document = roxmltree::Document::parse(payload)
        .map_err(|error| format!("Invalid feed XML: {error}"))?;
    let root = document.root_element();
    let channel = root
        .children()
        .find(|node| node.is_element() && local_name(*node) == "channel")
        .unwrap_or(root);
    let title = child_text(channel, &["title"]).or_else(|| Some(feed_url.to_string()));
    let description = child_text(channel, &["description", "subtitle", "summary"]);
    let site_url = first_link(channel);
    let mut episodes = Vec::new();
    for (index, node) in channel
        .children()
        .filter(|node| node.is_element() && matches!(local_name(*node).as_str(), "item" | "entry"))
        .enumerate()
    {
        let title =
            child_text(node, &["title"]).unwrap_or_else(|| format!("Episode {}", index + 1));
        let audio_url = enclosure_url(node);
        let guid = child_text(node, &["guid", "id"])
            .or_else(|| audio_url.clone())
            .unwrap_or_else(|| title.clone());
        episodes.push(ParsedEpisode {
            guid,
            title,
            description: child_text(node, &["description", "summary", "subtitle"]),
            audio_url,
            published_at: child_text(node, &["pubdate", "published", "updated"]),
            duration_seconds: parse_duration(child_text(node, &["duration"]).as_deref()),
        });
    }
    Ok(ParsedFeed {
        title,
        description,
        site_url,
        episodes,
    })
}

fn local_name(node: roxmltree::Node<'_, '_>) -> String {
    node.tag_name().name().to_ascii_lowercase()
}

fn child_text(node: roxmltree::Node<'_, '_>, names: &[&str]) -> Option<String> {
    node.children()
        .filter(|child| child.is_element())
        .find_map(|child| {
            let name = local_name(child);
            names
                .iter()
                .any(|candidate| *candidate == name)
                .then(|| clean_text(child.text()))
                .flatten()
        })
}

fn first_link(node: roxmltree::Node<'_, '_>) -> Option<String> {
    node.children()
        .filter(|child| child.is_element() && local_name(*child) == "link")
        .find_map(|child| clean_text(child.attribute("href").or_else(|| child.text())))
}

fn enclosure_url(node: roxmltree::Node<'_, '_>) -> Option<String> {
    for child in node.children().filter(|child| child.is_element()) {
        let name = local_name(child);
        if name == "enclosure" {
            if let Some(url) = clean_text(child.attribute("url")) {
                return Some(url);
            }
        }
        if name == "link" && child.attribute("rel") == Some("enclosure") {
            if let Some(url) = clean_text(child.attribute("href")) {
                return Some(url);
            }
        }
    }
    None
}

fn parse_duration(value: Option<&str>) -> Option<f64> {
    let text = value?.trim();
    if text.is_empty() {
        return None;
    }
    if let Ok(seconds) = text.parse::<f64>() {
        return Some(seconds);
    }
    let parts = text
        .split(':')
        .filter_map(|part| part.trim().parse::<f64>().ok())
        .collect::<Vec<_>>();
    match parts.as_slice() {
        [hours, minutes, seconds] => Some(hours * 3600.0 + minutes * 60.0 + seconds),
        [minutes, seconds] => Some(minutes * 60.0 + seconds),
        [seconds] => Some(*seconds),
        _ => None,
    }
}

fn episode_extension(audio_url: &str) -> &'static str {
    let path = audio_url.split('?').next().unwrap_or(audio_url);
    match Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "flac" => ".flac",
        "m4a" => ".m4a",
        "ogg" => ".ogg",
        "opus" => ".opus",
        "wav" => ".wav",
        "aac" => ".aac",
        _ => ".mp3",
    }
}

fn download_to_file(url: &str, target: &Path) -> Result<(), String> {
    let response = ureq::get(url)
        .set("User-Agent", "FLAC Cafe/0.5 podcast downloader")
        .timeout(std::time::Duration::from_secs(PODCAST_TIMEOUT_SECONDS))
        .call()
        .map_err(|error| format!("Could not download podcast episode: {error}"))?;
    let mut reader = response.into_reader();
    let mut file = std::fs::File::create(target)
        .map_err(|error| format!("Could not create podcast download: {error}"))?;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("Could not read podcast download: {error}"))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|error| format!("Could not write podcast download: {error}"))?;
    }
    Ok(())
}

fn podcast_metadata_from_file(
    path: &Path,
    episode: &DesktopPodcastEpisode,
) -> Map<String, JsonValue> {
    let result = metadata::read_file_metadata_result(path);
    if let Some(metadata) = result.get("metadata").and_then(JsonValue::as_object) {
        return metadata.clone();
    }
    let path_text = path.to_string_lossy().to_string();
    let mut map = Map::new();
    map.insert("path".to_string(), json!(path_text));
    map.insert("path_key".to_string(), json!(scan::path_key(path)));
    map.insert("title".to_string(), json!(episode.title));
    map.insert("artist".to_string(), json!(episode.subscription_title));
    map.insert("album".to_string(), JsonValue::Null);
    map.insert("album_artist".to_string(), JsonValue::Null);
    map.insert("track_number".to_string(), JsonValue::Null);
    map.insert("disc_number".to_string(), JsonValue::Null);
    map.insert("genre".to_string(), json!("Podcast"));
    map.insert("year".to_string(), JsonValue::Null);
    map.insert(
        "duration_seconds".to_string(),
        json!(episode.duration_seconds),
    );
    map.insert("rating".to_string(), JsonValue::Null);
    map.insert("bitrate".to_string(), JsonValue::Null);
    map.insert("replaygain_track_gain_db".to_string(), JsonValue::Null);
    map.insert("replaygain_album_gain_db".to_string(), JsonValue::Null);
    map.insert("replaygain_track_peak".to_string(), JsonValue::Null);
    map.insert("replaygain_album_peak".to_string(), JsonValue::Null);
    map.insert("audio_fingerprint".to_string(), json!(scan::path_key(path)));
    map.insert(
        "file_modified_at".to_string(),
        json!(metadata::modified_time_iso(path)),
    );
    map
}

fn json_text(value: Option<&JsonValue>) -> Option<String> {
    match value? {
        JsonValue::String(text) => Some(text.trim().to_string()).filter(|text| !text.is_empty()),
        JsonValue::Null => None,
        other => Some(other.to_string()),
    }
}
