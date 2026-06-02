import {
useEffect,
useMemo,
useRef,
useState,
} from "react";

import {
clapGenreTags,
deleteDeviceSyncProfile,
fetchAlbumTracks,
fetchAlbums,
fetchArtistLocalTracks,
fetchArtists,
fetchDeviceSyncDevices,
fetchDeviceSyncProfiles,
fetchTracks,
saveDeviceSyncProfile,
writeTrackMetadataToFiles,
} from "../../lib/api";
import type {
ClapGenreTagResponse,
DeviceSyncDetectedDevice,
DeviceSyncProfile,
DeviceSyncProfilePayload,
TrackFileMetadataWriteResponse
} from "../../types/api";
import type {
FileManagementCategory,
} from "./file-management/FileManagementNavigator";
import {
fileManagementSections,
filterFileManagementSections
} from "./file-management/FileManagementNavigator";
import type { FileManagementPageProps } from "./file-management/FileManagementPageTypes";
import { FileManagementPageView } from "./file-management/FileManagementPageView";
import type {
AutoTagProgressState,
CsvImportOptions,
CsvImportProfile,
LibraryTargetSearchResult,
FileOrganizationOptions,
} from "./file-management/fileManagementUtils";
import {
CSV_IMPORT_FIELDS,
DEFAULT_FILENAME_TAG_PATTERNS,
FILE_WRITE_PREVIEW_LIMIT,
currentScope,
formatJson,
parseDuplicateGroups,
parseTrackIds,
previewLabel,
readCsvProfiles,
readFilenameTagPresets,
writeCsvProfiles,
writeFilenameTagPresets,
} from "./file-management/fileManagementUtils";

export function FileManagementPage({
  initialFocusToolId,
  initialTrackScopeIds,
  onFocusToolConsumed,
  folderPath,
  playlists,
  onClearArtistCache,
  onClearLibraryCaches,
  filenameTagPreview,
  onPreviewFilenameTags,
  onApplyFilenameTags,
  tagRegexPreview,
  onPreviewTagRegex,
  onApplyTagRegex,
  autoTagPreview,
  onPreviewAutoTag,
  onApplyAutoTag,
  fileOrganizationPreview,
  fileOrganizationReport,
  onPreviewFileOrganization,
  onApplyFileOrganization,
  onExportFileOrganizationReport,
  deviceSyncPreview,
  onDeviceSync,
  audioConversionSetup,
  audioConversionInstallProgress,
  audioConversionPreview,
  audioConversionProgress,
  onRefreshAudioConversionSetup,
  onSaveAudioConversionSetup,
  onInstallAudioConversionFfmpeg,
  onBrowseAudioConversionTarget,
  onPreviewAudioConversion,
  onStartAudioConversion,
  onCancelAudioConversion,
  metadataCsvExport,
  metadataCsvImportPreview,
  metadataCsvImportReport,
  onExportMetadataCsv,
  onPreviewMetadataCsv,
  onApplyMetadataCsv,
  onExportMetadataCsvReport,
  duplicateActionResult,
  duplicateReview,
  onDuplicateAction,
  onLoadDuplicateReview,
  onRevealTracksByIds,
  clapStatus,
  clapInstallProgress,
  isClapInstalling,
  onRefreshClapStatus,
  onInstallClap,
  chromaprintSetup,
  onRefreshChromaprintSetup,
  onSaveChromaprintSetup,
  acousticFingerprintResult,
  onRunAcousticFingerprintPass,
  bulkUndoLog,
  bulkUndoBatches,
  bulkUndoRestoreResult,
  onRefreshUndoLog,
  onRestoreUndoEntry,
  onRestoreUndoBatch,
  reportFile,
  onReadReportFile,
  onAdvancedTagLibraryChanged,
  onClearTrackScope,
  onOpenApiKeysSettings,
  onSelectLibraryTarget,
  setStatus,
}: FileManagementPageProps) {
  const [trackScopeText, setTrackScopeText] = useState("");
  const [filenameTagPattern, setFilenameTagPattern] = useState(DEFAULT_FILENAME_TAG_PATTERNS[0]);
  const [filenameTagMissingOnly, setFilenameTagMissingOnly] = useState(true);
  const [filenameTagPresets, setFilenameTagPresets] = useState(readFilenameTagPresets);
  const [filenamePresetMessage, setFilenamePresetMessage] = useState<string | null>(null);
  const [filenamePresetJson, setFilenamePresetJson] = useState("");
  const [acceptedFilenameTrackIds, setAcceptedFilenameTrackIds] = useState<Set<number>>(() => new Set());
  const [fileWriteIncludeMetadata, setFileWriteIncludeMetadata] = useState(true);
  const [fileWriteIncludeRatings, setFileWriteIncludeRatings] = useState(true);
  const [fileWritePreview, setFileWritePreview] = useState<TrackFileMetadataWriteResponse | null>(null);
  const [fileWriteBusy, setFileWriteBusy] = useState(false);
  const [tagRegexField, setTagRegexField] = useState<"title" | "artist" | "album" | "album_artist" | "genre">("artist");
  const [tagRegexPattern, setTagRegexPattern] = useState("\\s+feat\\..*$");
  const [tagRegexReplacement, setTagRegexReplacement] = useState("");
  const [tagRegexCaseSensitive, setTagRegexCaseSensitive] = useState(false);
  const [autoTagMode, setAutoTagMode] = useState<"album" | "track">("album");
  const [autoTagMissingOnly, setAutoTagMissingOnly] = useState(true);
  const [autoTagIncludeArtwork, setAutoTagIncludeArtwork] = useState(true);
  const [autoTagSaveArtwork, setAutoTagSaveArtwork] = useState(false);
  const [autoTagWriteToFiles, setAutoTagWriteToFiles] = useState(false);
  const [acceptedAutoTagTrackIds, setAcceptedAutoTagTrackIds] = useState<Set<number>>(() => new Set());
  const [autoTagPreviewSource, setAutoTagPreviewSource] = useState<"musicbrainz" | "fingerprint" | null>(null);
  const [autoTagBusy, setAutoTagBusy] = useState(false);
  const [autoTagProgress, setAutoTagProgress] = useState<AutoTagProgressState | null>(null);
  const autoTagProgressTimerRef = useRef<number | null>(null);
  const autoTagProgressClearTimerRef = useRef<number | null>(null);
  const [fingerprintTagMissingOnly, setFingerprintTagMissingOnly] = useState(false);
  const [fingerprintTagSaveArtwork, setFingerprintTagSaveArtwork] = useState(false);
  const [fingerprintTagWriteToFiles, setFingerprintTagWriteToFiles] = useState(false);
  const [clapGenreMissingOnly, setClapGenreMissingOnly] = useState(true);
  const [clapGenreMinConfidence, setClapGenreMinConfidence] = useState(0.45);
  const [clapGenrePreview, setClapGenrePreview] = useState<ClapGenreTagResponse | null>(null);
  const [clapGenreBusy, setClapGenreBusy] = useState(false);
  const [organizeTemplate, setOrganizeTemplate] = useState("<Album Artist>/<Album> (<Year>)/<Track#> - <Title>");
  const [organizeBaseFolder, setOrganizeBaseFolder] = useState("");
  const [organizeCollisionStrategy, setOrganizeCollisionStrategy] = useState<"skip" | "auto_rename">("skip");
  const [organizeCleanupEmptyFolders, setOrganizeCleanupEmptyFolders] = useState(false);
  const [deviceSyncTarget, setDeviceSyncTarget] = useState("");
  const [deviceSyncProfileId, setDeviceSyncProfileId] = useState<number | null>(null);
  const [deviceSyncProfileName, setDeviceSyncProfileName] = useState("");
  const [deviceSyncProfiles, setDeviceSyncProfiles] = useState<DeviceSyncProfile[]>([]);
  const [deviceSyncPresets, setDeviceSyncPresets] = useState<DeviceSyncProfilePayload[]>([]);
  const [deviceSyncDevices, setDeviceSyncDevices] = useState<DeviceSyncDetectedDevice[]>([]);
  const [deviceSyncDeviceKind, setDeviceSyncDeviceKind] = useState<DeviceSyncProfilePayload["device_kind"]>("folder");
  const [deviceSyncMusicSubfolder, setDeviceSyncMusicSubfolder] = useState("Music");
  const [deviceSyncPlaylistSubfolder, setDeviceSyncPlaylistSubfolder] = useState("Playlists");
  const [deviceSyncPlaylistIds, setDeviceSyncPlaylistIds] = useState<Set<number>>(() => new Set());
  const [deviceSyncCopyFiles, setDeviceSyncCopyFiles] = useState(true);
  const [deviceSyncExportPlaylists, setDeviceSyncExportPlaylists] = useState(true);
  const [deviceSyncPreserveStructure, setDeviceSyncPreserveStructure] = useState(true);
  const [metadataCsvPath, setMetadataCsvPath] = useState("");
  const [metadataCsvMissingOnly, setMetadataCsvMissingOnly] = useState(true);
  const [metadataCsvClearBlankFields, setMetadataCsvClearBlankFields] = useState(false);
  const [csvColumnMapText, setCsvColumnMapText] = useState("{}");
  const [csvProfiles, setCsvProfiles] = useState(readCsvProfiles);
  const [csvProfileName, setCsvProfileName] = useState("");
  const [csvProfileMessage, setCsvProfileMessage] = useState<string | null>(null);
  const [duplicateTrackIdsText, setDuplicateTrackIdsText] = useState("");
  const [duplicateGroupsText, setDuplicateGroupsText] = useState("");
  const [duplicateDeleteFiles, setDuplicateDeleteFiles] = useState(false);
  const [fpcalcPath, setFpcalcPath] = useState("");
  const [acousticOverwrite, setAcousticOverwrite] = useState(false);
  const [acousticLimit, setAcousticLimit] = useState(200);
  const [reportPath, setReportPath] = useState("");
  const [toolSearch, setToolSearch] = useState("");
  const [toolCategory, setToolCategory] = useState<FileManagementCategory>("All");
  const [openFileManagementSection, setOpenFileManagementSection] = useState<string | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetSearchBusy, setTargetSearchBusy] = useState(false);
  const [targetSearchResults, setTargetSearchResults] = useState<LibraryTargetSearchResult[]>([]);

  const initialScopeKey = (initialTrackScopeIds ?? []).join(",");
  const incomingTrackScopeIds = useMemo(() => Array.from(new Set(initialTrackScopeIds ?? [])), [initialScopeKey, initialTrackScopeIds]);
  const scopedTrackIds = useMemo(() => parseTrackIds(trackScopeText), [trackScopeText]);
  const visibleSections = useMemo(
    () => filterFileManagementSections(fileManagementSections, toolCategory, toolSearch),
    [toolCategory, toolSearch],
  );
  const visibleSectionIds = useMemo(() => new Set(visibleSections.map((section) => section.id)), [visibleSections]);
  const focusOpenSignal = initialFocusToolId ? `${initialFocusToolId}:${initialScopeKey}` : null;
  const duplicateTrackIds = useMemo(
    () => parseTrackIds(duplicateTrackIdsText.trim() ? duplicateTrackIdsText : trackScopeText),
    [duplicateTrackIdsText, trackScopeText],
  );
  const duplicateGroups = useMemo(() => parseDuplicateGroups(duplicateGroupsText), [duplicateGroupsText]);
  const allFilenameTagPresets = Array.from(new Set([...DEFAULT_FILENAME_TAG_PATTERNS, ...filenameTagPresets]));
  const isCustomFilenameTagPreset = filenameTagPresets.includes(filenameTagPattern);
  const autoTagChangedIds = useMemo(
    () =>
      autoTagPreview?.previews
        .filter((preview) => acceptedAutoTagTrackIds.has(preview.track_id) && !preview.error && !preview.applied && preview.changed_fields.length > 0)
        .map((preview) => preview.track_id) ?? [],
    [acceptedAutoTagTrackIds, autoTagPreview],
  );
  const autoTagArtworkIds = useMemo(
    () =>
      autoTagPreview?.previews
        .filter((preview) => acceptedAutoTagTrackIds.has(preview.track_id) && !preview.error && !preview.artwork_saved && Boolean(preview.artwork_url))
        .map((preview) => preview.track_id) ?? [],
    [acceptedAutoTagTrackIds, autoTagPreview],
  );
  const fingerprintAutoTagIds = useMemo(
    () =>
      autoTagPreviewSource === "fingerprint" && autoTagPreview
        ? Array.from(new Set([...autoTagChangedIds, ...(fingerprintTagSaveArtwork ? autoTagArtworkIds : [])]))
        : [],
    [autoTagArtworkIds, autoTagChangedIds, autoTagPreview, autoTagPreviewSource, fingerprintTagSaveArtwork],
  );
  const acceptedChangedFilenameIds = useMemo(
    () =>
      filenameTagPreview?.previews
        .filter((preview) => acceptedFilenameTrackIds.has(preview.track_id) && preview.matched && preview.changed_fields.length > 0)
        .map((preview) => preview.track_id) ?? [],
    [acceptedFilenameTrackIds, filenameTagPreview],
  );

  function showTool(sectionId: string) {
    return visibleSectionIds.has(sectionId);
  }

  function openSignalFor(sectionId: string) {
    return initialFocusToolId === sectionId ? focusOpenSignal : undefined;
  }

  function openOptionalDependenciesSection() {
    setToolCategory("All");
    setToolSearch("Optional Dependencies");
    setOpenFileManagementSection("Optional Dependencies");
    void onRefreshAudioConversionSetup();
  }

  function clearAutoTagProgressTimers() {
    if (autoTagProgressTimerRef.current !== null) {
      window.clearInterval(autoTagProgressTimerRef.current);
      autoTagProgressTimerRef.current = null;
    }
    if (autoTagProgressClearTimerRef.current !== null) {
      window.clearTimeout(autoTagProgressClearTimerRef.current);
      autoTagProgressClearTimerRef.current = null;
    }
  }

  function beginAutoTagProgress(phase: AutoTagProgressState["phase"], total: number, label: string) {
    clearAutoTagProgressTimers();
    const safeTotal = Math.max(1, total);
    const step = Math.max(1, Math.ceil(safeTotal / 18));
    setAutoTagBusy(true);
    setAutoTagProgress({ phase, label, completed: 0, total: safeTotal });
    // The backend returns MusicBrainz work as one response today; this gives the
    // panel useful motion without pretending we have exact per-track callbacks.
    autoTagProgressTimerRef.current = window.setInterval(() => {
      setAutoTagProgress((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          completed: Math.min(current.total - 1, current.completed + step),
        };
      });
    }, 700);
  }

  function finishAutoTagProgress(label?: string) {
    if (autoTagProgressTimerRef.current !== null) {
      window.clearInterval(autoTagProgressTimerRef.current);
      autoTagProgressTimerRef.current = null;
    }
    setAutoTagBusy(false);
    setAutoTagProgress((current) =>
      current ? { ...current, label: label ?? current.label, completed: current.total } : current,
    );
    autoTagProgressClearTimerRef.current = window.setTimeout(() => {
      autoTagProgressClearTimerRef.current = null;
      setAutoTagProgress(null);
    }, 900);
  }

  useEffect(() => () => clearAutoTagProgressTimers(), []);

  useEffect(() => {
    if (incomingTrackScopeIds.length) {
      setTrackScopeText(incomingTrackScopeIds.join(", "));
    } else {
      setTrackScopeText("");
    }
  }, [initialScopeKey, incomingTrackScopeIds]);

  useEffect(() => {
    if (!initialFocusToolId) {
      return;
    }
    const section = fileManagementSections.find((item) => item.id === initialFocusToolId);
    setToolCategory("All");
    setToolSearch(section?.title ?? initialFocusToolId);
    setOpenFileManagementSection(section?.title ?? null);
    if (initialFocusToolId === "musicBrainz" && incomingTrackScopeIds.length > 0) {
      setAutoTagMode("track");
      setAutoTagMissingOnly(false);
    }
    onFocusToolConsumed?.();
  }, [initialFocusToolId, initialScopeKey, onFocusToolConsumed]);

  useEffect(() => {
    const next = new Set<number>();
    for (const preview of filenameTagPreview?.previews ?? []) {
      if (preview.matched && preview.changed_fields.length > 0) {
        next.add(preview.track_id);
      }
    }
    setAcceptedFilenameTrackIds(next);
  }, [filenameTagPreview]);

  useEffect(() => {
    setFpcalcPath(chromaprintSetup?.configured_path ?? chromaprintSetup?.resolved_path ?? "");
  }, [chromaprintSetup?.configured_path, chromaprintSetup?.resolved_path]);

  useEffect(() => {
    const next = new Set<number>();
    for (const preview of autoTagPreview?.previews ?? []) {
      const hasTagChanges = preview.changed_fields.length > 0 || preview.applied;
      const hasArtwork = Boolean(preview.artwork_url) || preview.artwork_saved;
      if (!preview.error && (hasTagChanges || hasArtwork)) {
        next.add(preview.track_id);
      }
    }
    setAcceptedAutoTagTrackIds(next);
  }, [autoTagPreview]);

  useEffect(() => {
    void loadDeviceSyncSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDeviceSyncSupport() {
    try {
      const [profileResponse, deviceResponse] = await Promise.all([
        fetchDeviceSyncProfiles(),
        fetchDeviceSyncDevices(),
      ]);
      setDeviceSyncProfiles(profileResponse.profiles);
      setDeviceSyncPresets(profileResponse.presets);
      setDeviceSyncDevices(deviceResponse.devices);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load device sync profiles");
    }
  }

  function applyDeviceSyncProfile(profile: DeviceSyncProfilePayload | DeviceSyncProfile) {
    setDeviceSyncProfileId("id" in profile ? profile.id : null);
    setDeviceSyncProfileName(profile.name);
    setDeviceSyncTarget(profile.target_folder ?? "");
    setDeviceSyncDeviceKind(profile.device_kind ?? "folder");
    setDeviceSyncMusicSubfolder(profile.music_subfolder ?? "Music");
    setDeviceSyncPlaylistSubfolder(profile.playlist_subfolder ?? "Playlists");
    setDeviceSyncPlaylistIds(new Set(profile.playlist_ids ?? []));
    setDeviceSyncCopyFiles(profile.copy_files ?? true);
    setDeviceSyncExportPlaylists(profile.export_playlists ?? true);
    setDeviceSyncPreserveStructure(profile.preserve_structure ?? true);
    setStatus(`Loaded device sync profile: ${profile.name}`);
  }

  function currentDeviceSyncProfilePayload(): DeviceSyncProfilePayload {
    return {
      name: deviceSyncProfileName.trim() || "Portable Player",
      target_folder: deviceSyncTarget,
      device_kind: deviceSyncDeviceKind ?? "folder",
      music_subfolder: deviceSyncMusicSubfolder,
      playlist_subfolder: deviceSyncPlaylistSubfolder,
      playlist_ids: Array.from(deviceSyncPlaylistIds),
      playlist_rules: {
        relative_paths: true,
        playlist_format: "m3u8",
        per_playlist_selection: true,
      },
      copy_files: deviceSyncCopyFiles,
      export_playlists: deviceSyncExportPlaylists,
      preserve_structure: deviceSyncPreserveStructure,
    };
  }

  async function saveCurrentDeviceSyncProfile() {
    try {
      const saved = await saveDeviceSyncProfile(currentDeviceSyncProfilePayload(), deviceSyncProfileId);
      setDeviceSyncProfileId(saved.id);
      setDeviceSyncProfileName(saved.name);
      await loadDeviceSyncSupport();
      setStatus(`Saved device sync profile: ${saved.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save device sync profile");
    }
  }

  async function deleteCurrentDeviceSyncProfile() {
    if (!deviceSyncProfileId) {
      setStatus("Choose a saved profile first");
      return;
    }
    try {
      await deleteDeviceSyncProfile(deviceSyncProfileId);
      setDeviceSyncProfileId(null);
      setDeviceSyncProfileName("");
      await loadDeviceSyncSupport();
      setStatus("Device sync profile deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete device sync profile");
    }
  }

  function useDetectedDevice(device: DeviceSyncDetectedDevice) {
    setDeviceSyncTarget(device.root_path);
    setDeviceSyncDeviceKind(device.device_kind as DeviceSyncProfilePayload["device_kind"]);
    if (!deviceSyncProfileName.trim()) {
      setDeviceSyncProfileName(device.label);
    }
    setStatus(`Using ${device.label} at ${device.root_path}`);
  }

  async function previewClapGenreTags(apply = false) {
    if (apply && !window.confirm("Apply CLAP genre predictions to the visible/selected tracks?")) {
      return;
    }
    setClapGenreBusy(true);
    setStatus(apply ? "Applying CLAP genre tags..." : "Building CLAP genre tag preview...");
    try {
      const response = await clapGenreTags({
        track_ids: currentScope(scopedTrackIds),
        missing_only: clapGenreMissingOnly,
        min_confidence: clapGenreMinConfidence,
        apply,
        limit: 500,
      });
      setClapGenrePreview(response);
      if (apply && response.applied > 0) {
        await onAdvancedTagLibraryChanged();
      }
      setStatus(
        apply
          ? `Applied CLAP genres to ${response.applied.toLocaleString()} track${response.applied === 1 ? "" : "s"}`
          : `CLAP preview found ${response.changed.toLocaleString()} genre change${response.changed === 1 ? "" : "s"}${
              response.blocked ? ` (${response.blocked.toLocaleString()} blocked by strict copy rules)` : ""
            }`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview CLAP genre tags");
    } finally {
      setClapGenreBusy(false);
    }
  }

  function saveCurrentFilenameTagPreset() {
    const trimmed = filenameTagPattern.trim();
    if (!trimmed || allFilenameTagPresets.includes(trimmed)) {
      return;
    }
    const next = [...filenameTagPresets, trimmed];
    setFilenameTagPresets(next);
    writeFilenameTagPresets(next);
    setFilenamePresetMessage("Pattern saved");
  }

  function deleteCurrentFilenameTagPreset() {
    if (!isCustomFilenameTagPreset) {
      return;
    }
    const next = filenameTagPresets.filter((pattern) => pattern !== filenameTagPattern);
    setFilenameTagPresets(next);
    writeFilenameTagPresets(next);
    setFilenameTagPattern(DEFAULT_FILENAME_TAG_PATTERNS[0]);
    setFilenamePresetMessage("Pattern deleted");
  }

  function exportFilenamePresets() {
    setFilenamePresetJson(formatJson(filenameTagPresets));
    setFilenamePresetMessage("Custom presets exported below");
  }

  function importFilenamePresets() {
    try {
      const parsed = JSON.parse(filenamePresetJson);
      if (!Array.isArray(parsed)) {
        throw new Error("Preset export must be a JSON array");
      }
      const incoming = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      const next = Array.from(new Set([...filenameTagPresets, ...incoming.map((pattern) => pattern.trim())]));
      setFilenameTagPresets(next);
      writeFilenameTagPresets(next);
      setFilenamePresetMessage(`Imported ${incoming.length.toLocaleString()} pattern${incoming.length === 1 ? "" : "s"}`);
    } catch (error) {
      setFilenamePresetMessage(error instanceof Error ? error.message : "Could not import filename presets");
    }
  }

  function toggleAcceptedFilenameTrack(trackId: number) {
    setAcceptedFilenameTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function parseCsvColumnMap(): Record<string, string> | null {
    try {
      const parsed = JSON.parse(csvColumnMapText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Column map must be a JSON object");
      }
      const normalized: Record<string, string> = {};
      for (const [field, column] of Object.entries(parsed)) {
        if (CSV_IMPORT_FIELDS.includes(field as (typeof CSV_IMPORT_FIELDS)[number]) && typeof column === "string" && column.trim()) {
          normalized[field] = column.trim();
        }
      }
      setCsvProfileMessage(null);
      return normalized;
    } catch (error) {
      setCsvProfileMessage(error instanceof Error ? error.message : "Could not parse column map");
      return null;
    }
  }

  function csvOptions(): CsvImportOptions | null {
    const columnMap = parseCsvColumnMap();
    if (columnMap === null) {
      return null;
    }
    return {
      trackIds: currentScope(scopedTrackIds),
      columnMap,
      clearBlankFields: metadataCsvClearBlankFields,
    };
  }

  function saveCsvProfile() {
    const name = csvProfileName.trim();
    const columnMap = parseCsvColumnMap();
    if (!name || columnMap === null) {
      setCsvProfileMessage(name ? "Could not save profile" : "Name the profile first");
      return;
    }
    const nextProfile: CsvImportProfile = {
      name,
      columnMap,
      missingOnly: metadataCsvMissingOnly,
      clearBlankFields: metadataCsvClearBlankFields,
    };
    const next = [...csvProfiles.filter((profile) => profile.name !== name), nextProfile].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    setCsvProfiles(next);
    writeCsvProfiles(next);
    setCsvProfileMessage("CSV profile saved");
  }

  function loadCsvProfile(name: string) {
    const profile = csvProfiles.find((item) => item.name === name);
    if (!profile) {
      return;
    }
    setCsvProfileName(profile.name);
    setCsvColumnMapText(formatJson(profile.columnMap));
    setMetadataCsvMissingOnly(profile.missingOnly);
    setMetadataCsvClearBlankFields(profile.clearBlankFields);
    setCsvProfileMessage(`Loaded ${profile.name}`);
  }

  function deleteCsvProfile() {
    const name = csvProfileName.trim();
    if (!name) {
      return;
    }
    const next = csvProfiles.filter((profile) => profile.name !== name);
    setCsvProfiles(next);
    writeCsvProfiles(next);
    setCsvProfileName("");
    setCsvProfileMessage("CSV profile deleted");
  }

  function withCsvOptions(action: (options: CsvImportOptions) => void | Promise<void>) {
    const options = csvOptions();
    if (options === null) {
      return;
    }
    void action(options);
  }

  function organizationOptions(): FileOrganizationOptions {
    return {
      collisionStrategy: organizeCollisionStrategy,
      cleanupEmptyFolders: organizeCleanupEmptyFolders,
      trackIds: currentScope(scopedTrackIds),
    };
  }

  async function applyFileOrganization() {
    await onApplyFileOrganization(organizeTemplate, organizeBaseFolder, organizationOptions());
  }

  function duplicateScopeForAction(): number[] {
    return duplicateTrackIds.length ? duplicateTrackIds : scopedTrackIds;
  }

  function deviceSyncOptions(apply = false) {
    return {
      playlistIds: Array.from(deviceSyncPlaylistIds),
      trackIds: currentScope(scopedTrackIds),
      musicSubfolder: deviceSyncMusicSubfolder,
      playlistSubfolder: deviceSyncPlaylistSubfolder,
      copyFiles: deviceSyncCopyFiles,
      exportPlaylists: deviceSyncExportPlaylists,
      preserveStructure: deviceSyncPreserveStructure,
      apply,
    };
  }

  function toggleDeviceSyncPlaylist(playlistId: number) {
    setDeviceSyncPlaylistIds((current) => {
      const next = new Set(current);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  }

  function toggleAutoTagTrack(trackId: number) {
    setAcceptedAutoTagTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function setToolTarget(value: string) {
    if (value === "selected" && incomingTrackScopeIds.length) {
      setTrackScopeText(incomingTrackScopeIds.join(", "));
      setStatus(`Using ${incomingTrackScopeIds.length.toLocaleString()} selected track${incomingTrackScopeIds.length === 1 ? "" : "s"}`);
      return;
    }
    setTrackScopeText("");
    onClearTrackScope();
    setStatus("Using each tool's default target");
  }

  function appendTargetTrackIds(trackIds: number[], sourceLabel: string) {
    const next = Array.from(new Set([...scopedTrackIds, ...trackIds])).filter((id) => Number.isFinite(id) && id > 0);
    setTrackScopeText(next.join(", "));
    setStatus(`Added ${trackIds.length.toLocaleString()} track${trackIds.length === 1 ? "" : "s"} from ${sourceLabel}`);
  }

  function removeScopedTrackId(trackId: number) {
    const next = scopedTrackIds.filter((id) => id !== trackId);
    setTrackScopeText(next.join(", "));
    setStatus(next.length ? `${next.length.toLocaleString()} track${next.length === 1 ? "" : "s"} still targeted` : "Using each tool's default target");
  }

  async function searchLibraryTargets() {
    const query = targetSearch.trim();
    if (!query) {
      setTargetSearchResults([]);
      return;
    }
    setTargetSearchBusy(true);
    try {
      const [trackResult, albumResult, artistResult] = await Promise.allSettled([
        fetchTracks(query, { limit: 8, sortBy: "artist", sortDirection: "asc" }),
        fetchAlbums(query),
        fetchArtists(query),
      ]);
      const results: LibraryTargetSearchResult[] = [];
      if (trackResult.status === "fulfilled") {
        results.push(...trackResult.value.slice(0, 8).map((track) => ({
          kind: "track" as const,
          key: `track-${track.id}`,
          label: track.title || "Untitled track",
          description: `${track.artist || "Unknown artist"} - ${track.album || "Unknown album"}`,
          track,
        })));
      }
      if (albumResult.status === "fulfilled") {
        results.push(...albumResult.value.slice(0, 6).map((album) => ({
          kind: "album" as const,
          key: `album-${album.id}`,
          label: album.album || "Untitled album",
          description: `${album.album_artist || "Unknown artist"} - ${album.track_count.toLocaleString()} tracks`,
          album,
        })));
      }
      if (artistResult.status === "fulfilled") {
        results.push(...artistResult.value.slice(0, 6).map((artist) => ({
          kind: "artist" as const,
          key: `artist-${artist.name}`,
          label: artist.name || "Unknown artist",
          description: `${artist.track_count.toLocaleString()} tracks - ${artist.album_count.toLocaleString()} albums`,
          artist,
        })));
      }
      setTargetSearchResults(results.slice(0, 18));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not search library targets");
    } finally {
      setTargetSearchBusy(false);
    }
  }

  async function appendLibraryTarget(result: LibraryTargetSearchResult) {
    if (result.kind === "track") {
      appendTargetTrackIds([result.track.id], result.label);
      return;
    }
    if (result.kind === "album") {
      const tracks = await fetchAlbumTracks(result.album.id);
      appendTargetTrackIds(tracks.map((track) => track.id), result.label);
      return;
    }
    const tracks = await fetchArtistLocalTracks(result.artist.name, 20000);
    appendTargetTrackIds(tracks.map((track) => track.id), result.label);
  }

  function pendingFileWriteIds() {
    return (
      fileWritePreview?.previews
        .filter((preview) => preview.changed_fields.length > 0 && !preview.applied && !preview.error)
        .map((preview) => preview.track_id) ?? []
    );
  }

  function fileWriteChangeDetails(preview: TrackFileMetadataWriteResponse["previews"][number]) {
    return preview.changed_fields
      .slice(0, 5)
      .map((field) => `${field.replace("_", " ")}: ${previewLabel(preview.file[field])} -> ${previewLabel(preview.database[field])}`);
  }

  async function previewDatabaseFileWrites(apply: boolean) {
    if (!fileWriteIncludeMetadata && !fileWriteIncludeRatings) {
      setStatus("Choose metadata, ratings, or both before writing files.");
      return;
    }
    if (apply && !fileWritePreview) {
      setStatus("Preview file writes first. If nothing differs, there will be nothing to write.");
      return;
    }
    const pendingIds = pendingFileWriteIds();
    const scope = apply && fileWritePreview ? pendingIds : currentScope(scopedTrackIds);
    if (apply && fileWritePreview && pendingIds.length === 0) {
      setStatus("No pending SQLite-to-file changes to write.");
      return;
    }
    if (apply) {
      const targetText = scope?.length ? `${scope.length.toLocaleString()} changed track${scope.length === 1 ? "" : "s"}` : "the current preview target";
      if (!window.confirm(`Write FLAC Cafe's SQLite metadata to ${targetText}? This updates audio file tags.`)) {
        return;
      }
    }

    setFileWriteBusy(true);
    setStatus(apply ? "Writing SQLite metadata to audio files..." : "Previewing SQLite-to-file metadata differences...");
    try {
      const response = await writeTrackMetadataToFiles({
        track_ids: scope?.length ? scope : null,
        include_metadata: fileWriteIncludeMetadata,
        include_rating: fileWriteIncludeRatings,
        apply,
        limit: apply ? Math.max(pendingIds.length, 1) : FILE_WRITE_PREVIEW_LIMIT,
      });
      setFileWritePreview(response);
      if (apply) {
        await onAdvancedTagLibraryChanged();
      }
      setStatus(
        apply
          ? `Wrote SQLite tags to ${response.applied.toLocaleString()} file${response.applied === 1 ? "" : "s"}`
          : `Found ${response.changed.toLocaleString()} file${response.changed === 1 ? "" : "s"} with tag differences`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatus(
        message.includes("404") || message.toLowerCase().includes("not found")
          ? "SQLite-to-file sync is not available in the running backend yet. Restart the dev backend or relaunch Tauri."
          : message || "Could not write SQLite metadata to files",
      );
    } finally {
      setFileWriteBusy(false);
    }
  }

  async function previewMusicBrainzAutoTags() {
    const scope = currentScope(scopedTrackIds);
    setAutoTagPreviewSource("musicbrainz");
    const targetCount = scope?.length ?? 50;
    beginAutoTagProgress(
      "preview",
      targetCount,
      scope
        ? `Previewing ${scope.length.toLocaleString()} selected track${scope.length === 1 ? "" : "s"}`
        : "Previewing the default MusicBrainz target",
    );
    setStatus(
      scope
        ? `Previewing MusicBrainz tags for ${scope.length.toLocaleString()} selected track${scope.length === 1 ? "" : "s"}...`
        : "Previewing MusicBrainz tags for the default tool target...",
    );
    try {
      await onPreviewAutoTag(autoTagMode, autoTagMissingOnly, autoTagIncludeArtwork, scope);
    } finally {
      finishAutoTagProgress("MusicBrainz preview finished");
    }
  }

  async function applyMusicBrainzAutoTags() {
    setAutoTagPreviewSource("musicbrainz");
    const acceptedPreviews = autoTagPreview
      ? autoTagPreview.previews.filter(
        (preview) =>
          acceptedAutoTagTrackIds.has(preview.track_id) &&
          !preview.error &&
          (preview.changed_fields.length > 0 || (autoTagSaveArtwork && Boolean(preview.artwork_url))),
      )
      : [];
    const scope = autoTagPreview
      ? Array.from(new Set([...autoTagChangedIds, ...(autoTagSaveArtwork ? autoTagArtworkIds : [])]))
      : currentScope(scopedTrackIds);
    if (autoTagPreview && acceptedPreviews.length === 0) {
      setStatus("No accepted MusicBrainz changes to apply.");
      return;
    }
    const targetCount = acceptedPreviews.length || scope?.length || 200;
    beginAutoTagProgress(
      "apply",
      targetCount,
      `Applying ${targetCount.toLocaleString()} accepted MusicBrainz item${targetCount === 1 ? "" : "s"}`,
    );
    setStatus(
      scope?.length
        ? `Applying MusicBrainz tags to ${scope.length.toLocaleString()} track${scope.length === 1 ? "" : "s"}...`
        : "Applying MusicBrainz tags to the default tool target...",
    );
    try {
      await onApplyAutoTag(
        autoTagMode,
        autoTagMissingOnly,
        autoTagIncludeArtwork,
        autoTagSaveArtwork,
        autoTagWriteToFiles,
        scope,
        // Pass accepted rows back so Rust can apply the reviewed proposals
        // directly instead of repeating the network lookup that built them.
        { acceptedPreviews: acceptedPreviews.length ? acceptedPreviews : undefined },
      );
    } finally {
      finishAutoTagProgress("MusicBrainz apply finished");
    }
  }

  async function analyzeAcousticFingerprints() {
    const scope = currentScope(scopedTrackIds);
    setStatus(
      scope
        ? `Analyzing fingerprints for ${scope.length.toLocaleString()} selected track${scope.length === 1 ? "" : "s"}...`
        : "Analyzing fingerprints for the default tool target...",
    );
    await onRunAcousticFingerprintPass(scope, acousticOverwrite, acousticLimit);
  }

  async function previewAcousticFingerprintTags() {
    const scope = currentScope(scopedTrackIds);
    setAutoTagPreviewSource("fingerprint");
    setAutoTagMode("track");
    setAutoTagMissingOnly(fingerprintTagMissingOnly);
    setAutoTagIncludeArtwork(true);
    setStatus(
      scope
        ? `Fingerprinting ${scope.length.toLocaleString()} selected track${scope.length === 1 ? "" : "s"} before tag preview...`
        : "Fingerprinting the default tool target before tag preview...",
    );
    await onRunAcousticFingerprintPass(scope, acousticOverwrite, acousticLimit);
    setStatus("Building AcoustID fingerprint-only tag preview...");
    await onPreviewAutoTag("track", fingerprintTagMissingOnly, true, scope, { fingerprintOnly: true });
  }

  async function applyAcousticFingerprintTags() {
    if (!fingerprintAutoTagIds.length) {
      setStatus("No accepted fingerprint tag changes to apply.");
      return;
    }
    setAutoTagPreviewSource("fingerprint");
    const acceptedPreviews = autoTagPreview
      ? autoTagPreview.previews.filter(
        (preview) =>
          acceptedAutoTagTrackIds.has(preview.track_id) &&
          !preview.error &&
          (preview.changed_fields.length > 0 || (fingerprintTagSaveArtwork && Boolean(preview.artwork_url))),
      )
      : [];
    setStatus(
      `Applying fingerprint tags to ${fingerprintAutoTagIds.length.toLocaleString()} track${fingerprintAutoTagIds.length === 1 ? "" : "s"}...`,
    );
    await onApplyAutoTag(
      "track",
      fingerprintTagMissingOnly,
      true,
      fingerprintTagSaveArtwork,
      fingerprintTagWriteToFiles,
      fingerprintAutoTagIds,
      { fingerprintOnly: true, acceptedPreviews: acceptedPreviews.length ? acceptedPreviews : undefined },
    );
  }

  function autoTagFieldSummary(preview: NonNullable<typeof autoTagPreview>["previews"][number]): string {
    if (preview.error) {
      return preview.error;
    }
    if (preview.applied && preview.artwork_saved) {
      return "Applied tags and saved cover";
    }
    if (preview.applied) {
      return "Applied tags; library rows refreshed";
    }
    if (preview.artwork_saved) {
      return "Cover saved";
    }
    if (!preview.changed_fields.length) {
      return preview.artwork_url ? "Artwork match only" : "Matched; no field changes";
    }
    return preview.changed_fields.join(", ");
  }

  function autoTagChangeDetails(preview: NonNullable<typeof autoTagPreview>["previews"][number]) {
    return preview.changed_fields
      .slice(0, 5)
      .map((field) => {
        const current = preview.current[field];
        const proposed = preview.proposed[field];
        if (preview.applied) {
          return `${field.replace("_", " ")}: updated to ${previewLabel(proposed)}`;
        }
        return `${field.replace("_", " ")}: ${String(current ?? "(empty)")} -> ${String(proposed ?? "(empty)")}`;
      });
  }

  const fileManagementPageModel = {
    initialFocusToolId, incomingTrackScopeIds, scopedTrackIds, visibleSectionIds, toolCategory, setToolCategory, toolSearch, setToolSearch, openFileManagementSection, setOpenFileManagementSection, showTool, openSignalFor, setToolTarget, onSelectLibraryTarget, onRefreshUndoLog,
    targetSearch, setTargetSearch, targetSearchBusy, targetSearchResults, searchLibraryTargets, appendLibraryTarget, trackScopeText, setTrackScopeText, removeScopedTrackId,
    folderPath, playlists, setStatus, onClearArtistCache, onClearLibraryCaches, onAdvancedTagLibraryChanged, onClearTrackScope, onOpenApiKeysSettings,
    audioConversionSetup, audioConversionInstallProgress, audioConversionPreview, audioConversionProgress, onRefreshAudioConversionSetup, onSaveAudioConversionSetup, onInstallAudioConversionFfmpeg, onBrowseAudioConversionTarget, onPreviewAudioConversion, onStartAudioConversion, onCancelAudioConversion, openOptionalDependenciesSection,
    clapStatus, clapInstallProgress, isClapInstalling, onRefreshClapStatus, onInstallClap,
    filenameTagPreview, filenameTagPattern, setFilenameTagPattern, filenameTagMissingOnly, setFilenameTagMissingOnly, filenameTagPresets, allFilenameTagPresets, isCustomFilenameTagPreset, filenamePresetMessage, filenamePresetJson, setFilenamePresetJson, saveCurrentFilenameTagPreset, deleteCurrentFilenameTagPreset, exportFilenamePresets, importFilenamePresets, acceptedFilenameTrackIds, acceptedChangedFilenameIds, toggleAcceptedFilenameTrack, onPreviewFilenameTags, onApplyFilenameTags,
    tagRegexPreview, tagRegexField, setTagRegexField, tagRegexPattern, setTagRegexPattern, tagRegexReplacement, setTagRegexReplacement, tagRegexCaseSensitive, setTagRegexCaseSensitive, onPreviewTagRegex, onApplyTagRegex,
    fileWriteIncludeMetadata, setFileWriteIncludeMetadata, fileWriteIncludeRatings, setFileWriteIncludeRatings, fileWritePreview, fileWriteBusy, pendingFileWriteIds, previewDatabaseFileWrites, fileWriteChangeDetails,
    autoTagPreview, autoTagMode, setAutoTagMode, autoTagMissingOnly, setAutoTagMissingOnly, autoTagIncludeArtwork, setAutoTagIncludeArtwork, autoTagSaveArtwork, setAutoTagSaveArtwork, autoTagWriteToFiles, setAutoTagWriteToFiles, acceptedAutoTagTrackIds, autoTagPreviewSource, autoTagBusy, autoTagProgress, autoTagChangedIds, autoTagArtworkIds, fingerprintAutoTagIds, previewMusicBrainzAutoTags, applyMusicBrainzAutoTags, toggleAutoTagTrack, autoTagFieldSummary, autoTagChangeDetails, fingerprintTagMissingOnly, setFingerprintTagMissingOnly, fingerprintTagSaveArtwork, setFingerprintTagSaveArtwork, fingerprintTagWriteToFiles, setFingerprintTagWriteToFiles, previewAcousticFingerprintTags, applyAcousticFingerprintTags,
    clapGenreMissingOnly, setClapGenreMissingOnly, clapGenreMinConfidence, setClapGenreMinConfidence, clapGenrePreview, clapGenreBusy, previewClapGenreTags,
    organizeTemplate, setOrganizeTemplate, organizeBaseFolder, setOrganizeBaseFolder, organizeCollisionStrategy, setOrganizeCollisionStrategy, organizeCleanupEmptyFolders, setOrganizeCleanupEmptyFolders, fileOrganizationPreview, fileOrganizationReport, organizationOptions, applyFileOrganization, onPreviewFileOrganization, onExportFileOrganizationReport,
    deviceSyncTarget, setDeviceSyncTarget, deviceSyncProfileId, setDeviceSyncProfileId, deviceSyncProfileName, setDeviceSyncProfileName, deviceSyncProfiles, deviceSyncPresets, deviceSyncDevices, deviceSyncDeviceKind, setDeviceSyncDeviceKind, deviceSyncMusicSubfolder, setDeviceSyncMusicSubfolder, deviceSyncPlaylistSubfolder, setDeviceSyncPlaylistSubfolder, deviceSyncPlaylistIds, setDeviceSyncPlaylistIds, deviceSyncCopyFiles, setDeviceSyncCopyFiles, deviceSyncExportPlaylists, setDeviceSyncExportPlaylists, deviceSyncPreserveStructure, setDeviceSyncPreserveStructure, applyDeviceSyncProfile, saveCurrentDeviceSyncProfile, deleteCurrentDeviceSyncProfile, useDetectedDevice, toggleDeviceSyncPlaylist, deviceSyncOptions, deviceSyncPreview, onDeviceSync, loadDeviceSyncSupport,
    metadataCsvPath, setMetadataCsvPath, metadataCsvMissingOnly, setMetadataCsvMissingOnly, metadataCsvClearBlankFields, setMetadataCsvClearBlankFields, csvColumnMapText, setCsvColumnMapText, csvProfiles, csvProfileName, setCsvProfileName, csvProfileMessage, saveCsvProfile, loadCsvProfile, deleteCsvProfile, withCsvOptions, metadataCsvExport, metadataCsvImportPreview, metadataCsvImportReport, onExportMetadataCsv, onPreviewMetadataCsv, onApplyMetadataCsv, onExportMetadataCsvReport,
    duplicateTrackIdsText, setDuplicateTrackIdsText, duplicateGroupsText, setDuplicateGroupsText, duplicateDeleteFiles, setDuplicateDeleteFiles, duplicateTrackIds, duplicateGroups, duplicateScopeForAction, duplicateActionResult, duplicateReview, onDuplicateAction, onLoadDuplicateReview, onRevealTracksByIds,
    fpcalcPath, setFpcalcPath, chromaprintSetup, onRefreshChromaprintSetup, onSaveChromaprintSetup, acousticOverwrite, setAcousticOverwrite, acousticLimit, setAcousticLimit, acousticFingerprintResult, analyzeAcousticFingerprints, reportPath, setReportPath, reportFile, onReadReportFile, bulkUndoLog, bulkUndoBatches, bulkUndoRestoreResult, onRestoreUndoEntry, onRestoreUndoBatch,
  };

  return <FileManagementPageView model={fileManagementPageModel} />;
}
