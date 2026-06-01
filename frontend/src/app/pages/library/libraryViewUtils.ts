import type {
AlbumSummary,
ArtistSummary,
Track,
} from "../../../types/api";
import {
display,
formatDuration,
trackGenre,
} from "../../shared";

export const COLLECTION_VIRTUAL_OVERSCAN = 8;
export const COMPLETION_COLLAPSED_ROW_HEIGHT = 92;
export const COMPLETION_EXPANDED_ROW_ESTIMATE = 360;
export const ARTIST_ROW_HEIGHT = 68;
export const ALBUM_LIST_ROW_HEIGHT = 68;
export const ALBUM_GRID_ROW_HEIGHT = 236;
export const PLAYLIST_ROW_HEIGHT = 66;
export const PLAYLIST_TOOLBAR_HEIGHT = 118;
export const TRACK_CONTEXT_ROW_HEIGHT = 36;
export const TRACK_CONTEXT_HEADER_HEIGHT = 34;
export const TRACK_CONTEXT_DIVIDER_HEIGHT = 9;
export const TRACK_TAGGING_SUBMENU_HEIGHT = 260;
export const TRACK_RATING_SUBMENU_HEIGHT = 218;
export const TRACK_RATING_SUBMENU_WIDTH = 192;
export const TRACK_PLAYLIST_SUBMENU_WIDTH = 240;
export const TRACK_SUBMENU_CLOSE_DELAY_MS = 700;
export const TRACK_VIRTUALIZATION_THRESHOLD = 260;
export const TRACK_VIRTUALIZATION_OVERSCAN = 18;
export const LIBRARY_ACTIONS_MENU_WIDTH = 288;
export const LIBRARY_ACTIONS_MENU_HEIGHT = 270;

export type ContextSubmenuKey = "tagging" | "rating" | "avoid" | "playlist";

function albumYearsLabel(album: AlbumSummary): string {
  const years = Array.from(new Set(album.years ?? (album.year ? [album.year] : []))).sort((a, b) => a - b);
  if (years.length === 0) {
    return "";
  }
  return years.length <= 3 ? years.join(", ") : `${years[0]}-${years[years.length - 1]}`;
}

function albumEditionLabel(album: AlbumSummary): string {
  const count = album.edition_count ?? album.album_ids?.length ?? 1;
  return count > 1 ? `${count} editions` : "";
}

export function albumMetaLabel(album: AlbumSummary): string {
  return [display(album.album_artist), `${album.track_count} tracks`, formatDuration(album.duration_seconds), albumYearsLabel(album), albumEditionLabel(album)]
    .filter(Boolean)
    .join(" - ");
}

function artistYearsLabel(artist: ArtistSummary): string {
  if (!artist.first_year && !artist.last_year) {
    return "";
  }
  if (artist.first_year && artist.last_year && artist.first_year !== artist.last_year) {
    return `${artist.first_year}-${artist.last_year}`;
  }
  return String(artist.first_year ?? artist.last_year);
}

export function artistMetaLabel(artist: ArtistSummary): string {
  return [
    `${artist.track_count} track${artist.track_count === 1 ? "" : "s"}`,
    `${artist.album_count} album${artist.album_count === 1 ? "" : "s"}`,
    artistYearsLabel(artist),
    formatDuration(artist.duration_seconds),
  ]
    .filter(Boolean)
    .join(" - ");
}

export const missingMetadataFilters = [
  { id: "all", label: "All" },
  { id: "title", label: "Title" },
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
  { id: "album_artist", label: "Album Artist" },
  { id: "track", label: "Track #" },
  { id: "genre", label: "Genre" },
  { id: "year", label: "Year" },
  { id: "duration", label: "Duration" },
] as const;

export type MissingMetadataFilter = (typeof missingMetadataFilters)[number]["id"];

export function missingMetadataFields(track: Track): Array<{ id: MissingMetadataFilter; label: string }> {
  const fields: Array<{ id: MissingMetadataFilter; label: string }> = [];
  if (!track.title?.trim()) {
    fields.push({ id: "title", label: "Title" });
  }
  if (!track.artist?.trim()) {
    fields.push({ id: "artist", label: "Artist" });
  }
  if (!track.album?.trim()) {
    fields.push({ id: "album", label: "Album" });
  }
  if (!track.album_artist?.trim()) {
    fields.push({ id: "album_artist", label: "Album Artist" });
  }
  if (track.track_number === null || track.track_number === undefined) {
    fields.push({ id: "track", label: "Track #" });
  }
  if (!trackGenre(track)?.trim()) {
    fields.push({ id: "genre", label: "Genre" });
  }
  if (track.year === null || track.year === undefined) {
    fields.push({ id: "year", label: "Year" });
  }
  if (track.duration_seconds === null || track.duration_seconds === undefined) {
    fields.push({ id: "duration", label: "Duration" });
  }
  return fields;
}

export function virtualCollectionWindow(
  itemCount: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  columns = 1,
) {
  // Fixed-height panes can skip DOM nodes by translating scroll position into visible row bounds.
  const safeColumns = Math.max(1, columns);
  const rowCount = Math.ceil(itemCount / safeColumns);
  const visibleRows = Math.ceil(Math.max(1, viewportHeight) / rowHeight) + COLLECTION_VIRTUAL_OVERSCAN * 2;
  const maxStartRow = Math.max(0, rowCount - visibleRows);
  const startRow = Math.min(Math.max(0, Math.floor(scrollTop / rowHeight) - COLLECTION_VIRTUAL_OVERSCAN), maxStartRow);
  const endRow = Math.min(rowCount, startRow + visibleRows);
  const startIndex = startRow * safeColumns;
  const endIndex = Math.min(itemCount, endRow * safeColumns);
  return {
    startIndex,
    endIndex,
    topSpacerHeight: startRow * rowHeight,
    bottomSpacerHeight: Math.max(0, (rowCount - endRow) * rowHeight),
  };
}

export function virtualVariableCollectionWindow<T>(
  items: T[],
  scrollTop: number,
  viewportHeight: number,
  rowHeight: (item: T) => number,
) {
  // Completion rows change height when expanded, so this path builds offsets before choosing the window.
  const heights = items.map((item) => Math.max(1, rowHeight(item)));
  const offsets: number[] = [];
  let totalHeight = 0;
  for (const height of heights) {
    offsets.push(totalHeight);
    totalHeight += height;
  }

  const startTarget = Math.max(0, scrollTop);
  const endTarget = startTarget + Math.max(1, viewportHeight);
  let firstVisibleIndex = offsets.findIndex((offset, index) => offset + heights[index] >= startTarget);
  if (firstVisibleIndex < 0) {
    firstVisibleIndex = Math.max(0, items.length - COLLECTION_VIRTUAL_OVERSCAN);
  }
  const startIndex = Math.max(0, firstVisibleIndex - COLLECTION_VIRTUAL_OVERSCAN);
  let endIndex = startIndex;
  while (endIndex < items.length && offsets[endIndex] <= endTarget) {
    endIndex += 1;
  }
  endIndex = Math.min(items.length, endIndex + COLLECTION_VIRTUAL_OVERSCAN);

  return {
    startIndex,
    endIndex,
    topSpacerHeight: offsets[startIndex] ?? 0,
    bottomSpacerHeight: Math.max(0, totalHeight - (offsets[endIndex] ?? totalHeight)),
    totalHeight,
  };
}
