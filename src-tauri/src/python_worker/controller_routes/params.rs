fn to_json<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| format!("Could not encode Rust response: {error}"))
}

fn param_string(params: &Map<String, Value>, key: &str) -> Option<String> {
    params
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn required_param_string(params: &Map<String, Value>, key: &str) -> Result<String, String> {
    param_string(params, key).ok_or_else(|| format!("Missing required parameter: {key}"))
}

fn param_i64(params: &Map<String, Value>, key: &str) -> Option<i64> {
    params.get(key).and_then(value_as_i64)
}

fn required_param_i64(params: &Map<String, Value>, key: &str) -> Result<i64, String> {
    param_i64(params, key).ok_or_else(|| format!("Expected integer parameter: {key}"))
}

fn param_usize(params: &Map<String, Value>, key: &str) -> Option<usize> {
    param_i64(params, key).and_then(|value| usize::try_from(value).ok())
}

fn param_f64(params: &Map<String, Value>, key: &str) -> Option<f64> {
    params.get(key).and_then(value_as_f64)
}

fn param_bool(params: &Map<String, Value>, key: &str) -> Option<bool> {
    params.get(key).and_then(value_as_bool)
}

fn body_field<'a>(body: &'a Value, key: &str) -> Option<&'a Value> {
    body.as_object()?.get(key).filter(|value| !value.is_null())
}

fn body_has_field(body: &Value, key: &str) -> bool {
    body.as_object()
        .and_then(|object| object.get(key))
        .is_some_and(|value| !value.is_null())
}

fn body_string(body: &Value, key: &str) -> Option<String> {
    body_field(body, key)
        .and_then(Value::as_str)
        .map(str::trim)
        .map(ToString::to_string)
}

fn required_body_string(body: &Value, key: &str) -> Result<String, String> {
    body_string(body, key)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("Missing required field: {key}"))
}

fn body_i64(body: &Value, key: &str) -> Option<i64> {
    body_field(body, key).and_then(value_as_i64)
}

fn required_body_i64(body: &Value, key: &str) -> Result<i64, String> {
    body_i64(body, key).ok_or_else(|| format!("Expected integer field: {key}"))
}

fn body_usize(body: &Value, key: &str) -> Option<usize> {
    body_i64(body, key).and_then(|value| usize::try_from(value).ok())
}

fn body_f64(body: &Value, key: &str) -> Option<f64> {
    body_field(body, key).and_then(value_as_f64)
}

fn body_bool(body: &Value, key: &str) -> Option<bool> {
    body_field(body, key).and_then(value_as_bool)
}

fn body_string_vec(body: &Value, key: &str) -> Option<Vec<String>> {
    Some(
        body_field(body, key)?
            .as_array()?
            .iter()
            .filter_map(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
            .collect(),
    )
}

fn required_body_string_vec(body: &Value, key: &str) -> Result<Vec<String>, String> {
    body_string_vec(body, key).ok_or_else(|| format!("Expected string list field: {key}"))
}

fn body_i64_vec(body: &Value, key: &str) -> Option<Vec<i64>> {
    Some(
        body_field(body, key)?
            .as_array()?
            .iter()
            .filter_map(value_as_i64)
            .collect(),
    )
}

fn required_body_i64_vec(body: &Value, key: &str) -> Result<Vec<i64>, String> {
    body_i64_vec(body, key).ok_or_else(|| format!("Expected integer list field: {key}"))
}

fn body_i64_groups(body: &Value, key: &str) -> Option<Vec<Vec<i64>>> {
    Some(
        body_field(body, key)?
            .as_array()?
            .iter()
            .filter_map(|group| {
                Some(
                    group
                        .as_array()?
                        .iter()
                        .filter_map(value_as_i64)
                        .collect::<Vec<_>>(),
                )
            })
            .collect(),
    )
}

fn value_as_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))
        .or_else(|| value.as_str()?.trim().parse::<i64>().ok())
}

fn value_as_f64(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str()?.trim().parse::<f64>().ok())
}

fn value_as_bool(value: &Value) -> Option<bool> {
    value.as_bool().or_else(
        || match value.as_str()?.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Some(true),
            "0" | "false" | "no" | "off" => Some(false),
            _ => None,
        },
    )
}
