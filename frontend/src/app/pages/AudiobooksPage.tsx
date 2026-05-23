import {
  Bookmark,
  BookOpen,
  Download,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createAudiobookBookmark,
  deleteAudiobookBookmark,
  exportAudiobookSyncMetadata,
  fetchAudiobookBookmarks,
  fetchAudiobookChapters,
  fetchAudiobooks,
  saveAudiobookChapters,
  updateAudiobookProgress,
} from "../../lib/api";
import type {
  AudiobookBookmark,
  AudiobookChapter,
  AudiobookTrack,
} from "../../types/api";
import {
  NumberField,
} from "../components/common";

function formatTime(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function chaptersToText(chapters: AudiobookChapter[]) {
  return chapters
    .map((chapter) => `${chapter.chapter_index}|${formatTime(chapter.start_seconds)}|${chapter.end_seconds ? formatTime(chapter.end_seconds) : ""}|${chapter.title}`)
    .join("\n");
}

function parseTime(value: string) {
  const parts = value.trim().split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

function parseChapters(text: string): AudiobookChapter[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => {
      const [chapterIndex, start, end, ...titleParts] = line.split("|");
      const title = titleParts.join("|").trim() || `Chapter ${index + 1}`;
      return {
        chapter_index: Math.max(1, Number(chapterIndex) || index + 1),
        title,
        start_seconds: parseTime(start || "0"),
        end_seconds: end?.trim() ? parseTime(end) : null,
      };
    })
    .filter((chapter) => chapter.title.trim().length > 0);
}

export function AudiobooksPage({ setStatus }: { setStatus: (message: string) => void }) {
  const [tracks, setTracks] = useState<AudiobookTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<AudiobookBookmark[]>([]);
  const [chapters, setChapters] = useState<AudiobookChapter[]>([]);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [bookmarkLabel, setBookmarkLabel] = useState("Bookmark");
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [chapterText, setChapterText] = useState("");
  const selected = useMemo(() => tracks.find((track) => track.id === selectedId) ?? tracks[0] ?? null, [selectedId, tracks]);

  async function loadAudiobooks() {
    try {
      const response = await fetchAudiobooks(300, 0);
      setTracks(response.tracks);
      setTotal(response.total);
      if (!selectedId && response.tracks[0]) {
        setSelectedId(response.tracks[0].id);
      }
      setStatus(response.total ? `Loaded ${response.total.toLocaleString()} audiobook track${response.total === 1 ? "" : "s"}` : "No audiobook tracks found");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load audiobooks");
    }
  }

  async function loadSelectedDetails(track: AudiobookTrack | null) {
    if (!track) {
      setBookmarks([]);
      setChapters([]);
      setChapterText("");
      setPositionSeconds(0);
      return;
    }
    try {
      const [bookmarkResponse, chapterResponse] = await Promise.all([
        fetchAudiobookBookmarks(track.id),
        fetchAudiobookChapters(track.id),
      ]);
      setBookmarks(bookmarkResponse);
      setChapters(chapterResponse);
      setChapterText(chaptersToText(chapterResponse));
      setPositionSeconds(Math.round(track.position_seconds || 0));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load audiobook details");
    }
  }

  useEffect(() => {
    void loadAudiobooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSelectedDetails(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function saveProgress() {
    if (!selected) {
      return;
    }
    try {
      await updateAudiobookProgress(selected.id, {
        position_seconds: positionSeconds,
        duration_seconds: selected.duration_seconds,
      });
      await loadAudiobooks();
      setStatus("Audiobook resume position saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save audiobook progress");
    }
  }

  async function addBookmark() {
    if (!selected) {
      return;
    }
    try {
      const bookmark = await createAudiobookBookmark(selected.id, {
        position_seconds: positionSeconds,
        label: bookmarkLabel || "Bookmark",
        note: bookmarkNote || null,
      });
      setBookmarks((current) => [...current, bookmark].sort((left, right) => left.position_seconds - right.position_seconds));
      setBookmarkNote("");
      setStatus("Audiobook bookmark added");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add audiobook bookmark");
    }
  }

  async function removeBookmark(bookmarkId: number) {
    try {
      await deleteAudiobookBookmark(bookmarkId);
      setBookmarks((current) => current.filter((bookmark) => bookmark.id !== bookmarkId));
      setStatus("Audiobook bookmark deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete audiobook bookmark");
    }
  }

  async function saveChapters() {
    if (!selected) {
      return;
    }
    try {
      const saved = await saveAudiobookChapters(selected.id, parseChapters(chapterText));
      setChapters(saved);
      setChapterText(chaptersToText(saved));
      setStatus("Audiobook chapters saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save audiobook chapters");
    }
  }

  async function exportSyncMetadata() {
    try {
      const response = await exportAudiobookSyncMetadata(selected ? [selected.id] : null);
      setStatus(`Exported ${response.track_count.toLocaleString()} audiobook sync record${response.track_count === 1 ? "" : "s"} to ${response.export_path}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export audiobook sync metadata");
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app">
      <header className="border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Audiobooks</h1>
            <p className="text-sm text-muted">Long-form library view with resume position, bookmarks, chapters, and sync metadata.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={() => void loadAudiobooks()}>
              <RefreshCw size={15} />
              Refresh
            </button>
            <button className="secondary-button" type="button" onClick={() => void exportSyncMetadata()}>
              <Download size={15} />
              Export Sync
            </button>
          </div>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)]">
        <div className="min-h-0 overflow-hidden rounded border border-line bg-panel">
          <div className="border-b border-line px-3 py-2 text-xs uppercase text-muted">
            {total.toLocaleString()} audiobook track{total === 1 ? "" : "s"}
          </div>
          <div className="grid max-h-full gap-1 overflow-auto p-2">
            {tracks.map((track) => (
              <button
                key={track.id}
                className={`grid min-w-0 gap-1 rounded px-3 py-2 text-left transition ${
                  selected?.id === track.id ? "bg-white/10 text-white" : "text-neutral-200 hover:bg-white/5"
                }`}
                type="button"
                onClick={() => setSelectedId(track.id)}
              >
                <span className="truncate text-sm font-medium">{track.title ?? "Untitled audiobook"}</span>
                <span className="truncate text-xs text-muted">{track.artist ?? track.album_artist ?? "Unknown author"} · {track.album ?? "Unknown book"}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-ink">
                  <span className="block h-full rounded-full bg-moss" style={{ width: `${track.progress_percent}%` }} />
                </span>
                <span className="text-xs text-muted">
                  {formatTime(track.position_seconds)} / {formatTime(track.duration_seconds)} · {track.bookmark_count} bookmark{track.bookmark_count === 1 ? "" : "s"}
                </span>
              </button>
            ))}
            {tracks.length === 0 && (
              <div className="grid place-items-center py-16 text-center text-sm text-muted">
                Tracks with audiobook genres or audiobook/book paths will appear here after scanning.
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-auto rounded border border-line bg-panel p-4">
          {selected ? (
            <div className="grid gap-5">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <BookOpen size={20} />
                  <span className="min-w-0 truncate">{selected.title ?? "Untitled audiobook"}</span>
                </div>
                <div className="mt-1 truncate text-sm text-muted">{selected.artist ?? selected.album_artist ?? "Unknown author"} · {selected.album ?? "Unknown book"}</div>
              </div>

              <div className="grid gap-3 rounded border border-line bg-ink p-3">
                <div className="text-xs uppercase text-muted">Resume Position</div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <NumberField label="Position Seconds" value={positionSeconds} min={0} max={Math.ceil(selected.duration_seconds ?? 999999)} onChange={setPositionSeconds} />
                  <button className="primary-button self-end" type="button" onClick={() => void saveProgress()}>
                    <Save size={15} />
                    Save Resume
                  </button>
                </div>
                <div className="text-xs text-muted">{formatTime(positionSeconds)} of {formatTime(selected.duration_seconds)}</div>
              </div>

              <div className="grid gap-3 rounded border border-line bg-ink p-3">
                <div className="flex items-center gap-2 text-xs uppercase text-muted">
                  <Bookmark size={14} />
                  Bookmarks
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={bookmarkLabel}
                    placeholder="Label"
                    onChange={(event) => setBookmarkLabel(event.target.value)}
                  />
                  <input
                    className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                    value={bookmarkNote}
                    placeholder="Optional note"
                    onChange={(event) => setBookmarkNote(event.target.value)}
                  />
                  <button className="secondary-button" type="button" onClick={() => void addBookmark()}>
                    <Plus size={15} />
                    Add
                  </button>
                </div>
                <div className="grid gap-1">
                  {bookmarks.map((bookmark) => (
                    <div key={bookmark.id} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 rounded bg-panel px-2 py-1.5 text-xs">
                      <span className="text-muted">{formatTime(bookmark.position_seconds)}</span>
                      <span className="min-w-0 truncate text-neutral-100">{bookmark.label}{bookmark.note ? ` - ${bookmark.note}` : ""}</span>
                      <button className="icon-button h-7 w-7" type="button" title="Delete bookmark" onClick={() => void removeBookmark(bookmark.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {bookmarks.length === 0 && <div className="py-2 text-xs text-muted">No bookmarks yet.</div>}
                </div>
              </div>

              <div className="grid gap-3 rounded border border-line bg-ink p-3">
                <div className="text-xs uppercase text-muted">Chapters</div>
                <textarea
                  className="min-h-40 rounded border border-line bg-panel px-3 py-2 font-mono text-xs text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  value={chapterText}
                  placeholder="1|0:00||Chapter 1"
                  onChange={(event) => setChapterText(event.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted">Format: index|start|end|title. End may be blank.</div>
                  <button className="secondary-button" type="button" onClick={() => void saveChapters()}>
                    <Save size={15} />
                    Save Chapters
                  </button>
                </div>
                <div className="text-xs text-muted">{chapters.length.toLocaleString()} chapter{chapters.length === 1 ? "" : "s"} loaded</div>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-center text-sm text-muted">Select an audiobook to edit resume data.</div>
          )}
        </div>
      </div>
    </section>
  );
}
