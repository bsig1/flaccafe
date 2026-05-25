import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Fingerprint,
  FolderOpen,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AcousticFingerprintResponse,
  AudioConversionPreviewResponse,
  AudioConversionProgress,
  AudioConversionSetupResponse,
  AutoTagResponse,
  BulkUndoBatchEntry,
  BulkUndoLogEntry,
  BulkUndoRestoreResponse,
  CacheClearTarget,
  ChromaprintStatusResponse,
  ClapInstallDevice,
  ClapInstallProgress,
  ClapGenreTagResponse,
  ClapStatusResponse,
  CsvMetadataExportResponse,
  CsvMetadataImportReportResponse,
  CsvMetadataImportResponse,
  DeviceSyncDetectedDevice,
  DeviceSyncProfile,
  DeviceSyncProfilePayload,
  DeviceSyncResponse,
  DuplicateActionRequest,
  DuplicateActionResponse,
  DuplicateReviewResponse,
  FileOrganizationReportResponse,
  FileOrganizationResponse,
  FilenameTagInferenceResponse,
  PlaylistSummary,
  ReportFileResponse,
  TagRegexReplaceResponse,
  Track,
  TrackFileMetadataWriteResponse,
} from "../../types/api";
import {
  deleteDeviceSyncProfile,
  fetchDeviceSyncDevices,
  fetchDeviceSyncProfiles,
  clapGenreTags,
  saveDeviceSyncProfile,
  writeTrackMetadataToFiles,
} from "../../lib/api";
import {
  openExternalUrl,
} from "../../lib/externalLinks";
import {
  DisclosureAccordionProvider,
  DisclosureSection,
  NumberField,
} from "../components/common";
import { AdvancedTagToolsSection } from "./file-management/AdvancedTagToolsSection";
import {
  AudioConversionSection,
  type AudioConversionOptions,
} from "./file-management/AudioConversionSection";
import { CacheUndoLogSection } from "./file-management/CacheUndoLogSection";
import { CdRipperSection } from "./file-management/CdRipperSection";
import {
  FileManagementNavigator,
  filterFileManagementSections,
  fileManagementSections,
} from "./file-management/FileManagementNavigator";
import type {
  FileManagementCategory,
} from "./file-management/FileManagementNavigator";
import { LibraryImportersSection } from "./file-management/LibraryImportersSection";
import { OptionalDependenciesSection } from "./file-management/OptionalDependenciesSection";
import { ReportViewerSection } from "./file-management/ReportViewerSection";
import { VolumeTagsSection } from "./file-management/VolumeTagsSection";
import {
  CSV_IMPORT_FIELDS,
  DEFAULT_FILENAME_TAG_PATTERNS,
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
import type {
  CsvImportOptions,
  CsvImportProfile,
  FileOrganizationOptions,
} from "./file-management/fileManagementUtils";

const ACOUSTID_API_KEY_URL = "https://acoustid.org/api-key";

type AutoTagRequestOptions = {
  fingerprintOnly?: boolean;
};

function defaultToolTarget(folderPath: string, folderName: string): string {
  const trimmed = folderPath.trim().replace(/[\\/]+$/, "");
  if (!trimmed) {
    return "";
  }
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${separator}${folderName}`;
}

function defaultAudioConversionTarget(folderPath: string): string {
  return defaultToolTarget(folderPath, "FLAC Cafe Converted");
}

function defaultCdRipTarget(folderPath: string): string {
  return defaultToolTarget(folderPath, "FLAC Cafe CD Rips");
}

export function FileManagementPage({
  initialFocusToolId,
  initialTrackScopeIds,
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
  audioConversionPreview,
  audioConversionProgress,
  onRefreshAudioConversionSetup,
  onSaveAudioConversionSetup,
  onInstallAudioConversionFfmpeg,
  onBrowseAudioConversionTarget,
  onBrowseCdRipTarget,
  onPlayCdPreviewTrack,
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
}: {
  initialFocusToolId?: string | null;
  initialTrackScopeIds?: number[] | null;
  folderPath: string;
  playlists: PlaylistSummary[];
  onClearArtistCache: () => void;
  onClearLibraryCaches: (targets: CacheClearTarget[]) => void | Promise<void>;
  filenameTagPreview: FilenameTagInferenceResponse | null;
  onPreviewFilenameTags: (pattern: string, missingOnly: boolean, trackIds?: number[] | null) => void | Promise<void>;
  onApplyFilenameTags: (pattern: string, missingOnly: boolean, trackIds?: number[] | null) => void | Promise<void>;
  tagRegexPreview: TagRegexReplaceResponse | null;
  onPreviewTagRegex: (
    field: "title" | "artist" | "album" | "album_artist" | "genre",
    pattern: string,
    replacement: string,
    caseSensitive: boolean,
    trackIds?: number[] | null,
  ) => void | Promise<void>;
  onApplyTagRegex: (
    field: "title" | "artist" | "album" | "album_artist" | "genre",
    pattern: string,
    replacement: string,
    caseSensitive: boolean,
    trackIds?: number[] | null,
  ) => void | Promise<void>;
  autoTagPreview: AutoTagResponse | null;
  onPreviewAutoTag: (
    mode: "album" | "track",
    missingOnly: boolean,
    includeArtwork: boolean,
    trackIds?: number[] | null,
    options?: AutoTagRequestOptions,
  ) => void | Promise<void>;
  onApplyAutoTag: (
    mode: "album" | "track",
    missingOnly: boolean,
    includeArtwork: boolean,
    saveArtwork: boolean,
    writeToFile: boolean,
    trackIds?: number[] | null,
    options?: AutoTagRequestOptions,
  ) => void | Promise<void>;
  fileOrganizationPreview: FileOrganizationResponse | null;
  fileOrganizationReport: FileOrganizationReportResponse | null;
  onPreviewFileOrganization: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  onApplyFileOrganization: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => boolean | Promise<boolean>;
  onExportFileOrganizationReport: (template: string, baseFolder?: string | null, options?: FileOrganizationOptions) => void | Promise<void>;
  deviceSyncPreview: DeviceSyncResponse | null;
  onDeviceSync: (
    targetFolder: string,
    options: {
      playlistIds?: number[];
      trackIds?: number[] | null;
      musicSubfolder?: string;
      playlistSubfolder?: string;
      copyFiles?: boolean;
      exportPlaylists?: boolean;
      preserveStructure?: boolean;
      apply?: boolean;
    },
  ) => void | Promise<void>;
  audioConversionSetup: AudioConversionSetupResponse | null;
  audioConversionPreview: AudioConversionPreviewResponse | null;
  audioConversionProgress: AudioConversionProgress | null;
  onRefreshAudioConversionSetup: () => void | Promise<void>;
  onSaveAudioConversionSetup: (ffmpegPath: string | null) => void | Promise<void>;
  onInstallAudioConversionFfmpeg: () => void | Promise<void>;
  onBrowseAudioConversionTarget: () => Promise<string | null>;
  onBrowseCdRipTarget: () => Promise<string | null>;
  onPlayCdPreviewTrack: (track: Track, queue?: Track[]) => void;
  onPreviewAudioConversion: (targetFolder: string, options: AudioConversionOptions) => void | Promise<void>;
  onStartAudioConversion: (targetFolder: string, options: AudioConversionOptions) => void | Promise<void>;
  onCancelAudioConversion: () => void | Promise<void>;
  metadataCsvExport: CsvMetadataExportResponse | null;
  metadataCsvImportPreview: CsvMetadataImportResponse | null;
  metadataCsvImportReport: CsvMetadataImportReportResponse | null;
  onExportMetadataCsv: (trackIds?: number[] | null) => void | Promise<void>;
  onPreviewMetadataCsv: (csvPath: string, missingOnly: boolean, options?: CsvImportOptions) => void | Promise<void>;
  onApplyMetadataCsv: (csvPath: string, missingOnly: boolean, options?: CsvImportOptions) => void | Promise<void>;
  onExportMetadataCsvReport: (csvPath: string, missingOnly: boolean, options?: CsvImportOptions) => void | Promise<void>;
  duplicateActionResult: DuplicateActionResponse | null;
  duplicateReview: DuplicateReviewResponse | null;
  onDuplicateAction: (request: DuplicateActionRequest) => void | Promise<void>;
  onLoadDuplicateReview: (trackIds: number[], groups: number[][]) => void | Promise<void>;
  onRevealTracksByIds: (trackIds: number[]) => void | Promise<void>;
  clapStatus: ClapStatusResponse | null;
  clapInstallProgress: ClapInstallProgress | null;
  isClapInstalling: boolean;
  onRefreshClapStatus: () => void | Promise<void>;
  onInstallClap: (device: ClapInstallDevice, force?: boolean) => void | Promise<void>;
  chromaprintSetup: ChromaprintStatusResponse | null;
  onRefreshChromaprintSetup: () => void | Promise<void>;
  onSaveChromaprintSetup: (fpcalcPath: string | null) => void | Promise<void>;
  acousticFingerprintResult: AcousticFingerprintResponse | null;
  onRunAcousticFingerprintPass: (trackIds: number[] | null, overwrite: boolean, limit: number) => void | Promise<void>;
  bulkUndoLog: BulkUndoLogEntry[];
  bulkUndoBatches: BulkUndoBatchEntry[];
  bulkUndoRestoreResult: BulkUndoRestoreResponse | null;
  onRefreshUndoLog: () => void | Promise<void>;
  onRestoreUndoEntry: (entryId: number) => void | Promise<void>;
  onRestoreUndoBatch: (batchId: string) => void | Promise<void>;
  reportFile: ReportFileResponse | null;
  onReadReportFile: (reportPath: string) => void | Promise<void>;
  onAdvancedTagLibraryChanged: () => void | Promise<void>;
  onClearTrackScope: () => void;
  onOpenApiKeysSettings: () => void;
  onSelectLibraryTarget: (view: "tracks" | "albums") => void;
  setStatus: (message: string) => void;
}) {
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
  const [fingerprintTagMissingOnly, setFingerprintTagMissingOnly] = useState(false);
  const [fingerprintTagSaveArtwork, setFingerprintTagSaveArtwork] = useState(false);
  const [fingerprintTagWriteToFiles, setFingerprintTagWriteToFiles] = useState(false);
  const [clapGenreMissingOnly, setClapGenreMissingOnly] = useState(true);
  const [clapGenreMinConfidence, setClapGenreMinConfidence] = useState(0.35);
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
  }, [initialFocusToolId, initialScopeKey]);

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
          : `CLAP preview found ${response.changed.toLocaleString()} genre change${response.changed === 1 ? "" : "s"}`,
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
        limit: apply ? 10000 : 500,
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
    setStatus(
      scope
        ? `Previewing MusicBrainz tags for ${scope.length.toLocaleString()} selected track${scope.length === 1 ? "" : "s"}...`
        : "Previewing MusicBrainz tags for the default tool target...",
    );
    await onPreviewAutoTag(autoTagMode, autoTagMissingOnly, autoTagIncludeArtwork, scope);
  }

  async function applyMusicBrainzAutoTags() {
    setAutoTagPreviewSource("musicbrainz");
    const scope = autoTagPreview
      ? Array.from(new Set([...autoTagChangedIds, ...(autoTagSaveArtwork ? autoTagArtworkIds : [])]))
      : currentScope(scopedTrackIds);
    setStatus(
      scope?.length
        ? `Applying MusicBrainz tags to ${scope.length.toLocaleString()} track${scope.length === 1 ? "" : "s"}...`
        : "Applying MusicBrainz tags to the default tool target...",
    );
    await onApplyAutoTag(autoTagMode, autoTagMissingOnly, autoTagIncludeArtwork, autoTagSaveArtwork, autoTagWriteToFiles, scope);
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
      { fingerprintOnly: true },
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

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">File Management</h1>
          <p className="text-xs text-muted">Batch cleanup, duplicate review, metadata import, and safe file moves.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void onRefreshUndoLog()}>
          <RotateCcw size={15} />
          Refresh Log
        </button>
      </header>
      <section className="min-h-0 flex-1 overflow-auto p-6">
        <DisclosureAccordionProvider
          openSectionId={openFileManagementSection}
          onOpenSectionChange={setOpenFileManagementSection}
        >
        <div className="grid max-w-6xl gap-5">
          <div className="rounded border border-line bg-panel p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-xs uppercase text-muted">Current Target</div>
                <div className="mt-1 text-sm font-medium text-neutral-100">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} selected track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Tool defaults"}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {scopedTrackIds.length
                    ? "Scoped tools will only act on those tracks until you clear the target."
                    : "Each tool chooses its normal safe target, usually recent or missing-metadata tracks."}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {incomingTrackScopeIds.length > 0 && !scopedTrackIds.length && (
                  <button className="secondary-button h-9" type="button" onClick={() => setToolTarget("selected")}>
                    Use Selected
                  </button>
                )}
                <button className="secondary-button h-9" type="button" onClick={() => onSelectLibraryTarget("tracks")}>
                  Choose Tracks
                </button>
                <button className="secondary-button h-9" type="button" onClick={() => onSelectLibraryTarget("albums")}>
                  Choose Albums
                </button>
                <button
                  className="secondary-button h-9"
                  type="button"
                  disabled={!scopedTrackIds.length}
                  onClick={() => setToolTarget("tool-default")}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <FileManagementNavigator
            sections={fileManagementSections}
            visibleSectionIds={visibleSectionIds}
            activeCategory={toolCategory}
            setActiveCategory={setToolCategory}
            query={toolSearch}
            setQuery={setToolSearch}
          />

          {visibleSectionIds.size === 0 && (
            <div className="rounded border border-dashed border-line bg-panel px-4 py-8 text-center text-sm text-muted">
              No file-management tools match that filter.
            </div>
          )}

          {showTool("optionalDependencies") && (
            <OptionalDependenciesSection
              audioConversionSetup={audioConversionSetup}
              clapStatus={clapStatus}
              clapInstallProgress={clapInstallProgress}
              isClapInstalling={isClapInstalling}
              defaultOpen={initialFocusToolId === "optionalDependencies"}
              openSignal={openSignalFor("optionalDependencies") ?? undefined}
              onRefreshAudioConversionSetup={onRefreshAudioConversionSetup}
              onInstallAudioConversionFfmpeg={onInstallAudioConversionFfmpeg}
              onRefreshClapStatus={onRefreshClapStatus}
              onInstallClap={onInstallClap}
              setStatus={setStatus}
            />
          )}

          {showTool("filenameTags") && (
          <DisclosureSection title="Filename Tag Inference" description="Infer metadata from folder and file naming patterns">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Pattern</span>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 min-w-0 flex-1 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                    value={allFilenameTagPresets.includes(filenameTagPattern) ? filenameTagPattern : ""}
                    onChange={(event) => {
                      if (event.target.value) {
                        setFilenameTagPattern(event.target.value);
                      }
                    }}
                  >
                    <option value="" disabled>
                      Choose saved pattern
                    </option>
                    {allFilenameTagPresets.map((pattern) => (
                      <option key={pattern} value={pattern}>
                        {pattern}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button h-9"
                    type="button"
                    disabled={!filenameTagPattern.trim() || allFilenameTagPresets.includes(filenameTagPattern.trim())}
                    onClick={saveCurrentFilenameTagPreset}
                  >
                    <Save size={15} />
                    Save
                  </button>
                  <button className="secondary-button h-9" type="button" disabled={!isCustomFilenameTagPreset} onClick={deleteCurrentFilenameTagPreset}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                  value={filenameTagPattern}
                  onChange={(event) => setFilenameTagPattern(event.target.value)}
                />
                {filenamePresetMessage && <span className="text-xs text-moss">{filenamePresetMessage}</span>}
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Only fill empty fields</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={filenameTagMissingOnly}
                    onChange={(event) => setFilenameTagMissingOnly(event.target.checked)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" onClick={exportFilenamePresets}>
                    <Download size={15} />
                    Export Presets
                  </button>
                  <button className="secondary-button" type="button" onClick={importFilenamePresets}>
                    <Upload size={15} />
                    Import Presets
                  </button>
                </div>
              </div>
              <textarea
                className="min-h-20 rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                value={filenamePresetJson}
                placeholder="Custom preset JSON appears here for export or paste an array here to import."
                onChange={(event) => setFilenamePresetJson(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onLoadDuplicateReview(duplicateScopeForAction(), duplicateGroups)}
                >
                  <ListChecks size={15} />
                  Load Review
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onPreviewFilenameTags(filenameTagPattern, filenameTagMissingOnly, currentScope(scopedTrackIds))}
                >
                  <Wand2 size={15} />
                  Preview Tags
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={Boolean(filenameTagPreview) && acceptedChangedFilenameIds.length === 0}
                  onClick={() =>
                    void onApplyFilenameTags(
                      filenameTagPattern,
                      filenameTagMissingOnly,
                      filenameTagPreview ? acceptedChangedFilenameIds : currentScope(scopedTrackIds),
                    )
                  }
                >
                  <FileText size={15} />
                  {filenameTagPreview ? "Apply Accepted" : "Apply Tags"}
                </button>
              </div>
              {filenameTagPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {filenameTagPreview.matches.toLocaleString()} matches, {filenameTagPreview.applied.toLocaleString()} applied,{" "}
                    {acceptedChangedFilenameIds.length.toLocaleString()} accepted changes
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {filenameTagPreview.previews.slice(0, 50).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_1fr] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-moss"
                          checked={acceptedFilenameTrackIds.has(preview.track_id)}
                          disabled={!preview.matched || preview.changed_fields.length === 0}
                          onChange={() => toggleAcceptedFilenameTrack(preview.track_id)}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-muted">{preview.path}</div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {preview.error ??
                              (preview.matched
                                ? preview.changed_fields.length
                                  ? preview.changed_fields.join(", ")
                                  : "Matched; no fields need changes"
                                : "No match")}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {duplicateReview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-neutral-200">
                      {duplicateReview.tracks.length.toLocaleString()} tracks loaded,{" "}
                      {duplicateReview.groups.length.toLocaleString()} review groups
                    </div>
                    {duplicateReview.missing_track_ids.length > 0 && (
                      <div className="text-ember">
                        {duplicateReview.missing_track_ids.length.toLocaleString()} selected track{duplicateReview.missing_track_ids.length === 1 ? "" : "s"} could not be loaded.
                      </div>
                    )}
                  </div>
                  {duplicateReview.groups.length > 0 && (
                    <div className="mb-3 grid gap-1">
                      {duplicateReview.groups.slice(0, 10).map((group) => (
                        <div key={group.key} className="rounded bg-panel px-2 py-1.5">
                          <div className="truncate text-neutral-200">
                            {group.key} - keep #{group.recommended_keep_id ?? "?"}
                          </div>
                          <div className="truncate text-muted">{group.recommendation_reason ?? group.match_reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="max-h-80 overflow-auto rounded border border-line/70">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                      <thead className="sticky top-0 bg-panel text-[11px] uppercase text-muted">
                        <tr>
                          <th className="px-2 py-2">Title</th>
                          <th className="px-2 py-2">Artist</th>
                          <th className="px-2 py-2">Album</th>
                          <th className="px-2 py-2">Rating</th>
                          <th className="px-2 py-2">Bitrate</th>
                          <th className="px-2 py-2">Path</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateReview.tracks.slice(0, 100).map((track) => (
                          <tr key={track.id} className="border-t border-line/60">
                            <td className="max-w-48 truncate px-2 py-1.5 text-neutral-200">{track.title ?? "(untitled)"}</td>
                            <td className="max-w-40 truncate px-2 py-1.5 text-muted">{track.artist ?? ""}</td>
                            <td className="max-w-40 truncate px-2 py-1.5 text-muted">{track.album ?? ""}</td>
                            <td className="px-2 py-1.5 text-muted">{track.rating ?? "-"}</td>
                            <td className="px-2 py-1.5 text-muted">{track.bitrate ? Math.round(track.bitrate / 1000) : "-"}</td>
                            <td className="max-w-72 truncate px-2 py-1.5 text-muted" title={track.path}>
                              {track.path}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("regexTags") && (
          <DisclosureSection title="Regex Tag Cleanup" description="Preview and apply MusicBee-style search/replace for common text tags">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 md:grid-cols-[180px_1fr_1fr]">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Field</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={tagRegexField}
                    onChange={(event) => setTagRegexField(event.target.value as typeof tagRegexField)}
                  >
                    <option value="title">Title</option>
                    <option value="artist">Artist</option>
                    <option value="album">Album</option>
                    <option value="album_artist">Album Artist</option>
                    <option value="genre">Genre</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Find Regex</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={tagRegexPattern}
                    placeholder="Example: \\s+feat\\..*$"
                    onChange={(event) => setTagRegexPattern(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Replace With</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={tagRegexReplacement}
                    placeholder="Leave blank to remove matches"
                    onChange={(event) => setTagRegexReplacement(event.target.value)}
                  />
                </label>
              </div>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Case sensitive match</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={tagRegexCaseSensitive}
                  onChange={(event) => setTagRegexCaseSensitive(event.target.checked)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void onPreviewTagRegex(
                      tagRegexField,
                      tagRegexPattern,
                      tagRegexReplacement,
                      tagRegexCaseSensitive,
                      currentScope(scopedTrackIds),
                    )
                  }
                >
                  <Eye size={15} />
                  Preview Replace
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={(tagRegexPreview?.changed ?? 1) === 0}
                  onClick={() =>
                    void onApplyTagRegex(
                      tagRegexField,
                      tagRegexPattern,
                      tagRegexReplacement,
                      tagRegexCaseSensitive,
                      currentScope(scopedTrackIds),
                    )
                  }
                >
                  <Wand2 size={15} />
                  Apply Replace
                </button>
              </div>
              {tagRegexPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {tagRegexPreview.changed.toLocaleString()} changed, {tagRegexPreview.applied.toLocaleString()} applied
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {tagRegexPreview.previews.slice(0, 60).map((preview) => (
                      <div key={preview.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">{preview.path}</div>
                        <div className={preview.error ? "truncate text-ember" : preview.changed ? "truncate text-neutral-200" : "truncate text-muted"}>
                          {preview.error ??
                            (preview.changed
                              ? `${preview.current ?? ""} -> ${preview.replacement ?? ""}`
                              : "No change")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("writeMetadataFiles") && (
          <DisclosureSection title="Write Database Tags To Files" description="Preview SQLite values, then write them into supported local audio tags">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                This is the reverse of Sync File Metadata. It writes FLAC Cafe's current library values into files, so use Preview first.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span>
                    <span className="block text-neutral-200">Write editable metadata</span>
                    <span className="text-xs text-muted">Title, artist, album, album artist, track/disc, genre, and year.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={fileWriteIncludeMetadata}
                    onChange={(event) => setFileWriteIncludeMetadata(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span>
                    <span className="block text-neutral-200">Write ratings</span>
                    <span className="text-xs text-muted">Stores the SQLite star rating in supported file rating tags.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ember"
                    checked={fileWriteIncludeRatings}
                    onChange={(event) => setFileWriteIncludeRatings(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} scoped track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Blank scope previews the 500 most recently edited music tracks"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={fileWriteBusy}
                    onClick={() => void previewDatabaseFileWrites(false)}
                  >
                    <Eye size={15} />
                    Preview File Writes
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={fileWriteBusy || !fileWritePreview || pendingFileWriteIds().length === 0}
                    onClick={() => void previewDatabaseFileWrites(true)}
                    title={
                      !fileWritePreview
                        ? "Preview file writes first"
                        : pendingFileWriteIds().length === 0
                          ? "No pending file tag changes"
                          : "Write pending SQLite values into file tags"
                    }
                  >
                    <Save size={15} />
                    Write Changed To Files
                  </button>
                </div>
              </div>
              {fileWritePreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 grid gap-2 sm:grid-cols-4">
                    <div>
                      <div className="font-semibold text-white">{fileWritePreview.total.toLocaleString()}</div>
                      <div className="text-muted">Checked</div>
                    </div>
                    <div>
                      <div className="font-semibold text-moss">{fileWritePreview.changed.toLocaleString()}</div>
                      <div className="text-muted">Different</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{fileWritePreview.applied.toLocaleString()}</div>
                      <div className="text-muted">Written</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{pendingFileWriteIds().length.toLocaleString()}</div>
                      <div className="text-muted">Pending</div>
                    </div>
                  </div>
                  {fileWritePreview.changed === 0 && fileWritePreview.errors.length === 0 && (
                    <div className="mb-3 rounded border border-moss/30 bg-moss/10 px-3 py-2 text-moss">
                      These files already match the SQLite metadata for the selected options.
                    </div>
                  )}
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {fileWritePreview.previews.slice(0, 80).map((preview) => (
                      <div key={preview.track_id} className="grid gap-1 rounded bg-panel px-2 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 truncate font-medium text-neutral-200">
                            {preview.title || preview.path.split(/[\\/]/).pop()}
                          </div>
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                            preview.error
                              ? "border-ember/40 text-ember"
                              : preview.applied
                                ? "border-moss/40 text-moss"
                                : preview.changed_fields.length
                                  ? "border-line text-muted"
                                  : "border-line/60 text-muted"
                          }`}
                          >
                            {preview.error ? "error" : preview.applied ? "written" : preview.changed_fields.length ? "pending" : "matched"}
                          </span>
                        </div>
                        <div className="truncate text-muted">{preview.artist || preview.path}</div>
                        <div className={preview.error ? "truncate text-ember" : preview.changed_fields.length ? "text-muted" : "truncate text-moss"}>
                          {preview.error ??
                            (preview.changed_fields.length
                              ? fileWriteChangeDetails(preview).join("; ")
                              : "No file tag changes")}
                        </div>
                      </div>
                    ))}
                  </div>
                  {fileWritePreview.errors.length > 0 && (
                    <details className="mt-3 text-xs text-ember">
                      <summary>File write errors</summary>
                      <div className="mt-2 grid gap-1">
                        {fileWritePreview.errors.slice(0, 20).map((error) => (
                          <div key={error} className="truncate">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("musicBrainz") && (
          <DisclosureSection
            title="MusicBrainz Auto-Tag"
            description="Preview album or track matches, missing-field fills, and Cover Art Archive artwork"
            defaultOpen={initialFocusToolId === "musicBrainz"}
            openSignal={openSignalFor("musicBrainz")}
          >
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Match Mode</span>
                    <select
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={autoTagMode}
                      onChange={(event) => setAutoTagMode(event.target.value as "album" | "track")}
                    >
                      <option value="album">Album / release</option>
                      <option value="track">Individual tracks</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Write Mode</span>
                    <select
                      className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={autoTagMissingOnly ? "missing" : "replace"}
                      onChange={(event) => setAutoTagMissingOnly(event.target.value === "missing")}
                    >
                      <option value="missing">Fill missing only</option>
                      <option value="replace">Replace metadata</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                    <span className="text-muted">Find artwork</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={autoTagIncludeArtwork}
                      onChange={(event) => setAutoTagIncludeArtwork(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                    <span className="text-muted">Save cover</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={autoTagSaveArtwork}
                      onChange={(event) => setAutoTagSaveArtwork(event.target.checked)}
                    />
                  </label>
                  <label className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${autoTagWriteToFiles ? "border-ember/40 bg-ember/10" : "border-line/70 bg-ink"}`}>
                    <span>
                      <span className="block text-neutral-200">Write tags to files</span>
                      <span className="block text-xs text-muted">SQLite is always updated.</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={autoTagWriteToFiles}
                      onChange={(event) => setAutoTagWriteToFiles(event.target.checked)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  {scopedTrackIds.length
                    ? `${scopedTrackIds.length.toLocaleString()} scoped track${scopedTrackIds.length === 1 ? "" : "s"}`
                    : "Blank scope uses recently added tracks; fill-empty mode limits it to incomplete metadata"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void previewMusicBrainzAutoTags()}
                  >
                    <Eye size={15} />
                    Preview Matches
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={Boolean(autoTagPreview) && autoTagChangedIds.length === 0 && (!autoTagSaveArtwork || autoTagArtworkIds.length === 0)}
                    onClick={() => void applyMusicBrainzAutoTags()}
                  >
                    <Wand2 size={15} />
                    {autoTagPreview ? "Apply Accepted" : "Apply Auto-Tags"}
                  </button>
                </div>
              </div>

              {autoTagPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 grid gap-2 sm:grid-cols-4">
                    <div>
                      <div className="font-semibold text-white">{autoTagPreview.matched}</div>
                      <div className="text-muted">Matched</div>
                    </div>
                    <div>
                      <div className="font-semibold text-moss">{autoTagPreview.changed}</div>
                      <div className="text-muted">With changes</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{autoTagPreview.artwork_matches}</div>
                      <div className="text-muted">Artwork matches</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{acceptedAutoTagTrackIds.size}</div>
                      <div className="text-muted">Accepted</div>
                    </div>
                  </div>
                  {autoTagPreview.matched === 0 && (
                    <div className="mb-3 rounded border border-ember/40 bg-ember/10 px-3 py-2 text-ember">
                      No MusicBrainz matches were found. For singles or tracks with a wrong album tag, try Individual tracks and Replace metadata.
                    </div>
                  )}
                  <div className="grid max-h-96 gap-1 overflow-auto pr-1">
                    {autoTagPreview.previews.slice(0, 80).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_52px_1fr] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-4 h-4 w-4 accent-moss"
                          checked={acceptedAutoTagTrackIds.has(preview.track_id)}
                          disabled={Boolean(preview.error) || (preview.changed_fields.length === 0 && !preview.artwork_url && !preview.applied && !preview.artwork_saved)}
                          onChange={() => toggleAutoTagTrack(preview.track_id)}
                        />
                        <div className="h-12 w-12 overflow-hidden rounded border border-line bg-ink">
                          {preview.artwork_thumbnail_url ? (
                            <img className="h-full w-full object-cover" src={preview.artwork_thumbnail_url} alt="" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted">No art</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-neutral-200">
                              {preview.proposed.title ? String(preview.proposed.title) : preview.path.split(/[\\/]/).pop()}
                            </span>
                            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">
                              {(preview.confidence * 100).toFixed(0)}%
                            </span>
                            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] uppercase text-muted">
                              {preview.match_type}
                            </span>
                            {(preview.applied || preview.artwork_saved) && (
                              <span className="rounded border border-moss/40 bg-moss/10 px-1.5 py-0.5 text-[10px] uppercase text-moss">
                                Applied
                              </span>
                            )}
                          </div>
                          <div className="truncate text-muted">
                            {[preview.proposed.artist, preview.proposed.album].filter(Boolean).map(String).join(" - ")}
                          </div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-moss"}>
                            {autoTagFieldSummary(preview)}
                          </div>
                          {preview.changed_fields.length > 0 && (
                            <div className="mt-1 grid gap-0.5 text-[11px] text-muted">
                              {autoTagChangeDetails(preview).map((detail) => (
                                <div key={detail} className="truncate">{detail}</div>
                              ))}
                            </div>
                          )}
                          {preview.release_title && (
                            <div className="truncate text-muted">
                              Release: {preview.release_title}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  {autoTagPreview.errors.length > 0 && (
                    <details className="mt-3 text-xs text-ember">
                      <summary>Auto-tag errors</summary>
                      <div className="mt-2 grid gap-1">
                        {autoTagPreview.errors.slice(0, 20).map((error) => (
                          <div key={error} className="truncate">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("clapGenreTags") && (
          <DisclosureSection
            title="CLAP Genre Tags"
            description="Preview CLAP genre predictions before copying them into editable metadata"
            defaultOpen={initialFocusToolId === "clapGenreTags"}
            openSignal={openSignalFor("clapGenreTags")}
          >
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span>
                    <span className="block text-neutral-200">Only fill empty genres</span>
                    <span className="text-xs text-muted">Leaves existing genre tags alone unless this is off.</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={clapGenreMissingOnly}
                    onChange={(event) => setClapGenreMissingOnly(event.target.checked)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Min Confidence {(clapGenreMinConfidence * 100).toFixed(0)}%</span>
                  <input
                    className="accent-moss"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={clapGenreMinConfidence}
                    onChange={(event) => setClapGenreMinConfidence(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted">
                  Requires tracks already analyzed by CLAP. The preview is limited to 500 tracks per pass.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button" type="button" disabled={clapGenreBusy} onClick={() => void previewClapGenreTags(false)}>
                    <Eye size={15} />
                    Preview Genres
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={clapGenreBusy || (clapGenrePreview?.changed ?? 1) === 0}
                    onClick={() => void previewClapGenreTags(true)}
                  >
                    <Wand2 size={15} />
                    Apply Preview
                  </button>
                </div>
              </div>
              {clapGenrePreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 grid gap-2 sm:grid-cols-4">
                    <div>
                      <div className="font-semibold text-white">{clapGenrePreview.total.toLocaleString()}</div>
                      <div className="text-muted">Analyzed</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">{clapGenrePreview.matched.toLocaleString()}</div>
                      <div className="text-muted">Predicted</div>
                    </div>
                    <div>
                      <div className="font-semibold text-moss">{clapGenrePreview.changed.toLocaleString()}</div>
                      <div className="text-muted">Would change</div>
                    </div>
                    <div>
                      <div className="font-semibold text-ember">{clapGenrePreview.applied.toLocaleString()}</div>
                      <div className="text-muted">Applied</div>
                    </div>
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {clapGenrePreview.previews.slice(0, 80).map((preview) => (
                      <div key={preview.track_id} className="grid gap-1 rounded bg-panel px-2 py-2">
                        <div className="truncate font-medium text-neutral-200">
                          {preview.title || "(untitled)"}
                          {preview.artist ? ` - ${preview.artist}` : ""}
                        </div>
                        <div className="truncate text-muted">
                          {preview.album || "Unknown album"}
                        </div>
                        <div className={preview.error ? "text-ember" : preview.changed ? "text-moss" : "text-muted"}>
                          {preview.error ??
                            `${preview.current_genre || "(empty)"} -> ${preview.proposed_genre || "(none)"}${
                              preview.confidence !== null && preview.confidence !== undefined
                                ? ` (${(preview.confidence * 100).toFixed(0)}%)`
                                : ""
                            }${preview.applied ? " - applied" : preview.changed ? "" : " - no change"}`}
                        </div>
                      </div>
                    ))}
                  </div>
                  {clapGenrePreview.errors.length > 0 && (
                    <details className="mt-3 text-xs text-ember">
                      <summary>CLAP genre notes</summary>
                      <div className="mt-2 grid gap-1">
                        {clapGenrePreview.errors.slice(0, 20).map((error) => (
                          <div key={error} className="truncate">{error}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("volumeTags") && (
          <VolumeTagsSection
            scopedTrackIds={scopedTrackIds}
            ffmpegSetup={audioConversionSetup}
            defaultOpen={initialFocusToolId === "volumeTags"}
            openSignal={openSignalFor("volumeTags") ?? undefined}
            onRefreshFfmpeg={onRefreshAudioConversionSetup}
            onInstallFfmpeg={onInstallAudioConversionFfmpeg}
            onLibraryChanged={onAdvancedTagLibraryChanged}
            setStatus={setStatus}
          />
          )}

          {showTool("organizer") && (
          <DisclosureSection title="File Organizer" description="Preview tag-based renames/reorganization and export a review report">
            <div className="grid gap-4 text-sm text-neutral-200">
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Template</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 font-mono text-xs text-white outline-none ring-moss/40 focus:ring-2"
                  value={organizeTemplate}
                  onChange={(event) => setOrganizeTemplate(event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Base Folder</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={organizeBaseFolder}
                  placeholder={folderPath || "Leave empty to use the music folder"}
                  onChange={(event) => setOrganizeBaseFolder(event.target.value)}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Name Collisions</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={organizeCollisionStrategy}
                    onChange={(event) => setOrganizeCollisionStrategy(event.target.value as "skip" | "auto_rename")}
                  >
                    <option value="skip">Skip existing files</option>
                    <option value="auto_rename">Auto-rename with (2)</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Remove empty source folders</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={organizeCleanupEmptyFolders}
                    onChange={(event) => setOrganizeCleanupEmptyFolders(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onPreviewFileOrganization(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <Eye size={15} />
                  Preview Renames
                </button>
                <button className="secondary-button" type="button" onClick={() => void onExportFileOrganizationReport(organizeTemplate, organizeBaseFolder, organizationOptions())}>
                  <Download size={15} />
                  Export Rename Report
                </button>
                <button className="primary-button" type="button" onClick={() => void applyFileOrganization()}>
                  <FolderOpen size={15} />
                  Rename/Reorganize
                </button>
              </div>
              {fileOrganizationPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {fileOrganizationPreview.changed_count.toLocaleString()} possible renames, {fileOrganizationPreview.applied.toLocaleString()} applied
                    {fileOrganizationPreview.removed_empty_folders
                      ? `, ${fileOrganizationPreview.removed_empty_folders.toLocaleString()} empty folders removed`
                      : ""}
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {fileOrganizationPreview.changes.slice(0, 50).map((change) => (
                      <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">{change.current_path}</div>
                        <div className={change.error || change.collision ? "truncate text-ember" : "truncate text-neutral-200"}>
                          {change.target_path}
                          {change.collision ? " - collision" : ""}
                          {change.error ? ` - ${change.error}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fileOrganizationReport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{fileOrganizationReport.report_path}</div>
                  <div>
                    {fileOrganizationReport.changed_count.toLocaleString()} changes, {fileOrganizationReport.collisions.toLocaleString()} collisions
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("deviceSync") && (
          <DisclosureSection title="Device Sync Folder" description="Preview copy jobs and playlist exports for a phone, USB drive, or portable player">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 rounded border border-line bg-ink p-3">
                <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto_auto]">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Saved Profile</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={deviceSyncProfileId ?? ""}
                      onChange={(event) => {
                        const profile = deviceSyncProfiles.find((item) => item.id === Number(event.target.value));
                        if (profile) {
                          applyDeviceSyncProfile(profile);
                        } else {
                          setDeviceSyncProfileId(null);
                        }
                      }}
                    >
                      <option value="">New profile</option>
                      {deviceSyncProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Profile Name</span>
                    <input
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={deviceSyncProfileName}
                      placeholder="Phone, USB stick, car player"
                      onChange={(event) => setDeviceSyncProfileName(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button self-end" type="button" onClick={() => void saveCurrentDeviceSyncProfile()}>
                    <Save size={15} />
                    Save
                  </button>
                  <button className="secondary-button self-end" type="button" disabled={!deviceSyncProfileId} onClick={() => void deleteCurrentDeviceSyncProfile()}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Preset</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      defaultValue=""
                      onChange={(event) => {
                        const preset = deviceSyncPresets.find((item) => item.name === event.target.value);
                        if (preset) {
                          applyDeviceSyncProfile(preset);
                        }
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Load Android/USB preset</option>
                      {deviceSyncPresets.map((preset) => (
                        <option key={preset.name} value={preset.name}>{preset.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Mounted Device</span>
                    <select
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      defaultValue=""
                      onChange={(event) => {
                        const device = deviceSyncDevices.find((item) => item.id === event.target.value);
                        if (device) {
                          useDetectedDevice(device);
                        }
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="">Use detected drive</option>
                      {deviceSyncDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.id} - {device.label} ({device.hint ?? "drive"})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-button self-end" type="button" onClick={() => void loadDeviceSyncSupport()}>
                    <RefreshCw size={15} />
                    Refresh
                  </button>
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Target Folder</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={deviceSyncTarget}
                  placeholder="Example: E:\\Music"
                  onChange={(event) => setDeviceSyncTarget(event.target.value)}
                />
              </label>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Device Type</span>
                  <select
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                    value={deviceSyncDeviceKind}
                    onChange={(event) => setDeviceSyncDeviceKind(event.target.value as DeviceSyncProfilePayload["device_kind"])}
                  >
                    <option value="folder">Folder</option>
                    <option value="usb">USB drive</option>
                    <option value="android_folder">Android folder</option>
                    <option value="android_mtp">Android MTP note</option>
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Music Subfolder</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={deviceSyncMusicSubfolder}
                    placeholder="Music"
                    onChange={(event) => setDeviceSyncMusicSubfolder(event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Playlist Subfolder</span>
                  <input
                    className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={deviceSyncPlaylistSubfolder}
                    placeholder="Playlists"
                    onChange={(event) => setDeviceSyncPlaylistSubfolder(event.target.value)}
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Copy audio files</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncCopyFiles}
                    onChange={(event) => setDeviceSyncCopyFiles(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Export playlists</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncExportPlaylists}
                    onChange={(event) => setDeviceSyncExportPlaylists(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Preserve folders</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={deviceSyncPreserveStructure}
                    onChange={(event) => setDeviceSyncPreserveStructure(event.target.checked)}
                  />
                </label>
              </div>
              <div className="rounded border border-line bg-ink p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs uppercase text-muted">Playlists</div>
                  <button
                    className="text-xs text-moss hover:text-white"
                    type="button"
                    onClick={() =>
                      setDeviceSyncPlaylistIds(
                        deviceSyncPlaylistIds.size === playlists.length
                          ? new Set()
                          : new Set(playlists.map((playlist) => playlist.id)),
                      )
                    }
                  >
                    {deviceSyncPlaylistIds.size === playlists.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className="grid max-h-48 gap-1 overflow-auto pr-1">
                  {playlists.map((playlist) => (
                    <label key={playlist.id} className="flex items-center justify-between gap-3 rounded bg-panel px-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-200">{playlist.name}</span>
                        <span className="block truncate text-xs text-muted">{playlist.track_count.toLocaleString()} tracks</span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-moss"
                        checked={deviceSyncPlaylistIds.has(playlist.id)}
                        onChange={() => toggleDeviceSyncPlaylist(playlist.id)}
                      />
                    </label>
                  ))}
                  {playlists.length === 0 && <div className="py-4 text-center text-xs text-muted">No playlists yet.</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onDeviceSync(deviceSyncTarget, deviceSyncOptions(false))}>
                  <Eye size={15} />
                  Preview Sync
                </button>
                <button className="primary-button" type="button" onClick={() => void onDeviceSync(deviceSyncTarget, deviceSyncOptions(true))}>
                  <FolderOpen size={15} />
                  Sync Folder
                </button>
              </div>
              {deviceSyncPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {deviceSyncPreview.changed_files.toLocaleString()} files need copy,{" "}
                    {deviceSyncPreview.copied_files.toLocaleString()} copied,{" "}
                    {deviceSyncPreview.playlists_written.toLocaleString()} playlists written
                  </div>
                  {deviceSyncPreview.playlist_exports.length > 0 && (
                    <div className="mb-3 grid gap-1">
                      {deviceSyncPreview.playlist_exports.map((playlist) => (
                        <div key={playlist.playlist_id} className="rounded bg-panel px-2 py-1.5">
                          <div className={playlist.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                            {playlist.name} - {playlist.track_count.toLocaleString()} tracks
                          </div>
                          <div className="truncate text-muted">{playlist.error ?? playlist.playlist_path}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {deviceSyncPreview.changes.slice(0, 60).map((change) => (
                      <div key={change.track_id} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-neutral-200">{change.title ?? change.source_path}</div>
                        <div className={change.error ? "truncate text-ember" : "truncate text-muted"}>
                          {change.error ?? change.target_path}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("cdRipper") && (
          <CdRipperSection
            defaultTargetFolder={defaultCdRipTarget(folderPath)}
            onBrowseTarget={onBrowseCdRipTarget}
            onPlayPreviewTrack={onPlayCdPreviewTrack}
            setStatus={setStatus}
          />
          )}

          {showTool("audioConversion") && (
          <AudioConversionSection
            scopedTrackIds={scopedTrackIds}
            setup={audioConversionSetup}
            preview={audioConversionPreview}
            progress={audioConversionProgress}
            defaultTargetFolder={defaultAudioConversionTarget(folderPath)}
            onBrowseTarget={onBrowseAudioConversionTarget}
            onOpenOptionalDependencies={openOptionalDependenciesSection}
            onPreview={onPreviewAudioConversion}
            onStart={onStartAudioConversion}
            onCancel={onCancelAudioConversion}
          />
          )}

          {showTool("libraryImporters") && <LibraryImportersSection setStatus={setStatus} />}

          {showTool("csvMetadata") && (
          <DisclosureSection title="CSV Metadata Import" description="Spreadsheet cleanup with saved mappings, conflict review, and blank-field control">
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => void onExportMetadataCsv(currentScope(scopedTrackIds))}>
                  <Download size={15} />
                  Export CSV
                </button>
                {metadataCsvExport && (
                  <button className="secondary-button" type="button" onClick={() => setMetadataCsvPath(metadataCsvExport.csv_path)}>
                    <FileText size={15} />
                    Use Last Export
                  </button>
                )}
              </div>
              {metadataCsvExport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{metadataCsvExport.csv_path}</div>
                  <div>{metadataCsvExport.track_count.toLocaleString()} tracks exported</div>
                </div>
              )}
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Import CSV Path</span>
                <input
                  className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={metadataCsvPath}
                  placeholder="Paste the exported CSV path"
                  onChange={(event) => setMetadataCsvPath(event.target.value)}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2">
                  <span className="text-xs uppercase text-muted">Saved Mapping Profile</span>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-9 min-w-0 flex-1 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
                      value={csvProfileName}
                      onChange={(event) => loadCsvProfile(event.target.value)}
                    >
                      <option value="">Choose profile</option>
                      {csvProfiles.map((profile) => (
                        <option key={profile.name} value={profile.name}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-9 min-w-44 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={csvProfileName}
                      placeholder="Profile name"
                      onChange={(event) => setCsvProfileName(event.target.value)}
                    />
                  </div>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <button className="secondary-button h-9" type="button" onClick={saveCsvProfile}>
                    <Save size={15} />
                    Save
                  </button>
                  <button className="secondary-button h-9" type="button" disabled={!csvProfileName.trim()} onClick={deleteCsvProfile}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>
              <label className="grid gap-2">
                <span className="text-xs uppercase text-muted">Column Map JSON</span>
                <textarea
                  className="min-h-24 rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={csvColumnMapText}
                  placeholder='{"title":"Title","artist":"Artist","rating":"Stars"}'
                  onChange={(event) => setCsvColumnMapText(event.target.value)}
                />
              </label>
              {csvProfileMessage && <div className="text-xs text-moss">{csvProfileMessage}</div>}
              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Only fill empty fields on import</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={metadataCsvMissingOnly}
                    onChange={(event) => setMetadataCsvMissingOnly(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <span className="text-muted">Clear fields when CSV cells are blank</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={metadataCsvClearBlankFields}
                    onChange={(event) => setMetadataCsvClearBlankFields(event.target.checked)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" type="button" onClick={() => withCsvOptions((options) => onPreviewMetadataCsv(metadataCsvPath, metadataCsvMissingOnly, options))}>
                  <EyeOff size={15} />
                  Preview Import
                </button>
                <button className="secondary-button" type="button" onClick={() => withCsvOptions((options) => onExportMetadataCsvReport(metadataCsvPath, metadataCsvMissingOnly, options))}>
                  <Download size={15} />
                  Export Dry Run
                </button>
                <button className="primary-button" type="button" onClick={() => withCsvOptions((options) => onApplyMetadataCsv(metadataCsvPath, metadataCsvMissingOnly, options))}>
                  <Upload size={15} />
                  Import CSV
                </button>
              </div>
              {metadataCsvImportPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-2 text-neutral-200">
                    {metadataCsvImportPreview.changed.toLocaleString()} changed rows, {metadataCsvImportPreview.applied.toLocaleString()} applied
                  </div>
                  <div className="grid max-h-80 gap-1 overflow-auto pr-1">
                    {metadataCsvImportPreview.previews.slice(0, 50).map((preview) => (
                      <div key={`${preview.row_number}-${preview.track_id ?? "missing"}`} className="grid gap-1 rounded bg-panel px-2 py-1.5">
                        <div className="truncate text-muted">
                          Row {preview.row_number}
                          {preview.path ? ` - ${preview.path}` : ""}
                        </div>
                        <div className={preview.error ? "truncate text-ember" : "truncate text-neutral-200"}>
                          {preview.error ??
                            (preview.changed_fields.length
                              ? preview.changed_fields.join(", ")
                              : preview.matched
                                ? "Matched; no fields need changes"
                                : "No match")}
                        </div>
                        {preview.conflict_fields.length > 0 && (
                          <div className="text-ember">
                            Conflicts:{" "}
                            {preview.conflict_fields
                              .map((field) => `${field} ${previewLabel(preview.current[field])} -> ${previewLabel(preview.imported[field])}`)
                              .join("; ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {metadataCsvImportReport && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div className="truncate">{metadataCsvImportReport.report_path}</div>
                  <div>
                    {metadataCsvImportReport.changed.toLocaleString()} changed rows, {metadataCsvImportReport.errors.toLocaleString()} errors captured
                  </div>
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("advancedTags") && (
          <AdvancedTagToolsSection
            scopedTrackIds={scopedTrackIds}
            onLibraryChanged={onAdvancedTagLibraryChanged}
            setStatus={setStatus}
          />
          )}

          {showTool("duplicates") && (
          <DisclosureSection title="Duplicate Review" description="Keep the best copy, remove selected tracks, reveal files, or export a duplicate report">
            <div className="grid gap-4 text-sm text-neutral-200">
              <details className="rounded border border-line/70 bg-ink px-3 py-2">
                <summary className="cursor-pointer text-xs uppercase text-muted">Advanced duplicate target overrides</summary>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Specific Tracks</span>
                    <input
                      className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={duplicateTrackIdsText}
                      placeholder="Optional advanced override. Blank uses the current target."
                      onChange={(event) => setDuplicateTrackIdsText(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs uppercase text-muted">Keep-Best Groups</span>
                    <textarea
                      className="min-h-20 rounded border border-line bg-panel px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                      value={duplicateGroupsText}
                      placeholder="One duplicate group per line, for example: 12, 34, 56"
                      onChange={(event) => setDuplicateGroupsText(event.target.value)}
                    />
                  </label>
                </div>
              </details>
              <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                <span className="text-muted">Also delete files from disk</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={duplicateDeleteFiles}
                  onChange={(event) => setDuplicateDeleteFiles(event.target.checked)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void onDuplicateAction({
                      action: "export_report",
                      track_ids: duplicateScopeForAction(),
                    })
                  }
                >
                  <Download size={15} />
                  Export Report
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!duplicateScopeForAction().length}
                  onClick={() => void onRevealTracksByIds(duplicateScopeForAction())}
                >
                  <FolderOpen size={15} />
                  Reveal One
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!duplicateScopeForAction().length && duplicateGroups.length === 0}
                  onClick={() =>
                    void onDuplicateAction({
                      action: "keep_best",
                      track_ids: duplicateScopeForAction(),
                      groups: duplicateGroups,
                      delete_files: duplicateDeleteFiles,
                    })
                  }
                >
                  <CheckCircle2 size={15} />
                  Keep Best
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!duplicateScopeForAction().length}
                  onClick={() =>
                    void onDuplicateAction({
                      action: "remove_selected",
                      track_ids: duplicateScopeForAction(),
                      delete_files: duplicateDeleteFiles,
                    })
                  }
                >
                  <Trash2 size={15} />
                  Remove Selected
                </button>
              </div>
              {duplicateActionResult && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div>
                    {duplicateActionResult.action}: {duplicateActionResult.affected.toLocaleString()} affected
                    {duplicateActionResult.deleted_files ? `, ${duplicateActionResult.deleted_files.toLocaleString()} files deleted` : ""}
                  </div>
                  {duplicateActionResult.report_path && <div className="truncate">{duplicateActionResult.report_path}</div>}
                  {duplicateActionResult.errors.map((error) => (
                    <div key={error} className="truncate text-ember">
                      {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DisclosureSection>
          )}

          {showTool("acousticFingerprints") && (
          <DisclosureSection
            title="Acoustic Fingerprints"
            description="Chromaprint fpcalc pass for duplicate matching and optional AcoustID-assisted tagging"
            defaultOpen={initialFocusToolId === "acousticFingerprints"}
            openSignal={openSignalFor("acousticFingerprints")}
          >
            <div className="grid gap-4 text-sm text-neutral-200">
              <div className="grid gap-3 rounded border border-line bg-ink p-3 md:grid-cols-[1fr_220px] md:items-end">
                <div>
                  <div className="text-xs uppercase text-muted">Fingerprint Target</div>
                  <div className="mt-1 text-neutral-200">
                    {scopedTrackIds.length
                      ? `${scopedTrackIds.length.toLocaleString()} selected track${scopedTrackIds.length === 1 ? "" : "s"}`
                      : "Tool default target"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Run fingerprints first. With an AcoustID key in Settings, Auto-Tag can identify tracks from audio.
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                      type="button"
                      onClick={onOpenApiKeysSettings}
                    >
                      Manage API Keys
                    </button>
                    <button
                      className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                      type="button"
                      onClick={() => void openExternalUrl(ACOUSTID_API_KEY_URL, setStatus)}
                    >
                      Get AcoustID key
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
                <NumberField label="Fingerprint Limit" value={acousticLimit} min={1} max={10000} onChange={setAcousticLimit} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 rounded border border-line/70 bg-ink px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={acousticOverwrite}
                    onChange={(event) => setAcousticOverwrite(event.target.checked)}
                  />
                  <span className="text-muted">Overwrite existing fingerprints</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={!fingerprintTagMissingOnly}
                      onChange={(event) => setFingerprintTagMissingOnly(!event.target.checked)}
                    />
                    Replace metadata
                  </label>
                  <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={fingerprintTagSaveArtwork}
                      onChange={(event) => setFingerprintTagSaveArtwork(event.target.checked)}
                    />
                    Save cover
                  </label>
                  <label className="flex items-center gap-2 rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={fingerprintTagWriteToFiles}
                      onChange={(event) => setFingerprintTagWriteToFiles(event.target.checked)}
                    />
                    Write files
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void analyzeAcousticFingerprints()}
                  >
                    <Fingerprint size={15} />
                    Analyze Fingerprints
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void previewAcousticFingerprintTags()}
                  >
                    <Wand2 size={15} />
                    Preview Fingerprint Tags
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={fingerprintAutoTagIds.length === 0}
                    onClick={() => void applyAcousticFingerprintTags()}
                  >
                    <Save size={15} />
                    Apply Accepted Fingerprint Tags
                  </button>
                </div>
              </div>
              <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
                Fingerprint tag preview is AcoustID-only. It will not fall back to title, artist, or album text search.
              </div>
              {autoTagPreviewSource === "fingerprint" && autoTagPreview && (
                <div className="rounded border border-line bg-ink p-3 text-xs">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">Fingerprint tag preview</div>
                      <div className="mt-1 text-muted">
                        {autoTagPreview.matched.toLocaleString()} matched, {autoTagPreview.changed.toLocaleString()} with metadata changes,{" "}
                        {acceptedAutoTagTrackIds.size.toLocaleString()} accepted
                      </div>
                    </div>
                    <button
                      className="primary-button h-8"
                      type="button"
                      disabled={fingerprintAutoTagIds.length === 0}
                      onClick={() => void applyAcousticFingerprintTags()}
                    >
                      <Save size={14} />
                      Apply Accepted
                    </button>
                  </div>
                  {autoTagPreview.matched === 0 && (
                    <div className="mb-3 rounded border border-ember/40 bg-ember/10 px-3 py-2 text-ember">
                      No AcoustID fingerprint matches were found. Confirm the API key is saved, then run Analyze Fingerprints.
                    </div>
                  )}
                  <div className="grid max-h-64 gap-1 overflow-auto pr-1">
                    {autoTagPreview.previews.slice(0, 50).map((preview) => (
                      <label key={preview.track_id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded bg-panel px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-moss"
                          checked={acceptedAutoTagTrackIds.has(preview.track_id)}
                          disabled={Boolean(preview.error) || (preview.changed_fields.length === 0 && !preview.artwork_url && !preview.applied && !preview.artwork_saved)}
                          onChange={() => toggleAutoTagTrack(preview.track_id)}
                        />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium text-neutral-200">
                              {preview.proposed.title ? String(preview.proposed.title) : preview.path.split(/[\\/]/).pop()}
                            </span>
                            {(preview.applied || preview.artwork_saved) && (
                              <span className="shrink-0 rounded border border-moss/40 bg-moss/10 px-1.5 py-0.5 text-[10px] uppercase text-moss">
                                Applied
                              </span>
                            )}
                          </div>
                          <div className="truncate text-muted">
                            {[preview.proposed.artist, preview.proposed.album].filter(Boolean).map(String).join(" - ")}
                          </div>
                          <div className={preview.error ? "truncate text-ember" : "truncate text-moss"}>
                            {autoTagFieldSummary(preview)}
                          </div>
                          {preview.changed_fields.length > 0 && (
                            <div className="mt-1 grid gap-0.5 text-[11px] text-muted">
                              {autoTagChangeDetails(preview).map((detail) => (
                                <div key={detail} className="truncate">{detail}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="w-24 text-right text-[10px] uppercase text-muted">
                          <div>{(preview.confidence * 100).toFixed(0)}%</div>
                          <div className="truncate">{preview.source.includes("AcoustID") ? "AcoustID" : preview.source}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {acousticFingerprintResult && (
                <div className="rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                  <div>
                    {acousticFingerprintResult.tool_available ? "fpcalc available" : "fpcalc missing"} -{" "}
                    {acousticFingerprintResult.updated.toLocaleString()} updated, {acousticFingerprintResult.skipped.toLocaleString()} skipped
                  </div>
                  {acousticFingerprintResult.errors.map((error) => (
                    <div key={error} className="truncate text-ember">
                      {error}
                    </div>
                  ))}
                  {acousticFingerprintResult.skipped_reasons?.map((reason) => (
                    <div key={reason} className="truncate text-muted">
                      {reason}
                    </div>
                  ))}
                </div>
              )}
              <details className="rounded border border-line bg-ink p-3 text-xs text-muted">
                <summary className="cursor-pointer select-none text-xs uppercase text-neutral-200">
                  Chromaprint Setup
                  <span className={chromaprintSetup?.available ? "ml-2 text-moss" : "ml-2 text-ember"}>
                    {chromaprintSetup?.available ? "Ready" : "Needs setup"}
                  </span>
                </summary>
                <div className="mt-3 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>{chromaprintSetup?.message ?? "Checking fpcalc setup"}</div>
                    <button className="secondary-button h-8" type="button" onClick={() => void onRefreshChromaprintSetup()}>
                      <RefreshCw size={14} />
                      Check
                    </button>
                  </div>
                  {chromaprintSetup?.resolved_path && <div className="truncate">Using {chromaprintSetup.resolved_path}</div>}
                  {chromaprintSetup?.version && <div className="truncate">{chromaprintSetup.version}</div>}
                  <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={fpcalcPath}
                    placeholder={chromaprintSetup?.tool_directory ? `${chromaprintSetup.tool_directory}\\fpcalc.exe` : "Path to fpcalc.exe"}
                    onChange={(event) => setFpcalcPath(event.target.value)}
                  />
                  <button className="secondary-button h-9" type="button" onClick={() => void onSaveChromaprintSetup(fpcalcPath.trim() || null)}>
                    <Save size={15} />
                    Save Path
                  </button>
                  <button className="secondary-button h-9" type="button" onClick={() => void onSaveChromaprintSetup(null)}>
                    Clear
                  </button>
                </div>
                {chromaprintSetup?.tool_directory && (
                  <div className="truncate">
                    Bundled by default. Custom option: put fpcalc.exe in {chromaprintSetup.tool_directory}; PATH is optional.
                  </div>
                )}
                {chromaprintSetup?.errors.map((error) => (
                  <div key={error} className="truncate text-ember">
                    {error}
                  </div>
                ))}
                </div>
              </details>
            </div>
          </DisclosureSection>
          )}

          {showTool("reportViewer") && (
          <ReportViewerSection
            reportPath={reportPath}
            setReportPath={setReportPath}
            fileOrganizationReport={fileOrganizationReport}
            metadataCsvImportReport={metadataCsvImportReport}
            duplicateActionResult={duplicateActionResult}
            reportFile={reportFile}
            onReadReportFile={onReadReportFile}
          />
          )}

          {showTool("cacheUndo") && (
          <CacheUndoLogSection
            bulkUndoLog={bulkUndoLog}
            bulkUndoBatches={bulkUndoBatches}
            bulkUndoRestoreResult={bulkUndoRestoreResult}
            onRefreshUndoLog={onRefreshUndoLog}
            onRestoreUndoEntry={onRestoreUndoEntry}
            onRestoreUndoBatch={onRestoreUndoBatch}
            onClearArtistCache={onClearArtistCache}
            onClearLibraryCaches={onClearLibraryCaches}
          />
          )}
        </div>
        </DisclosureAccordionProvider>
      </section>
    </main>
  );
}
