import {
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
} from "lucide-react";
import type { CSSProperties } from "react";

import { audioUrl } from "../../lib/api";
import type { RadioStation, Track } from "../../types/api";
import { RatingStars } from "../components/common";
import { display, formatPlaybackTime } from "../shared";

export function PlayerBarView({ model }: { model: any }) {
  const currentTrack = model.currentTrack as Track | null;
  const currentRadioStation = model.currentRadioStation as RadioStation | null;
  const preloadedNextTrack = model.preloadedNextTrack as Track | null;
  const {
    miniPlayer, artworkSrc, playerTitle, hideArtworkPreview, scheduleArtworkPreview, setArtworkFailed, isRadioSource, isPreviewTrack, isLibraryTrack, radioSubtitle, hasCurrentArtist, currentArtistLabel, onOpenCurrentArtist, hasCurrentAlbum, currentAlbumLabel, onOpenCurrentAlbum, onOpenCurrentTrack, cdSkipIsSettling, hasPrevious, canPreviousAction, handlePreviousTrack, playRelative, isPlaying, hasPlayableSource, togglePlayback, hasNext, usePlayback, webAudioSourceUrl, webAudioKey, audioRef, isCdPreviewTrack, syncDuration, handleTimeUpdate, setIsPlaying, suppressWebPauseUntilRef, maybeClearPendingResume, handleEnded, activeSourceKeyRef, activeSourceKey, suppressWebPlaybackErrorsUntilRef, setStatus, canPreloadNextTrack, nextAudioRef, trackAudioSourceUrl, effectiveDuration, currentTime, progressPercent, progressFill, handleSeek, handleProgressKeyDown, playbackMode, cycleRepeatMode, onOpenLyricsView, onOpenQueueView, muted, volume, handleVolumeWheel, toggleMuted, handleVolumeChange, volumePercentDraft, commitVolumePercent, setVolumePercentDraft, handleVolumePercentChange, handleVolumePercentKeyDown, onRating, showArtworkPreview,
  } = model;

  return (
    <section
      className={`grid shrink-0 items-center border-t border-line bg-[rgb(var(--color-sidebar))] px-4 ${
        miniPlayer
          ? "h-20 grid-cols-[minmax(180px,280px)_1fr_minmax(120px,150px)] gap-3"
          : "h-28 grid-cols-[minmax(220px,340px)_1fr_minmax(260px,320px)] gap-5"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <div
            aria-label={artworkSrc ? `Album cover for ${playerTitle}` : undefined}
            className="grid h-16 w-16 place-items-center overflow-hidden rounded border border-line bg-panel text-moss shadow-inner outline-none transition focus-visible:ring-2 focus-visible:ring-moss/55"
            role={artworkSrc ? "img" : undefined}
            tabIndex={artworkSrc ? 0 : -1}
            onBlur={hideArtworkPreview}
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
          </div>
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
                  title={`Open artist: ${currentArtistLabel}`}
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

        {!usePlayback && webAudioSourceUrl ? (
          <audio
            key={webAudioKey}
            ref={audioRef}
            className="hidden"
            crossOrigin="anonymous"
            preload={isRadioSource || isCdPreviewTrack ? "metadata" : "auto"}
            src={webAudioSourceUrl}
            onLoadedMetadata={syncDuration}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => {
              setIsPlaying(true);
            }}
            onPause={() => {
              if (window.performance.now() < suppressWebPauseUntilRef.current) {
                return;
              }
              setIsPlaying(false);
            }}
            onCanPlay={() => {
              syncDuration();
            }}
            onSeeked={() => {
              const audio = audioRef.current;
              if (audio) {
                maybeClearPendingResume(audio.currentTime);
              }
            }}
            onEnded={isRadioSource ? () => setIsPlaying(false) : handleEnded}
            onError={() => {
              const isStaleEvent = activeSourceKeyRef.current !== activeSourceKey;
              const isSuppressedTeardownError = window.performance.now() < suppressWebPlaybackErrorsUntilRef.current;
              if (isStaleEvent || isSuppressedTeardownError) {
                return;
              }
              const code = audioRef.current?.error?.code;
              const message =
                isRadioSource
                  ? "Radio stream could not be loaded."
                  : code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                    ? "This file is not supported by the current WebView codec stack. Use the external-player button for a fallback."
                    : "Audio source failed to load. The backend may need a restart, or the file may be missing.";
              setStatus(message);
            }}
          />
        ) : !usePlayback ? (
          <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
        ) : null}
        {!usePlayback && preloadedNextTrack && canPreloadNextTrack && (
          <audio
            key={`next-${preloadedNextTrack.id}`}
            ref={nextAudioRef}
            className="hidden"
            crossOrigin="anonymous"
            preload="auto"
            src={trackAudioSourceUrl(preloadedNextTrack)}
          />
        )}

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
            <input
              aria-label="Playback position"
              className="player-progress"
              disabled={!currentTrack || effectiveDuration <= 0 || isCdPreviewTrack}
              max={Math.max(effectiveDuration, 0)}
              min={0}
              step={1}
              style={{ "--progress": `${progressPercent}%`, "--progress-fill": progressFill } as CSSProperties}
              type="range"
              value={effectiveDuration > 0 ? Math.min(currentTime, effectiveDuration) : 0}
              onChange={handleSeek}
              onKeyDown={handleProgressKeyDown}
            />
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
              <RatingStars rating={currentTrack.rating} onChange={(rating) => onRating(currentTrack.id, rating)} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
