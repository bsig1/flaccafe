pub(super) fn try_handle_track_json(
    state: State<'_, DesktopLibraryState>,
    action: &str,
    params: &Map<String, Value>,
    body: &Value,
) -> Result<Option<Value>, String> {
    let response = match action {
        "list_track_page" => Some(to_json(library::tracks_page(
            state,
            param_string(params, "search"),
            param_usize(params, "limit"),
            param_usize(params, "offset"),
            param_string(params, "sort_by").or_else(|| param_string(params, "sortBy")),
            param_string(params, "sort_direction")
                .or_else(|| param_string(params, "sortDirection")),
            param_string(params, "artist"),
            param_string(params, "album"),
            param_string(params, "genre"),
            param_string(params, "path"),
            param_string(params, "extension"),
            param_string(params, "rating_state").or_else(|| param_string(params, "ratingState")),
            param_f64(params, "min_rating").or_else(|| param_f64(params, "minRating")),
            param_f64(params, "max_rating").or_else(|| param_f64(params, "maxRating")),
            param_i64(params, "year_from").or_else(|| param_i64(params, "yearFrom")),
            param_i64(params, "year_to").or_else(|| param_i64(params, "yearTo")),
            param_f64(params, "min_duration").or_else(|| param_f64(params, "minDuration")),
            param_f64(params, "max_duration").or_else(|| param_f64(params, "maxDuration")),
            param_bool(params, "missing_metadata")
                .or_else(|| param_bool(params, "missingMetadata")),
        )?)?),
        "list_tracks" => {
            let page = library::tracks_page(
                state,
                param_string(params, "search"),
                param_usize(params, "limit"),
                param_usize(params, "offset"),
                param_string(params, "sort_by").or_else(|| param_string(params, "sortBy")),
                param_string(params, "sort_direction")
                    .or_else(|| param_string(params, "sortDirection")),
                param_string(params, "artist"),
                param_string(params, "album"),
                param_string(params, "genre"),
                param_string(params, "path"),
                param_string(params, "extension"),
                param_string(params, "rating_state")
                    .or_else(|| param_string(params, "ratingState")),
                param_f64(params, "min_rating").or_else(|| param_f64(params, "minRating")),
                param_f64(params, "max_rating").or_else(|| param_f64(params, "maxRating")),
                param_i64(params, "year_from").or_else(|| param_i64(params, "yearFrom")),
                param_i64(params, "year_to").or_else(|| param_i64(params, "yearTo")),
                param_f64(params, "min_duration").or_else(|| param_f64(params, "minDuration")),
                param_f64(params, "max_duration").or_else(|| param_f64(params, "maxDuration")),
                param_bool(params, "missing_metadata")
                    .or_else(|| param_bool(params, "missingMetadata")),
            )?;
            Some(to_json(page.tracks)?)
        }
        "get_tracks_batch" => Some(to_json(library::tracks_batch(
            state,
            body_i64_vec(body, "track_ids")
                .or_else(|| body_i64_vec(body, "trackIds"))
                .unwrap_or_default(),
        )?)?),
        "write_track_metadata_to_files" => Some(to_json(
            library::track_file_metadata_write_preview(
                body_i64_vec(body, "track_ids").or_else(|| body_i64_vec(body, "trackIds")),
                body_bool(body, "include_metadata")
                    .or_else(|| body_bool(body, "includeMetadata")),
                body_bool(body, "include_rating").or_else(|| body_bool(body, "includeRating")),
                body_bool(body, "apply"),
                body_usize(body, "limit"),
            )?,
        )?),
        "get_track" => Some(to_json(library::track(
            state,
            required_param_i64(params, "track_id")?,
        )?)?),
        _ => None,
    };
    Ok(response)
}
