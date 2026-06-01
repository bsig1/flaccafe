import {
Album,
BarChart3,
CheckCircle2,
FolderOpen,
MoreHorizontal,
Pencil,
Play,
Plus,
Trash2,
X,
} from "lucide-react";
import {
type ReactNode,
useEffect,
useRef,
useState,
} from "react";

import {
albumArtworkUrl,
fetchSimilarTracks,
} from "../../lib/api";
import type {
PlaylistSummary,
SimilarTrack,
Track,
} from "../../types/api";
import {
analysisError,
analysisMoodTags,
analysisTags,
display,
formatBitrate,
formatDate,
formatDuration,
formatPercent,
isClapAnalyzed,
} from "../shared";
import {
RatingStars,
} from "./common";
import type {
EditableMetadataKey,
} from "./modals";

export function TrackDetailsPanel({
  track,
  queue,
  playlists,
  isAudioAnalyzing,
  onClose,
  onSelectTrack,
  onPreviewTrack,
  isTrackSelected,
  onPlayTrack,
  onRating,
  displayRatingsAsNumbers,
  onAnalyzeTracks,
  onAddTracksToPlaylist,
  onDeleteTrack,
  onEditTrack,
  onRevealTrack,
  onSearchAnalysisTag,
}: {
  track: Track | null;
  queue: Track[];
  playlists: PlaylistSummary[];
  isAudioAnalyzing: boolean;
  onClose: () => void;
  onSelectTrack: (track: Track) => void;
  onPreviewTrack: (track: Track) => void;
  isTrackSelected: boolean;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onRating: (trackId: number, rating: number | null) => void;
  displayRatingsAsNumbers?: boolean;
  onAnalyzeTracks: (trackIds: number[]) => void;
  onAddTracksToPlaylist: (trackIds: number[], playlistId?: number) => void | Promise<void>;
  onDeleteTrack: (trackId: number, deleteFile: boolean) => void;
  onEditTrack: (track: Track, field?: EditableMetadataKey | null) => void;
  onRevealTrack: (track: Track) => void;
  onSearchAnalysisTag?: (tag: string, kind: "genre" | "mood") => void;
}) {
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [actionsPosition, setActionsPosition] = useState({ left: 0, top: 0 });
  const [similarTracks, setSimilarTracks] = useState<SimilarTrack[]>([]);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setArtworkFailed(false);
    setActionsOpen(false);
    setPlaylistMenuOpen(false);
    setSimilarTracks([]);
  }, [track?.id]);

  useEffect(() => {
    if (!track || track.id <= 0 || !isClapAnalyzed(track)) {
      setSimilarTracks([]);
      setIsSimilarLoading(false);
      return;
    }
    let cancelled = false;
    setIsSimilarLoading(true);
    fetchSimilarTracks(track.id, 8)
      .then((rows) => {
        if (!cancelled) {
          setSimilarTracks(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSimilarTracks([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSimilarLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [track?.id, track?.analysis_updated_at, track?.analysis_embedding]);

  useEffect(() => {
    if (!actionsOpen) {
      return;
    }

    function closeActions(event?: Event) {
      if (event instanceof MouseEvent && actionsButtonRef.current?.contains(event.target as Node | null)) {
        return;
      }
      setActionsOpen(false);
      setPlaylistMenuOpen(false);
    }

    window.addEventListener("click", closeActions);
    window.addEventListener("resize", closeActions);
    window.addEventListener("scroll", closeActions, true);
    window.addEventListener("keydown", closeActions);
    return () => {
      window.removeEventListener("click", closeActions);
      window.removeEventListener("resize", closeActions);
      window.removeEventListener("scroll", closeActions, true);
      window.removeEventListener("keydown", closeActions);
    };
  }, [actionsOpen]);

  if (!track) {
    return null;
  }

  const detailTrack = track;
  const tags = analysisTags(track);
  const moodTags = analysisMoodTags(track);
  const error = analysisError(track);
  const artworkSrc = !artworkFailed ? albumArtworkUrl(track.id, track.file_modified_at) : null;
  const editableTitle = "Edit metadata";

  function toggleActions() {
    const rect = actionsButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 208;
      const height = 250;
      setActionsPosition({
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
        top: Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - height - 8)),
      });
    }
    setActionsOpen((current) => !current);
  }

  function EditableValue({
    field,
    children,
    className = "text-white",
  }: {
    field: EditableMetadataKey;
    children: ReactNode;
    className?: string;
  }) {
    const editThisValue = () => onEditTrack(detailTrack, field);
    return (
      <span className="block min-w-0 max-w-full leading-snug">
        <button
          className={`block w-fit max-w-full cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-sm text-left align-baseline hover:text-moss focus:outline-none focus:text-moss ${className}`}
          type="button"
          title={editableTitle}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            editThisValue();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            editThisValue();
          }}
        >
          {children}
        </button>
      </span>
    );
  }

  return (
    <aside
      data-track-details-panel
      className="absolute inset-y-0 right-0 z-40 flex w-[min(24rem,calc(100vw-2rem))] max-w-96 flex-col overflow-hidden border-l border-line bg-[rgb(var(--color-strip))] shadow-2xl"
    >
      <div className="flex h-14 items-center justify-between border-b border-line px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Track Details</div>
          <div className="truncate text-xs text-muted">{isClapAnalyzed(track) ? "CLAP analyzed" : "Not analyzed"}</div>
        </div>
        <button className="icon-button" type="button" title="Close details" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mb-4 flex min-w-0 gap-3">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded border border-line bg-ink text-moss">
            {artworkSrc ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={artworkSrc}
                onError={() => setArtworkFailed(true)}
              />
            ) : (
              <Album size={30} />
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <EditableValue field="title" className="text-base font-semibold text-white">{display(track.title, "Untitled")}</EditableValue>
            <EditableValue field="artist" className="text-sm text-neutral-300">{display(track.artist)}</EditableValue>
            <EditableValue field="album" className="text-xs text-muted">{display(track.album, "Unknown album")}</EditableValue>
            <div className="relative z-20 mt-3 flex gap-2">
              <button className="primary-button h-8" type="button" onClick={() => onPlayTrack(track, queue.length ? queue : [track])}>
                <Play size={14} />
                Play
              </button>
              <button
                className="secondary-button h-8"
                type="button"
                disabled={isTrackSelected}
                onClick={() => onSelectTrack(track)}
              >
                <CheckCircle2 size={14} />
                {isTrackSelected ? "Selected" : "Select"}
              </button>
              <div
                className="relative"
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                <button
                  ref={actionsButtonRef}
                  className="icon-button h-8 w-8 cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                  type="button"
                  title="More track actions"
                  aria-expanded={actionsOpen}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleActions();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    toggleActions();
                  }}
                >
                  <MoreHorizontal size={15} />
                </button>
                {actionsOpen && (
                  <div
                    className="fixed z-50 w-52 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm shadow-2xl"
                    style={{ left: actionsPosition.left, top: actionsPosition.top }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div onMouseEnter={() => setPlaylistMenuOpen(true)} onMouseLeave={() => setPlaylistMenuOpen(false)}>
                      <button
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/10"
                        type="button"
                        onClick={() => setPlaylistMenuOpen((current) => !current)}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Plus size={14} />
                          <span className="truncate">Add to playlist</span>
                        </span>
                        <span className="text-muted">{playlistMenuOpen ? "v" : ">"}</span>
                      </button>
                      {playlistMenuOpen && (
                        <div className="max-h-56 overflow-auto border-y border-line/70 bg-ink/60 py-1">
                          {playlists.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted">No playlists yet</div>
                          ) : (
                            playlists.map((playlist) => (
                              <button
                                key={playlist.id}
                                className="flex w-full items-center justify-between gap-2 px-6 py-1.5 text-left text-xs hover:bg-white/10"
                                type="button"
                                title={playlist.name}
                                onClick={() => {
                                  void onAddTracksToPlaylist([track.id], playlist.id);
                                  setPlaylistMenuOpen(false);
                                  setActionsOpen(false);
                                }}
                              >
                                <span className="min-w-0 truncate">{playlist.name}</span>
                                <span className="shrink-0 text-muted">{playlist.track_count.toLocaleString()}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted" type="button" disabled={isAudioAnalyzing} onClick={() => {
                      onAnalyzeTracks([track.id]);
                      setActionsOpen(false);
                    }}>
                      <BarChart3 size={14} />
                      Analyze track
                    </button>
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => {
                      onEditTrack(track);
                      setActionsOpen(false);
                    }}>
                      <Pencil size={14} />
                      Edit metadata
                    </button>
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => {
                      onRevealTrack(track);
                      setActionsOpen(false);
                    }}>
                      <FolderOpen size={14} />
                      Reveal in Explorer
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10" type="button" onClick={() => {
                      onDeleteTrack(track.id, false);
                      setActionsOpen(false);
                    }}>
                      <Trash2 size={14} />
                      Remove from library
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs uppercase text-muted">Rating</div>
          <RatingStars rating={track.rating} displayAsNumber={displayRatingsAsNumbers} onChange={(rating) => onRating(track.id, rating)} />
        </div>

        <div className="grid min-w-0 gap-3 text-sm">
          <div className="min-w-0 rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">Metadata</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <div className="text-muted">Album artist</div>
                <EditableValue field="album_artist">{display(track.album_artist)}</EditableValue>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Year</div>
                <EditableValue field="year">{display(track.year, "-")}</EditableValue>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Track</div>
                <EditableValue field="track_number">{display(track.track_number, "-")}</EditableValue>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Disc</div>
                <EditableValue field="disc_number">{display(track.disc_number, "-")}</EditableValue>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Duration</div>
                <div className="truncate text-white">{formatDuration(track.duration_seconds)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Bitrate</div>
                <div className="truncate text-white">{formatBitrate(track.bitrate)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted">File genre</div>
                <EditableValue field="genre">{display(track.genre, "-")}</EditableValue>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">CLAP Analysis</div>
            <div className="grid gap-2 text-xs">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted">Provider</span>
                <span className="min-w-0 truncate text-white">{display(track.analysis_provider, "none")}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted">Genre</span>
                <span className="min-w-0 truncate text-white">{display(track.analysis_genre, "-")}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted">Confidence</span>
                <span className="text-white">
                  {track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
                    ? formatPercent(track.analysis_genre_confidence * 100)
                    : "-"}
                </span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted">Mood</span>
                <span className="min-w-0 truncate text-white">{display(track.analysis_mood, "-")}</span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted">Mood match</span>
                <span className="text-white">
                  {track.analysis_mood_confidence !== null && track.analysis_mood_confidence !== undefined
                    ? formatPercent(track.analysis_mood_confidence * 100)
                    : "-"}
                </span>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-muted">Updated</span>
                <span className="min-w-0 truncate text-white">{formatDate(track.analysis_updated_at)}</span>
              </div>
            </div>
            {error && <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.slice(0, 10).map(([tag, score]) => (
                  <button
                    key={tag}
                    className="rounded border border-line bg-ink px-2 py-1 text-left text-xs text-neutral-200 transition hover:border-moss/60 hover:text-white"
                    type="button"
                    title={`Search genre: ${tag}`}
                    onClick={() => onSearchAnalysisTag?.(tag, "genre")}
                  >
                    {tag} {formatPercent(score * 100)}
                  </button>
                ))}
              </div>
            )}
            {moodTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {moodTags.slice(0, 8).map(([tag, score]) => (
                  <button
                    key={tag}
                    className="rounded border border-line bg-ink px-2 py-1 text-left text-xs text-neutral-200 transition hover:border-moss/60 hover:text-white"
                    type="button"
                    title={`Search mood: ${tag}`}
                    onClick={() => onSearchAnalysisTag?.(tag, "mood")}
                  >
                    {tag} {formatPercent(score * 100)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 rounded border border-line bg-panel p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs uppercase text-muted">Similar Tracks</div>
              {isSimilarLoading && <div className="text-[10px] uppercase text-muted">Loading</div>}
            </div>
            <div className="grid gap-1.5">
              {similarTracks.map((similar) => (
                <div
                  key={similar.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-line/60 bg-ink px-2.5 py-2 text-xs"
                >
                  <button
                    className="min-w-0 text-left"
                    type="button"
                    title={similar.similarity_reason}
                    onClick={() => onPreviewTrack(similar)}
                  >
                    <span className="block truncate font-medium text-neutral-100">{display(similar.title, "Untitled")}</span>
                    <span className="block truncate text-muted">
                      {display(similar.artist)} - CLAP {similar.audio_similarity !== null ? similar.audio_similarity.toFixed(2) : similar.similarity_score.toFixed(2)}
                    </span>
                  </button>
                  <button
                    className="icon-button h-7 w-7"
                    type="button"
                    title="Play similar track"
                    onClick={() => onPlayTrack(similar, similarTracks)}
                  >
                    <Play size={13} />
                  </button>
                </div>
              ))}
              {!isSimilarLoading && similarTracks.length === 0 && (
                <div className="rounded border border-line/60 bg-ink px-3 py-4 text-center text-xs text-muted">
                  {isClapAnalyzed(track) ? "No close CLAP neighbors yet." : "Analyze this track with CLAP to find neighbors."}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">History</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <div className="text-muted">Plays</div>
                <div className="text-white">{track.play_count.toLocaleString()}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Skips</div>
                <div className="text-white">{track.skip_count.toLocaleString()}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Last played</div>
                <div className="truncate text-white">{formatDate(track.last_played_at)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted">Last skipped</div>
                <div className="truncate text-white">{formatDate(track.last_skipped_at)}</div>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">File</div>
            <div className="break-all text-xs text-neutral-300">{track.path}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
