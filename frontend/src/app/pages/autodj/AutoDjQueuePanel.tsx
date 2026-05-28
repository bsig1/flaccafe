import { Fragment } from "react";
import {
  ArrowDown,
  ArrowUp,
  FolderOpen,
  GripVertical,
  Info,
  Play,
  Plus,
  SkipForward,
  Trash2,
  Volume2,
  Wand2,
  X,
} from "lucide-react";

import type {
  QueueTrack,
  RecommendationDrift,
  RecommendationRun,
} from "../../../types/api";
import {
  breakdownEntries,
  display,
  formatDuration,
  formatPercent,
  formatShortDate,
  isClapAnalyzed,
  reasonChipClass,
  reasonChips,
} from "../../shared";

export function AutoDjQueuePanel({ model }: { model: any }) {
  const queue = model.queue as QueueTrack[];
  const selectedQueueKeys = model.selectedQueueKeys as Set<string>;
  const recommendationDrift = model.recommendationDrift as RecommendationDrift;
  const recommendationHistory = model.recommendationHistory as RecommendationRun[];
  const {
    setQueueSelection,
    removeSelectedQueueItems,
    queueDuration,
    queueArtists,
    clapTracks,
    allQueueSelected,
    toggleQueueSelection,
    explainTrackKey,
    setExplainTrackKey,
    currentTrackId,
    dragQueueIndex,
    dragQueueOverIndex,
    openQueueContextMenu,
    beginQueueDrag,
    onPlayTrack,
    compactReasonForTrack,
    compactScoreBreakdown,
    scoreLabel,
    moveQueueItem,
    setQueue,
    setSelectedQueueKeys,
    queueContextMenu,
    setQueueContextMenu,
    onPlayNext,
    onAddToQueue,
    onQuickAutoDj,
    onRevealTrack,
    onRefreshHistory,
  } = model;

  return (
        <section className="min-w-0 overflow-auto">
          {selectedQueueKeys.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-line bg-[rgb(var(--color-subtle))] px-4 py-2 text-sm">
              <div className="text-muted">
                <span className="font-medium text-white">{selectedQueueKeys.size}</span> selected
              </div>
              <div className="flex items-center gap-2">
                <button className="secondary-button h-8" type="button" onClick={() => setQueueSelection(false)}>
                  Clear
                </button>
                <button className="secondary-button h-8 text-ember" type="button" onClick={removeSelectedQueueItems}>
                  <Trash2 size={14} />
                  Remove Selected
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-3 border-b border-line bg-[rgb(var(--color-strip))] p-4 md:grid-cols-4">
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Tracks</div>
              <div className="mt-1 text-xl font-semibold text-white">{queue.length}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Duration</div>
              <div className="mt-1 text-xl font-semibold text-white">{formatDuration(queueDuration)}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">Artists</div>
              <div className="mt-1 text-xl font-semibold text-white">{queueArtists}</div>
            </div>
            <div className="rounded border border-line/70 bg-panel p-3">
              <div className="text-xs uppercase text-muted">CLAP</div>
              <div className="mt-1 text-xl font-semibold text-moss">{queue.length ? formatPercent((clapTracks / queue.length) * 100) : "--"}</div>
            </div>
          </div>
          {recommendationDrift.total_tracks > 0 && (
            <div className="border-b border-line bg-[rgb(var(--color-subtle))] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Recommendation Drift</div>
                  <div className="text-xs text-muted">
                    {recommendationDrift.unique_artists} artists, {recommendationDrift.unique_albums} albums, average rating{" "}
                    {recommendationDrift.average_rating?.toFixed(2) ?? "unrated"}
                  </div>
                </div>
                <div className="text-xs text-muted">{recommendationDrift.total_tracks} tracks</div>
              </div>
              {recommendationDrift.warnings.length > 0 && (
                <div className="mb-3 grid gap-1.5">
                  {recommendationDrift.warnings.map((warning: string) => (
                    <div key={warning} className="rounded border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
                      {warning}
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ["Familiar", recommendationDrift.familiar_percent, "bg-moss"],
                  ["Exploration", recommendationDrift.exploration_percent, "bg-ember"],
                  ["Unrated", recommendationDrift.unrated_percent, "bg-[rgb(var(--color-soft-accent))]"],
                  ["Artist repeats", recommendationDrift.repeat_artist_percent, "bg-red-300"],
                  ["CLAP", recommendationDrift.clap_percent, "bg-neutral-300"],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded border border-line/70 bg-panel p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-muted">{label}</span>
                      <span className="tabular-nums text-neutral-100">{Number(value).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-ink">
                      <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {recommendationHistory.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium uppercase text-muted">Recent Queue Balance</div>
                    <button className="text-xs text-muted hover:text-white" type="button" onClick={() => void onRefreshHistory()}>
                      Refresh
                    </button>
                  </div>
                  <div className="grid gap-1.5">
                    {recommendationHistory.slice(0, 5).map((run) => (
                      <div key={run.id} className="grid grid-cols-[120px_1fr_60px] items-center gap-3 text-xs">
                        <span className="truncate text-muted">{formatShortDate(run.created_at)}</span>
                        <div className="flex h-2 overflow-hidden rounded bg-ink">
                          <div className="bg-moss" style={{ width: `${Math.min(100, run.drift.familiar_percent)}%` }} />
                          <div className="bg-ember" style={{ width: `${Math.min(100, run.drift.exploration_percent)}%` }} />
                        </div>
                        <span className="text-right tabular-nums text-muted">{run.track_ids.length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <table className="w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-ink text-xs uppercase text-muted">
              <tr>
                <th className="w-11 px-3 py-3 font-medium">
                  <input
                    aria-label="Select AutoDJ queue"
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={allQueueSelected}
                    disabled={queue.length === 0}
                    onChange={(event) => setQueueSelection(event.target.checked)}
                  />
                </th>
                <th className="w-14 px-3 py-3 font-medium"></th>
                <th className="w-20 px-4 py-3 font-medium">#</th>
                <th className="w-[42%] px-3 py-3 font-medium xl:w-[34%]">Title</th>
                <th className="w-[24%] px-3 py-3 font-medium xl:w-[18%]">Artist</th>
                <th className="hidden w-[18%] px-3 py-3 font-medium xl:table-cell">Album</th>
                <th className="w-24 px-3 py-3 font-medium">Score</th>
                <th className="hidden w-[22%] px-3 py-3 font-medium 2xl:table-cell">Why</th>
                <th className="w-28 px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((track: QueueTrack, index: number) => {
                const rowKey = `${track.id}-${index}`;
                const explained = explainTrackKey === rowKey;
                return (
                <Fragment key={rowKey}>
                <tr
                  data-reorder-index={index}
                  onContextMenu={(event) => openQueueContextMenu(event, track, index, rowKey)}
                  className={`border-b border-line/60 hover:bg-white/[0.035] ${
                    selectedQueueKeys.has(rowKey)
                      ? "bg-white/[0.035]"
                      : dragQueueIndex === index
                        ? "bg-moss/10"
                        : dragQueueOverIndex === index
                          ? "bg-ember/10"
                          : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      aria-label={`Select ${display(track.title, "track")}`}
                      type="checkbox"
                      className="h-4 w-4 accent-moss"
                      checked={selectedQueueKeys.has(rowKey)}
                      onChange={() => toggleQueueSelection(rowKey)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      className={`icon-button h-8 w-8 ${
                        currentTrackId === track.id ? "border-moss text-moss" : ""
                      }`}
                      title={`Play ${display(track.title, "track")}`}
                      type="button"
                      onClick={() => onPlayTrack(track, queue)}
                    >
                      {currentTrackId === track.id ? <Volume2 size={15} /> : <Play size={15} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    <button
                      className="inline-flex cursor-grab items-center gap-1 rounded px-1.5 py-1 text-muted hover:bg-white/10 hover:text-white active:cursor-grabbing"
                      type="button"
                      title="Drag to reorder"
                      onPointerDown={(event) => beginQueueDrag(event, index, track)}
                    >
                      <GripVertical size={14} />
                      <span>{index + 1}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="truncate font-medium text-white">{display(track.title, "Untitled")}</div>
                    <div className="truncate text-xs text-muted 2xl:hidden">
                      {compactReasonForTrack(track)}
                    </div>
                  </td>
                  <td className="truncate px-3 py-3 text-neutral-200">{display(track.artist)}</td>
                  <td className="hidden truncate px-3 py-3 text-neutral-300 xl:table-cell">{display(track.album)}</td>
                  <td className="px-3 py-3 tabular-nums text-moss">{track.score.toFixed(2)}</td>
                  <td className="hidden px-3 py-3 2xl:table-cell">
                    <button
                      className="grid w-full min-w-0 gap-1 rounded px-1.5 py-1 text-left hover:bg-white/[0.04]"
                      type="button"
                      title={track.reason}
                      onClick={() => setExplainTrackKey(explained ? null : rowKey)}
                    >
                      <span className="truncate text-xs font-medium text-neutral-100">{compactReasonForTrack(track)}</span>
                      <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                        {compactScoreBreakdown(track).map(([key, value]: [string, number]) => (
                          <span
                            key={key}
                            className={`max-w-[7rem] truncate rounded border px-1.5 py-0.5 text-[11px] ${
                              value >= 0
                                ? "border-moss/30 bg-moss/10 text-moss"
                                : "border-red-500/30 bg-red-500/10 text-red-200"
                            }`}
                            title={`${scoreLabel(key)}: ${value.toFixed(3)}`}
                          >
                            {scoreLabel(key)} {value >= 0 ? "+" : ""}
                            {value.toFixed(2)}
                          </span>
                        ))}
                        {isClapAnalyzed(track) && (
                          <span className="shrink-0 rounded border border-moss/40 bg-moss/10 px-1.5 py-0.5 text-[11px] text-moss">
                            CLAP
                          </span>
                        )}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="icon-button h-8 w-8" type="button" title="Move up" disabled={index === 0} onClick={() => moveQueueItem(index, "up")}>
                        <ArrowUp size={14} />
                      </button>
                      <button className="icon-button h-8 w-8" type="button" title="Move down" disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, "down")}>
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className={`icon-button h-8 w-8 ${explained ? "border-moss text-moss" : ""}`}
                        type="button"
                        title="Why this track?"
                        onClick={() => setExplainTrackKey(explained ? null : rowKey)}
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="icon-button h-8 w-8"
                        type="button"
                        title="Remove from queue"
                        onClick={() => {
                          setQueue(queue.filter((_: QueueTrack, itemIndex: number) => itemIndex !== index));
                          setSelectedQueueKeys(new Set());
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {explained && (
                  <tr className="border-b border-line/60 bg-[rgb(var(--color-subtle))]">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid gap-4 text-sm md:grid-cols-[1fr_280px]">
                        <div>
                          <div className="mb-2 text-xs font-medium uppercase text-muted">Why this track</div>
                          <div className="flex flex-wrap gap-2">
                            {breakdownEntries(track).map(([key, value]) => (
                              <span
                                key={key}
                                className={`rounded border px-2 py-1 text-xs ${
                                  value >= 0
                                    ? "border-moss/30 bg-moss/10 text-moss"
                                    : "border-red-500/30 bg-red-500/10 text-red-200"
                                }`}
                                title={`${key}: ${value.toFixed(3)}`}
                              >
                                {scoreLabel(key)} {value >= 0 ? "+" : ""}
                                {value.toFixed(3)}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 rounded border border-line/70 bg-ink px-3 py-2 text-xs leading-5 text-neutral-300">
                            {track.reason}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {reasonChips(track.reason).map((reason) => (
                              <span
                                key={reason}
                                className={`rounded border px-2 py-1 text-xs ${reasonChipClass(reason)}`}
                              >
                                {reason}
                              </span>
                            ))}
                            {isClapAnalyzed(track) && (
                              <span className="rounded border border-moss/40 bg-moss/10 px-2 py-1 text-xs text-moss">
                                CLAP {display(track.analysis_genre, "audio")}
                                {track.analysis_mood ? ` / ${track.analysis_mood}` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rounded border border-line/70 bg-panel p-3 text-xs">
                          <div className="mb-2 font-medium uppercase text-muted">Audio analysis</div>
                          <div className="grid gap-1">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Provider</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_provider, "None")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Genre</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_genre, "-")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Confidence</span>
                              <span className="text-neutral-200">
                                {track.analysis_genre_confidence !== null && track.analysis_genre_confidence !== undefined
                                  ? formatPercent(track.analysis_genre_confidence * 100)
                                  : "--"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Mood</span>
                              <span className="truncate text-neutral-200">{display(track.analysis_mood, "-")}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Mood match</span>
                              <span className="text-neutral-200">
                                {track.analysis_mood_confidence !== null && track.analysis_mood_confidence !== undefined
                                  ? formatPercent(track.analysis_mood_confidence * 100)
                                  : "--"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted">Seed similarity</span>
                              <span className="text-neutral-200">
                                {track.score_breakdown?.similarity ? `+${track.score_breakdown.similarity.toFixed(3)}` : "--"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
              })}
            </tbody>
          </table>
          {queue.length === 0 && (
            <div className="grid h-full place-items-center text-sm text-muted">
              Generate a queue after scanning your library.
            </div>
          )}
          {queueContextMenu && (
            <div
              className="fixed z-50 w-56 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm text-neutral-100 shadow-2xl"
              style={{ left: queueContextMenu.x, top: queueContextMenu.y }}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onPlayTrack(queueContextMenu.track, queue);
                  setQueueContextMenu(null);
                }}
              >
                <Play size={15} />
                Play
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onPlayNext(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <SkipForward size={15} />
                Play Next
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  onAddToQueue(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <Plus size={15} />
                Add To Playback Queue
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onQuickAutoDj(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <Wand2 size={15} />
                AutoDJ From Track
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  void onRevealTrack(queueContextMenu.track);
                  setQueueContextMenu(null);
                }}
              >
                <FolderOpen size={15} />
                Reveal in Explorer
              </button>
              <div className="my-1 border-t border-line" />
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10"
                type="button"
                onClick={() => {
                  setExplainTrackKey(queueContextMenu.rowKey);
                  setQueueContextMenu(null);
                }}
              >
                <Info size={15} />
                Why This Track?
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
                type="button"
                disabled={queueContextMenu.index === 0}
                onClick={() => {
                  moveQueueItem(queueContextMenu.index, "up");
                  setQueueContextMenu(null);
                }}
              >
                <ArrowUp size={15} />
                Move Up
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 disabled:text-muted"
                type="button"
                disabled={queueContextMenu.index === queue.length - 1}
                onClick={() => {
                  moveQueueItem(queueContextMenu.index, "down");
                  setQueueContextMenu(null);
                }}
              >
                <ArrowDown size={15} />
                Move Down
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-ember hover:bg-white/10"
                type="button"
                onClick={() => {
                  setQueue(queue.filter((_: QueueTrack, itemIndex: number) => itemIndex !== queueContextMenu.index));
                  setSelectedQueueKeys(new Set());
                  setQueueContextMenu(null);
                }}
              >
                <Trash2 size={15} />
                Remove From AutoDJ
              </button>
            </div>
          )}
        </section>

  );
}
