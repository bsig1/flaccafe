import {
  ExternalLink,
  RefreshCw,
  UserRound,
} from "lucide-react";

import type {
  ArtistInfoResponse,
  Track,
} from "../../types/api";
import {
  display,
  formatRating,
  primaryArtistName,
} from "../shared";

export function ArtistPage({
  currentTrack,
  artistInfo,
  artistTracks,
  isArtistLoading,
  onRefresh,
  onPlayTrack,
  onOpenExternalUrl,
}: {
  currentTrack: Track | null;
  artistInfo: ArtistInfoResponse | null;
  artistTracks: Track[];
  isArtistLoading: boolean;
  onRefresh: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onOpenExternalUrl: (url: string) => void;
}) {
  const artistName = primaryArtistName(currentTrack?.artist) || display(currentTrack?.artist, "");
  const hasImage = Boolean(artistInfo?.image_url);

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Artist</h1>
          <p className="text-xs text-muted">
            {artistName ? `About ${artistName}` : "Select a track to see artist details"}
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={!artistName || isArtistLoading}
          onClick={onRefresh}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-auto p-6 xl:grid-cols-[minmax(260px,340px)_1fr] xl:overflow-hidden">
        <section className="min-h-0 min-w-0 xl:overflow-auto">
          <div className="aspect-[4/5] overflow-hidden rounded border border-line bg-panel shadow-xl">
            {hasImage ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={artistInfo?.image_url ?? ""}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-moss">
                <UserRound size={64} />
              </div>
            )}
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="truncate text-2xl font-semibold text-white">
              {artistInfo?.artist_name ?? (artistName || "No artist selected")}
            </h2>
            <div className="mt-2 truncate text-sm text-muted">
              {currentTrack ? `${display(currentTrack.title, "Current track")} - ${display(currentTrack.album, "Unknown album")}` : ""}
            </div>
          </div>

          {artistTracks.length > 0 && (
            <div className="mt-5 overflow-hidden rounded border border-line bg-panel">
              <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm font-semibold text-white">
                <span className="truncate">Top Local Tracks</span>
                <span className="shrink-0 text-xs font-normal text-muted">{artistTracks.length}</span>
              </div>
              <div>
              {artistTracks.slice(0, 12).map((track) => (
                <button
                  key={track.id}
                  className="flex w-full items-center justify-between gap-3 border-b border-line/60 px-3 py-2 text-left text-sm hover:bg-white/[0.035]"
                  type="button"
                  onClick={() => onPlayTrack(track, artistTracks)}
                >
                  <span className="min-w-0 flex-1 truncate text-white">{display(track.title, "Untitled")}</span>
                  <span className="shrink-0 text-xs text-muted">{formatRating(track.rating)}</span>
                </button>
              ))}
              </div>
            </div>
          )}
        </section>

        <section className="min-h-[420px] min-w-0 rounded border border-line bg-panel xl:min-h-0">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <div className="text-sm font-semibold text-white">Background</div>
            <div className="flex min-w-0 items-center gap-3">
              {artistInfo?.source && <span className="truncate text-xs text-muted">{artistInfo.source}</span>}
              {artistInfo?.page_url && (
                <button
                  className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                  type="button"
                  onClick={() => artistInfo.page_url && onOpenExternalUrl(artistInfo.page_url)}
                >
                  Open
                  <ExternalLink size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="h-[calc(100%-3rem)] overflow-auto px-7 py-6">
            {isArtistLoading && <div className="text-sm text-muted">Loading artist info...</div>}
            {!isArtistLoading && !artistName && (
              <div className="grid h-full place-items-center text-sm text-muted">No artist selected.</div>
            )}
            {!isArtistLoading && artistName && !artistInfo?.found && (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                {artistInfo?.error ?? "No artist background found yet."}
              </div>
            )}
            {!isArtistLoading && artistInfo?.found && (
              <div className="mx-auto max-w-3xl">
                <p className="whitespace-pre-wrap text-xl leading-9 text-neutral-100">
                  {artistInfo.summary}
                </p>
                {artistInfo.from_cache && (
                  <div className="mt-5 text-xs text-muted">
                    Cached locally{artistInfo.updated_at ? ` on ${new Date(artistInfo.updated_at).toLocaleString()}` : ""}.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
