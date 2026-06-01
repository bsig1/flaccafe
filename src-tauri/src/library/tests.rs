#[cfg(test)]
mod tests {
    use super::{
        albums, artists, library_stats, open_database,
        playlist_files::{parse_playlist_entries, playlist_entry_path},
        playlist_tracks, playlists,
        recommendations::generate_autodj,
        refresh_library_derived_data,
        search::search_terms,
        sort_expression, tracks_page, normalized_path_key, DesktopLibraryState,
    };
    use rusqlite::params;
    use serde_json::json;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{Instant, SystemTime, UNIX_EPOCH};
    use tauri::Manager;

    #[test]
    fn search_terms_split_messy_text() {
        assert_eq!(
            search_terms("artist/album: track"),
            vec!["artist", "album", "track"]
        );
    }

    #[test]
    fn sort_expression_uses_safe_fallback() {
        assert_eq!(sort_expression("rating"), "coalesce(rating, -1)");
        assert!(sort_expression("drop table tracks").contains("coalesce(artist, '')"));
        assert!(sort_expression("artist").contains("LIKE 'the %'"));
    }

    #[test]
    fn normalized_path_key_strips_windows_verbatim_prefixes() {
        let key = normalized_path_key(r"\\?\C:\Music\Song.flac");
        if cfg!(windows) {
            assert_eq!(key, r"c:\music\song.flac");
        } else {
            assert_eq!(key, r"C:\Music\Song.flac");
        }
    }

    #[test]
    fn playlist_entry_paths_decode_file_urls() {
        let path = playlist_entry_path("file:///C:/Music/A%20Song.flac", Path::new("."))
            .expect("file url should resolve");
        assert!(path.to_string_lossy().contains("A Song.flac"));
    }

    #[test]
    fn playlist_parser_reads_common_formats() {
        let pls = parse_playlist_entries(
            Path::new("mix.pls"),
            "[playlist]\nFile1=one.mp3\nFile2=https://example.test/radio\n",
        )
        .expect("PLS should parse");
        assert_eq!(pls.entries.len(), 2);
        assert_eq!(pls.local_paths.len(), 1);

        let wpl = parse_playlist_entries(
            Path::new("mix.wpl"),
            r#"<smil><media src="two%20words.flac"/><media src='icy://station'/></smil>"#,
        )
        .expect("WPL should parse");
        assert_eq!(wpl.entries.len(), 2);
        assert_eq!(wpl.local_paths.len(), 1);

        let xspf = parse_playlist_entries(
            Path::new("mix.xspf"),
            r#"<playlist><trackList><track><location>file:///C:/Music/Three.flac</location></track></trackList></playlist>"#,
        )
        .expect("XSPF should parse");
        assert_eq!(xspf.local_paths.len(), 1);

        let itunes = parse_playlist_entries(
            Path::new("library.xml"),
            r#"<plist><dict><key>Location</key><string>file:///C:/Music/Four%20Ampersand.flac</string></dict></plist>"#,
        )
        .expect("iTunes XML should parse");
        assert_eq!(itunes.local_paths.len(), 1);
    }

    #[test]
    #[ignore = "manual fake-database performance benchmark"]
    fn benchmark_fake_database_common_paths() {
        let temp_root = unique_benchmark_dir();
        let database_path = temp_root.join("music.sqlite3");
        fs::create_dir_all(&temp_root).expect("benchmark temp dir should be created");
        std::env::set_var("MUSIC_REC_DB", &database_path);
        seed_fake_benchmark_database(12_000, 1_000, 8).expect("fake library should seed");

        let app = tauri::test::mock_builder()
            .manage(DesktopLibraryState)
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("mock Tauri app should build");

        println!(
            "BENCH fake_db={} tracks=12000 albums=1000 playlists=8",
            database_path.display()
        );
        bench_once("derived_summary_refresh_after_scan", || {
            let connection = open_database()?;
            refresh_library_derived_data(&connection)?;
            Ok(0)
        });
        bench_once("startup_first_library_page_cold", || {
            clear_ui_query_cache()?;
            tracks_page(
                app.state::<DesktopLibraryState>(),
                None,
                Some(150),
                Some(0),
                Some("artist".to_string()),
                Some("asc".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some("any".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some(false),
            )
            .map(|page| page.tracks.len() as i64)
        });
        bench_once("tracks_page_fuzzy_search_cold", || {
            clear_ui_query_cache()?;
            tracks_page(
                app.state::<DesktopLibraryState>(),
                Some("artist 24 title 8".to_string()),
                Some(150),
                Some(0),
                Some("title".to_string()),
                Some("asc".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some("any".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some(false),
            )
            .map(|page| page.tracks.len() as i64)
        });
        bench_once("albums_page_cold", || {
            clear_ui_query_cache()?;
            albums(app.state::<DesktopLibraryState>(), None, Some(250), Some(0))
                .map(|albums| albums.len() as i64)
        });
        bench_once("artists_page_cold", || {
            clear_ui_query_cache()?;
            artists(app.state::<DesktopLibraryState>(), None, Some(250), Some(0))
                .map(|artists| artists.len() as i64)
        });
        bench("library_stats", 40, || {
            library_stats(app.state::<DesktopLibraryState>()).map(|stats| stats.total_tracks)
        });
        bench("tracks_page_default_warm", 40, || {
            tracks_page(
                app.state::<DesktopLibraryState>(),
                None,
                Some(150),
                Some(0),
                Some("artist".to_string()),
                Some("asc".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some("any".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some(false),
            )
            .map(|page| page.tracks.len() as i64)
        });
        bench("tracks_page_deep_scroll_warm", 30, || {
            tracks_page(
                app.state::<DesktopLibraryState>(),
                None,
                Some(150),
                Some(6_000),
                Some("artist".to_string()),
                Some("asc".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some("any".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some(false),
            )
            .map(|page| page.tracks.len() as i64)
        });
        bench("tracks_page_fuzzy_search_warm", 30, || {
            tracks_page(
                app.state::<DesktopLibraryState>(),
                Some("artist 24 title 8".to_string()),
                Some(150),
                Some(0),
                Some("title".to_string()),
                Some("asc".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some("any".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some(false),
            )
            .map(|page| page.tracks.len() as i64)
        });
        bench("albums_page_warm", 30, || {
            albums(app.state::<DesktopLibraryState>(), None, Some(250), Some(0))
                .map(|albums| albums.len() as i64)
        });
        bench("artists_page_warm", 30, || {
            artists(app.state::<DesktopLibraryState>(), None, Some(250), Some(0))
                .map(|artists| artists.len() as i64)
        });
        bench("playlists_page", 40, || {
            playlists(app.state::<DesktopLibraryState>()).map(|playlists| playlists.len() as i64)
        });
        bench("playlist_tracks_page", 30, || {
            playlist_tracks(app.state::<DesktopLibraryState>(), 1).map(|tracks| tracks.len() as i64)
        });
        bench("autodj_generate_50", 12, || {
            generate_autodj(
                app.state::<DesktopLibraryState>(),
                json!({
                    "queue_length": 50,
                    "temperature": 0.8,
                    "same_artist_cooldown": 6,
                    "same_album_cooldown": 10,
                    "target_unrated_percent": 12,
                    "recently_played_days": 14,
                    "seed": 42
                }),
            )
            .map(|queue| queue.tracks.len() as i64)
        });

        std::env::remove_var("MUSIC_REC_DB");
        let _ = fs::remove_dir_all(temp_root);
    }

    fn bench_once(name: &str, run: impl FnOnce() -> Result<i64, String>) {
        let started = Instant::now();
        let checksum = run().unwrap_or_else(|error| panic!("{name} failed: {error}"));
        let elapsed = started.elapsed().as_secs_f64() * 1000.0;
        println!("BENCH {name}: first={elapsed:.3}ms checksum={checksum}");
    }

    fn bench(name: &str, iterations: usize, mut run: impl FnMut() -> Result<i64, String>) {
        let mut values = Vec::with_capacity(iterations);
        let mut checksum = 0i64;
        for _ in 0..iterations {
            let started = Instant::now();
            checksum ^= run().unwrap_or_else(|error| panic!("{name} failed: {error}"));
            values.push(started.elapsed().as_secs_f64() * 1000.0);
        }
        values.sort_by(|left, right| left.total_cmp(right));
        let median = values[values.len() / 2];
        let p95 = values[((values.len() as f64 * 0.95).ceil() as usize - 1).min(values.len() - 1)];
        let min = values[0];
        let max = values[values.len() - 1];
        println!(
            "BENCH {name}: median={median:.3}ms p95={p95:.3}ms min={min:.3}ms max={max:.3}ms n={iterations} checksum={checksum}"
        );
    }

    fn clear_ui_query_cache() -> Result<(), String> {
        open_database()?
            .execute("DELETE FROM library_query_cache WHERE cache_key LIKE 'ui:%'", [])
            .map(|_| ())
            .map_err(|error| format!("Could not clear benchmark cache: {error}"))
    }

    fn unique_benchmark_dir() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_millis();
        std::env::temp_dir().join(format!(
            "flaccafe-fake-db-bench-{}-{stamp}",
            std::process::id()
        ))
    }

    fn seed_fake_benchmark_database(
        track_count: i64,
        album_count: i64,
        playlist_count: i64,
    ) -> Result<(), String> {
        let mut connection = open_database()?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Could not start fake seed transaction: {error}"))?;
        transaction
            .execute(
                "INSERT INTO settings(key, value) VALUES('library_path', 'C:\\FakeMusic')",
                [],
            )
            .map_err(|error| format!("Could not seed settings: {error}"))?;
        for album_id in 1..=album_count {
            transaction
                .execute(
                    "INSERT INTO albums(id, album, album_artist, year, artwork_path)
                     VALUES(?, ?, ?, ?, NULL)",
                    params![
                        album_id,
                        format!("Album {:04}", album_id),
                        format!("Album Artist {:03}", album_id % 250),
                        1980 + (album_id % 45)
                    ],
                )
                .map_err(|error| format!("Could not seed album {album_id}: {error}"))?;
        }
        for track_id in 1..=track_count {
            let album_id = ((track_id - 1) % album_count) + 1;
            let rating = if track_id % 9 == 0 {
                None
            } else {
                Some(((track_id % 10) as f64 / 2.0).clamp(0.5, 5.0))
            };
            transaction
                .execute(
                    r#"
                    INSERT INTO tracks(
                      id, path, path_key, title, artist, album, album_artist, album_id,
                      track_number, disc_number, genre, analysis_genre, year,
                      duration_seconds, bitrate, rating, play_count, skip_count,
                      last_played_at, date_added, file_modified_at
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || (? % 120) || ' days'), datetime('now'), datetime('now'))
                    "#,
                    params![
                        track_id,
                        format!("C:\\FakeMusic\\Artist {:03}\\Album {:04}\\Track {:05}.flac", track_id % 600, album_id, track_id),
                        format!("c:/fakemusic/artist {:03}/album {:04}/track {:05}.flac", track_id % 600, album_id, track_id),
                        format!("Title {:05}", track_id),
                        format!("Artist {:03}; Guest {:02}", track_id % 600, track_id % 30),
                        format!("Album {:04}", album_id),
                        format!("Album Artist {:03}", album_id % 250),
                        album_id,
                        ((track_id - 1) % 12) + 1,
                        match track_id % 6 {
                            0 => "Rock",
                            1 => "Pop",
                            2 => "Electronic",
                            3 => "Folk",
                            4 => "Jazz",
                            _ => "Metal",
                        },
                        match track_id % 5 {
                            0 => "indie rock",
                            1 => "pop",
                            2 => "electronic",
                            3 => "folk",
                            _ => "jazz",
                        },
                        1980 + (album_id % 45),
                        120.0 + (track_id % 260) as f64,
                        850_000 + (track_id % 300_000),
                        rating,
                        track_id % 20,
                        track_id % 4,
                        track_id,
                    ],
                )
                .map_err(|error| format!("Could not seed track {track_id}: {error}"))?;
            if track_id % 4 == 0 {
                transaction
                    .execute(
                        "INSERT INTO play_events(track_id, event_type, timestamp, metadata_json)
                         VALUES(?, 'played', datetime('now', '-' || (? % 90) || ' days'), '{}')",
                        params![track_id, track_id],
                    )
                    .map_err(|error| format!("Could not seed play event {track_id}: {error}"))?;
            }
        }
        for playlist_id in 1..=playlist_count {
            transaction
                .execute(
                    "INSERT INTO playlists(id, name) VALUES(?, ?)",
                    params![playlist_id, format!("Benchmark Playlist {playlist_id}")],
                )
                .map_err(|error| format!("Could not seed playlist {playlist_id}: {error}"))?;
            for position in 0..250 {
                let track_id = ((playlist_id * 997 + position) % track_count) + 1;
                transaction
                    .execute(
                        "INSERT OR IGNORE INTO playlist_tracks(playlist_id, track_id, position) VALUES(?, ?, ?)",
                        params![playlist_id, track_id, position],
                    )
                    .map_err(|error| format!("Could not seed playlist track {playlist_id}/{position}: {error}"))?;
            }
        }
        transaction
            .commit()
            .map_err(|error| format!("Could not commit fake seed transaction: {error}"))?;
        Ok(())
    }
}

