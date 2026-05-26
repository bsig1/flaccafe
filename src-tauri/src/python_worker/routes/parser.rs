use serde_json::{Map, Value};

pub(crate) struct PythonWorkerAction {
    pub(crate) action: &'static str,
    pub(crate) params: Map<String, Value>,
}

#[derive(Clone, Copy)]
struct PythonRoute {
    method: &'static str,
    template: &'static str,
    action: &'static str,
}

pub(crate) fn action_for_request(method: &str, path: &str) -> Result<PythonWorkerAction, String> {
    let method = method.trim().to_ascii_uppercase();
    let request_path = request_path_without_origin(path);
    let (path_only, query) = split_query(&request_path);
    let normalized_path = normalize_path(path_only);
    let query_params = parse_query(query)?;

    for route in PYTHON_ROUTES {
        if route.method != method {
            continue;
        }
        let Some(mut path_params) = match_template(route.template, &normalized_path)? else {
            continue;
        };
        for (key, value) in query_params.iter() {
            path_params.insert(key.clone(), value.clone());
        }
        return Ok(PythonWorkerAction {
            action: route.action,
            params: path_params,
        });
    }

    Err(format!(
        "No Rust controller action is mapped for {method} {normalized_path}"
    ))
}

fn request_path_without_origin(path: &str) -> String {
    let trimmed = path.trim();
    if let Some(scheme_index) = trimmed.find("://") {
        let after_origin = &trimmed[scheme_index + 3..];
        if let Some(path_index) = after_origin.find('/') {
            return after_origin[path_index..].to_string();
        }
        return "/".to_string();
    }
    trimmed.to_string()
}

fn split_query(path: &str) -> (&str, Option<&str>) {
    match path.split_once('?') {
        Some((path_only, query)) => (path_only, Some(query)),
        None => (path, None),
    }
}

fn normalize_path(path: &str) -> String {
    let without_fragment = path.split_once('#').map(|(value, _)| value).unwrap_or(path);
    let normalized = if without_fragment.starts_with('/') {
        without_fragment.to_string()
    } else {
        format!("/{without_fragment}")
    };
    if normalized.len() > 1 {
        normalized.trim_end_matches('/').to_string()
    } else {
        normalized
    }
}

fn parse_query(query: Option<&str>) -> Result<Map<String, Value>, String> {
    let mut params = Map::new();
    let Some(query) = query else {
        return Ok(params);
    };
    for pair in query.split('&').filter(|part| !part.is_empty()) {
        let (raw_key, raw_value) = pair.split_once('=').unwrap_or((pair, ""));
        let key = decode_component(raw_key, true)?;
        let value = Value::String(decode_component(raw_value, true)?);
        match params.get_mut(&key) {
            Some(Value::Array(values)) => values.push(value),
            Some(existing) => {
                let old = existing.clone();
                *existing = Value::Array(vec![old, value]);
            }
            None => {
                params.insert(key, value);
            }
        }
    }
    Ok(params)
}

fn match_template(template: &str, path: &str) -> Result<Option<Map<String, Value>>, String> {
    let template_parts = path_parts(template);
    let path_parts = path_parts(path);
    if template_parts.len() != path_parts.len() {
        return Ok(None);
    }
    let mut params = Map::new();
    for (template_part, path_part) in template_parts.iter().zip(path_parts.iter()) {
        if let Some(name) = template_part
            .strip_prefix('{')
            .and_then(|value| value.strip_suffix('}'))
        {
            params.insert(
                name.to_string(),
                Value::String(decode_component(path_part, false)?),
            );
        } else if template_part != path_part {
            return Ok(None);
        }
    }
    Ok(Some(params))
}

fn path_parts(path: &str) -> Vec<&str> {
    path.trim_matches('/')
        .split('/')
        .filter(|part| !part.is_empty())
        .collect()
}

fn decode_component(value: &str, plus_is_space: bool) -> Result<String, String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0usize;
    while index < bytes.len() {
        match bytes[index] {
            b'%' => {
                if index + 2 >= bytes.len() {
                    return Err("Malformed percent-encoded path or query".to_string());
                }
                let hex = std::str::from_utf8(&bytes[index + 1..index + 3])
                    .map_err(|_| "Malformed percent-encoded path or query".to_string())?;
                let byte = u8::from_str_radix(hex, 16)
                    .map_err(|_| "Malformed percent-encoded path or query".to_string())?;
                decoded.push(byte);
                index += 3;
            }
            b'+' if plus_is_space => {
                decoded.push(b' ');
                index += 1;
            }
            byte => {
                decoded.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8(decoded).map_err(|_| "Path or query was not UTF-8".to_string())
}

