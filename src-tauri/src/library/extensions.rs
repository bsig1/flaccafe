use serde_json::Value;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};

use super::{app_storage_root, repo_root, DesktopExtensionListResponse, DesktopExtensionManifest};

const MANIFEST_NAMES: [&str; 3] = [
    "flac-cafe-extension.json",
    "extension.json",
    "manifest.json",
];
const VALID_KINDS: [&str; 5] = ["skin", "plugin", "importer", "visualizer", "integration"];

pub fn extensions() -> Result<DesktopExtensionListResponse, String> {
    discover_extensions_from_dirs(user_extensions_dir(), extension_search_dirs(), true)
}

pub fn reload_extensions() -> Result<DesktopExtensionListResponse, String> {
    extensions()
}

fn user_extensions_dir() -> PathBuf {
    app_storage_root().join("extensions")
}

fn bundled_extensions_dir() -> Option<PathBuf> {
    repo_root().map(|root| root.join("extensions"))
}

fn extension_search_dirs() -> Vec<PathBuf> {
    let user_dir = user_extensions_dir();
    let mut dirs = vec![user_dir.clone()];
    if let Some(bundled) = bundled_extensions_dir() {
        if bundled != user_dir {
            dirs.push(bundled);
        }
    }
    dirs
}

fn json_string(raw: &Value, key: &str) -> Option<String> {
    raw.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn json_string_list(raw: &Value, key: &str) -> Vec<String> {
    raw.get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::trim))
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn entry_is_safe_relative_path(entry: &Path) -> bool {
    !entry.is_absolute()
        && entry.components().all(|component| {
            !matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
}

fn extension_manifest_payload(manifest_path: &Path, directory: &Path) -> DesktopExtensionManifest {
    let mut errors = Vec::new();
    let raw = match std::fs::read_to_string(manifest_path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
    {
        Some(value) => value,
        None => {
            errors.push("Could not read manifest as JSON".to_string());
            Value::Object(Default::default())
        }
    };

    let kind = json_string(&raw, "kind")
        .unwrap_or_else(|| "plugin".to_string())
        .to_ascii_lowercase();
    if !VALID_KINDS.contains(&kind.as_str()) {
        errors.push(format!("Unknown extension kind '{kind}'"));
    }

    let extension_id = json_string(&raw, "id")
        .or_else(|| {
            directory
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_string)
        })
        .unwrap_or_default();
    let name = json_string(&raw, "name").unwrap_or_else(|| extension_id.clone());
    let version = json_string(&raw, "version").unwrap_or_else(|| "0.0.0".to_string());
    let entry = json_string(&raw, "entry");
    let entry_path = entry.as_ref().and_then(|entry| {
        let relative = PathBuf::from(entry);
        if !entry_is_safe_relative_path(&relative) {
            errors.push("Entry must stay inside the extension folder".to_string());
            return None;
        }
        let candidate = directory.join(relative);
        if !candidate.exists() {
            errors.push("Entry file does not exist".to_string());
        }
        Some(candidate.to_string_lossy().to_string())
    });

    DesktopExtensionManifest {
        id: extension_id.clone(),
        name: name.clone(),
        version,
        kind,
        description: json_string(&raw, "description"),
        author: json_string(&raw, "author"),
        homepage: json_string(&raw, "homepage"),
        entry,
        entry_path,
        directory: directory.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        capabilities: json_string_list(&raw, "capabilities"),
        permissions: json_string_list(&raw, "permissions"),
        enabled: raw.get("enabled").and_then(Value::as_bool).unwrap_or(true),
        valid: errors.is_empty() && !extension_id.is_empty() && !name.is_empty(),
        errors,
    }
}

fn discover_extensions_from_dirs(
    user_dir: PathBuf,
    search_dirs: Vec<PathBuf>,
    create_user_dir: bool,
) -> Result<DesktopExtensionListResponse, String> {
    if create_user_dir {
        std::fs::create_dir_all(&user_dir).map_err(|error| {
            format!(
                "Could not create extension folder {}: {error}",
                user_dir.display()
            )
        })?;
    }

    let mut manifests = Vec::new();
    let mut seen = HashSet::new();
    for base_dir in &search_dirs {
        let Ok(entries) = std::fs::read_dir(base_dir) else {
            continue;
        };
        let mut directories = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect::<Vec<_>>();
        directories.sort_by_key(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
        });
        for directory in directories {
            let manifest_path = MANIFEST_NAMES
                .iter()
                .map(|name| directory.join(name))
                .find(|path| path.is_file());
            let Some(manifest_path) = manifest_path else {
                continue;
            };
            let manifest = extension_manifest_payload(&manifest_path, &directory);
            let dedupe_key = format!("{}:{}", manifest.id, manifest.directory);
            if seen.insert(dedupe_key) {
                manifests.push(manifest);
            }
        }
    }

    Ok(DesktopExtensionListResponse {
        user_extensions_dir: user_dir.to_string_lossy().to_string(),
        search_directories: search_dirs
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        manifest_names: MANIFEST_NAMES
            .iter()
            .map(|name| (*name).to_string())
            .collect(),
        extensions: manifests,
    })
}

#[cfg(test)]
mod tests {
    use super::discover_extensions_from_dirs;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn discovers_and_validates_extension_manifests() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("flac-cafe-extension-test-{stamp}"));
        let user_dir = root.join("user");
        let bundle_dir = root.join("bundled");
        let valid_dir = bundle_dir.join("valid");
        let invalid_dir = bundle_dir.join("invalid");
        fs::create_dir_all(&valid_dir).unwrap();
        fs::create_dir_all(&invalid_dir).unwrap();
        fs::write(valid_dir.join("theme.json"), "{}").unwrap();
        fs::write(
            valid_dir.join("extension.json"),
            r#"{"id":"valid","name":"Valid","kind":"skin","entry":"theme.json","capabilities":["theme"]}"#,
        )
        .unwrap();
        fs::write(
            invalid_dir.join("manifest.json"),
            r#"{"id":"bad","name":"Bad","kind":"danger","entry":"../outside.js"}"#,
        )
        .unwrap();

        let response =
            discover_extensions_from_dirs(user_dir.clone(), vec![user_dir, bundle_dir], true)
                .unwrap();
        assert_eq!(response.extensions.len(), 2);
        assert!(response.extensions.iter().any(|extension| extension.valid));
        assert!(response
            .extensions
            .iter()
            .any(|extension| !extension.valid && extension.errors.len() >= 2));
        let _ = fs::remove_dir_all(root);
    }
}
