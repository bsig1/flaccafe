import type {
  AlbumSummary,
  ArtistSummary,
  Track,
} from "../../../types/api";

export const FILE_WRITE_PREVIEW_LIMIT = 100_000;

export const DEFAULT_FILENAME_TAG_PATTERNS = [
  "<Album Artist> - <Album> [<Year>]/<Track#> - <Artist> - <Title>",
  "<Album Artist>/<Album>/<Track#> - <Title>",
  "<Artist> - <Album>/<Disc#>-<Track#> - <Title>",
  "<Genre>/<Artist>/<Album> (<Year>)/<Track#> - <Title>",
];

const FILENAME_TAG_PRESETS_KEY = "flacCafeFilenameTagPresets";
const CSV_IMPORT_PROFILES_KEY = "flacCafeCsvImportProfiles";

export const CSV_IMPORT_FIELDS = [
  "title",
  "artist",
  "album",
  "album_artist",
  "track_number",
  "disc_number",
  "genre",
  "year",
  "rating",
] as const;

export type FileOrganizationOptions = {
  collisionStrategy?: "skip" | "auto_rename";
  cleanupEmptyFolders?: boolean;
  trackIds?: number[] | null;
};

export type AutoTagProgressState = {
  phase: "preview" | "apply";
  label: string;
  completed: number;
  total: number;
};

export type LibraryTargetSearchResult =
  | { kind: "track"; key: string; label: string; description: string; track: Track }
  | { kind: "album"; key: string; label: string; description: string; album: AlbumSummary }
  | { kind: "artist"; key: string; label: string; description: string; artist: ArtistSummary };

export type CsvImportOptions = {
  trackIds?: number[] | null;
  columnMap?: Record<string, string>;
  clearBlankFields?: boolean;
};

export interface CsvImportProfile {
  name: string;
  columnMap: Record<string, string>;
  missingOnly: boolean;
  clearBlankFields: boolean;
}

export function readFilenameTagPresets(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FILENAME_TAG_PRESETS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function writeFilenameTagPresets(patterns: string[]) {
  window.localStorage.setItem(FILENAME_TAG_PRESETS_KEY, JSON.stringify(patterns));
}

export function readCsvProfiles(): CsvImportProfile[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CSV_IMPORT_PROFILES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((profile): profile is CsvImportProfile => {
        return Boolean(
          profile &&
            typeof profile.name === "string" &&
            profile.name.trim() &&
            typeof profile.columnMap === "object" &&
            !Array.isArray(profile.columnMap),
        );
      })
      .map((profile) => ({
        name: profile.name.trim(),
        columnMap: profile.columnMap,
        missingOnly: profile.missingOnly !== false,
        clearBlankFields: Boolean(profile.clearBlankFields),
      }));
  } catch {
    return [];
  }
}

export function writeCsvProfiles(profiles: CsvImportProfile[]) {
  window.localStorage.setItem(CSV_IMPORT_PROFILES_KEY, JSON.stringify(profiles));
}

export function parseTrackIds(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(/[,\s]+/)
        .map((chunk) => Number(chunk.trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
}

export function parseDuplicateGroups(text: string): number[][] {
  return text
    .split(/\r?\n/)
    .map((line) => parseTrackIds(line))
    .filter((group) => group.length > 1);
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function previewLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "(blank)";
  }
  return String(value);
}

export function currentScope(trackIds: number[]): number[] | null {
  return trackIds.length ? trackIds : null;
}

export function reportSummary(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "JSON report";
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["total", "matched", "changed", "changed_count", "errors", "profile_count"]) {
    const item = record[key];
    if (typeof item === "number") {
      parts.push(`${key.replace("_", " ")}: ${item.toLocaleString()}`);
    }
  }
  if (Array.isArray(record.groups)) {
    parts.push(`groups: ${record.groups.length.toLocaleString()}`);
  }
  if (Array.isArray(record.previews)) {
    parts.push(`previews: ${record.previews.length.toLocaleString()}`);
  }
  if (Array.isArray(record.comparisons)) {
    parts.push(`comparisons: ${record.comparisons.length.toLocaleString()}`);
  }
  return parts.length ? parts.join(" / ") : "JSON report";
}

export function canRestoreUndo(actionType: string): boolean {
  return [
    "csv_metadata_import",
    "regex_metadata_replace",
    "musicbrainz_auto_tag",
    "file_organization",
    "track_remove",
    "advanced_tag_edit",
    "tag_backup_restore",
    "sqlite_file_tag_write",
  ].includes(actionType);
}
