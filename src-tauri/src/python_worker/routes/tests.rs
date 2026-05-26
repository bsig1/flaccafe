#[cfg(test)]
mod tests {
    use super::{action_for_request, PYTHON_ROUTES};

    #[test]
    fn maps_path_and_query_to_action_params() {
        let action =
            action_for_request("GET", "/diagnostics/logs/backend?limit=25&tag=a&tag=b").unwrap();
        assert_eq!(action.action, "get_backend_log");
        assert_eq!(action.params["limit"].as_str(), Some("25"));
        assert!(action.params["tag"].is_array());
    }

    #[test]
    fn maps_dynamic_segments_after_static_routes() {
        let page = action_for_request("GET", "/tracks/page?limit=10").unwrap();
        assert_eq!(page.action, "list_track_page");
        let track = action_for_request("GET", "/tracks/42").unwrap();
        assert_eq!(track.action, "get_track");
        assert_eq!(track.params["track_id"].as_str(), Some("42"));
    }

    #[test]
    fn maps_head_requests_to_controller_action() {
        let action = action_for_request(
            "HEAD",
            "/library/tools/cd-rip/playback/live/audio?drive_id=D%3A&track_number=1",
        )
        .unwrap();
        assert_eq!(action.action, "stream_cd_live_audio");
        assert_eq!(action.params["drive_id"].as_str(), Some("D:"));
    }

    #[test]
    fn hammers_every_route_with_good_and_bad_request_shapes() {
        for route in PYTHON_ROUTES {
            let path = concrete_path(route.template);
            let good_cases = [
                (route.method.to_string(), path.clone()),
                (route.method.to_ascii_lowercase(), path.clone()),
                (
                    route.method.to_string(),
                    path.trim_start_matches('/').to_string(),
                ),
                (route.method.to_string(), format!("{path}/")),
                (
                    route.method.to_string(),
                    format!("http://127.0.0.1:8765{path}?hammer=a&hammer=b"),
                ),
            ];
            for (method, good_path) in good_cases {
                let action = action_for_request(&method, &good_path).unwrap_or_else(|error| {
                    panic!(
                        "expected route hammer good case to map {} {} ({}) but got {error}",
                        method, good_path, route.action
                    )
                });
                assert_eq!(action.action, route.action);
            }

            let bad_cases = [
                ("OPTIONS".to_string(), path.clone()),
                (route.method.to_string(), "/__hammer_missing__".to_string()),
                (
                    route.method.to_string(),
                    format!(
                        "{}/__hammer_extra__/__hammer_leaf__",
                        path.trim_end_matches('/')
                    ),
                ),
                (
                    route.method.to_string(),
                    format!("/__hammer_prefix{}", path.trim_start_matches('/')),
                ),
                (route.method.to_string(), format!("{path}?broken=%GG")),
            ];
            for (method, bad_path) in bad_cases {
                assert!(
                    action_for_request(&method, &bad_path).is_err(),
                    "expected route hammer bad case to reject {method} {bad_path}"
                );
            }
        }
    }

    fn concrete_path(template: &str) -> String {
        let path = template
            .trim_matches('/')
            .split('/')
            .filter(|part| !part.is_empty())
            .map(|part| {
                part.strip_prefix('{')
                    .and_then(|value| value.strip_suffix('}'))
                    .map(sample_segment)
                    .unwrap_or_else(|| part.to_string())
            })
            .collect::<Vec<_>>()
            .join("/");
        format!("/{path}")
    }

    fn sample_segment(name: &str) -> String {
        match name {
            "service" => "listenbrainz".to_string(),
            "job_id" => "hammer-job".to_string(),
            "track_id" => "101".to_string(),
            "album_id" => "202".to_string(),
            "playlist_id" => "303".to_string(),
            "subscription_id" => "404".to_string(),
            "episode_id" => "505".to_string(),
            "rule_id" => "606".to_string(),
            "preset_id" => "707".to_string(),
            "definition_id" => "808".to_string(),
            "profile_id" => "909".to_string(),
            "batch_id" => "111".to_string(),
            "entry_id" => "222".to_string(),
            _ => "1".to_string(),
        }
    }
}
