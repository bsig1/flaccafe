import {
  RefreshCw,
} from "lucide-react";
import {
  useState,
} from "react";

import type {
  HistoryStatsResponse,
  HistoryTrackStat,
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
  formatDuration,
  parseAppDate,
} from "../shared";

function eventLabel(eventType: PlayEventEntry["event_type"]) {
  if (eventType === "played") {
    return "Play";
  }
  if (eventType === "skipped") {
    return "Skip";
  }
  return "Rate";
}

function eventTone(eventType: PlayEventEntry["event_type"]) {
  if (eventType === "played") {
    return "border-moss/40 bg-moss/10 text-moss";
  }
  if (eventType === "skipped") {
    return "border-ember/40 bg-ember/10 text-ember";
  }
  return "border-white/20 bg-white/10 text-neutral-100";
}

function formatHistoryDate(value: string) {
  const date = parseAppDate(value);
  if (date === null) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : value.toLocaleString();
}

function formatListeningTime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) {
    return "-";
  }
  if (seconds <= 0) {
    return "0:00";
  }
  return formatDuration(seconds);
}

function deriveHistoryStats(events: PlayEventEntry[], stats: LibraryStatsResponse | null): HistoryStatsResponse | null {
  if (events.length === 0 && stats === null) {
    return null;
  }
  const rowsByTrack = new Map<
    number,
    {
      track: Track;
      playedEvents: number;
      skippedEvents: number;
    }
  >();
  let recentPlayedEvents = 0;
  let recentSkippedEvents = 0;
  let recentRatedEvents = 0;
  events.forEach((event) => {
    if (event.event_type === "played") {
      recentPlayedEvents += 1;
    } else if (event.event_type === "skipped") {
      recentSkippedEvents += 1;
    } else if (event.event_type === "rated") {
      recentRatedEvents += 1;
    }
    if (!event.track) {
      return;
    }
    const existing = rowsByTrack.get(event.track.id) ?? {
      track: event.track,
      playedEvents: 0,
      skippedEvents: 0,
    };
    if (event.event_type === "played") {
      existing.playedEvents += 1;
    } else if (event.event_type === "skipped") {
      existing.skippedEvents += 1;
    }
    rowsByTrack.set(event.track.id, existing);
  });
  const rows = Array.from(rowsByTrack.values()).map(({ track, playedEvents, skippedEvents }) => {
    const playCount = Math.max(track.play_count ?? 0, playedEvents);
    const skipCount = Math.max(track.skip_count ?? 0, skippedEvents);
    return {
      track,
      play_count: playCount,
      skip_count: skipCount,
      listened_seconds: (track.duration_seconds ?? 0) * playCount,
    };
  });
  const rowPlayTotal = rows.reduce((total, row) => total + row.play_count, 0);
  const rowSkipTotal = rows.reduce((total, row) => total + row.skip_count, 0);
  return {
    total_play_count: Math.max(stats?.played_events ?? 0, rowPlayTotal),
    total_skip_count: Math.max(stats?.skipped_events ?? 0, rowSkipTotal),
    total_play_events: stats?.played_events ?? recentPlayedEvents,
    total_skip_events: stats?.skipped_events ?? recentSkippedEvents,
    total_rated_events: recentRatedEvents,
    unique_played_tracks: rows.filter((row) => row.play_count > 0).length,
    unique_skipped_tracks: rows.filter((row) => row.skip_count > 0).length,
    total_listened_seconds: rows.reduce((total, row) => total + row.listened_seconds, 0),
    top_played: rows
      .filter((row) => row.play_count > 0)
      .sort((left, right) => right.play_count - left.play_count || right.listened_seconds - left.listened_seconds)
      .slice(0, 10),
    top_skipped: rows
      .filter((row) => row.skip_count > 0)
      .sort((left, right) => right.skip_count - left.skip_count || right.play_count - left.play_count)
      .slice(0, 10),
  };
}

export function HistoryPage({
  events,
  stats,
  historyStats,
  onPlayTrack,
  onRefresh,
}: {
  events: PlayEventEntry[];
  stats: LibraryStatsResponse | null;
  historyStats: HistoryStatsResponse | null;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onRefresh: () => void;
}) {
  const playable = events.map((event) => event.track).filter((track): track is Track => Boolean(track));
  const [columnWidths, setColumnWidths] = useState<Record<HistoryColumnKey, number>>(defaultHistoryColumnWidths);
  const [historyView, setHistoryView] = useState<"stats" | "recent">("stats");
  const tableWidth = Object.values(columnWidths).reduce((total, width) => total + width, 0);
  const displayStats = historyStats ?? deriveHistoryStats(events, stats);

  function handleResize(column: string, width: number) {
    if (!(column in columnWidths)) {
      return;
    }
    setColumnWidths((current) => ({ ...current, [column as HistoryColumnKey]: width }));
  }

  function renderTopTrackList(rows: HistoryTrackStat[], metric: "plays" | "skips") {
    const topRows = rows.slice(0, 10);
    const queue = topRows.map((row) => row.track);
    return (
      <div className="grid gap-1">
        {topRows.map((row, index) => (
          <button
            key={`${metric}-${row.track.id}`}
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded border border-line/60 bg-ink px-3 py-2 text-left text-xs transition hover:border-moss/40 hover:bg-white/[0.035]"
            type="button"
            onClick={() => onPlayTrack(row.track, queue)}
          >
            <span className="text-right tabular-nums text-muted">{index + 1}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-neutral-100">{display(row.track.title, "Untitled")}</span>
              <span className="block truncate text-muted">{display(row.track.artist)} - {display(row.track.album, "Unknown album")}</span>
            </span>
            <span className={metric === "plays" ? "tabular-nums text-moss" : "tabular-nums text-ember"}>
              {metric === "plays" ? compactNumber(row.play_count) : compactNumber(row.skip_count)}
            </span>
          </button>
        ))}
        {topRows.length === 0 && (
          <div className="rounded border border-line/70 bg-ink px-3 py-8 text-center text-xs text-muted">
            No tracks yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-white">History</h1>
          <p className="text-xs text-muted">Recent plays, skips, ratings, and library stats</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded border border-line bg-panel p-1 text-xs">
            {([
              ["stats", "Stats"],
              ["recent", "Recent"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                className={`h-8 rounded px-3 transition ${historyView === id ? "bg-white/10 text-white" : "text-muted hover:text-white"}`}
                type="button"
                onClick={() => setHistoryView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </header>
      {historyView === "stats" ? (
        <section className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mx-auto grid max-w-6xl gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border border-line bg-panel p-4">
                <div className="text-xs uppercase text-muted">Total Listens</div>
                <div className="mt-2 text-2xl font-semibold text-white">{compactNumber(displayStats?.total_play_count)}</div>
                <div className="mt-1 text-xs text-muted">{compactNumber(displayStats?.unique_played_tracks)} unique tracks</div>
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="text-xs uppercase text-muted">Total Time</div>
                <div className="mt-2 text-2xl font-semibold text-moss">{formatListeningTime(displayStats?.total_listened_seconds)}</div>
                <div className="mt-1 text-xs text-muted">Estimated from duration x play count</div>
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="text-xs uppercase text-muted">Skips</div>
                <div className="mt-2 text-2xl font-semibold text-ember">{compactNumber(displayStats?.total_skip_count)}</div>
                <div className="mt-1 text-xs text-muted">{compactNumber(displayStats?.unique_skipped_tracks)} tracks skipped</div>
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="text-xs uppercase text-muted">Library</div>
                <div className="mt-2 text-2xl font-semibold text-white">{compactNumber(stats?.total_tracks)}</div>
                <div className="mt-1 text-xs text-muted">
                  {compactNumber(stats?.rated_tracks)} rated tracks / {compactNumber(displayStats?.total_rated_events)} rating events
                </div>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded border border-line bg-panel p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Top 10 Most Listened</div>
                    <div className="text-xs text-muted">Ranked by saved play count.</div>
                  </div>
                  <span className="rounded border border-moss/30 bg-moss/10 px-2 py-1 text-xs text-moss">
                    {compactNumber(displayStats?.total_play_events)} events
                  </span>
                </div>
                {renderTopTrackList(displayStats?.top_played ?? [], "plays")}
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Top 10 Most Skipped</div>
                    <div className="text-xs text-muted">Useful for cleanup and AutoDJ tuning.</div>
                  </div>
                  <span className="rounded border border-ember/30 bg-ember/10 px-2 py-1 text-xs text-ember">
                    {compactNumber(displayStats?.total_skip_events)} events
                  </span>
                </div>
                {renderTopTrackList(displayStats?.top_skipped ?? [], "skips")}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="min-w-0 overflow-auto">
          <table className="w-full table-fixed text-left text-sm" style={{ minWidth: tableWidth }}>
            <colgroup>
              <col style={{ width: columnWidths.event }} />
              <col style={{ width: columnWidths.track }} />
              <col style={{ width: columnWidths.context }} />
              <col style={{ width: columnWidths.when }} />
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
              <tr>
                <ResizableHeader label="Event" column="event" width={columnWidths.event} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="Track" column="track" width={columnWidths.track} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="Artist / Album" column="context" width={columnWidths.context} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
                <ResizableHeader label="When" column="when" width={columnWidths.when} sort={{ key: "title", direction: "asc" }} onSort={() => {}} onResize={handleResize} />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-line/60 hover:bg-white/[0.035]">
                  <td className="px-2 py-2 text-muted">
                    <span className={`inline-flex rounded border px-2 py-0.5 text-[0.68rem] font-semibold uppercase ${eventTone(event.event_type)}`}>
                      {eventLabel(event.event_type)}
                    </span>
                  </td>
                  <td className="truncate px-3 py-3">
                    {event.track ? (
                      <button className="block max-w-full truncate text-left font-medium text-white" type="button" onClick={() => onPlayTrack(event.track!, playable)}>
                        {display(event.track.title, "Untitled")}
                      </button>
                    ) : (
                      <span className="text-muted">Missing track</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="truncate text-neutral-200">{display(event.track?.artist)}</div>
                    <div className="truncate text-xs text-muted">{display(event.track?.album, "Unknown album")}</div>
                  </td>
                  <td className="truncate px-3 py-2 text-xs text-muted" title={event.timestamp}>
                    {formatHistoryDate(event.timestamp)}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className="px-3 py-10 text-center text-sm text-muted" colSpan={4}>
                    No history events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
