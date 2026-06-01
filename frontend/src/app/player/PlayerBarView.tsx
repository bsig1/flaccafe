import {
Activity,
FileText,
ListMusic,
Pause,
Play,
Radio,
Repeat,
Repeat1,
Repeat2,
SkipBack,
SkipForward,
Volume2,
VolumeX,
X,
} from "lucide-react";
import type {
CSSProperties,
} from "react";

import type { RadioStation,Track } from "../../types/api";
import { RatingStars } from "../components/common";
import { formatPlaybackTime } from "../shared";

const PLAYBACK_SCRUB_STEP_SECONDS = 0.01;

export function PlayerBarView({ model }: { model: any }) {
  const currentTrack = model.currentTrack as Track | null;
  const currentRadioStation = model.currentRadioStation as RadioStation | null;
  const {
    miniPlayer, artworkSrc, playerTitle, hideArtworkPreview, scheduleArtworkPreview, setArtworkFailed, isRadioSource, isPreviewTrack, isLibraryTrack, radioSubtitle, hasCurrentArtist, currentArtistLabel, onOpenCurrentArtist, onOpenCurrentArtistInfo, hasCurrentAlbum, currentAlbumLabel, onOpenCurrentAlbum, onOpenCurrentTrack, cdSkipIsSettling, hasPrevious, canPreviousAction, handlePreviousTrack, playRelative, isPlaying, hasPlayableSource, togglePlayback, hasNext, effectiveDuration, currentTime, progressPercent, progressFill, handleSeek, handleProgressKeyDown, playbackSeekStepSeconds, playbackMode, cycleRepeatMode, onOpenLyricsView, onOpenQueueView, showOutputDiagnosticsButton, diagnosticsOpen, setDiagnosticsOpen, playbackDiagnostics, muted, volume, handleVolumeWheel, toggleMuted, handleVolumeChange, volumePercentDraft, commitVolumePercent, setVolumePercentDraft, handleVolumePercentChange, handleVolumePercentKeyDown, onRating, displayRatingsAsNumbers, showArtworkPreview,
  } = model;

  return (
    <section
      className={`relative grid shrink-0 items-center border-t border-line bg-[rgb(var(--color-sidebar))] px-4 ${
        miniPlayer
          ? "h-20 grid-cols-[minmax(180px,280px)_1fr_minmax(120px,150px)] gap-3"
          : "h-28 grid-cols-[minmax(220px,340px)_1fr_minmax(260px,320px)] gap-5"
      }`}
    >
      {diagnosticsOpen && (
        <div className="absolute bottom-[calc(100%+0.5rem)] right-4 z-50 w-[min(30rem,calc(100vw-2rem))] rounded border border-line bg-[rgb(var(--color-popover))] p-3 text-xs shadow-2xl shadow-black/45">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-semibold text-white">Output Diagnostics</div>
            <button className="icon-button h-7 w-7" type="button" title="Close diagnostics" onClick={() => setDiagnosticsOpen(false)}>
              <X size={13} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-line/70 bg-ink px-3 py-2">
              <div className="text-muted">Backend</div>
              <div className="truncate text-neutral-100">{playbackDiagnostics?.output_backend ?? "not opened"}</div>
            </div>
            <div className="rounded border border-line/70 bg-ink px-3 py-2">
              <div className="text-muted">Sample rate</div>
              <div className="text-neutral-100">{playbackDiagnostics?.sample_rate ? `${playbackDiagnostics.sample_rate} Hz` : "unknown"}</div>
            </div>
            <div className="rounded border border-line/70 bg-ink px-3 py-2">
              <div className="text-muted">Buffer</div>
              <div className="text-neutral-100">{playbackDiagnostics?.buffer_frames ? `${playbackDiagnostics.buffer_frames} frames` : "default"}</div>
            </div>
            <div className="rounded border border-line/70 bg-ink px-3 py-2">
              <div className="text-muted">Dropped frames</div>
              <div className={playbackDiagnostics?.dropped_frames ? "text-ember" : "text-neutral-100"}>
                {playbackDiagnostics?.dropped_frames ?? 0}
              </div>
            </div>
          </div>
          <div className="mt-2 truncate text-muted" title={playbackDiagnostics?.device_name ?? undefined}>
            {playbackDiagnostics?.device_name ?? "No output device has been opened yet."}
          </div>
        </div>
      )}
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <button
            aria-label={hasCurrentArtist && currentTrack && !isPreviewTrack ? `Open artist background: ${currentArtistLabel}` : artworkSrc ? `Album cover for ${playerTitle}` : undefined}
            className="grid h-16 w-16 place-items-center overflow-hidden rounded border border-line bg-panel text-moss shadow-inner outline-none transition hover:border-moss/50 focus-visible:ring-2 focus-visible:ring-moss/55"
            type="button"
            title={hasCurrentArtist && currentTrack && !isPreviewTrack ? `Open artist background: ${currentArtistLabel}` : undefined}
            onBlur={hideArtworkPreview}
            onClick={() => {
              if (hasCurrentArtist && currentTrack && !isPreviewTrack) {
                onOpenCurrentArtistInfo(currentTrack);
              }
            }}
            onFocus={scheduleArtworkPreview}
            onMouseEnter={scheduleArtworkPreview}
            onMouseLeave={hideArtworkPreview}
          >
            {artworkSrc ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={artworkSrc}
                onError={() => setArtworkFailed(true)}
              />
            ) : isRadioSource ? (
              <Radio size={22} />
            ) : (
              <Volume2 size={22} />
            )}
          </button>
          {artworkSrc && showArtworkPreview && (
            <div className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] left-0 z-50 w-60 overflow-hidden rounded-lg border border-line bg-panel shadow-2xl shadow-black/45">
              <img
                alt=""
                className="aspect-square w-full object-cover"
                src={artworkSrc}
                onError={() => {
                  setArtworkFailed(true);
                  hideArtworkPreview();
                }}
              />
            </div>
          )}
        </div>
        <div className="grid min-w-0 gap-0.5 overflow-hidden">
          <button
            className="w-fit min-w-0 max-w-full justify-self-start truncate rounded text-left text-sm font-semibold text-white transition hover:text-moss disabled:cursor-default disabled:hover:text-white"
            type="button"
            disabled={!isLibraryTrack}
            title={isLibraryTrack ? "Show track in Library" : undefined}
            onClick={() => isLibraryTrack && currentTrack && onOpenCurrentTrack(currentTrack)}
          >
            {playerTitle}
          </button>
          {currentRadioStation ? (
            <div className="min-w-0 truncate text-xs text-muted" title={currentRadioStation.stream_url}>
              {radioSubtitle}
            </div>
          ) : currentTrack ? (
            <div
              className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-muted"
              style={{ fontSize: "clamp(0.68rem, 0.58rem + 0.22vw, 0.75rem)" }}
            >
              {hasCurrentArtist && !isPreviewTrack ? (
                <button
                  className="min-w-0 max-w-full shrink truncate rounded text-left transition hover:text-white"
                  type="button"
                  title={`Show artist in Library: ${currentArtistLabel}`}
                  onClick={() => onOpenCurrentArtist(currentTrack)}
                >
                  {currentArtistLabel}
                </button>
              ) : (
                <span className="min-w-0 max-w-full shrink truncate">{currentArtistLabel}</span>
              )}
              {hasCurrentAlbum && !isPreviewTrack && (
                <>
                  <span className="shrink-0">-</span>
                  <button
                    className="min-w-0 max-w-full shrink truncate rounded text-left transition hover:text-white"
                    type="button"
                    title={`Open album: ${currentAlbumLabel}`}
                    onClick={() => onOpenCurrentAlbum(currentTrack)}
                  >
                    {currentAlbumLabel}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="truncate text-xs text-muted">Select a track or radio station</div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-center gap-2">
          <button
            className="icon-button"
            type="button"
            title={cdSkipIsSettling ? "CD track is starting" : hasPrevious ? "Previous track" : "Restart track"}
            disabled={!canPreviousAction || cdSkipIsSettling}
            onClick={handlePreviousTrack}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-ember text-ink shadow-sm shadow-black/25 transition hover:bg-[rgb(var(--color-primary-hover))] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            title={isPlaying ? "Pause" : "Play"}
            disabled={!hasPlayableSource}
            onClick={togglePlayback}
          >
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </button>
          <button
            className="icon-button"
            type="button"
            title={cdSkipIsSettling ? "CD track is starting" : "Next track"}
            disabled={!hasNext || cdSkipIsSettling}
            onClick={() => playRelative(1)}
          >
            <SkipForward size={17} />
          </button>
        </div>

        <div
          className={`grid ${
            isRadioSource
              ? "grid-cols-[minmax(48px,auto)_1fr_auto]"
              : "grid-cols-[minmax(48px,auto)_1fr_minmax(48px,auto)_auto]"
          } items-center gap-3 text-xs tabular-nums text-muted`}
        >
          <span className="text-right">{isRadioSource ? "Live" : formatPlaybackTime(currentTime)}</span>
          {isRadioSource ? (
            <div
              aria-label="Live stream"
              className="h-2 min-w-0 overflow-hidden rounded-full bg-line/70 shadow-inner"
              role="progressbar"
            >
              <div
                className="h-full w-full rounded-full bg-ember transition-opacity"
                style={{ boxShadow: isPlaying ? "0 0 12px rgb(var(--color-ember) / 0.55)" : undefined }}
              />
            </div>
          ) : (
            <div className="relative min-w-0">
              <input
                aria-label="Playback position"
                className="player-progress w-full"
                data-wheel-step={playbackSeekStepSeconds}
                disabled={!currentTrack || effectiveDuration <= 0}
                max={Math.max(effectiveDuration, 0)}
                min={0}
                step={PLAYBACK_SCRUB_STEP_SECONDS}
                style={{ "--progress": `${progressPercent}%`, "--progress-fill": progressFill } as CSSProperties}
                type="range"
                value={effectiveDuration > 0 ? Math.min(currentTime, effectiveDuration) : 0}
                onChange={handleSeek}
                onKeyDown={handleProgressKeyDown}
              />
            </div>
          )}
          {!isRadioSource && <span>{formatPlaybackTime(effectiveDuration)}</span>}
          <div className="flex items-center justify-end gap-1">
            {!isRadioSource && (
              <>
                <button
                  className={`icon-button h-8 w-8 ${
                    playbackMode === "repeatQueue" || playbackMode === "repeatOne" ? "border-moss text-moss" : ""
                  }`}
                  type="button"
                  title={playbackMode === "repeatOne" ? "Repeat one" : playbackMode === "repeatQueue" ? "Repeat queue" : "Repeat off"}
                  onClick={cycleRepeatMode}
                >
                  {playbackMode === "repeatOne" ? (
                    <Repeat1 size={14} />
                  ) : playbackMode === "repeatQueue" ? (
                    <Repeat2 size={14} />
                  ) : (
                    <Repeat size={14} />
                  )}
                </button>
                <button
                  className="icon-button h-8 w-8"
                  type="button"
                  title="Open lyrics"
                  onClick={onOpenLyricsView}
                >
                  <FileText size={14} />
                </button>
              </>
            )}
            {!isRadioSource && (
              <button
                className="icon-button h-8 w-8"
                type="button"
                title="Open queue"
                onClick={onOpenQueueView}
              >
                <ListMusic size={14} />
              </button>
            )}
            {showOutputDiagnosticsButton && (
              <button
                className={`icon-button h-8 w-8 ${diagnosticsOpen ? "border-moss text-moss" : ""}`}
                type="button"
                title="Output diagnostics"
                onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
              >
                <Activity size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid min-w-0 justify-items-end gap-2 text-right text-xs text-muted">
        <div
          className={`grid ${miniPlayer ? "w-[156px] grid-cols-[28px_1fr_48px]" : "w-[188px] grid-cols-[28px_1fr_48px]"} items-center gap-2`}
          onWheel={handleVolumeWheel}
        >
          <button
            className={`icon-button h-7 w-7 ${muted || volume === 0 ? "border-ember text-ember" : ""}`}
            type="button"
            title={muted || volume === 0 ? "Unmute" : "Mute"}
            onClick={toggleMuted}
          >
            {muted || volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <input
            aria-label="Volume"
            className="h-2 w-full accent-moss"
            max={1}
            min={0}
            step={0.01}
            type="range"
            value={volume}
            onChange={handleVolumeChange}
          />
          <span className="flex items-center justify-end gap-0.5 tabular-nums text-neutral-300" title="Volume percent">
            <input
              aria-label="Volume percent"
              className="h-6 w-8 border-0 bg-transparent p-0 text-right text-xs text-neutral-300 outline-none transition focus:text-white focus:underline focus:decoration-moss"
              inputMode="numeric"
              max={100}
              min={0}
              step={1}
              type="text"
              value={volumePercentDraft ?? String(Math.round(volume * 100))}
              onChange={handleVolumePercentChange}
              onBlur={(event) => {
                commitVolumePercent(event.currentTarget.value);
                setVolumePercentDraft(null);
              }}
              onFocus={(event) => {
                setVolumePercentDraft(String(Math.round(volume * 100)));
                event.currentTarget.select();
              }}
              onKeyDown={handleVolumePercentKeyDown}
            />
            <span>%</span>
          </span>
        </div>
        <div className={`flex ${miniPlayer ? "w-[156px]" : "w-[188px]"} max-w-full items-center justify-end`}>
          {isLibraryTrack && currentTrack && !miniPlayer && (
            <div className="shrink min-w-0 scale-90 origin-right">
              <RatingStars rating={currentTrack.rating} displayAsNumber={displayRatingsAsNumbers} onChange={(rating) => onRating(currentTrack.id, rating)} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
