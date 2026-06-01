export interface Track {
  id: number;
  path: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  track_number: number | null;
  disc_number: number | null;
  genre: string | null;
  analysis_provider: string | null;
  analysis_model: string | null;
  analysis_genre: string | null;
  analysis_genre_confidence: number | null;
  analysis_genre_tags: string | null;
  analysis_mood?: string | null;
  analysis_mood_confidence?: number | null;
  analysis_mood_tags?: string | null;
  analysis_embedding?: string | null;
  analysis_updated_at: string | null;
  year: number | null;
  duration_seconds: number | null;
  bitrate: number | null;
  replaygain_track_gain_db?: number | null;
  replaygain_album_gain_db?: number | null;
  replaygain_track_peak?: number | null;
  replaygain_album_peak?: number | null;
  audio_fingerprint: string | null;
  acoustic_fingerprint?: string | null;
  acoustic_fingerprint_updated_at?: string | null;
  rating: number | null;
  play_count: number;
  skip_count: number;
  last_played_at: string | null;
  last_skipped_at: string | null;
  date_added: string;
  file_modified_at: string | null;
  audio_url?: string | null;
  is_preview?: boolean;
}

export interface QueueTrack extends Track {
  score: number;
  reason: string;
  score_breakdown: Record<string, number>;
}

export interface TrackPage {
  tracks: Track[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrackBatchResponse {
  tracks: Track[];
  missing_ids: number[];
}

export type AdvancedTrackRatingState = "any" | "rated" | "unrated";

export interface AdvancedTrackSearchFilters {
  artist?: string;
  album?: string;
  genre?: string;
  mood?: string;
  path?: string;
  extension?: string;
  rating_state?: AdvancedTrackRatingState;
  min_rating?: string;
  max_rating?: string;
  year_from?: string;
  year_to?: string;
  min_duration?: string;
  max_duration?: string;
  missing_metadata?: boolean;
}

export interface TrackMetadataUpdate {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  album_artist?: string | null;
  track_number?: number | null;
  disc_number?: number | null;
  genre?: string | null;
  year?: number | null;
  write_to_file?: boolean | null;
}

export interface AlbumSummary {
  id: number;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  years?: number[];
  album_ids?: number[];
  edition_count?: number;
  artwork_path?: string | null;
  artwork_locked?: boolean;
  track_count: number;
  expected_track_count?: number | null;
  missing_track_count?: number;
  duration_seconds: number | null;
  average_rating: number | null;
  artwork_track_id: number | null;
  completion_expected_track_count?: number | null;
  completion_source?: string | null;
  completion_release_id?: string | null;
  completion_release_title?: string | null;
  completion_checked_at?: string | null;
}

export interface ArtistSummary {
  name: string;
  track_count: number;
  album_count: number;
  duration_seconds: number | null;
  average_rating: number | null;
  play_count: number;
  skip_count: number;
  first_year: number | null;
  last_year: number | null;
  artwork_track_id: number | null;
}

export interface AlbumCompletionLookupResponse {
  album_id: number;
  expected_track_count: number | null;
  missing_track_count: number;
  source: string | null;
  release_id: string | null;
  release_title: string | null;
  confidence: number;
  checked_at: string | null;
  error?: string | null;
}

export interface AlbumArtworkCandidate {
  source: "selected" | "sidecar" | "embedded" | "web";
  label: string;
  path: string | null;
  track_id: number | null;
  artwork_url?: string | null;
  thumbnail_url?: string | null;
  release_id?: string | null;
  media_type: string | null;
  size_bytes: number | null;
  modified_at: string | null;
  selected: boolean;
}

export interface AlbumArtworkCandidatesResponse {
  album_id: number;
  candidates: AlbumArtworkCandidate[];
}

export interface AlbumArtworkSearchResponse {
  album_id: number;
  candidates: AlbumArtworkCandidate[];
  errors: string[];
}

export interface AlbumArtworkUpdateResponse {
  album_id: number;
  artwork_path: string | null;
  artwork_locked: boolean;
  candidates: AlbumArtworkCandidate[];
  embedded_updated: number;
  errors: string[];
}

export interface PlaylistSummary {
  id: number;
  name: string;
  track_count: number;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlayEventEntry {
  id: number;
  track_id: number;
  event_type: "played" | "skipped" | "rated";
  timestamp: string;
  metadata: Record<string, unknown>;
  track: Track | null;
}

export interface HistoryTrackStat {
  track: Track;
  play_count: number;
  skip_count: number;
  listened_seconds: number;
}

export interface HistoryAlbumCompletionStat {
  album: string;
  album_artist: string | null;
  track_count: number;
  played_track_count: number;
  unplayed_track_count: number;
  completion_percent: number;
  duration_seconds: number;
  last_played_at: string | null;
  next_track: Track | null;
}

export interface HistoryRatingStat {
  rating: number;
  count: number;
}

export interface HistoryPeriodStat {
  period: string;
  plays: number;
  skips: number;
  ratings: number;
  listened_seconds: number;
}

export interface HistoryDensityStat {
  weekday: number;
  hour: number;
  plays: number;
}

export interface LibraryTimelineStat {
  period: string;
  tracks: number;
  duration_seconds: number;
}

export interface HistoryStatsResponse {
  total_play_count: number;
  total_skip_count: number;
  total_play_events: number;
  total_skip_events: number;
  total_rated_events: number;
  unique_played_tracks: number;
  unique_skipped_tracks: number;
  total_listened_seconds: number;
  albums_completed?: number;
  albums_tracked?: number;
  album_completion_percent?: number;
  completed_albums?: HistoryAlbumCompletionStat[];
  next_albums?: HistoryAlbumCompletionStat[];
  top_played: HistoryTrackStat[];
  top_skipped: HistoryTrackStat[];
  rating_distribution?: HistoryRatingStat[];
  events_by_day?: HistoryPeriodStat[];
  events_by_week?: HistoryPeriodStat[];
  events_by_month?: HistoryPeriodStat[];
  listening_density?: HistoryDensityStat[];
  library_added_by_day?: LibraryTimelineStat[];
  library_added_by_week?: LibraryTimelineStat[];
  library_added_by_month?: LibraryTimelineStat[];
}

export interface DuplicateGroup {
  key: string;
  ignore_key: string;
  tracks: Track[];
  match_reason: string;
  recommended_keep_id: number | null;
  recommendation_reason: string | null;
  duration_spread_seconds: number | null;
  bitrate_spread: number | null;
  shared_fingerprint: boolean;
  shared_acoustic_fingerprint?: boolean;
  average_audio_similarity: number | null;
  path_roots: string[];
  analyzed_tracks: number;
}

export interface SimilarTrack extends Track {
  similarity_score: number;
  similarity_reason: string;
  audio_similarity: number | null;
}

export interface SimilarAlbum {
  album: AlbumSummary;
  similarity_score: number;
  analyzed_tracks: number;
}

export interface SimilarArtist {
  artist: ArtistSummary;
  similarity_score: number;
  analyzed_tracks: number;
}

export interface LibraryHealthResponse {
  missing_files: Track[];
  missing_metadata: Track[];
  duplicate_groups: DuplicateGroup[];
  unrated_tracks: Track[];
  missing_metadata_total: number;
  duplicate_group_total: number;
  ignored_duplicate_group_total: number;
}

export interface LibraryStatsResponse {
  total_tracks: number;
  total_albums: number;
  total_artists: number;
  total_playlists: number;
  rated_tracks: number;
  unrated_tracks: number;
  total_duration_seconds: number | null;
  played_events: number;
  skipped_events: number;
}

export interface InboxResponse {
  tracks: Track[];
  notes: InboxTrackNote[];
  auto_review_rules: InboxAutoReviewRule[];
  total_new: number;
  total_reviewed: number;
  limit: number;
  offset: number;
}

export interface InboxTrackNote {
  track_id: number;
  note: string;
  updated_at: string;
}

export interface InboxReviewResponse {
  updated: number;
  total_new: number;
  total_reviewed: number;
}

export type InboxAutoReviewField =
  | "title"
  | "artist"
  | "album"
  | "album_artist"
  | "genre"
  | "path"
  | "year"
  | "rating"
  | "duration_seconds";

export type InboxAutoReviewMatchType =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "is_empty"
  | "is_not_empty";

export interface InboxAutoReviewRule {
  id: number;
  name: string;
  enabled: boolean;
  field: InboxAutoReviewField;
  match_type: InboxAutoReviewMatchType;
  value: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxAutoReviewRuleRequest {
  name: string;
  enabled: boolean;
  field: InboxAutoReviewField;
  match_type: InboxAutoReviewMatchType;
  value: string;
  note?: string | null;
  apply_existing?: boolean;
}

export interface InboxAutoReviewRuleApplyResponse {
  rule: InboxAutoReviewRule;
  applied: number;
  total_new: number;
  total_reviewed: number;
}

export interface InboxAutoReviewRuleDeleteResponse {
  deleted: boolean;
  total_new: number;
  total_reviewed: number;
}

