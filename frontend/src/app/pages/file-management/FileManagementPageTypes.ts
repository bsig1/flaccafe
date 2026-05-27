import type {
  AcousticFingerprintResponse,
  AudioConversionInstallProgress,
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
} from "../../../types/api";
import type {
  CsvImportOptions,
  FileOrganizationOptions,
} from "./fileManagementUtils";
import type { AudioConversionOptions } from "./AudioConversionSection";

export type AutoTagRequestOptions = {
  fingerprintOnly?: boolean;
};

export type FileManagementPageProps = {
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
  audioConversionInstallProgress: AudioConversionInstallProgress | null;
  audioConversionPreview: AudioConversionPreviewResponse | null;
  audioConversionProgress: AudioConversionProgress | null;
  onRefreshAudioConversionSetup: () => void | Promise<void>;
  onSaveAudioConversionSetup: (ffmpegPath: string | null) => void | Promise<void>;
  onInstallAudioConversionFfmpeg: () => void | Promise<void>;
  onBrowseAudioConversionTarget: () => Promise<string | null>;
  onBrowseCdRipTarget: () => Promise<string | null>;
  cdAutoLookupMetadata: boolean;
  currentCdPlaybackDriveId?: string | null;
  isCdPlaybackActive?: boolean;
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
};
