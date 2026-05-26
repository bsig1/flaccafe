use std::path::PathBuf;
use std::time::SystemTime;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

use super::{
    app_storage_root, scan::utc_now, DesktopFileOrganizationReportResponse,
    DesktopFileOrganizationResponse, DesktopReportFileResponse,
};

fn export_dir() -> PathBuf {
    app_storage_root().join("exports")
}

fn resolve_existing_json_report_path(report_path: &str) -> Result<PathBuf, String> {
    let trimmed = report_path.trim();
    if trimmed.is_empty() {
        return Err("Report path is required".to_string());
    }
    let path = PathBuf::from(trimmed);
    if path.is_absolute() {
        Ok(path)
    } else {
        Ok(export_dir().join(path))
    }
}

fn resolve_json_report_path(
    report_path: Option<String>,
    fallback_name: String,
) -> Result<PathBuf, String> {
    let path = report_path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| export_dir().join(fallback_name));
    if path.is_absolute() {
        Ok(path)
    } else {
        Ok(export_dir().join(path))
    }
}

fn system_time_to_iso(value: SystemTime) -> Option<String> {
    let datetime = OffsetDateTime::from(value).replace_microsecond(0).ok()?;
    datetime.format(&Rfc3339).ok()
}

pub fn read_report_file(
    report_path: String,
    max_bytes: Option<usize>,
) -> Result<DesktopReportFileResponse, String> {
    let target = resolve_existing_json_report_path(&report_path)?;
    if !target.is_file() {
        return Ok(DesktopReportFileResponse {
            report_path: target.to_string_lossy().to_string(),
            exists: false,
            size_bytes: 0,
            modified_at: None,
            parsed_json: None,
            raw_text: None,
            truncated: false,
            error: Some("Report file does not exist".to_string()),
        });
    }

    let max_bytes = max_bytes.unwrap_or(750_000).clamp(1024, 5_000_000);
    let metadata = std::fs::metadata(&target)
        .map_err(|error| format!("Could not read report metadata: {error}"))?;
    let bytes =
        std::fs::read(&target).map_err(|error| format!("Could not read report: {error}"))?;
    let truncated = bytes.len() > max_bytes;
    let raw_text = String::from_utf8_lossy(&bytes[..bytes.len().min(max_bytes)])
        .trim_start_matches('\u{feff}')
        .to_string();
    let (parsed_json, error) = if truncated {
        (None, None)
    } else {
        match serde_json::from_str::<serde_json::Value>(&raw_text) {
            Ok(value) => (Some(value), None),
            Err(error) => (None, Some(format!("Could not parse JSON: {error}"))),
        }
    };

    Ok(DesktopReportFileResponse {
        report_path: target.to_string_lossy().to_string(),
        exists: true,
        size_bytes: metadata.len() as i64,
        modified_at: metadata.modified().ok().and_then(system_time_to_iso),
        parsed_json,
        raw_text: Some(raw_text),
        truncated,
        error,
    })
}

pub fn export_file_organization_report(
    report_path: Option<String>,
    response: &DesktopFileOrganizationResponse,
) -> Result<DesktopFileOrganizationReportResponse, String> {
    let stamp = OffsetDateTime::now_utc().unix_timestamp();
    let target = resolve_json_report_path(
        report_path,
        format!("flac-cafe-file-organization-{stamp}.json"),
    )?;
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create report folder: {error}"))?;
    }
    let payload = serde_json::json!({
        "generated_at": utc_now(),
        "template": response.template,
        "base_folder": response.base_folder,
        "total": response.total,
        "changed_count": response.changed_count,
        "changes": response.changes,
    });
    let text = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Could not encode file organization report: {error}"))?;
    std::fs::write(&target, text)
        .map_err(|error| format!("Could not write file organization report: {error}"))?;
    Ok(DesktopFileOrganizationReportResponse {
        report_path: target.to_string_lossy().to_string(),
        total: response.total,
        changed_count: response.changed_count,
        collisions: response
            .changes
            .iter()
            .filter(|change| change.collision)
            .count() as i64,
    })
}

#[cfg(test)]
mod tests {
    use super::read_report_file;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn reads_json_report_with_parse_error_or_payload() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("flac-cafe-report-test-{stamp}"));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("report.json");
        fs::write(&path, r#"{"ok":true}"#).unwrap();

        let response = read_report_file(path.to_string_lossy().to_string(), Some(1024)).unwrap();
        assert!(response.exists);
        assert_eq!(
            response
                .parsed_json
                .and_then(|value| value.get("ok").and_then(serde_json::Value::as_bool)),
            Some(true)
        );
        let _ = fs::remove_dir_all(root);
    }
}
