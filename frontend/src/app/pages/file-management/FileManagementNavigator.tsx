import {
Search,
X,
} from "lucide-react";

export type FileManagementCategory = "All" | "Setup" | "Tags" | "Files" | "Devices" | "Import" | "Maintenance";

export interface FileManagementSectionMeta {
  id: string;
  title: string;
  description: string;
  category: Exclude<FileManagementCategory, "All">;
  keywords: string[];
}

export const fileManagementCategories: FileManagementCategory[] = [
  "All",
  "Setup",
  "Tags",
  "Files",
  "Devices",
  "Import",
  "Maintenance",
];

export const fileManagementSections: FileManagementSectionMeta[] = [
  {
    id: "optionalDependencies",
    title: "Optional Dependencies",
    description: "Install and inspect large optional runtimes such as CLAP and FFmpeg.",
    category: "Setup",
    keywords: ["dependencies", "install", "setup", "ml", "clap", "ffmpeg", "runtime", "torch", "transformers"],
  },
  {
    id: "filenameTags",
    title: "Filename Tag Inference",
    description: "Infer metadata from folder and file naming patterns.",
    category: "Tags",
    keywords: ["metadata", "title", "artist", "album", "track number", "patterns"],
  },
  {
    id: "regexTags",
    title: "Regex Tag Cleanup",
    description: "Preview and apply search/replace cleanup for common text tags.",
    category: "Tags",
    keywords: ["replace", "preset", "artist cleanup", "metadata"],
  },
  {
    id: "writeMetadataFiles",
    title: "Write Database Tags To Files",
    description: "Push FLAC Cafe's SQLite metadata and ratings into local audio tags.",
    category: "Tags",
    keywords: ["sqlite", "database", "write", "sync", "files", "ratings", "metadata"],
  },
  {
    id: "musicBrainz",
    title: "MusicBrainz Auto-Tag",
    description: "Preview album or track matches, missing-field fills, and artwork.",
    category: "Tags",
    keywords: ["autotag", "musicbrainz", "cover art archive", "metadata"],
  },
  {
    id: "clapGenreTags",
    title: "CLAP Genre Tags",
    description: "Preview and copy CLAP genre predictions into editable Genre tags.",
    category: "Tags",
    keywords: ["clap", "genre", "analysis", "embeddings", "classification", "metadata"],
  },
  {
    id: "volumeTags",
    title: "Volume Tags",
    description: "Analyze loudness and write ReplayGain-style volume tags.",
    category: "Tags",
    keywords: ["volume", "gain", "replaygain", "loudness", "normalization", "ffmpeg"],
  },
  {
    id: "organizer",
    title: "File Organizer",
    description: "Preview tag-based renames/reorganization and export a review report.",
    category: "Files",
    keywords: ["move", "rename", "folders", "template", "paths"],
  },
  {
    id: "deviceSync",
    title: "Device Sync Folder",
    description: "Copy files and playlists to phones, USB drives, or portable players.",
    category: "Devices",
    keywords: ["android", "usb", "playlist export", "sync"],
  },
  {
    id: "audioConversion",
    title: "Audio Conversion",
    description: "Transcode local files with metadata, artwork, resampling, and normalization.",
    category: "Files",
    keywords: ["ffmpeg", "transcode", "normalize", "resample", "convert"],
  },
  {
    id: "libraryImporters",
    title: "Library Importers",
    description: "Bring ratings and play counts from other desktop libraries.",
    category: "Import",
    keywords: ["musicbee", "itunes", "windows media player", "ratings", "plays"],
  },
  {
    id: "csvMetadata",
    title: "CSV Metadata Import",
    description: "Spreadsheet cleanup with saved mappings and dry-run reports.",
    category: "Import",
    keywords: ["spreadsheet", "csv", "export", "mapping", "metadata"],
  },
  {
    id: "advancedTags",
    title: "Advanced Tag Tools",
    description: "Custom tags, virtual tags, copy/swap, presets, and backup/restore.",
    category: "Tags",
    keywords: ["custom tags", "virtual tags", "backup", "restore", "copy", "swap"],
  },
  {
    id: "duplicates",
    title: "Duplicate Review",
    description: "Keep the best copy, reveal files, or export duplicate reports.",
    category: "Maintenance",
    keywords: ["duplicates", "delete", "cleanup", "report"],
  },
  {
    id: "acousticFingerprints",
    title: "Acoustic Fingerprints",
    description: "Chromaprint fingerprints for duplicate matching and optional AcoustID-assisted tagging.",
    category: "Maintenance",
    keywords: ["chromaprint", "fpcalc", "fingerprint", "duplicates", "tagging", "musicbrainz", "acoustid"],
  },
  {
    id: "reportViewer",
    title: "Report Viewer",
    description: "Open JSON reports from imports, file organization, duplicate review, and AutoDJ.",
    category: "Maintenance",
    keywords: ["json", "report", "dry run", "preview"],
  },
  {
    id: "cacheUndo",
    title: "Cache And Undo Log",
    description: "Clear derived data and restore recent bulk actions.",
    category: "Maintenance",
    keywords: ["undo", "restore", "cache", "rollback"],
  },
];

export function filterFileManagementSections(
  sections: FileManagementSectionMeta[],
  category: FileManagementCategory,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return sections.filter((section) => {
    const categoryMatches = category === "All" || section.category === category;
    if (!categoryMatches) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = [
      section.title,
      section.description,
      section.category,
      ...section.keywords,
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function FileManagementNavigator({
  sections,
  visibleSectionIds,
  activeCategory,
  setActiveCategory,
  query,
  setQuery,
}: {
  sections: FileManagementSectionMeta[];
  visibleSectionIds: Set<string>;
  activeCategory: FileManagementCategory;
  setActiveCategory: (category: FileManagementCategory) => void;
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <div className="rounded border border-line bg-panel p-4 shadow-sm shadow-black/10">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-2 text-sm text-neutral-200">
          <span className="text-xs uppercase text-muted">Find Tools</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className="h-10 w-full rounded border border-line bg-ink pl-9 pr-9 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={query}
              placeholder="Search tags, artwork, duplicates, devices, reports..."
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-white/10 hover:text-white"
                type="button"
                title="Clear file-management search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </span>
        </label>
        <div className="rounded border border-line/70 bg-ink px-3 py-2 text-xs text-muted">
          {visibleSectionIds.size.toLocaleString()} of {sections.length.toLocaleString()} visible
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {fileManagementCategories.map((category) => {
          const count = category === "All"
            ? sections.length
            : sections.filter((section) => section.category === category).length;
          const active = activeCategory === category;
          return (
            <button
              key={category}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-moss/40 bg-moss/15 text-white"
                  : "border-line bg-ink text-muted hover:bg-white/5 hover:text-white"
              }`}
              type="button"
              onClick={() => setActiveCategory(category)}
            >
              {category}
              <span className="ml-2 text-muted">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
