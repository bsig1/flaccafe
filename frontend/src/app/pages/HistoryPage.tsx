import {
  RefreshCw,
} from "lucide-react";
import {
  useState,
} from "react";

import type {
  LibraryStatsResponse,
  PlayEventEntry,
  Track,
} from "../../types/api";
import {
  ResizableHeader,
} from "../components/common";
import {
  HistoryColumnKey,
  defaultHistoryColumnWidths,
  display,
  formatDate,
} from "../shared";

export function HistoryPage({
  events,
  stats,
  onPlayTrack,
  onRefresh,
}: {
  events: PlayEventEntry[];
  stats: LibraryStatsResponse | null;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onRefresh: () => void;
}) {
  const playable = events.map((event) => event.track).filter((track): track is Track => Boolean(track));
  const [columnWidths, setColumnWidths] = useState<Record<HistoryColumnKey, number>>(defaultHistoryColumnWidths);
  const tableWidth = Object.values(columnWidths).reduce((total, width) => total + width, 0);

  function handleResize(column: string, width: number) {
    if (!(column in columnWidths)) {
      return;
    }
    setColumnWidths((current) => ({ ...current, [column as HistoryColumnKey]: width }));
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">History</h1>
          <p className="text-xs text-muted">Recent plays, skips, ratings, and library stats</p>
        </div>
        <button className="secondary-button" type="button" onClick={onRefresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
        <section className="border-r border-line p-4">
          <div className="grid gap-3 text-sm">
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Tracks</div>
              <div className="mt-1 text-2xl font-semibold text-white">{stats?.total_tracks.toLocaleString() ?? "-"}</div>
            </div>
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Artists</div>
              <div className="mt-1 text-2xl font-semibold text-white">{stats?.total_artists.toLocaleString() ?? "-"}</div>
            </div>
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Rated</div>
              <div className="mt-1 text-2xl font-semibold text-moss">{stats?.rated_tracks.toLocaleString() ?? "-"}</div>
            </div>
            <div className="rounded border border-line bg-panel p-3">
              <div className="text-xs uppercase text-muted">Plays / Skips</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {stats ? `${stats.played_events} / ${stats.skipped_events}` : "-"}
              </div>
            </div>
          </div>
        </section>
        <section className="min-w-0 overflow-auto">
          <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
            <colgroup>
              <col style={{ width: columnWidths.event }} />
              <col style={{ width: columnWidths.track }} />
              <col style={{ width: columnWidths.artist }} />
              <col style={{ width: columnWidths.album }} />
              <col style={{ width: columnWidths.when }} />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
              <tr>
                <ResizableHeader label="Event" column="event" width={columnWidths.event} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="Track" column="track" width={columnWidths.track} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="Artist" column="artist" width={columnWidths.artist} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="Album" column="album" width={columnWidths.album} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="When" column="when" width={columnWidths.when} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-line/60 hover:bg-white/[0.035]">
                  <td className="px-4 py-3 text-muted">{event.event_type}</td>
                  <td className="truncate px-3 py-3">
                    {event.track ? (
                      <button className="truncate text-left font-medium text-white" type="button" onClick={() => onPlayTrack(event.track!, playable)}>
                        {display(event.track.title, "Untitled")}
                      </button>
                    ) : (
                      <span className="text-muted">Missing track</span>
                    )}
                  </td>
                  <td className="truncate px-3 py-3 text-neutral-200">{display(event.track?.artist)}</td>
                  <td className="truncate px-3 py-3 text-neutral-300">{display(event.track?.album)}</td>
                  <td className="truncate px-3 py-3 text-muted">{formatDate(event.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
