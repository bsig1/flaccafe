import {
  Album,
  BarChart3,
  BookOpen,
  Clock3,
  Disc3,
  FileText,
  FolderCog,
  FolderOpen,
  Gauge,
  HardDrive,
  HeartPulse,
  Keyboard,
  KeyRound,
  Library,
  ListMusic,
  Mic2,
  Music,
  Palette,
  Podcast,
  Radio,
  RadioTower,
  Send,
  Settings,
  SlidersHorizontal,
  Tags,
  UserRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  desktopFetchAlbums,
  desktopFetchArtists,
  desktopFetchPlaylists,
  desktopFetchTrackPage,
} from "../../lib/desktopLibrary";
import type {
  AlbumSummary,
  ArtistSummary,
  PlaylistSummary,
  Track,
} from "../../types/api";
import {
  display,
} from "../shared";
import type { Page } from "../shared";
import {
  fileManagementSections,
} from "../pages/file-management/FileManagementNavigator";

export type SidebarSearchKind =
  | "page"
  | "settings"
  | "fileManagement"
  | "track"
  | "album"
  | "artist"
  | "playlist";

interface SidebarSearchBase {
  key: string;
  kind: SidebarSearchKind;
  label: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
}

export type SidebarSearchTarget =
  | (SidebarSearchBase & { kind: "page"; page: Page })
  | (SidebarSearchBase & { kind: "settings"; sectionId: string })
  | (SidebarSearchBase & { kind: "fileManagement"; toolId: string })
  | (SidebarSearchBase & { kind: "track"; track: Track })
  | (SidebarSearchBase & { kind: "album"; album: AlbumSummary })
  | (SidebarSearchBase & { kind: "artist"; artist: ArtistSummary })
  | (SidebarSearchBase & { kind: "playlist"; playlist: PlaylistSummary });

export interface ScoredSidebarSearchTarget {
  target: SidebarSearchTarget;
  score: number;
}

const pageTargets: SidebarSearchTarget[] = [
  {
    key: "page-library",
    kind: "page",
    page: "library",
    label: "Library",
    description: "Tracks, albums, artists, playlists, health, and inbox",
    keywords: ["music", "tracks", "albums", "artists", "playlists", "health", "inbox"],
    icon: Library,
  },
  {
    key: "page-now-playing",
    kind: "page",
    page: "nowPlaying",
    label: "Now Playing",
    description: "Current queue, synced lyrics, and playback view",
    keywords: ["queue", "lyrics", "current track", "playback"],
    icon: FileText,
  },
  {
    key: "page-artist",
    kind: "page",
    page: "artist",
    label: "Artist",
    description: "Artist biography, local top tracks, and Wikipedia lookup",
    keywords: ["wikipedia", "bio", "lookup", "local tracks"],
    icon: UserRound,
  },
  {
    key: "page-autodj",
    kind: "page",
    page: "autodj",
    label: "AutoDJ",
    description: "Generate queues, recommendation profiles, and avoid rules",
    keywords: ["recommendations", "queue", "profiles", "avoid"],
    icon: RadioTower,
  },
  {
    key: "page-audiobooks",
    kind: "page",
    page: "audiobooks",
    label: "Audiobooks",
    description: "Audiobook chapters, bookmarks, and progress",
    keywords: ["chapters", "bookmarks", "progress"],
    icon: BookOpen,
  },
  {
    key: "page-history",
    kind: "page",
    page: "history",
    label: "History",
    description: "Played, skipped, and rated track history",
    keywords: ["plays", "skips", "ratings", "stats"],
    icon: Clock3,
  },
  {
    key: "page-podcasts",
    kind: "page",
    page: "podcasts",
    label: "Podcasts",
    description: "Podcast subscriptions and downloaded episodes",
    keywords: ["rss", "subscriptions", "episodes", "downloads"],
    icon: Podcast,
  },
  {
    key: "page-radio",
    kind: "page",
    page: "radio",
    label: "Web Radio",
    description: "Local web radio station list",
    keywords: ["streams", "stations", "internet radio"],
    icon: Radio,
  },
  {
    key: "page-scrobbling",
    kind: "page",
    page: "scrobbling",
    label: "Scrobbling",
    description: "Last.fm and scrobble queue tools",
    keywords: ["lastfm", "last.fm", "scrobble", "accounts"],
    icon: Send,
  },
  {
    key: "page-cd",
    kind: "page",
    page: "cd",
    label: "CD",
    description: "CD playback and ripping",
    keywords: ["disc", "rip", "drive", "musicbrainz"],
    icon: Disc3,
  },
  {
    key: "page-sources",
    kind: "page",
    page: "sources",
    label: "Sources",
    description: "Library folders, scan, and folder watch",
    keywords: ["folders", "scan", "watch", "library path"],
    icon: FolderOpen,
  },
  {
    key: "page-analysis",
    kind: "page",
    page: "analysis",
    label: "Analysis",
    description: "CLAP coverage, audio analysis, and embeddings",
    keywords: ["clap", "genre", "embeddings", "coverage"],
    icon: BarChart3,
  },
  {
    key: "page-file-management",
    kind: "page",
    page: "fileManagement",
    label: "File Management",
    description: "Tags, imports, conversion, duplicate review, and device sync",
    keywords: ["tags", "files", "duplicates", "conversion", "sync", "imports"],
    icon: FolderCog,
  },
  {
    key: "page-settings",
    kind: "page",
    page: "settings",
    label: "Settings",
    description: "Preferences, playback, shortcuts, and maintenance",
    keywords: ["preferences", "theme", "shortcuts", "maintenance", "audio"],
    icon: Settings,
  },
];

const settingsTargets: SidebarSearchTarget[] = [
  {
    key: "settings-library-preferences",
    kind: "settings",
    sectionId: "Library Preferences",
    label: "Library Preferences",
    description: "Display, file paths, rating storage, startup page, and theme",
    keywords: ["display", "ratings", "metadata", "startup", "theme", "font", "density", "sidebar width", "sidebar position", "right sidebar", "checkbox", "delete"],
    icon: Palette,
  },
  {
    key: "settings-api-keys",
    kind: "settings",
    sectionId: "apiKeys",
    label: "API Keys",
    description: "AcoustID, Last.fm, online metadata, and scrobbling keys",
    keywords: ["acoustid", "lastfm", "last.fm", "musicbrainz", "scrobbling", "metadata"],
    icon: KeyRound,
  },
  {
    key: "settings-keyboard-shortcuts",
    kind: "settings",
    sectionId: "Keyboard Shortcuts",
    label: "Keyboard Shortcuts",
    description: "Page navigation, playback shortcuts, media keys, and HTTP shortcuts",
    keywords: ["hotkeys", "keybinds", "advanced http", "get", "post", "patch", "delete"],
    icon: Keyboard,
  },
  {
    key: "settings-playback-engine",
    kind: "settings",
    sectionId: "Playback Engine",
    label: "Playback Engine",
    description: "Rust output, devices, backend diagnostics, and codec checks",
    keywords: ["audio", "rust", "device", "wasapi", "asio", "cpal", "codec", "gapless"],
    icon: Gauge,
  },
  {
    key: "settings-lyrics",
    kind: "settings",
    sectionId: "Lyrics",
    label: "Lyrics",
    description: "Automatic lyric fetching, synced cache, and bulk lookup",
    keywords: ["lrc", "lrclib", "sidecar", "cache", "bulk lookup", "follow", "source"],
    icon: FileText,
  },
  {
    key: "settings-replaygain",
    kind: "settings",
    sectionId: "ReplayGain",
    label: "ReplayGain",
    description: "Loudness normalization, target level, and clipping protection",
    keywords: ["volume", "loudness", "normalization", "gain", "clipping"],
    icon: SlidersHorizontal,
  },
  {
    key: "settings-equalizer",
    kind: "settings",
    sectionId: "Equalizer / DSP",
    label: "Equalizer / DSP",
    description: "EQ bands, presets, preamp, and limiter",
    keywords: ["eq", "dsp", "presets", "limiter", "preamp"],
    icon: SlidersHorizontal,
  },
  {
    key: "settings-playback-behavior",
    kind: "settings",
    sectionId: "Playback Behavior & Codecs",
    label: "Playback Behavior & Codecs",
    description: "Fade, skip threshold, codec support, and playback behavior",
    keywords: ["fade", "skip", "codec", "format", "crossfade"],
    icon: Music,
  },
  {
    key: "settings-maintenance",
    kind: "settings",
    sectionId: "Maintenance",
    label: "Maintenance",
    description: "Backend diagnostics, support bundle, folders, cache, and reset",
    keywords: ["backend", "diagnostics", "database", "support bundle", "logs", "cache", "reset"],
    icon: Wrench,
  },
  {
    key: "settings-extensions",
    kind: "settings",
    sectionId: "Extensions And Skins",
    label: "Extensions And Skins",
    description: "Theme folders, manifests, plugins, and customization",
    keywords: ["themes", "skins", "plugins", "manifest", "customization"],
    icon: HardDrive,
  },
];

const fileManagementIconByCategory: Record<string, LucideIcon> = {
  Setup: Wrench,
  Tags,
  Files: FolderCog,
  Devices: HardDrive,
  Import: ListMusic,
  Maintenance: HeartPulse,
};

export function buildStaticSidebarSearchTargets(showCdPage: boolean): SidebarSearchTarget[] {
  const fileTargets: SidebarSearchTarget[] = fileManagementSections.map((section) => ({
    key: `file-management-${section.id}`,
    kind: "fileManagement",
    toolId: section.id,
    label: section.title,
    description: section.description,
    keywords: [section.category, ...section.keywords],
    icon: fileManagementIconByCategory[section.category] ?? FolderCog,
  }));
  return [
    ...pageTargets.filter((target) => target.kind !== "page" || target.page !== "cd" || showCdPage),
    ...settingsTargets,
    ...fileTargets,
  ];
}

export function searchSidebarTargets(
  targets: SidebarSearchTarget[],
  query: string,
  limit = 12,
): ScoredSidebarSearchTarget[] {
  return targets
    .map((target) => ({ target, score: scoreSidebarSearchTarget(target, query) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.target.label.localeCompare(right.target.label))
    .slice(0, limit);
}

export async function searchLibrarySidebarTargets(query: string): Promise<ScoredSidebarSearchTarget[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }
  const [tracksResult, albumsResult, artistsResult, playlistsResult] = await Promise.allSettled([
    desktopFetchTrackPage({ search: trimmed, limit: 6, offset: 0, sortBy: "artist", sortDirection: "asc" }),
    desktopFetchAlbums(trimmed, 5, 0),
    desktopFetchArtists(trimmed, 5, 0),
    desktopFetchPlaylists(),
  ]);
  const targets: SidebarSearchTarget[] = [];
  if (tracksResult.status === "fulfilled") {
    targets.push(...tracksResult.value.tracks.map(trackToSearchTarget));
  }
  if (albumsResult.status === "fulfilled") {
    targets.push(...albumsResult.value.slice(0, 5).map(albumToSearchTarget));
  }
  if (artistsResult.status === "fulfilled") {
    targets.push(...artistsResult.value.slice(0, 5).map(artistToSearchTarget));
  }
  if (playlistsResult.status === "fulfilled") {
    targets.push(...playlistsResult.value.map(playlistToSearchTarget));
  }
  return searchSidebarTargets(dedupeTargets(targets), trimmed, 14);
}

function trackToSearchTarget(track: Track): SidebarSearchTarget {
  const title = display(track.title, "Untitled Track");
  const artist = display(track.artist, "Unknown Artist");
  const album = display(track.album, "Unknown Album");
  return {
    key: `library-track-${track.id}`,
    kind: "track",
    track,
    label: title,
    description: `${artist} - ${album}`,
    keywords: [artist, album, display(track.album_artist, ""), display(track.genre, ""), track.path],
    icon: Music,
  };
}

function albumToSearchTarget(album: AlbumSummary): SidebarSearchTarget {
  const title = display(album.album, "Untitled Album");
  const artist = display(album.album_artist, "Unknown Artist");
  return {
    key: `library-album-${album.id}`,
    kind: "album",
    album,
    label: title,
    description: `${artist} - ${album.track_count.toLocaleString()} tracks`,
    keywords: [artist, String(album.year ?? ""), `${album.track_count} tracks`],
    icon: Album,
  };
}

function artistToSearchTarget(artist: ArtistSummary): SidebarSearchTarget {
  return {
    key: `library-artist-${artist.name}`,
    kind: "artist",
    artist,
    label: artist.name,
    description: `${artist.track_count.toLocaleString()} tracks - ${artist.album_count.toLocaleString()} albums`,
    keywords: [`${artist.track_count} tracks`, `${artist.album_count} albums`],
    icon: Mic2,
  };
}

function playlistToSearchTarget(playlist: PlaylistSummary): SidebarSearchTarget {
  return {
    key: `library-playlist-${playlist.id}`,
    kind: "playlist",
    playlist,
    label: playlist.name,
    description: `${playlist.track_count.toLocaleString()} tracks`,
    keywords: ["playlist", `${playlist.track_count} tracks`],
    icon: ListMusic,
  };
}

function scoreSidebarSearchTarget(target: SidebarSearchTarget, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 0;
  }
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const label = normalizeSearchText(target.label);
  const description = normalizeSearchText(target.description);
  const keywords = normalizeSearchText(target.keywords.join(" "));
  const haystack = `${label} ${description} ${keywords}`.trim();
  const matchedTerms = terms.filter((term) => haystack.includes(term));
  if (matchedTerms.length === 0) {
    return 0;
  }
  const tokenSet = new Set(label.split(" ").filter(Boolean));
  let score = matchedTerms.length * 8 - (terms.length - matchedTerms.length) * 7;
  if (label === normalizedQuery) {
    score += 120;
  } else if (label.startsWith(normalizedQuery)) {
    score += 80;
  } else if (label.includes(normalizedQuery)) {
    score += 52;
  }
  if (acronymForText(label).startsWith(normalizedQuery)) {
    score += 32;
  }
  terms.forEach((term) => {
    if (tokenSet.has(term)) {
      score += 18;
    } else if (label.split(" ").some((token) => token.startsWith(term))) {
      score += 12;
    } else if (keywords.includes(term)) {
      score += 7;
    } else if (description.includes(term)) {
      score += 4;
    }
  });
  if (target.kind === "track" || target.kind === "album" || target.kind === "artist" || target.kind === "playlist") {
    score += 10;
  }
  return score;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function acronymForText(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => token[0])
    .join("");
}

function dedupeTargets(targets: SidebarSearchTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.key)) {
      return false;
    }
    seen.add(target.key);
    return true;
  });
}
