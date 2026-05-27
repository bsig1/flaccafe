use super::*;

fn sorted_artist_components(value: &str) -> Vec<String> {
    let mut components = artist_lookup_components(value);
    components.sort();
    components
}

fn artist_info_fixture(
    artist_name: &str,
    summary: &str,
    page_url: &str,
    from_cache: bool,
) -> DesktopArtistInfoResponse {
    DesktopArtistInfoResponse {
        artist_name: artist_name.to_string(),
        query: artist_name.to_string(),
        summary: Some(summary.to_string()),
        image_url: None,
        page_url: Some(page_url.to_string()),
        source: Some("Wikipedia".to_string()),
        found: true,
        confidence: 0.0,
        from_cache,
        stale: false,
        updated_at: None,
        error: None,
    }
}

fn missing_cached_artist_info(artist_name: &str) -> DesktopArtistInfoResponse {
    DesktopArtistInfoResponse {
        artist_name: artist_name.to_string(),
        query: artist_name.to_string(),
        summary: None,
        image_url: None,
        page_url: None,
        source: Some("Wikipedia".to_string()),
        found: false,
        confidence: 0.0,
        from_cache: true,
        stale: false,
        updated_at: None,
        error: Some("No confident Wikipedia page found".to_string()),
    }
}

#[test]
fn natural_ampersand_artist_names_stay_together() {
    assert_eq!(
        sorted_artist_components("King Gizzard & the Lizard Wizard"),
        vec!["king gizzard the lizard wizard".to_string()]
    );
}

#[test]
fn collaboration_artist_names_split_for_lookup() {
    assert_eq!(
        sorted_artist_components("AnnenMayKantereit & Giant Rooks"),
        vec!["annenmaykantereit".to_string(), "giant rooks".to_string()]
    );
    assert_eq!(
        sorted_artist_components("Clean Bandit feat. Sean Paul & Anne-Marie"),
        vec![
            "anne marie".to_string(),
            "clean bandit".to_string(),
            "sean paul".to_string(),
        ]
    );
}

#[test]
fn full_ambiguous_artist_names_can_still_match_local_tracks() {
    assert!(artist_tag_matches_lookup(
        "Simon & Garfunkel",
        Some("Simon & Garfunkel")
    ));
    assert!(artist_tag_matches_lookup(
        "Earth, Wind & Fire",
        Some("Earth, Wind & Fire")
    ));
    assert!(artist_tag_matches_lookup(
        "Anne-Marie",
        Some("Clean Bandit feat. Sean Paul & Anne-Marie")
    ));
}

#[test]
fn parenthetical_music_pages_can_score_as_confident_artist_matches() {
    let info = artist_info_fixture(
        "Aurora (singer)",
        "Aurora is a Norwegian singer songwriter and record producer.",
        "https://en.wikipedia.org/wiki/Aurora_(singer)",
        false,
    );
    assert!(is_usable_artist_score(artist_summary_score("Aurora", &info)));
}

#[test]
fn parenthetical_singer_pages_beat_common_word_pages() {
    let animal = artist_info_fixture(
        "Fox",
        "Foxes are small-to-medium-sized omnivorous mammals belonging to the family Canidae.",
        "https://en.wikipedia.org/wiki/Fox",
        false,
    );
    let singer = artist_info_fixture(
        "Foxes (singer)",
        "Louisa Rose Allen, known professionally as Foxes, is an English pop singer.",
        "https://en.wikipedia.org/wiki/Foxes_(singer)",
        false,
    );
    assert!(!is_usable_artist_score(artist_summary_score("Foxes", &animal)));
    assert!(is_high_confidence_artist_score(artist_summary_score(
        "Foxes",
        &singer
    )));
}

#[test]
fn low_confidence_artist_pages_are_treated_as_not_found() {
    let mut info = artist_info_fixture(
        "Aurora",
        "An aurora is a natural light display in Earth's sky.",
        "https://en.wikipedia.org/wiki/Aurora",
        false,
    );
    info.image_url = Some("https://example.test/aurora.jpg".to_string());
    let response = with_artist_confidence("Aurora", info);
    assert!(!response.found);
    assert!(response.summary.is_none());
    assert!(response.image_url.is_none());
    assert!(response.page_url.is_none());
}

#[test]
fn low_confidence_cached_summaries_do_not_block_a_fresh_lookup() {
    let cached_name_page = artist_info_fixture(
        "Khalid",
        "Khalid is a popular Arabic male given name meaning eternal.",
        "https://en.wikipedia.org/wiki/Khalid",
        true,
    );
    assert!(!is_usable_cached_artist_info("Khalid", &cached_name_page));
}

#[test]
fn usable_cached_artist_pages_are_not_marked_stale() {
    let mut cached = artist_info_fixture(
        "Ariana Grande",
        "Ariana Grande-Butera is an American singer, songwriter, and actress.",
        "https://en.wikipedia.org/wiki/Ariana_Grande",
        true,
    );
    cached.stale = true;
    let response = with_artist_confidence("Ariana Grande", cached);
    assert!(response.found);
    assert!(response.confidence >= WIKIPEDIA_MIN_CONFIDENCE);
    assert!(!response.stale);
}

#[test]
fn missing_cached_artist_info_does_not_block_a_fresh_lookup() {
    assert!(!is_usable_cached_artist_info(
        "Gary Jules",
        &missing_cached_artist_info("Gary Jules")
    ));
}

#[test]
fn disambiguated_khalid_singer_page_is_confident() {
    let singer = artist_info_fixture(
        "Khalid (singer)",
        "Khalid Donnel Robinson is an American singer and songwriter.",
        "https://en.wikipedia.org/wiki/Khalid_(singer)",
        false,
    );
    assert!(is_usable_artist_score(artist_summary_score("Khalid", &singer)));
}

#[test]
fn mononymous_stage_name_pages_can_score_as_confident_artist_matches() {
    let singer = artist_info_fixture(
        "Finneas O'Connell",
        "Finneas Baird O'Connell, better known mononymously as Finneas, is an American singer, songwriter, musician, record producer and actor.",
        "https://en.wikipedia.org/wiki/Finneas_O%27Connell",
        false,
    );
    assert!(is_high_confidence_artist_score(artist_summary_score(
        "Finneas",
        &singer
    )));
}

#[test]
fn gary_jules_page_is_confident() {
    let singer = artist_info_fixture(
        "Gary Jules",
        "Gary Jules Aguirre Jr. is an American singer-songwriter.",
        "https://en.wikipedia.org/wiki/Gary_Jules",
        false,
    );
    assert!(is_usable_artist_score(artist_summary_score("Gary Jules", &singer)));
}

#[test]
fn hip_hop_group_pages_can_score_as_confident_artist_matches() {
    let group = artist_info_fixture(
        "Styles of Beyond",
        "Styles of Beyond are an American underground hip hop group.",
        "https://en.wikipedia.org/wiki/Styles_of_Beyond",
        false,
    );
    assert!(is_usable_artist_score(artist_summary_score(
        "Styles of Beyond",
        &group
    )));
}

#[test]
fn wikipedia_lookup_query_normalizes_unicode_hyphen_variants() {
    assert_eq!(wikipedia_lookup_query("Anne-Marie"), "Anne-Marie");
    assert_eq!(wikipedia_lookup_query("Anne‐Marie"), "Anne-Marie");
    assert_eq!(wikipedia_lookup_query("Anne‑Marie"), "Anne-Marie");
    assert_eq!(wikipedia_lookup_query("Anne−Marie"), "Anne-Marie");
}
