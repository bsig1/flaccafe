use super::types::*;
use super::{local_app_data, open_database};
use rusqlite::{params, Connection};
use std::env;
use std::path::{Path, PathBuf};
use tauri::State;

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

fn podcast_base_folder(download_folder: Option<String>) -> PathBuf {
    download_folder
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| export_dir().join("podcasts"))
}

fn subscription_folder(title: &str, download_folder: Option<String>) -> PathBuf {
    podcast_base_folder(download_folder).join(safe_component(title))
}

fn subscription_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativePodcastSubscription> {
    let title = row.get::<_, Option<String>>("title")?.unwrap_or_default();
    let download_folder = row.get::<_, Option<String>>("download_folder")?;
    let effective_download_folder = Some(
        subscription_folder(&title, download_folder.clone())
            .to_string_lossy()
            .to_string(),
    );
    Ok(NativePodcastSubscription {
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

fn episode_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NativePodcastEpisode> {
    Ok(NativePodcastEpisode {
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

fn subscription_by_id(
    connection: &Connection,
    subscription_id: i64,
) -> Result<NativePodcastSubscription, String> {
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
pub fn native_podcast_subscriptions(
    _state: State<'_, NativeLibraryState>,
) -> Result<Vec<NativePodcastSubscription>, String> {
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
pub fn native_save_podcast_subscription(
    _state: State<'_, NativeLibraryState>,
    subscription_id: Option<i64>,
    title: Option<String>,
    feed_url: String,
    site_url: Option<String>,
    description: Option<String>,
    auto_download: Option<bool>,
    download_folder: Option<String>,
) -> Result<NativePodcastSubscription, String> {
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
pub fn native_delete_podcast_subscription(
    _state: State<'_, NativeLibraryState>,
    subscription_id: i64,
    delete_files: Option<bool>,
) -> Result<NativePodcastSubscriptionDeleteResponse, String> {
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
        return Ok(NativePodcastSubscriptionDeleteResponse {
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
                    std::fs::remove_file(&path).map_err(|error| {
                        format!("Could not delete podcast file {}: {error}", path.display())
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
    Ok(NativePodcastSubscriptionDeleteResponse {
        deleted,
        deleted_files,
        missing_files,
        removed_tracks,
    })
}

#[tauri::command]
pub fn native_podcast_subscription_folder(
    _state: State<'_, NativeLibraryState>,
    subscription_id: i64,
) -> Result<NativePodcastFolderResponse, String> {
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
    Ok(NativePodcastFolderResponse {
        path: path.to_string_lossy().to_string(),
        created: !existed,
    })
}

#[tauri::command]
pub fn native_podcast_episodes(
    _state: State<'_, NativeLibraryState>,
    subscription_id: Option<i64>,
    limit: Option<usize>,
) -> Result<Vec<NativePodcastEpisode>, String> {
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
