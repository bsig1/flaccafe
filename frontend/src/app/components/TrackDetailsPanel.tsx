import {
  Album,
  BarChart3,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import {
  albumArtworkUrl,
} from "../../lib/api";
import type {
  Track,
} from "../../types/api";
import {
  analysisError,
  analysisTags,
  display,
  formatDate,
  formatDuration,
  formatPercent,
  isClapAnalyzed,
} from "../shared";
import {
  RatingStars,
} from "./common";

export function TrackDetailsPanel({
  track,
  queue,
  isAudioAnalyzing,
  onClose,
  onPlayTrack,
  onRating,
  onAnalyzeTracks,
  onAddTracksToPlaylist,
  onDeleteTrack,
  onEditTrack,
  onRevealTrack,
}: {
  track: Track | null;
  queue: Track[];
  isAudioAnalyzing: boolean;
  onClose: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onRating: (trackId: number, rating: number | null) => void;
  onAnalyzeTracks: (trackIds: number[]) => void;
  onAddTracksToPlaylist: (trackIds: number[]) => void;
  onDeleteTrack: (trackId: number, deleteFile: boolean) => void;
  onEditTrack: (track: Track) => void;
  onRevealTrack: (track: Track) => void;
}) {
  const [artworkFailed, setArtworkFailed] = useState(false);

  useEffect(() => {
    setArtworkFailed(false);
  }, [track?.id]);

  if (!track) {
    return null;
  }

  const tags = analysisTags(track);
  const error = analysisError(track);
  const artworkSrc = !artworkFailed ? albumArtworkUrl(track.id) : null;

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-line bg-[rgb(var(--color-strip))]">
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
        <div className="mb-4 flex gap-3">
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
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-white">{display(track.title, "Untitled")}</div>
            <div className="truncate text-sm text-neutral-300">{display(track.artist)}</div>
            <div className="truncate text-xs text-muted">{display(track.album, "Unknown album")}</div>
            <div className="mt-3 flex gap-2">
              <button className="primary-button h-8" type="button" onClick={() => onPlayTrack(track, queue.length ? queue : [track])}>
                <Play size={14} />
                Play
              </button>
              <details className="relative" data-auto-close>
                <summary className="icon-button h-8 w-8 cursor-pointer list-none [&::-webkit-details-marker]:hidden" title="More track actions">
                  <MoreHorizontal size={15} />
                </summary>
                <div className="absolute left-0 top-9 z-30 w-48 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm shadow-2xl">
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => onAddTracksToPlaylist([track.id])}>
                    <Plus size={14} />
                    Add to playlist
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted" type="button" disabled={isAudioAnalyzing} onClick={() => onAnalyzeTracks([track.id])}>
                    <BarChart3 size={14} />
                    Analyze track
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => onEditTrack(track)}>
                    <Pencil size={14} />
                    Edit metadata
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10" type="button" onClick={() => onRevealTrack(track)}>
                    <FolderOpen size={14} />
                    Reveal in Explorer
                  </button>
                  <div className="my-1 border-t border-line" />
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10" type="button" onClick={() => onDeleteTrack(track.id, false)}>
                    <Trash2 size={14} />
                    Remove from library
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs uppercase text-muted">Rating</div>
          <RatingStars rating={track.rating} onChange={(rating) => onRating(track.id, rating)} />
        </div>

        <div className="grid gap-3 text-sm">
          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">Metadata</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted">Album artist</div>
                <div className="truncate text-white">{display(track.album_artist)}</div>
              </div>
              <div>
                <div className="text-muted">Year</div>
                <div className="truncate text-white">{display(track.year, "-")}</div>
              </div>
              <div>
                <div className="text-muted">Track</div>
                <div className="truncate text-white">{display(track.track_number, "-")}</div>
              </div>
              <div>
                <div className="text-muted">Disc</div>
                <div className="truncate text-white">{display(track.disc_number, "-")}</div>
              </div>
              <div>
                <div className="text-muted">Duration</div>
                <div className="truncate text-white">{formatDuration(track.duration_seconds)}</div>
              </div>
              <div>
                <div className="text-muted">File genre</div>
                <div className="truncate text-white">{display(track.genre, "-")}</div>
              </div>
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">CLAP Analysis</div>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Provider</span>
                <span className="truncate text-white">{display(track.analysis_provider, "none")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Genre</span>
                <span className="truncate text-white">{display(track.analysis_genre, "-")}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Confidence</span>
                <span className="text-white">
                  {track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
                    ? formatPercent(track.analysis_genre_confidence * 100)
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Updated</span>
                <span className="truncate text-white">{formatDate(track.analysis_updated_at)}</span>
              </div>
            </div>
            {error && <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.slice(0, 10).map(([tag, score]) => (
                  <span key={tag} className="rounded border border-line bg-ink px-2 py-1 text-xs text-neutral-200">
                    {tag} {formatPercent(score * 100)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">History</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted">Plays</div>
                <div className="text-white">{track.play_count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted">Skips</div>
                <div className="text-white">{track.skip_count.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted">Last played</div>
                <div className="truncate text-white">{formatDate(track.last_played_at)}</div>
              </div>
              <div>
                <div className="text-muted">Last skipped</div>
                <div className="truncate text-white">{formatDate(track.last_skipped_at)}</div>
              </div>
            </div>
          </div>

          <div className="rounded border border-line bg-panel p-3">
            <div className="mb-2 text-xs uppercase text-muted">File</div>
            <div className="break-all text-xs text-neutral-300">{track.path}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
