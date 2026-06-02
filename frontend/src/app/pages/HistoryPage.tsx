import {
Play,
RefreshCw,
} from "lucide-react";
import {
useState,
} from "react";

import type {
HistoryAlbumCompletionStat,
HistoryDensityStat,
HistoryPeriodStat,
HistoryRatingStat,
HistoryStatsResponse,
HistoryTrackStat,
LibraryStatsResponse,
LibraryTimelineStat,
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

function periodRowsFor(
  stats: HistoryStatsResponse | null,
  period: "day" | "week" | "month",
): HistoryPeriodStat[] {
  if (!stats) {
    return [];
  }
  if (period === "day") {
    return stats.events_by_day ?? [];
  }
  if (period === "week") {
    return stats.events_by_week ?? [];
  }
  return stats.events_by_month ?? [];
}

function timelineRowsFor(
  stats: HistoryStatsResponse | null,
  period: "day" | "week" | "month",
): LibraryTimelineStat[] {
  if (!stats) {
    return [];
  }
  if (period === "day") {
    return stats.library_added_by_day ?? [];
  }
  if (period === "week") {
    return stats.library_added_by_week ?? [];
  }
  return stats.library_added_by_month ?? [];
}

function ratingLabel(rating: number) {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

function renderRatingDistribution(rows: HistoryRatingStat[]) {
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.rating} className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
          <span className="text-muted">{ratingLabel(row.rating)}</span>
          <div className="h-2 overflow-hidden rounded bg-ink">
            <div className="h-full rounded bg-moss" style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }} />
          </div>
          <span className="text-right tabular-nums text-neutral-200">{compactNumber(row.count)}</span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="rounded border border-line/70 bg-ink px-3 py-6 text-center text-xs text-muted">
          No rated tracks yet.
        </div>
      )}
    </div>
  );
}

function renderPeriodBars(rows: HistoryPeriodStat[]) {
  const maxPlays = Math.max(1, ...rows.map((row) => row.plays));
  const visibleRows = rows.slice(-18);
  return (
    <div className="grid gap-2">
      {visibleRows.map((row) => (
        <div key={row.period} className="grid grid-cols-[5.75rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs" title={`${row.plays.toLocaleString()} plays, ${row.skips.toLocaleString()} skips, ${formatListeningTime(row.listened_seconds)}`}>
          <span className="truncate text-muted">{row.period}</span>
          <div className="h-2 overflow-hidden rounded bg-ink">
            <div className="h-full rounded bg-ember" style={{ width: `${Math.max(4, (row.plays / maxPlays) * 100)}%` }} />
          </div>
          <span className="text-right tabular-nums text-neutral-200">{compactNumber(row.plays)}</span>
        </div>
      ))}
      {visibleRows.length === 0 && (
        <div className="rounded border border-line/70 bg-ink px-3 py-6 text-center text-xs text-muted">
          No listening events yet.
        </div>
      )}
    </div>
  );
}

function renderTimelineBars(rows: LibraryTimelineStat[]) {
  const maxTracks = Math.max(1, ...rows.map((row) => row.tracks));
  const visibleRows = rows.slice(-18);
  return (
    <div className="grid gap-2">
      {visibleRows.map((row) => (
        <div key={row.period} className="grid grid-cols-[5.75rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs" title={`${row.tracks.toLocaleString()} tracks, ${formatListeningTime(row.duration_seconds)}`}>
          <span className="truncate text-muted">{row.period}</span>
          <div className="h-2 overflow-hidden rounded bg-ink">
            <div className="h-full rounded bg-moss" style={{ width: `${Math.max(4, (row.tracks / maxTracks) * 100)}%` }} />
          </div>
          <span className="text-right tabular-nums text-neutral-200">{compactNumber(row.tracks)}</span>
        </div>
      ))}
      {visibleRows.length === 0 && (
        <div className="rounded border border-line/70 bg-ink px-3 py-6 text-center text-xs text-muted">
          No library additions yet.
        </div>
      )}
    </div>
  );
}

function renderListeningDensity(rows: HistoryDensityStat[]) {
  const rowMap = new Map(rows.map((row) => [`${row.weekday}:${row.hour}`, row.plays]));
  const maxPlays = Math.max(1, ...rows.map((row) => row.plays));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="grid gap-1">
      <div className="grid grid-cols-[2.2rem_repeat(24,minmax(0,1fr))] gap-1 text-[9px] text-muted">
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center">{hour % 6 === 0 ? hour : ""}</span>
        ))}
      </div>
      {days.map((day, weekday) => (
        <div key={day} className="grid grid-cols-[2.2rem_repeat(24,minmax(0,1fr))] gap-1">
          <span className="text-[10px] text-muted">{day}</span>
          {Array.from({ length: 24 }, (_, hour) => {
            const plays = rowMap.get(`${weekday}:${hour}`) ?? 0;
            const opacity = plays === 0 ? 0.08 : 0.22 + (plays / maxPlays) * 0.68;
            return (
              <div
                key={`${day}-${hour}`}
                className="aspect-square rounded-sm bg-moss"
                style={{ opacity }}
                title={`${day} ${hour}:00 - ${plays.toLocaleString()} play${plays === 1 ? "" : "s"}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
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
    albums_completed: 0,
    albums_tracked: stats?.total_albums ?? 0,
    album_completion_percent: 0,
    completed_albums: [],
    next_albums: [],
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
  const [historyPeriod, setHistoryPeriod] = useState<"day" | "week" | "month">("week");
  const tableWidth = Object.values(columnWidths).reduce((total, width) => total + width, 0);
  const displayStats = historyStats ?? deriveHistoryStats(events, stats);
  const periodRows = periodRowsFor(displayStats, historyPeriod);
  const timelineRows = timelineRowsFor(displayStats, historyPeriod);

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

  function renderAlbumProgress(row: HistoryAlbumCompletionStat) {
    const percent = Math.max(0, Math.min(100, row.completion_percent));
    return (
      <div className="mt-2 h-2 overflow-hidden rounded bg-ink">
        <div
          className={`h-full rounded ${row.unplayed_track_count === 0 ? "bg-moss" : "bg-ember"}`}
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>
    );
  }

  function renderAlbumCompletionRow(row: HistoryAlbumCompletionStat, mode: "next" | "completed") {
    const nextTrack = row.next_track;
    const subtitle = `${display(row.album_artist, "Unknown artist")} - ${row.played_track_count.toLocaleString()}/${row.track_count.toLocaleString()} tracks`;
    return (
      <div
        key={`${mode}-${row.album_artist ?? "unknown"}-${row.album}`}
        className="rounded border border-line/70 bg-ink px-3 py-2 text-xs"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-100">{display(row.album, "Unknown album")}</div>
            <div className="truncate text-muted">{subtitle}</div>
          </div>
          <div className={mode === "completed" ? "shrink-0 tabular-nums text-moss" : "shrink-0 tabular-nums text-ember"}>
            {mode === "completed" ? "done" : `${row.unplayed_track_count} left`}
          </div>
        </div>
        {renderAlbumProgress(row)}
        <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-[11px] text-muted">
          <span className="truncate">
            {mode === "completed"
              ? row.last_played_at
                ? `Completed by ${formatHistoryDate(row.last_played_at)}`
                : "All local tracks have been played"
              : nextTrack
                ? `Next: ${display(nextTrack.title, "Untitled")}`
                : "No unplayed track found"}
          </span>
          {mode === "next" && nextTrack && (
            <button
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-moss/40 px-2 text-moss transition hover:bg-moss/10"
              type="button"
              title="Play next unplayed track"
              onClick={() => onPlayTrack(nextTrack, [nextTrack])}
            >
              <Play size={12} />
              Play
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderAlbumCompletionPanel() {
    const nextAlbums = displayStats?.next_albums ?? [];
    const completedAlbums = displayStats?.completed_albums ?? [];
    const primaryNextAlbum = nextAlbums[0] ?? null;
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded border border-line bg-panel p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Next Album To Finish</div>
              <div className="text-xs text-muted">Closest incomplete albums by unplayed track count.</div>
            </div>
            {primaryNextAlbum && (
              <span className="rounded border border-ember/30 bg-ember/10 px-2 py-1 text-xs text-ember">
                {primaryNextAlbum.unplayed_track_count.toLocaleString()} left
              </span>
            )}
          </div>
          <div className="grid gap-2">
            {nextAlbums.slice(0, 5).map((row) => renderAlbumCompletionRow(row, "next"))}
            {nextAlbums.length === 0 && (
              <div className="rounded border border-line/70 bg-ink px-3 py-8 text-center text-xs text-muted">
                No incomplete albums found.
              </div>
            )}
          </div>
        </div>
        <div className="rounded border border-line bg-panel p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-white">Completed Albums</div>
            <div className="text-xs text-muted">Most recently finished local album groups.</div>
          </div>
          <div className="grid max-h-[26rem] content-start gap-2 overflow-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {completedAlbums.map((row) => renderAlbumCompletionRow(row, "completed"))}
            {completedAlbums.length === 0 && (
              <div className="rounded border border-line/70 bg-ink px-3 py-8 text-center text-xs text-muted">
                No completed albums yet.
              </div>
            )}
          </div>
        </div>
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
                <div className="text-xs uppercase text-muted">Albums Completed</div>
                <div className="mt-2 text-2xl font-semibold text-white">{compactNumber(displayStats?.albums_completed)}</div>
                <div className="mt-1 text-xs text-muted">
                  {compactNumber(displayStats?.albums_tracked)} tracked / {(displayStats?.album_completion_percent ?? 0).toFixed(1)}%
                </div>
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="text-xs uppercase text-muted">Library</div>
                <div className="mt-2 text-2xl font-semibold text-white">{compactNumber(stats?.total_tracks)}</div>
                <div className="mt-1 text-xs text-muted">
                  {compactNumber(stats?.rated_tracks)} rated tracks / {compactNumber(displayStats?.total_rated_events)} rating events
                </div>
              </div>
            </div>
            {renderAlbumCompletionPanel()}
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded border border-line bg-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Listening By {historyPeriod[0].toUpperCase() + historyPeriod.slice(1)}</div>
                    <div className="text-xs text-muted">Plays, skips, ratings, and estimated listening time.</div>
                  </div>
                  <div className="grid grid-cols-3 rounded border border-line bg-ink p-1 text-xs">
                    {(["day", "week", "month"] as const).map((period) => (
                      <button
                        key={period}
                        className={`h-7 rounded px-2 capitalize transition ${historyPeriod === period ? "bg-white/10 text-white" : "text-muted hover:text-white"}`}
                        type="button"
                        onClick={() => setHistoryPeriod(period)}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
                {renderPeriodBars(periodRows)}
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-white">Library Timeline</div>
                  <div className="text-xs text-muted">Tracks added by {historyPeriod}.</div>
                </div>
                {renderTimelineBars(timelineRows)}
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded border border-line bg-panel p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-white">Rating Stats</div>
                  <div className="text-xs text-muted">Distribution across saved track ratings.</div>
                </div>
                {renderRatingDistribution(displayStats?.rating_distribution ?? [])}
              </div>
              <div className="rounded border border-line bg-panel p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-white">Listening Density</div>
                  <div className="text-xs text-muted">Play events by day of week and hour.</div>
                </div>
                {renderListeningDensity(displayStats?.listening_density ?? [])}
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
        <section className="min-w-0 overflow-auto px-4 py-3">
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
