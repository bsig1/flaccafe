import type {
  AlbumSummary,
  ArtistSummary,
  AdvancedTrackSearchFilters,
  AudiobookBookmark,
  AudiobookBookmarkRequest,
  AudiobookChapter,
  AudiobookListResponse,
  AudiobookProgressRequest,
  AudiobookProgressResponse,
  AutoDjAvoidRule,
  AutoDjResponse,
  AutoDjSettings,
  AudioAnalysisCoverage,
  AudioConversionSetupRequest,
  AudioConversionSetupResponse,
  BulkLyricsProgress,
  BulkLyricsSaveLocation,
  BulkLyricsStartResponse,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  CacheClearResponse,
  CacheClearTarget,
  ChromaprintConfigRequest,
  ChromaprintStatusResponse,
  CustomTagBatchRequest,
  CustomTagBatchResponse,
  DeviceSyncProfile,
  DeviceSyncProfilePayload,
  DeviceSyncProfilesResponse,
  DuplicateReviewRequest,
  DuplicateReviewResponse,
  ExportResponse,
  FileOrganizationRequest,
  FileOrganizationResponse,
  FilenameTagInferenceRequest,
  FilenameTagInferenceResponse,
  GaplessValidationRequest,
  GaplessValidationResponse,
  HistoryStatsResponse,
  InboxResponse,
  InboxAutoReviewRule,
  InboxAutoReviewRuleApplyResponse,
  InboxAutoReviewRuleDeleteResponse,
  InboxAutoReviewRuleRequest,
  InboxReviewResponse,
  InboxTrackNote,
  LibraryHealthResponse,
  LibrarySourceRemoveResponse,
  LibraryStatsResponse,
  LyricsLookupRequest,
  LyricsResponse,
  LyricsUpdateRequest,
  PlayEventEntry,
  PlaylistSummary,
  PodcastEpisode,
  PodcastFolderResponse,
  PodcastSubscription,
  PodcastSubscriptionDeleteResponse,
  PodcastSubscriptionPayload,
  RadioStation,
  RadioStationPayload,
  ArtistInfoResponse,
  RecommendationAbChoiceResponse,
  RecommendationAbTestResponse,
  RecommendationProfile,
  RecommendationProfileComparison,
  RecommendationProfileComparisonExportResponse,
  RecommendationProfileComparisonImportResponse,
  RecommendationRun,
  RegexTagPreset,
  RegexTagPresetRequest,
  ScrobbleAccount,
  ScrobbleAccountRequest,
  ScrobbleOutboxEntry,
  ScrobbleQueueHistoryResponse,
  ScrobbleService,
  SettingsResponse,
  SettingsUpdateRequest,
  SimilarTrack,
  TagFieldCopySwapRequest,
  TagFieldCopySwapResponse,
  TagRegexReplaceRequest,
  TagRegexReplaceResponse,
  Track,
  TrackBatchResponse,
  TrackLoveResponse,
  TrackPage,
  VirtualTagDefinition,
  VirtualTagDefinitionRequest,
  VirtualTagPreviewRequest,
  VirtualTagPreviewResponse,
  VolumeTagRequest,
  VolumeTagResponse,
  LovedTrack,
} from "../types/api";

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export interface desktopTrackPage extends TrackPage {
  source: "rust-sqlite" | string;
}

export interface desktopLibraryReconcilePreview {
  folders: string[];
  scanned_files: number;
  database_tracks: number;
  new_files: number;
  missing_tracks: number;
  modified_tracks: number;
  sample_new_files: string[];
  sample_missing_tracks: string[];
  sample_modified_tracks: string[];
  elapsed_ms: number;
  errors: string[];
}

export interface desktopPlaylistParseResponse {
  playlist_path: string;
  base_folder: string;
  entries: string[];
  local_paths: string[];
  errors: string[];
}

export interface desktopBulkFileMove {
  source_path: string;
  target_path: string;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface desktopBulkFileMoveResponse {
  total: number;
  changed: number;
  applied: number;
  moves: desktopBulkFileMove[];
}

export function desktopFetchTrackPage({
  search = "",
  limit = 150,
  offset = 0,
  sortBy = "artist",
  sortDirection = "asc",
  advancedFilters,
}: {
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  advancedFilters?: AdvancedTrackSearchFilters;
}): Promise<desktopTrackPage> {
  return invokeDesktop<desktopTrackPage>("tracks_page", {
    search,
    limit,
    offset,
    sortBy,
    sortDirection,
    artist: advancedFilters?.artist?.trim() || null,
    album: advancedFilters?.album?.trim() || null,
    genre: advancedFilters?.genre?.trim() || null,
    path: advancedFilters?.path?.trim() || null,
    extension: advancedFilters?.extension?.trim() || null,
    ratingState: advancedFilters?.rating_state ?? "any",
    minRating: numericFilterValue(advancedFilters?.min_rating),
    maxRating: numericFilterValue(advancedFilters?.max_rating),
    yearFrom: integerFilterValue(advancedFilters?.year_from),
    yearTo: integerFilterValue(advancedFilters?.year_to),
    minDuration: numericFilterValue(advancedFilters?.min_duration),
    maxDuration: numericFilterValue(advancedFilters?.max_duration),
    missingMetadata: advancedFilters?.missing_metadata ?? false,
  });
}

function numericFilterValue(value?: string | null): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerFilterValue(value?: string | null): number | null {
  const parsed = numericFilterValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export function desktopFetchClapCoverage(): Promise<AudioAnalysisCoverage> {
  return invokeDesktop<AudioAnalysisCoverage>("clap_coverage");
}

export function desktopFetchBackendHealth(): Promise<{ status: string }> {
  return invokeDesktop<{ status: string }>("health");
}

export function desktopFetchSettings(): Promise<SettingsResponse> {
  return invokeDesktop<SettingsResponse>("settings");
}

export function desktopUpdateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return invokeDesktop<SettingsResponse>("update_settings", {
    writeRatingsToFiles: settings.write_ratings_to_files,
    autoWriteFetchedLyricsSidecars: settings.auto_write_fetched_lyrics_sidecars,
    cdAutoLookupMetadata: settings.cd_auto_lookup_metadata,
    acoustidApiKey: settings.acoustid_api_key,
    clearAcoustidApiKey: settings.clear_acoustid_api_key,
    lastfmApiKey: settings.lastfm_api_key,
    lastfmApiSecret: settings.lastfm_api_secret,
    clearLastfmApiCredentials: settings.clear_lastfm_api_credentials,
  });
}

export function desktopRemoveLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return invokeDesktop<LibrarySourceRemoveResponse>("remove_library_source", { path });
}

export function desktopFetchTrack(trackId: number): Promise<Track> {
  return invokeDesktop<Track>("track", { trackId });
}

export function desktopFetchTracksBatch(trackIds: number[]): Promise<TrackBatchResponse> {
  return invokeDesktop<TrackBatchResponse>("tracks_batch", { trackIds });
}

export function desktopFetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return invokeDesktop<SimilarTrack[]>("similar_tracks", { trackId, limit });
}

export function desktopFetchAudiobooks(limit = 200, offset = 0): Promise<AudiobookListResponse> {
  return invokeDesktop<AudiobookListResponse>("audiobooks", { limit, offset });
}

export function desktopUpdateAudiobookProgress(
  trackId: number,
  requestBody: AudiobookProgressRequest,
): Promise<AudiobookProgressResponse> {
  return invokeDesktop<AudiobookProgressResponse>("update_audiobook_progress", {
    trackId,
    positionSeconds: requestBody.position_seconds,
    durationSeconds: requestBody.duration_seconds ?? null,
  });
}

export function desktopFetchAudiobookBookmarks(trackId: number): Promise<AudiobookBookmark[]> {
  return invokeDesktop<AudiobookBookmark[]>("audiobook_bookmarks", { trackId });
}

export function desktopCreateAudiobookBookmark(
  trackId: number,
  requestBody: AudiobookBookmarkRequest,
): Promise<AudiobookBookmark> {
  return invokeDesktop<AudiobookBookmark>("create_audiobook_bookmark", {
    trackId,
    positionSeconds: requestBody.position_seconds,
    label: requestBody.label ?? null,
    note: requestBody.note ?? null,
  });
}

export function desktopDeleteAudiobookBookmark(bookmarkId: number): Promise<{ deleted: boolean }> {
  return invokeDesktop<{ deleted: boolean }>("delete_audiobook_bookmark", { bookmarkId });
}

export function desktopFetchAudiobookChapters(trackId: number): Promise<AudiobookChapter[]> {
  return invokeDesktop<AudiobookChapter[]>("audiobook_chapters", { trackId });
}

export function desktopSaveAudiobookChapters(trackId: number, chapters: AudiobookChapter[]): Promise<AudiobookChapter[]> {
  return invokeDesktop<AudiobookChapter[]>("save_audiobook_chapters", { trackId, chapters });
}

export function desktopFetchRadioStations(): Promise<RadioStation[]> {
  return invokeDesktop<RadioStation[]>("radio_stations");
}

export function desktopSaveRadioStation(
  requestBody: RadioStationPayload,
  stationId?: number | null,
): Promise<RadioStation> {
  return invokeDesktop<RadioStation>("save_radio_station", {
    stationId: stationId ?? null,
    name: requestBody.name,
    streamUrl: requestBody.stream_url,
    homepageUrl: requestBody.homepage_url ?? null,
    genre: requestBody.genre ?? null,
    notes: requestBody.notes ?? null,
  });
}

export function desktopDeleteRadioStation(stationId: number): Promise<{ deleted: boolean }> {
  return invokeDesktop<{ deleted: boolean }>("delete_radio_station", { stationId });
}

export function desktopMarkRadioStationPlayed(stationId: number): Promise<RadioStation> {
  return invokeDesktop<RadioStation>("mark_radio_station_played", { stationId });
}

export function desktopFetchLovedTracks(limit = 100): Promise<LovedTrack[]> {
  return invokeDesktop<LovedTrack[]>("loved_tracks", { limit });
}

export function desktopUpdateTrackLove(trackId: number, loved: boolean, source = "local"): Promise<TrackLoveResponse> {
  return invokeDesktop<TrackLoveResponse>("update_track_love", { trackId, loved, source });
}

export function desktopUpdateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return invokeDesktop<Track>("update_track_rating", { trackId, rating });
}

export function desktopMarkTrackPlayed(trackId: number): Promise<Track> {
  return invokeDesktop<Track>("mark_track_played", { trackId });
}

export function desktopMarkTrackSkipped(trackId: number): Promise<Track> {
  return invokeDesktop<Track>("mark_track_skipped", { trackId });
}

export function desktopFetchAlbums(search = "", limit = 20000, offset = 0): Promise<AlbumSummary[]> {
  return invokeDesktop<AlbumSummary[]>("albums", { search, limit, offset });
}

export function desktopFetchArtists(search = "", limit = 20000, offset = 0): Promise<ArtistSummary[]> {
  return invokeDesktop<ArtistSummary[]>("artists", { search, limit, offset });
}

export function desktopFetchPlaylists(): Promise<PlaylistSummary[]> {
  return invokeDesktop<PlaylistSummary[]>("playlists");
}

export function desktopCreatePlaylist(name: string): Promise<PlaylistSummary> {
  return invokeDesktop<PlaylistSummary>("create_playlist", { name });
}

export function desktopDeletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return invokeDesktop<PlaylistSummary[]>("delete_playlist", { playlistId });
}

export function desktopFetchAlbumTracks(albumId: number): Promise<Track[]> {
  return invokeDesktop<Track[]>("album_tracks", { albumId });
}

export function desktopFetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return invokeDesktop<Track[]>("playlist_tracks", { playlistId });
}

export function desktopAddTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return invokeDesktop<Track[]>("add_playlist_tracks", { playlistId, trackIds });
}

export function desktopRemoveTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return invokeDesktop<Track[]>("remove_playlist_track", { playlistId, trackId });
}

export function desktopMoveTrackInPlaylist(
  playlistId: number,
  trackId: number,
  direction: "up" | "down",
): Promise<Track[]> {
  return invokeDesktop<Track[]>("move_playlist_track", { playlistId, trackId, direction });
}

export function desktopFetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return invokeDesktop<PlayEventEntry[]>("history", { limit });
}

export function desktopFetchHistoryStats(limit = 10): Promise<HistoryStatsResponse> {
  return invokeDesktop<HistoryStatsResponse>("history_stats", { limit });
}

export function desktopFetchLibraryStats(): Promise<LibraryStatsResponse> {
  return invokeDesktop<LibraryStatsResponse>("library_stats");
}

export function desktopFetchLibraryInbox(limit = 200, offset = 0): Promise<InboxResponse> {
  return invokeDesktop<InboxResponse>("inbox", { limit, offset });
}

export function desktopUpdateInboxNote(trackId: number, note: string | null): Promise<InboxTrackNote | null> {
  return invokeDesktop<InboxTrackNote | null>("update_inbox_note", { trackId, note });
}

export function desktopReviewInbox(trackIds: number[] | null, allNew = false): Promise<InboxReviewResponse> {
  return invokeDesktop<InboxReviewResponse>("review_inbox", {
    trackIds,
    allNew,
  });
}

export function desktopFetchInboxAutoReviewRules(): Promise<InboxAutoReviewRule[]> {
  return invokeDesktop<InboxAutoReviewRule[]>("inbox_auto_review_rules");
}

export function desktopCreateInboxAutoReviewRule(
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return invokeDesktop<InboxAutoReviewRuleApplyResponse>("create_inbox_auto_review_rule", {
    name: requestBody.name,
    enabled: requestBody.enabled,
    field: requestBody.field,
    matchType: requestBody.match_type,
    value: requestBody.value,
    note: requestBody.note ?? null,
    applyExisting: requestBody.apply_existing ?? false,
  });
}

export function desktopUpdateInboxAutoReviewRule(
  ruleId: number,
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return invokeDesktop<InboxAutoReviewRuleApplyResponse>("update_inbox_auto_review_rule", {
    ruleId,
    name: requestBody.name,
    enabled: requestBody.enabled,
    field: requestBody.field,
    matchType: requestBody.match_type,
    value: requestBody.value,
    note: requestBody.note ?? null,
    applyExisting: requestBody.apply_existing ?? false,
  });
}

export function desktopDeleteInboxAutoReviewRule(ruleId: number): Promise<InboxAutoReviewRuleDeleteResponse> {
  return invokeDesktop<InboxAutoReviewRuleDeleteResponse>("delete_inbox_auto_review_rule", { ruleId });
}

export function desktopFetchRegexTagPresets(): Promise<RegexTagPreset[]> {
  return invokeDesktop<RegexTagPreset[]>("regex_tag_presets");
}

export function desktopSaveRegexTagPreset(requestBody: RegexTagPresetRequest): Promise<RegexTagPreset> {
  return invokeDesktop<RegexTagPreset>("save_regex_tag_preset", {
    name: requestBody.name,
    field: requestBody.field,
    pattern: requestBody.pattern,
    replacement: requestBody.replacement,
    caseSensitive: requestBody.case_sensitive ?? false,
  });
}

export function desktopDeleteRegexTagPreset(presetId: number): Promise<{ deleted: boolean }> {
  return invokeDesktop<{ deleted: boolean }>("delete_regex_tag_preset", { presetId });
}

export function desktopFetchVirtualTags(): Promise<VirtualTagDefinition[]> {
  return invokeDesktop<VirtualTagDefinition[]>("virtual_tags");
}

export function desktopSaveVirtualTag(requestBody: VirtualTagDefinitionRequest): Promise<VirtualTagDefinition> {
  return invokeDesktop<VirtualTagDefinition>("save_virtual_tag", {
    name: requestBody.name,
    expression: requestBody.expression,
  });
}

export function desktopDeleteVirtualTag(definitionId: number): Promise<{ deleted: boolean }> {
  return invokeDesktop<{ deleted: boolean }>("delete_virtual_tag", { definitionId });
}

export function desktopInferFilenameTags(
  requestBody: FilenameTagInferenceRequest,
): Promise<FilenameTagInferenceResponse> {
  return invokeDesktop<FilenameTagInferenceResponse>("infer_filename_tags", {
    pattern: requestBody.pattern,
    trackIds: requestBody.track_ids ?? null,
    missingOnly: requestBody.missing_only ?? true,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function desktopCustomTags(requestBody: CustomTagBatchRequest): Promise<CustomTagBatchResponse> {
  return invokeDesktop<CustomTagBatchResponse>("custom_tags", {
    action: requestBody.action ?? "set",
    tagKey: requestBody.tag_key,
    value: requestBody.value ?? null,
    trackIds: requestBody.track_ids ?? null,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function desktopVirtualTagPreview(requestBody: VirtualTagPreviewRequest): Promise<VirtualTagPreviewResponse> {
  return invokeDesktop<VirtualTagPreviewResponse>("virtual_tag_preview", {
    expression: requestBody.expression,
    trackIds: requestBody.track_ids ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function desktopCopySwapTags(requestBody: TagFieldCopySwapRequest): Promise<TagFieldCopySwapResponse> {
  return invokeDesktop<TagFieldCopySwapResponse>("copy_swap_tags", {
    action: requestBody.action ?? "copy",
    sourceField: requestBody.source_field,
    targetField: requestBody.target_field,
    trackIds: requestBody.track_ids ?? null,
    missingOnly: requestBody.missing_only ?? false,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function desktopRegexTags(requestBody: TagRegexReplaceRequest): Promise<TagRegexReplaceResponse> {
  return invokeDesktop<TagRegexReplaceResponse>("regex_tags", {
    field: requestBody.field,
    pattern: requestBody.pattern,
    replacement: requestBody.replacement,
    caseSensitive: requestBody.case_sensitive ?? false,
    trackIds: requestBody.track_ids ?? null,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function desktopFetchDeviceSyncProfiles(): Promise<DeviceSyncProfilesResponse> {
  return invokeDesktop<DeviceSyncProfilesResponse>("device_sync_profiles");
}

export function desktopSaveDeviceSyncProfile(
  requestBody: DeviceSyncProfilePayload,
  profileId?: number | null,
): Promise<DeviceSyncProfile> {
  return invokeDesktop<DeviceSyncProfile>("save_device_sync_profile", {
    profileId: profileId ?? null,
    name: requestBody.name,
    targetFolder: requestBody.target_folder ?? "",
    deviceKind: requestBody.device_kind ?? "folder",
    musicSubfolder: requestBody.music_subfolder ?? "Music",
    playlistSubfolder: requestBody.playlist_subfolder ?? "Playlists",
    playlistIds: requestBody.playlist_ids ?? [],
    playlistRules: requestBody.playlist_rules ?? {},
    copyFiles: requestBody.copy_files ?? true,
    exportPlaylists: requestBody.export_playlists ?? true,
    preserveStructure: requestBody.preserve_structure ?? true,
  });
}

export function desktopDeleteDeviceSyncProfile(profileId: number): Promise<{ deleted: boolean }> {
  return invokeDesktop<{ deleted: boolean }>("delete_device_sync_profile", { profileId });
}

export function desktopClearLibraryCaches(targets: CacheClearTarget[]): Promise<CacheClearResponse> {
  return invokeDesktop<CacheClearResponse>("clear_library_caches", { targets });
}

export function desktopFetchBulkUndoLog(limit = 30): Promise<BulkUndoLogEntry[]> {
  return invokeDesktop<BulkUndoLogEntry[]>("bulk_undo_log", { limit });
}

export function desktopFetchBulkUndoBatches(limit = 30): Promise<BulkUndoBatchEntry[]> {
  return invokeDesktop<BulkUndoBatchEntry[]>("bulk_undo_batches", { limit });
}

export function desktopRestoreBulkUndoEntry(entryId: number): Promise<BulkUndoRestoreResponse> {
  return invokeDesktop<BulkUndoRestoreResponse>("restore_bulk_undo_entry", { entryId });
}

export function desktopRestoreBulkUndoBatch(batchId: string): Promise<BulkUndoRestoreResponse> {
  return invokeDesktop<BulkUndoRestoreResponse>("restore_bulk_undo_batch", { batchId });
}

export function desktopFetchLibraryHealth(limit = 300): Promise<LibraryHealthResponse> {
  return invokeDesktop<LibraryHealthResponse>("library_health", { limit });
}

export function desktopGenerateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return invokeDesktop<AutoDjResponse>("generate_autodj", { settings });
}

export function desktopRecordRecommendationFeedback(requestBody: {
  track_id: number;
  event_type: "play_next" | "add_to_queue" | "manual_play";
  weight?: number;
}): Promise<{ status: string }> {
  return invokeDesktop<{ status: string }>("record_recommendation_feedback", {
    trackId: requestBody.track_id,
    eventType: requestBody.event_type,
    weight: requestBody.weight ?? null,
  });
}

export function desktopFetchRecommendationProfiles(): Promise<RecommendationProfile[]> {
  return invokeDesktop<RecommendationProfile[]>("recommendation_profiles");
}

export function desktopFetchRecommendationHistory(limit = 30): Promise<RecommendationRun[]> {
  return invokeDesktop<RecommendationRun[]>("recommendation_history", { limit });
}

export function desktopCompareRecommendationProfiles(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparison[]> {
  return invokeDesktop<RecommendationProfileComparison[]>("compare_recommendation_profiles", {
    profileIds: requestBody.profile_ids ?? null,
    seedTrackId: requestBody.seed_track_id ?? null,
    seed: requestBody.seed ?? null,
  });
}

export function desktopExportRecommendationProfileComparison(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparisonExportResponse> {
  return invokeDesktop<RecommendationProfileComparisonExportResponse>(
    "export_recommendation_profile_comparison",
    {
      profileIds: requestBody.profile_ids ?? null,
      seedTrackId: requestBody.seed_track_id ?? null,
      seed: requestBody.seed ?? null,
    },
  );
}

export function desktopImportRecommendationProfileComparison(
  reportPath: string,
): Promise<RecommendationProfileComparisonImportResponse> {
  return invokeDesktop<RecommendationProfileComparisonImportResponse>(
    "import_recommendation_profile_comparison",
    { reportPath },
  );
}

export function desktopCreateRecommendationAbTest(requestBody: {
  base_settings: AutoDjSettings;
  challenger_settings?: AutoDjSettings | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationAbTestResponse> {
  return invokeDesktop<RecommendationAbTestResponse>("create_recommendation_ab_test", {
    baseSettings: requestBody.base_settings,
    challengerSettingsJson: requestBody.challenger_settings ?? null,
    seedTrackId: requestBody.seed_track_id ?? null,
    seed: requestBody.seed ?? null,
  });
}

export function desktopChooseRecommendationAbTest(requestBody: {
  test_id?: string | null;
  chosen_label: "A" | "B";
  chosen_track_ids: number[];
  rejected_track_ids?: number[];
  feedback_weight?: number;
}): Promise<RecommendationAbChoiceResponse> {
  return invokeDesktop<RecommendationAbChoiceResponse>("choose_recommendation_ab_test", {
    chosenLabel: requestBody.chosen_label,
    chosenTrackIds: requestBody.chosen_track_ids,
    feedbackWeight: requestBody.feedback_weight ?? null,
  });
}

export function desktopSaveRecommendationProfile(
  requestBody: { name: string; settings: AutoDjSettings; is_default?: boolean },
  profileId?: number | null,
): Promise<RecommendationProfile> {
  return invokeDesktop<RecommendationProfile>("save_recommendation_profile", {
    profileId: profileId ?? null,
    name: requestBody.name,
    settings: requestBody.settings,
    isDefault: requestBody.is_default ?? false,
  });
}

export function desktopSetDefaultRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return invokeDesktop<RecommendationProfile[]>("set_default_recommendation_profile", { profileId });
}

export function desktopDeleteRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return invokeDesktop<RecommendationProfile[]>("delete_recommendation_profile", { profileId });
}

export function desktopFetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return invokeDesktop<AutoDjAvoidRule[]>("autodj_avoid_rules");
}

export function desktopCreateAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return invokeDesktop<AutoDjAvoidRule>("create_autodj_avoid_rule", {
    scope: requestBody.scope,
    trackId: requestBody.track_id ?? null,
    value: requestBody.value ?? null,
  });
}

export function desktopDeleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return invokeDesktop<AutoDjAvoidRule[]>("delete_autodj_avoid_rule", { ruleId });
}

export function desktopLibraryReconcilePreview({
  paths,
  extensions,
  sampleLimit = 25,
}: {
  paths: string[];
  extensions?: string[] | null;
  sampleLimit?: number;
}): Promise<desktopLibraryReconcilePreview> {
  return invokeDesktop<desktopLibraryReconcilePreview>("library_reconcile_preview", {
    paths,
    extensions: extensions ?? null,
    sampleLimit,
  });
}

export function desktopFileOrganizationPreview(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
  return invokeDesktop<FileOrganizationResponse>("file_organization_preview", {
    template: requestBody.template,
    baseFolder: requestBody.base_folder ?? null,
    trackIds: requestBody.track_ids ?? null,
    collisionStrategy: requestBody.collision_strategy ?? null,
    cleanupEmptyFolders: requestBody.cleanup_empty_folders ?? false,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function desktopParsePlaylist(playlistPath: string): Promise<desktopPlaylistParseResponse> {
  return invokeDesktop<desktopPlaylistParseResponse>("parse_playlist", { playlistPath });
}

export function desktopExportM3u(playlistPath: string, trackPaths: string[]): Promise<ExportResponse> {
  return invokeDesktop<ExportResponse>("export_m3u", { playlistPath, trackPaths });
}

export function desktopVolumeTagsPreview(requestBody: VolumeTagRequest): Promise<VolumeTagResponse> {
  return invokeDesktop<VolumeTagResponse>("volume_tags_preview", {
    trackIds: requestBody.track_ids ?? null,
    mode: requestBody.mode ?? "analyze",
    writeToFile: requestBody.write_to_file ?? null,
    manualTrackGainDb: requestBody.manual_track_gain_db ?? null,
    manualTrackPeak: requestBody.manual_track_peak ?? null,
    manualAlbumGainDb: requestBody.manual_album_gain_db ?? null,
    manualAlbumPeak: requestBody.manual_album_peak ?? null,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function desktopBulkFileMovePreview(
  moves: Array<[string, string]>,
  apply = false,
): Promise<desktopBulkFileMoveResponse> {
  return invokeDesktop<desktopBulkFileMoveResponse>("bulk_file_move_preview", { moves, apply });
}

export function desktopGaplessValidate(requestBody: GaplessValidationRequest): Promise<GaplessValidationResponse> {
  return invokeDesktop<GaplessValidationResponse>("gapless_validate", {
    trackIds: requestBody.track_ids ?? null,
    albumId: requestBody.album_id ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function desktopFetchPodcastSubscriptions(): Promise<PodcastSubscription[]> {
  return invokeDesktop<PodcastSubscription[]>("podcast_subscriptions");
}

export function desktopSavePodcastSubscription(
  requestBody: PodcastSubscriptionPayload,
  subscriptionId?: number | null,
): Promise<PodcastSubscription> {
  return invokeDesktop<PodcastSubscription>("save_podcast_subscription", {
    subscriptionId: subscriptionId ?? null,
    title: requestBody.title ?? null,
    feedUrl: requestBody.feed_url,
    siteUrl: requestBody.site_url ?? null,
    description: requestBody.description ?? null,
    autoDownload: requestBody.auto_download ?? false,
    downloadFolder: requestBody.download_folder ?? null,
  });
}

export function desktopDeletePodcastSubscription(
  subscriptionId: number,
  deleteFiles = false,
): Promise<PodcastSubscriptionDeleteResponse> {
  return invokeDesktop<PodcastSubscriptionDeleteResponse>("delete_podcast_subscription", {
    subscriptionId,
    deleteFiles,
  });
}

export function desktopEnsurePodcastSubscriptionFolder(subscriptionId: number): Promise<PodcastFolderResponse> {
  return invokeDesktop<PodcastFolderResponse>("podcast_subscription_folder", { subscriptionId });
}

export function desktopFetchPodcastEpisodes(subscriptionId?: number | null, limit = 200): Promise<PodcastEpisode[]> {
  return invokeDesktop<PodcastEpisode[]>("podcast_episodes", {
    subscriptionId: subscriptionId ?? null,
    limit,
  });
}

export function desktopFetchScrobbleAccounts(): Promise<ScrobbleAccount[]> {
  return invokeDesktop<ScrobbleAccount[]>("scrobble_accounts");
}

export function desktopSaveScrobbleAccount(
  service: ScrobbleService,
  requestBody: ScrobbleAccountRequest,
): Promise<ScrobbleAccount> {
  return invokeDesktop<ScrobbleAccount>("save_scrobble_account", {
    service,
    enabled: requestBody.enabled ?? null,
    username: requestBody.username ?? null,
    usernameSet: Object.prototype.hasOwnProperty.call(requestBody, "username"),
    token: requestBody.token ?? null,
    tokenSet: Object.prototype.hasOwnProperty.call(requestBody, "token"),
    apiKey: requestBody.api_key ?? null,
    apiKeySet: Object.prototype.hasOwnProperty.call(requestBody, "api_key"),
    apiSecret: requestBody.api_secret ?? null,
    apiSecretSet: Object.prototype.hasOwnProperty.call(requestBody, "api_secret"),
    sessionKey: requestBody.session_key ?? null,
    sessionKeySet: Object.prototype.hasOwnProperty.call(requestBody, "session_key"),
  });
}

export function desktopFetchScrobbleOutbox(limit = 100): Promise<ScrobbleOutboxEntry[]> {
  return invokeDesktop<ScrobbleOutboxEntry[]>("scrobble_outbox", { limit });
}

export function desktopQueueScrobbleHistory(
  service: ScrobbleService,
  limit = 100,
): Promise<ScrobbleQueueHistoryResponse> {
  return invokeDesktop<ScrobbleQueueHistoryResponse>("queue_scrobble_history", { service, limit });
}

export function desktopFetchDuplicateReview(requestBody: DuplicateReviewRequest): Promise<DuplicateReviewResponse> {
  return invokeDesktop<DuplicateReviewResponse>("duplicate_review", {
    trackIds: requestBody.track_ids ?? null,
    groups: requestBody.groups ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function desktopFetchArtistInfo(artistName: string, refresh = false): Promise<ArtistInfoResponse> {
  return invokeDesktop<ArtistInfoResponse>("artist_info", { name: artistName, refresh });
}

export function desktopSaveArtistInfoOverride(
  artistName: string,
  wikipediaTitleOrUrl: string,
): Promise<ArtistInfoResponse> {
  return invokeDesktop<ArtistInfoResponse>("save_artist_info_override", {
    name: artistName,
    wikipediaTitleOrUrl,
  });
}

export function desktopFetchArtistLocalTracks(artistName: string, limit = 100): Promise<Track[]> {
  return invokeDesktop<Track[]>("artist_local_tracks", { name: artistName, limit });
}

export function desktopClearArtistCache(): Promise<{ deleted: number }> {
  return invokeDesktop<{ deleted: number }>("clear_artist_cache");
}

export function desktopFetchAudioConversionSetup(): Promise<AudioConversionSetupResponse> {
  return invokeDesktop<AudioConversionSetupResponse>("audio_conversion_setup");
}

export function desktopSaveAudioConversionSetup(
  requestBody: AudioConversionSetupRequest,
): Promise<AudioConversionSetupResponse> {
  return invokeDesktop<AudioConversionSetupResponse>("save_audio_conversion_setup", {
    ffmpegPath: requestBody.ffmpeg_path ?? null,
  });
}

export function desktopFetchChromaprintSetup(): Promise<ChromaprintStatusResponse> {
  return invokeDesktop<ChromaprintStatusResponse>("chromaprint_setup");
}

export function desktopSaveChromaprintSetup(
  requestBody: ChromaprintConfigRequest,
): Promise<ChromaprintStatusResponse> {
  return invokeDesktop<ChromaprintStatusResponse>("save_chromaprint_setup", {
    fpcalcPath: requestBody.fpcalc_path ?? null,
  });
}

export function desktopBackendJson<T>(
  method: string,
  path: string,
  body?: unknown,
  baseUrl?: string,
): Promise<T> {
  return invokeDesktop<T>("backend_json", {
    method,
    path,
    body: body ?? null,
    baseUrl: baseUrl ?? null,
  });
}

export function desktopFetchLyrics(trackId: number): Promise<LyricsResponse> {
  return invokeDesktop<LyricsResponse>("track_lyrics_direct", { trackId });
}

export function desktopFetchLyricsOnline(trackId: number): Promise<LyricsResponse> {
  return invokeDesktop<LyricsResponse>("fetch_track_lyrics_direct", { trackId });
}

export function desktopFetchLyricsByMetadata(
  requestBody: LyricsLookupRequest,
): Promise<LyricsResponse> {
  return invokeDesktop<LyricsResponse>("lookup_lyrics_by_metadata_direct", {
    body: requestBody,
  });
}

export function desktopUpdateLyrics(
  trackId: number,
  requestBody: LyricsUpdateRequest,
): Promise<LyricsResponse> {
  return invokeDesktop<LyricsResponse>("update_track_lyrics_direct", {
    trackId,
    lyrics: requestBody.lyrics ?? null,
    isSynced: requestBody.is_synced ?? null,
    target: requestBody.target ?? null,
    source: requestBody.source ?? null,
  });
}

export function desktopStartBulkLyricsLookup(
  includeOnline = true,
  onlyMissing = true,
  limit?: number | null,
  saveLocation: BulkLyricsSaveLocation = "sidecar",
): Promise<BulkLyricsStartResponse> {
  return invokeDesktop<BulkLyricsStartResponse>("start_bulk_lyrics_lookup_direct", {
    includeOnline,
    onlyMissing,
    limit: limit ?? null,
    saveLocation,
  });
}

export function desktopFetchBulkLyricsLookupProgress(jobId: string): Promise<BulkLyricsProgress> {
  return invokeDesktop<BulkLyricsProgress>("bulk_lyrics_lookup_progress_direct", { jobId });
}

export function desktopCancelBulkLyricsLookup(jobId: string): Promise<BulkLyricsProgress> {
  return invokeDesktop<BulkLyricsProgress>("cancel_bulk_lyrics_lookup_direct", { jobId });
}
