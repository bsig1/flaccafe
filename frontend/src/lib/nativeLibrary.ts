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

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export interface NativeTrackPage extends TrackPage {
  source: "rust-sqlite" | string;
}

export interface NativeLibraryReconcilePreview {
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

export interface NativePlaylistParseResponse {
  playlist_path: string;
  base_folder: string;
  entries: string[];
  local_paths: string[];
  errors: string[];
}

export interface NativeBulkFileMove {
  source_path: string;
  target_path: string;
  changed: boolean;
  applied: boolean;
  error: string | null;
}

export interface NativeBulkFileMoveResponse {
  total: number;
  changed: number;
  applied: number;
  moves: NativeBulkFileMove[];
}

export function nativeFetchTrackPage({
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
}): Promise<NativeTrackPage> {
  return invokeNative<NativeTrackPage>("native_tracks_page", {
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

export function nativeFetchClapCoverage(): Promise<AudioAnalysisCoverage> {
  return invokeNative<AudioAnalysisCoverage>("native_clap_coverage");
}

export function nativeFetchBackendHealth(): Promise<{ status: string }> {
  return invokeNative<{ status: string }>("native_health");
}

export function nativeFetchSettings(): Promise<SettingsResponse> {
  return invokeNative<SettingsResponse>("native_settings");
}

export function nativeUpdateSettings(settings: SettingsUpdateRequest): Promise<SettingsResponse> {
  return invokeNative<SettingsResponse>("native_update_settings", {
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

export function nativeRemoveLibrarySource(path: string): Promise<LibrarySourceRemoveResponse> {
  return invokeNative<LibrarySourceRemoveResponse>("native_remove_library_source", { path });
}

export function nativeFetchTrack(trackId: number): Promise<Track> {
  return invokeNative<Track>("native_track", { trackId });
}

export function nativeFetchTracksBatch(trackIds: number[]): Promise<TrackBatchResponse> {
  return invokeNative<TrackBatchResponse>("native_tracks_batch", { trackIds });
}

export function nativeFetchSimilarTracks(trackId: number, limit = 12): Promise<SimilarTrack[]> {
  return invokeNative<SimilarTrack[]>("native_similar_tracks", { trackId, limit });
}

export function nativeFetchAudiobooks(limit = 200, offset = 0): Promise<AudiobookListResponse> {
  return invokeNative<AudiobookListResponse>("native_audiobooks", { limit, offset });
}

export function nativeUpdateAudiobookProgress(
  trackId: number,
  requestBody: AudiobookProgressRequest,
): Promise<AudiobookProgressResponse> {
  return invokeNative<AudiobookProgressResponse>("native_update_audiobook_progress", {
    trackId,
    positionSeconds: requestBody.position_seconds,
    durationSeconds: requestBody.duration_seconds ?? null,
  });
}

export function nativeFetchAudiobookBookmarks(trackId: number): Promise<AudiobookBookmark[]> {
  return invokeNative<AudiobookBookmark[]>("native_audiobook_bookmarks", { trackId });
}

export function nativeCreateAudiobookBookmark(
  trackId: number,
  requestBody: AudiobookBookmarkRequest,
): Promise<AudiobookBookmark> {
  return invokeNative<AudiobookBookmark>("native_create_audiobook_bookmark", {
    trackId,
    positionSeconds: requestBody.position_seconds,
    label: requestBody.label ?? null,
    note: requestBody.note ?? null,
  });
}

export function nativeDeleteAudiobookBookmark(bookmarkId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_audiobook_bookmark", { bookmarkId });
}

export function nativeFetchAudiobookChapters(trackId: number): Promise<AudiobookChapter[]> {
  return invokeNative<AudiobookChapter[]>("native_audiobook_chapters", { trackId });
}

export function nativeSaveAudiobookChapters(trackId: number, chapters: AudiobookChapter[]): Promise<AudiobookChapter[]> {
  return invokeNative<AudiobookChapter[]>("native_save_audiobook_chapters", { trackId, chapters });
}

export function nativeFetchRadioStations(): Promise<RadioStation[]> {
  return invokeNative<RadioStation[]>("native_radio_stations");
}

export function nativeSaveRadioStation(
  requestBody: RadioStationPayload,
  stationId?: number | null,
): Promise<RadioStation> {
  return invokeNative<RadioStation>("native_save_radio_station", {
    stationId: stationId ?? null,
    name: requestBody.name,
    streamUrl: requestBody.stream_url,
    homepageUrl: requestBody.homepage_url ?? null,
    genre: requestBody.genre ?? null,
    notes: requestBody.notes ?? null,
  });
}

export function nativeDeleteRadioStation(stationId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_radio_station", { stationId });
}

export function nativeMarkRadioStationPlayed(stationId: number): Promise<RadioStation> {
  return invokeNative<RadioStation>("native_mark_radio_station_played", { stationId });
}

export function nativeFetchLovedTracks(limit = 100): Promise<LovedTrack[]> {
  return invokeNative<LovedTrack[]>("native_loved_tracks", { limit });
}

export function nativeUpdateTrackLove(trackId: number, loved: boolean, source = "local"): Promise<TrackLoveResponse> {
  return invokeNative<TrackLoveResponse>("native_update_track_love", { trackId, loved, source });
}

export function nativeUpdateTrackRating(trackId: number, rating: number | null): Promise<Track> {
  return invokeNative<Track>("native_update_track_rating", { trackId, rating });
}

export function nativeMarkTrackPlayed(trackId: number): Promise<Track> {
  return invokeNative<Track>("native_mark_track_played", { trackId });
}

export function nativeMarkTrackSkipped(trackId: number): Promise<Track> {
  return invokeNative<Track>("native_mark_track_skipped", { trackId });
}

export function nativeFetchAlbums(search = "", limit = 20000, offset = 0): Promise<AlbumSummary[]> {
  return invokeNative<AlbumSummary[]>("native_albums", { search, limit, offset });
}

export function nativeFetchArtists(search = "", limit = 20000, offset = 0): Promise<ArtistSummary[]> {
  return invokeNative<ArtistSummary[]>("native_artists", { search, limit, offset });
}

export function nativeFetchPlaylists(): Promise<PlaylistSummary[]> {
  return invokeNative<PlaylistSummary[]>("native_playlists");
}

export function nativeCreatePlaylist(name: string): Promise<PlaylistSummary> {
  return invokeNative<PlaylistSummary>("native_create_playlist", { name });
}

export function nativeDeletePlaylist(playlistId: number): Promise<PlaylistSummary[]> {
  return invokeNative<PlaylistSummary[]>("native_delete_playlist", { playlistId });
}

export function nativeFetchAlbumTracks(albumId: number): Promise<Track[]> {
  return invokeNative<Track[]>("native_album_tracks", { albumId });
}

export function nativeFetchPlaylistTracks(playlistId: number): Promise<Track[]> {
  return invokeNative<Track[]>("native_playlist_tracks", { playlistId });
}

export function nativeAddTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<Track[]> {
  return invokeNative<Track[]>("native_add_playlist_tracks", { playlistId, trackIds });
}

export function nativeRemoveTrackFromPlaylist(playlistId: number, trackId: number): Promise<Track[]> {
  return invokeNative<Track[]>("native_remove_playlist_track", { playlistId, trackId });
}

export function nativeMoveTrackInPlaylist(
  playlistId: number,
  trackId: number,
  direction: "up" | "down",
): Promise<Track[]> {
  return invokeNative<Track[]>("native_move_playlist_track", { playlistId, trackId, direction });
}

export function nativeFetchHistory(limit = 200): Promise<PlayEventEntry[]> {
  return invokeNative<PlayEventEntry[]>("native_history", { limit });
}

export function nativeFetchHistoryStats(limit = 10): Promise<HistoryStatsResponse> {
  return invokeNative<HistoryStatsResponse>("native_history_stats", { limit });
}

export function nativeFetchLibraryStats(): Promise<LibraryStatsResponse> {
  return invokeNative<LibraryStatsResponse>("native_library_stats");
}

export function nativeFetchLibraryInbox(limit = 200, offset = 0): Promise<InboxResponse> {
  return invokeNative<InboxResponse>("native_inbox", { limit, offset });
}

export function nativeUpdateInboxNote(trackId: number, note: string | null): Promise<InboxTrackNote | null> {
  return invokeNative<InboxTrackNote | null>("native_update_inbox_note", { trackId, note });
}

export function nativeReviewInbox(trackIds: number[] | null, allNew = false): Promise<InboxReviewResponse> {
  return invokeNative<InboxReviewResponse>("native_review_inbox", {
    trackIds,
    allNew,
  });
}

export function nativeFetchInboxAutoReviewRules(): Promise<InboxAutoReviewRule[]> {
  return invokeNative<InboxAutoReviewRule[]>("native_inbox_auto_review_rules");
}

export function nativeCreateInboxAutoReviewRule(
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return invokeNative<InboxAutoReviewRuleApplyResponse>("native_create_inbox_auto_review_rule", {
    name: requestBody.name,
    enabled: requestBody.enabled,
    field: requestBody.field,
    matchType: requestBody.match_type,
    value: requestBody.value,
    note: requestBody.note ?? null,
    applyExisting: requestBody.apply_existing ?? false,
  });
}

export function nativeUpdateInboxAutoReviewRule(
  ruleId: number,
  requestBody: InboxAutoReviewRuleRequest,
): Promise<InboxAutoReviewRuleApplyResponse> {
  return invokeNative<InboxAutoReviewRuleApplyResponse>("native_update_inbox_auto_review_rule", {
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

export function nativeDeleteInboxAutoReviewRule(ruleId: number): Promise<InboxAutoReviewRuleDeleteResponse> {
  return invokeNative<InboxAutoReviewRuleDeleteResponse>("native_delete_inbox_auto_review_rule", { ruleId });
}

export function nativeFetchRegexTagPresets(): Promise<RegexTagPreset[]> {
  return invokeNative<RegexTagPreset[]>("native_regex_tag_presets");
}

export function nativeSaveRegexTagPreset(requestBody: RegexTagPresetRequest): Promise<RegexTagPreset> {
  return invokeNative<RegexTagPreset>("native_save_regex_tag_preset", {
    name: requestBody.name,
    field: requestBody.field,
    pattern: requestBody.pattern,
    replacement: requestBody.replacement,
    caseSensitive: requestBody.case_sensitive ?? false,
  });
}

export function nativeDeleteRegexTagPreset(presetId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_regex_tag_preset", { presetId });
}

export function nativeFetchVirtualTags(): Promise<VirtualTagDefinition[]> {
  return invokeNative<VirtualTagDefinition[]>("native_virtual_tags");
}

export function nativeSaveVirtualTag(requestBody: VirtualTagDefinitionRequest): Promise<VirtualTagDefinition> {
  return invokeNative<VirtualTagDefinition>("native_save_virtual_tag", {
    name: requestBody.name,
    expression: requestBody.expression,
  });
}

export function nativeDeleteVirtualTag(definitionId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_virtual_tag", { definitionId });
}

export function nativeInferFilenameTags(
  requestBody: FilenameTagInferenceRequest,
): Promise<FilenameTagInferenceResponse> {
  return invokeNative<FilenameTagInferenceResponse>("native_infer_filename_tags", {
    pattern: requestBody.pattern,
    trackIds: requestBody.track_ids ?? null,
    missingOnly: requestBody.missing_only ?? true,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeCustomTags(requestBody: CustomTagBatchRequest): Promise<CustomTagBatchResponse> {
  return invokeNative<CustomTagBatchResponse>("native_custom_tags", {
    action: requestBody.action ?? "set",
    tagKey: requestBody.tag_key,
    value: requestBody.value ?? null,
    trackIds: requestBody.track_ids ?? null,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeVirtualTagPreview(requestBody: VirtualTagPreviewRequest): Promise<VirtualTagPreviewResponse> {
  return invokeNative<VirtualTagPreviewResponse>("native_virtual_tag_preview", {
    expression: requestBody.expression,
    trackIds: requestBody.track_ids ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function nativeCopySwapTags(requestBody: TagFieldCopySwapRequest): Promise<TagFieldCopySwapResponse> {
  return invokeNative<TagFieldCopySwapResponse>("native_copy_swap_tags", {
    action: requestBody.action ?? "copy",
    sourceField: requestBody.source_field,
    targetField: requestBody.target_field,
    trackIds: requestBody.track_ids ?? null,
    missingOnly: requestBody.missing_only ?? false,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeRegexTags(requestBody: TagRegexReplaceRequest): Promise<TagRegexReplaceResponse> {
  return invokeNative<TagRegexReplaceResponse>("native_regex_tags", {
    field: requestBody.field,
    pattern: requestBody.pattern,
    replacement: requestBody.replacement,
    caseSensitive: requestBody.case_sensitive ?? false,
    trackIds: requestBody.track_ids ?? null,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeFetchDeviceSyncProfiles(): Promise<DeviceSyncProfilesResponse> {
  return invokeNative<DeviceSyncProfilesResponse>("native_device_sync_profiles");
}

export function nativeSaveDeviceSyncProfile(
  requestBody: DeviceSyncProfilePayload,
  profileId?: number | null,
): Promise<DeviceSyncProfile> {
  return invokeNative<DeviceSyncProfile>("native_save_device_sync_profile", {
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

export function nativeDeleteDeviceSyncProfile(profileId: number): Promise<{ deleted: boolean }> {
  return invokeNative<{ deleted: boolean }>("native_delete_device_sync_profile", { profileId });
}

export function nativeClearLibraryCaches(targets: CacheClearTarget[]): Promise<CacheClearResponse> {
  return invokeNative<CacheClearResponse>("native_clear_library_caches", { targets });
}

export function nativeFetchBulkUndoLog(limit = 30): Promise<BulkUndoLogEntry[]> {
  return invokeNative<BulkUndoLogEntry[]>("native_bulk_undo_log", { limit });
}

export function nativeFetchBulkUndoBatches(limit = 30): Promise<BulkUndoBatchEntry[]> {
  return invokeNative<BulkUndoBatchEntry[]>("native_bulk_undo_batches", { limit });
}

export function nativeRestoreBulkUndoEntry(entryId: number): Promise<BulkUndoRestoreResponse> {
  return invokeNative<BulkUndoRestoreResponse>("native_restore_bulk_undo_entry", { entryId });
}

export function nativeRestoreBulkUndoBatch(batchId: string): Promise<BulkUndoRestoreResponse> {
  return invokeNative<BulkUndoRestoreResponse>("native_restore_bulk_undo_batch", { batchId });
}

export function nativeFetchLibraryHealth(limit = 300): Promise<LibraryHealthResponse> {
  return invokeNative<LibraryHealthResponse>("native_library_health", { limit });
}

export function nativeGenerateAutoDj(settings: AutoDjSettings): Promise<AutoDjResponse> {
  return invokeNative<AutoDjResponse>("native_generate_autodj", { settings });
}

export function nativeRecordRecommendationFeedback(requestBody: {
  track_id: number;
  event_type: "play_next" | "add_to_queue" | "manual_play";
  weight?: number;
}): Promise<{ status: string }> {
  return invokeNative<{ status: string }>("native_record_recommendation_feedback", {
    trackId: requestBody.track_id,
    eventType: requestBody.event_type,
    weight: requestBody.weight ?? null,
  });
}

export function nativeFetchRecommendationProfiles(): Promise<RecommendationProfile[]> {
  return invokeNative<RecommendationProfile[]>("native_recommendation_profiles");
}

export function nativeFetchRecommendationHistory(limit = 30): Promise<RecommendationRun[]> {
  return invokeNative<RecommendationRun[]>("native_recommendation_history", { limit });
}

export function nativeCompareRecommendationProfiles(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparison[]> {
  return invokeNative<RecommendationProfileComparison[]>("native_compare_recommendation_profiles", {
    profileIds: requestBody.profile_ids ?? null,
    seedTrackId: requestBody.seed_track_id ?? null,
    seed: requestBody.seed ?? null,
  });
}

export function nativeExportRecommendationProfileComparison(requestBody: {
  profile_ids?: number[] | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationProfileComparisonExportResponse> {
  return invokeNative<RecommendationProfileComparisonExportResponse>(
    "native_export_recommendation_profile_comparison",
    {
      profileIds: requestBody.profile_ids ?? null,
      seedTrackId: requestBody.seed_track_id ?? null,
      seed: requestBody.seed ?? null,
    },
  );
}

export function nativeImportRecommendationProfileComparison(
  reportPath: string,
): Promise<RecommendationProfileComparisonImportResponse> {
  return invokeNative<RecommendationProfileComparisonImportResponse>(
    "native_import_recommendation_profile_comparison",
    { reportPath },
  );
}

export function nativeCreateRecommendationAbTest(requestBody: {
  base_settings: AutoDjSettings;
  challenger_settings?: AutoDjSettings | null;
  seed_track_id?: number | null;
  seed?: number | null;
}): Promise<RecommendationAbTestResponse> {
  return invokeNative<RecommendationAbTestResponse>("native_create_recommendation_ab_test", {
    baseSettings: requestBody.base_settings,
    challengerSettingsJson: requestBody.challenger_settings ?? null,
    seedTrackId: requestBody.seed_track_id ?? null,
    seed: requestBody.seed ?? null,
  });
}

export function nativeChooseRecommendationAbTest(requestBody: {
  test_id?: string | null;
  chosen_label: "A" | "B";
  chosen_track_ids: number[];
  rejected_track_ids?: number[];
  feedback_weight?: number;
}): Promise<RecommendationAbChoiceResponse> {
  return invokeNative<RecommendationAbChoiceResponse>("native_choose_recommendation_ab_test", {
    chosenLabel: requestBody.chosen_label,
    chosenTrackIds: requestBody.chosen_track_ids,
    feedbackWeight: requestBody.feedback_weight ?? null,
  });
}

export function nativeSaveRecommendationProfile(
  requestBody: { name: string; settings: AutoDjSettings; is_default?: boolean },
  profileId?: number | null,
): Promise<RecommendationProfile> {
  return invokeNative<RecommendationProfile>("native_save_recommendation_profile", {
    profileId: profileId ?? null,
    name: requestBody.name,
    settings: requestBody.settings,
    isDefault: requestBody.is_default ?? false,
  });
}

export function nativeSetDefaultRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return invokeNative<RecommendationProfile[]>("native_set_default_recommendation_profile", { profileId });
}

export function nativeDeleteRecommendationProfile(profileId: number): Promise<RecommendationProfile[]> {
  return invokeNative<RecommendationProfile[]>("native_delete_recommendation_profile", { profileId });
}

export function nativeFetchAutoDjAvoidRules(): Promise<AutoDjAvoidRule[]> {
  return invokeNative<AutoDjAvoidRule[]>("native_autodj_avoid_rules");
}

export function nativeCreateAutoDjAvoidRule(requestBody: {
  scope: "track" | "artist" | "album" | "genre";
  track_id?: number | null;
  value?: string | null;
}): Promise<AutoDjAvoidRule> {
  return invokeNative<AutoDjAvoidRule>("native_create_autodj_avoid_rule", {
    scope: requestBody.scope,
    trackId: requestBody.track_id ?? null,
    value: requestBody.value ?? null,
  });
}

export function nativeDeleteAutoDjAvoidRule(ruleId: number): Promise<AutoDjAvoidRule[]> {
  return invokeNative<AutoDjAvoidRule[]>("native_delete_autodj_avoid_rule", { ruleId });
}

export function nativeLibraryReconcilePreview({
  paths,
  extensions,
  sampleLimit = 25,
}: {
  paths: string[];
  extensions?: string[] | null;
  sampleLimit?: number;
}): Promise<NativeLibraryReconcilePreview> {
  return invokeNative<NativeLibraryReconcilePreview>("native_library_reconcile_preview", {
    paths,
    extensions: extensions ?? null,
    sampleLimit,
  });
}

export function nativeFileOrganizationPreview(requestBody: FileOrganizationRequest): Promise<FileOrganizationResponse> {
  return invokeNative<FileOrganizationResponse>("native_file_organization_preview", {
    template: requestBody.template,
    baseFolder: requestBody.base_folder ?? null,
    trackIds: requestBody.track_ids ?? null,
    collisionStrategy: requestBody.collision_strategy ?? null,
    cleanupEmptyFolders: requestBody.cleanup_empty_folders ?? false,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeParsePlaylist(playlistPath: string): Promise<NativePlaylistParseResponse> {
  return invokeNative<NativePlaylistParseResponse>("native_parse_playlist", { playlistPath });
}

export function nativeExportM3u(playlistPath: string, trackPaths: string[]): Promise<ExportResponse> {
  return invokeNative<ExportResponse>("native_export_m3u", { playlistPath, trackPaths });
}

export function nativeVolumeTagsPreview(requestBody: VolumeTagRequest): Promise<VolumeTagResponse> {
  return invokeNative<VolumeTagResponse>("native_volume_tags_preview", {
    trackIds: requestBody.track_ids ?? null,
    manualTrackGainDb: requestBody.manual_track_gain_db ?? null,
    manualTrackPeak: requestBody.manual_track_peak ?? null,
    manualAlbumGainDb: requestBody.manual_album_gain_db ?? null,
    manualAlbumPeak: requestBody.manual_album_peak ?? null,
    apply: requestBody.apply ?? false,
    limit: requestBody.limit ?? null,
  });
}

export function nativeBulkFileMovePreview(
  moves: Array<[string, string]>,
  apply = false,
): Promise<NativeBulkFileMoveResponse> {
  return invokeNative<NativeBulkFileMoveResponse>("native_bulk_file_move_preview", { moves, apply });
}

export function nativeGaplessValidate(requestBody: GaplessValidationRequest): Promise<GaplessValidationResponse> {
  return invokeNative<GaplessValidationResponse>("native_gapless_validate", {
    trackIds: requestBody.track_ids ?? null,
    albumId: requestBody.album_id ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function nativeFetchPodcastSubscriptions(): Promise<PodcastSubscription[]> {
  return invokeNative<PodcastSubscription[]>("native_podcast_subscriptions");
}

export function nativeSavePodcastSubscription(
  requestBody: PodcastSubscriptionPayload,
  subscriptionId?: number | null,
): Promise<PodcastSubscription> {
  return invokeNative<PodcastSubscription>("native_save_podcast_subscription", {
    subscriptionId: subscriptionId ?? null,
    title: requestBody.title ?? null,
    feedUrl: requestBody.feed_url,
    siteUrl: requestBody.site_url ?? null,
    description: requestBody.description ?? null,
    autoDownload: requestBody.auto_download ?? false,
    downloadFolder: requestBody.download_folder ?? null,
  });
}

export function nativeDeletePodcastSubscription(
  subscriptionId: number,
  deleteFiles = false,
): Promise<PodcastSubscriptionDeleteResponse> {
  return invokeNative<PodcastSubscriptionDeleteResponse>("native_delete_podcast_subscription", {
    subscriptionId,
    deleteFiles,
  });
}

export function nativeEnsurePodcastSubscriptionFolder(subscriptionId: number): Promise<PodcastFolderResponse> {
  return invokeNative<PodcastFolderResponse>("native_podcast_subscription_folder", { subscriptionId });
}

export function nativeFetchPodcastEpisodes(subscriptionId?: number | null, limit = 200): Promise<PodcastEpisode[]> {
  return invokeNative<PodcastEpisode[]>("native_podcast_episodes", {
    subscriptionId: subscriptionId ?? null,
    limit,
  });
}

export function nativeFetchScrobbleAccounts(): Promise<ScrobbleAccount[]> {
  return invokeNative<ScrobbleAccount[]>("native_scrobble_accounts");
}

export function nativeSaveScrobbleAccount(
  service: ScrobbleService,
  requestBody: ScrobbleAccountRequest,
): Promise<ScrobbleAccount> {
  return invokeNative<ScrobbleAccount>("native_save_scrobble_account", {
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

export function nativeFetchScrobbleOutbox(limit = 100): Promise<ScrobbleOutboxEntry[]> {
  return invokeNative<ScrobbleOutboxEntry[]>("native_scrobble_outbox", { limit });
}

export function nativeQueueScrobbleHistory(
  service: ScrobbleService,
  limit = 100,
): Promise<ScrobbleQueueHistoryResponse> {
  return invokeNative<ScrobbleQueueHistoryResponse>("native_queue_scrobble_history", { service, limit });
}

export function nativeFetchDuplicateReview(requestBody: DuplicateReviewRequest): Promise<DuplicateReviewResponse> {
  return invokeNative<DuplicateReviewResponse>("native_duplicate_review", {
    trackIds: requestBody.track_ids ?? null,
    groups: requestBody.groups ?? null,
    limit: requestBody.limit ?? null,
  });
}

export function nativeFetchArtistInfo(artistName: string, refresh = false): Promise<ArtistInfoResponse> {
  return invokeNative<ArtistInfoResponse>("native_artist_info", { name: artistName, refresh });
}

export function nativeFetchArtistLocalTracks(artistName: string, limit = 100): Promise<Track[]> {
  return invokeNative<Track[]>("native_artist_local_tracks", { name: artistName, limit });
}

export function nativeClearArtistCache(): Promise<{ deleted: number }> {
  return invokeNative<{ deleted: number }>("native_clear_artist_cache");
}

export function nativeFetchAudioConversionSetup(): Promise<AudioConversionSetupResponse> {
  return invokeNative<AudioConversionSetupResponse>("native_audio_conversion_setup");
}

export function nativeSaveAudioConversionSetup(
  requestBody: AudioConversionSetupRequest,
): Promise<AudioConversionSetupResponse> {
  return invokeNative<AudioConversionSetupResponse>("native_save_audio_conversion_setup", {
    ffmpegPath: requestBody.ffmpeg_path ?? null,
  });
}

export function nativeFetchChromaprintSetup(): Promise<ChromaprintStatusResponse> {
  return invokeNative<ChromaprintStatusResponse>("native_chromaprint_setup");
}

export function nativeSaveChromaprintSetup(
  requestBody: ChromaprintConfigRequest,
): Promise<ChromaprintStatusResponse> {
  return invokeNative<ChromaprintStatusResponse>("native_save_chromaprint_setup", {
    fpcalcPath: requestBody.fpcalc_path ?? null,
  });
}

export function nativeBackendJson<T>(
  method: string,
  path: string,
  body?: unknown,
  baseUrl?: string,
): Promise<T> {
  return invokeNative<T>("native_backend_json", {
    method,
    path,
    body: body ?? null,
    baseUrl: baseUrl ?? null,
  });
}
