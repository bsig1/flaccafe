use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

pub const FOLDER_WATCH_EVENT: &str = "flac-cafe://desktop-folder-watch";

#[derive(Default)]
pub struct FolderWatchState {
    inner: Mutex<FolderWatchInner>,
}

#[derive(Default)]
struct FolderWatchInner {
    runtime: Option<FolderWatchRuntime>,
    watched_paths: Vec<String>,
    pending_events: u64,
    last_event_ms: Option<u128>,
    last_error: Option<String>,
}

struct FolderWatchRuntime {
    stop: Sender<()>,
    thread: JoinHandle<()>,
}

#[derive(Clone, Serialize)]
pub struct FolderWatchEvent {
    paths: Vec<String>,
    event_count: u64,
    emitted_at_ms: u128,
}

#[derive(Serialize)]
pub struct FolderWatchStatus {
    running: bool,
    watched_paths: Vec<String>,
    pending_events: u64,
    last_event_ms: Option<u128>,
    last_error: Option<String>,
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn normalize_watch_paths(paths: Vec<String>) -> Result<Vec<PathBuf>, String> {
    let mut normalized = Vec::new();
    let mut seen = BTreeSet::new();
    for raw_path in paths {
        let trimmed = raw_path.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = PathBuf::from(trimmed)
            .canonicalize()
            .map_err(|error| format!("{trimmed}: {error}"))?;
        if !path.is_dir() {
            return Err(format!("{} is not a folder", path.display()));
        }
        let key = path.to_string_lossy().to_lowercase();
        if seen.insert(key) {
            normalized.push(path);
        }
    }
    if normalized.is_empty() {
        return Err("Choose at least one folder to watch".to_string());
    }
    Ok(normalized)
}

fn status_from_inner(inner: &FolderWatchInner) -> FolderWatchStatus {
    FolderWatchStatus {
        running: inner.runtime.is_some(),
        watched_paths: inner.watched_paths.clone(),
        pending_events: inner.pending_events,
        last_event_ms: inner.last_event_ms,
        last_error: inner.last_error.clone(),
    }
}

fn stop_runtime(runtime: FolderWatchRuntime) {
    let _ = runtime.stop.send(());
    let _ = runtime.thread.join();
}

#[tauri::command]
pub fn folder_watch_start(
    app: AppHandle,
    state: State<'_, FolderWatchState>,
    paths: Vec<String>,
    debounce_ms: Option<u64>,
) -> Result<FolderWatchStatus, String> {
    let normalized = normalize_watch_paths(paths)?;
    let watched_paths: Vec<String> = normalized
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect();
    let debounce = Duration::from_millis(debounce_ms.unwrap_or(1_200).clamp(100, 10_000));

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (event_tx, event_rx) = mpsc::channel::<notify::Result<Event>>();
    let app_for_thread = app.clone();
    let watched_for_thread = normalized.clone();

    let thread = thread::spawn(move || {
        let tx = event_tx.clone();
        let watcher_result = RecommendedWatcher::new(
            move |event| {
                let _ = tx.send(event);
            },
            Config::default(),
        );
        let mut watcher = match watcher_result {
            Ok(watcher) => watcher,
            Err(error) => {
                let _ = app_for_thread.emit(
                    FOLDER_WATCH_EVENT,
                    FolderWatchEvent {
                        paths: vec![format!("watcher-error:{error}")],
                        event_count: 1,
                        emitted_at_ms: now_ms(),
                    },
                );
                return;
            }
        };

        for path in watched_for_thread {
            if watcher.watch(&path, RecursiveMode::Recursive).is_err() {
                let _ = app_for_thread.emit(
                    FOLDER_WATCH_EVENT,
                    FolderWatchEvent {
                        paths: vec![format!("watch-error:{}", path.display())],
                        event_count: 1,
                        emitted_at_ms: now_ms(),
                    },
                );
            }
        }

        let mut pending_paths = BTreeSet::<String>::new();
        let mut event_count = 0u64;
        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }
            match event_rx.recv_timeout(debounce) {
                Ok(Ok(event)) => {
                    event_count = event_count.saturating_add(1);
                    for path in event.paths {
                        pending_paths.insert(path.to_string_lossy().to_string());
                    }
                }
                Ok(Err(error)) => {
                    event_count = event_count.saturating_add(1);
                    pending_paths.insert(format!("watch-error:{error}"));
                }
                Err(RecvTimeoutError::Timeout) => {
                    if event_count > 0 {
                        let payload = FolderWatchEvent {
                            paths: pending_paths.iter().cloned().collect(),
                            event_count,
                            emitted_at_ms: now_ms(),
                        };
                        let _ = app_for_thread.emit(FOLDER_WATCH_EVENT, payload);
                        pending_paths.clear();
                        event_count = 0;
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Folder watch lock poisoned".to_string())?;
    if let Some(runtime) = inner.runtime.take() {
        stop_runtime(runtime);
    }
    inner.runtime = Some(FolderWatchRuntime {
        stop: stop_tx,
        thread,
    });
    inner.watched_paths = watched_paths;
    inner.pending_events = 0;
    inner.last_error = None;
    Ok(status_from_inner(&inner))
}

#[tauri::command]
pub fn folder_watch_stop(state: State<'_, FolderWatchState>) -> Result<FolderWatchStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Folder watch lock poisoned".to_string())?;
    if let Some(runtime) = inner.runtime.take() {
        stop_runtime(runtime);
    }
    inner.watched_paths.clear();
    Ok(status_from_inner(&inner))
}

#[tauri::command]
pub fn folder_watch_status(
    state: State<'_, FolderWatchState>,
) -> Result<FolderWatchStatus, String> {
    let inner = state
        .inner
        .lock()
        .map_err(|_| "Folder watch lock poisoned".to_string())?;
    Ok(status_from_inner(&inner))
}

#[tauri::command]
pub fn folder_watch_mark_event(
    state: State<'_, FolderWatchState>,
    event_count: u64,
    error: Option<String>,
) -> Result<FolderWatchStatus, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "Folder watch lock poisoned".to_string())?;
    inner.pending_events = inner.pending_events.saturating_add(event_count.max(1));
    inner.last_event_ms = Some(now_ms());
    inner.last_error = error.filter(|value| !value.trim().is_empty());
    Ok(status_from_inner(&inner))
}

pub fn stop_folder_watch(app: &AppHandle) {
    let state = app.state::<FolderWatchState>();
    let runtime = if let Ok(mut inner) = state.inner.lock() {
        inner.runtime.take()
    } else {
        None
    };
    if let Some(runtime) = runtime {
        stop_runtime(runtime);
    }
}
