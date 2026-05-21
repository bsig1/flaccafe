import {
  CheckCircle2,
  CircleStop,
  ExternalLink,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  CSSProperties,
  ChangeEvent,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  albumArtworkUrl,
  audioUrl,
} from "../../lib/api";
import type { SmtcButtonPayload } from "../../lib/tauriMedia";
import {
  clearSmtcState,
  listenForSmtcButtons,
  updateSmtcState,
} from "../../lib/tauriMedia";
import type {
  Track,
} from "../../types/api";
import {
  RatingStars,
} from "../components/common";
import {
  END_FADE_SECONDS,
  MiniPlayerCommand,
  PlaybackMode,
  clampNumber,
  display,
  formatPlaybackTime,
  miniPlayerChannelName,
  miniPlayerTrackSnapshot,
  publishMiniPlayerSnapshot,
  readStoredMuted,
  readStoredVolume,
  shouldRecordTrackAsPlayed,
  trackGenre,
  writeStoredAudioControls,
} from "../shared";

export function PlayerBar({
  currentTrack,
  queue,
  onSelectTrack,
  onTrackEnded,
  onTrackSkipped,
  onPlaybackTime,
  onRating,
  autoPlay,
  fadeMs,
  skipThresholdPercent,
  miniPlayer,
  playbackMode,
  setPlaybackMode,
  onOpenMiniPlayer,
  setStatus,
}: {
  currentTrack: Track | null;
  queue: Track[];
  onSelectTrack: (track: Track, queue: Track[], options?: { suppressExitRecord?: boolean }) => void;
  onTrackEnded: (trackId: number) => Promise<void>;
  onTrackSkipped: (trackId: number) => Promise<void>;
  onPlaybackTime: (seconds: number) => void;
  onRating: (trackId: number, rating: number | null) => void;
  autoPlay: boolean;
  fadeMs: number;
  skipThresholdPercent: number;
  miniPlayer: boolean;
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  onOpenMiniPlayer: () => void | Promise<void>;
  setStatus: (message: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const crossfadeTimerRef = useRef<number | null>(null);
  const endFadeTrackRef = useRef<number | null>(null);
  const crossfadeTrackRef = useRef<number | null>(null);
  const handoffRef = useRef<{ trackId: number; currentTime: number } | null>(null);
  const smtcActionRef = useRef<(payload: SmtcButtonPayload) => void>(() => {});
  const miniPlayerChannelRef = useRef<BroadcastChannel | null>(null);
  const miniPlayerCommandRef = useRef<(command: MiniPlayerCommand) => void>(() => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(readStoredVolume);
  const [muted, setMuted] = useState(readStoredMuted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const currentIndex = currentTrack ? queue.findIndex((track) => track.id === currentTrack.id) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < queue.length - 1;
  const preloadedNextTrack =
    hasNext ? queue[currentIndex + 1] : playbackMode === "repeatQueue" && queue.length > 0 ? queue[0] : null;
  const effectiveDuration = duration || currentTrack?.duration_seconds || 0;
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;
  const smtcPositionSecond = Math.floor(currentTime);
  const trackSwitchFadeMs = Math.min(fadeMs, 160);
  const outputVolume = muted ? 0 : volume;

  useEffect(() => {
    return () => {
      cancelFade();
      cancelCrossfade();
      miniPlayerChannelRef.current?.close();
    };
  }, []);

  useEffect(() => {
    writeStoredAudioControls(volume, muted);
    if (fadeTimerRef.current === null && crossfadeTimerRef.current === null) {
      if (audioRef.current) {
        audioRef.current.volume = outputVolume;
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.volume = 0;
      }
    }
  }, [volume, muted, outputVolume]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }
    const channel = new BroadcastChannel(miniPlayerChannelName);
    miniPlayerChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type !== "command") {
        return;
      }
      miniPlayerCommandRef.current(event.data.command as MiniPlayerCommand);
    };
    return () => {
      if (miniPlayerChannelRef.current === channel) {
        miniPlayerChannelRef.current = null;
      }
      channel.close();
    };
  }, []);

  useEffect(() => {
    const audio = nextAudioRef.current;
    if (audio) {
      audio.load();
    }
  }, [preloadedNextTrack?.id]);

  function cancelFade() {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }

  function cancelCrossfade() {
    if (crossfadeTimerRef.current !== null) {
      window.clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
  }

  function fadeVolume(targetVolume: number, durationMs: number, afterFade?: () => void) {
    const audio = audioRef.current;
    if (!audio) {
      afterFade?.();
      return;
    }
    cancelFade();
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));
    const startVolume = audio.volume;
    if (durationMs <= 0) {
      audio.volume = clampedTarget;
      afterFade?.();
      return;
    }
    const startedAt = window.performance.now();
    fadeTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = startVolume + (clampedTarget - startVolume) * progress;
      if (progress >= 1) {
        cancelFade();
        afterFade?.();
      }
    }, 16);
  }

  async function startCrossfade(nextTrack: Track) {
    const currentAudio = audioRef.current;
    const nextAudio = nextAudioRef.current;
    if (!currentTrack || !currentAudio || !nextAudio || currentAudio.paused || crossfadeTrackRef.current === currentTrack.id) {
      return;
    }

    crossfadeTrackRef.current = currentTrack.id;
    cancelFade();
    cancelCrossfade();

    try {
      nextAudio.currentTime = 0;
      nextAudio.volume = 0;
      await nextAudio.play();
    } catch {
      crossfadeTrackRef.current = null;
      return;
    }

    const durationMs = Math.max(120, fadeMs);
    const startedAt = window.performance.now();
    crossfadeTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      currentAudio.volume = Math.max(0, outputVolume * (1 - progress));
      nextAudio.volume = Math.min(outputVolume, outputVolume * progress);

      if (progress >= 1) {
        cancelCrossfade();
        handoffRef.current = { trackId: nextTrack.id, currentTime: nextAudio.currentTime };
        currentAudio.pause();
        currentAudio.volume = outputVolume;
        void onTrackEnded(currentTrack.id);
        onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
      }
    }, 16);
  }

  async function playWithFade() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    cancelFade();
    audio.volume = 0;
    try {
      await audio.play();
      setIsPlaying(true);
      fadeVolume(outputVolume, fadeMs);
    } catch (error: unknown) {
      audio.volume = outputVolume;
      if (audio.error) {
        setStatus("Audio source failed to load. Restart the app if the backend was updated recently.");
        return;
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setStatus("Press play to start playback.");
        return;
      }
      setStatus("Playback could not start for this file.");
    }
  }

  function pauseWithFade() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    fadeVolume(0, fadeMs, () => {
      audio.pause();
      audio.volume = outputVolume;
      setIsPlaying(false);
    });
  }

  useEffect(() => {
    cancelFade();
    setCurrentTime(0);
    onPlaybackTime(0);
    setDuration(currentTrack?.duration_seconds ?? 0);
    setArtworkFailed(false);
    setIsPlaying(false);
    endFadeTrackRef.current = null;
    crossfadeTrackRef.current = null;

    if (!currentTrack) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const handoff = handoffRef.current;
    if (handoff?.trackId === currentTrack.id) {
      handoffRef.current = null;
      audio.currentTime = handoff.currentTime;
      audio.volume = outputVolume;
      void audio.play().then(() => setIsPlaying(true)).catch(() => {
        setStatus("Playback could not continue after crossfade.");
      });
      return;
    }
    if (autoPlay) {
      void playWithFade();
    }
  }, [currentTrack?.id, autoPlay]);

  function syncDuration() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    setDuration(Number.isFinite(audio.duration) ? audio.duration : currentTrack?.duration_seconds ?? 0);
  }

  function handleSeek(event: ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    seekTo(nextTime);
  }

  function seekTo(nextTime: number) {
    const audio = audioRef.current;
    const boundedTime =
      effectiveDuration > 0 ? Math.min(Math.max(0, nextTime), effectiveDuration) : Math.max(0, nextTime);
    setCurrentTime(boundedTime);
    onPlaybackTime(boundedTime);
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = boundedTime;
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }
    if (audio.paused) {
      await playWithFade();
    } else {
      pauseWithFade();
    }
  }

  function changeVolume(nextVolume: number) {
    const bounded = clampNumber(nextVolume, 0, 1);
    setVolume(bounded);
    if (bounded > 0) {
      setMuted(false);
    }
  }

  function handleVolumeChange(event: ChangeEvent<HTMLInputElement>) {
    changeVolume(Number(event.target.value));
  }

  function toggleMuted() {
    setMuted((current) => !current);
  }

  function playRelative(offset: number, recordExit = true) {
    const nextTrack = queue[currentIndex + offset];
    if (nextTrack) {
      const audio = audioRef.current;
      if (recordExit) {
        void recordCurrentTrackExit();
      }
      cancelCrossfade();
      crossfadeTrackRef.current = null;
      nextAudioRef.current?.pause();
      if (audio && !audio.paused) {
        fadeVolume(0, trackSwitchFadeMs, () => {
          audio.pause();
          try {
            audio.currentTime = 0;
          } catch {
            // Some codecs do not permit seeking during teardown.
          }
          onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
        });
      } else {
        cancelFade();
        onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
      }
    }
  }

  async function skipCurrent() {
    if (!currentTrack) {
      return;
    }
    await recordCurrentTrackExit();
    if (hasNext) {
      playRelative(1, false);
    } else {
      const audio = audioRef.current;
      audio?.pause();
      setIsPlaying(false);
    }
  }

  async function recordCurrentTrackExit() {
    if (!currentTrack) {
      return;
    }
    if (shouldRecordTrackAsPlayed(currentTime, effectiveDuration, skipThresholdPercent)) {
      await onTrackEnded(currentTrack.id);
    } else {
      await onTrackSkipped(currentTrack.id);
    }
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const nextTime = audio.currentTime;
    setCurrentTime(nextTime);
    onPlaybackTime(nextTime);
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : effectiveDuration;
    const crossfadeLeadSeconds = Math.max(0.12, fadeMs / 1000);
    if (
      currentTrack &&
      preloadedNextTrack &&
      playbackMode !== "stopAfterCurrent" &&
      playbackMode !== "repeatOne" &&
      fadeMs > 0 &&
      audioDuration > crossfadeLeadSeconds * 2 &&
      audioDuration - nextTime <= crossfadeLeadSeconds &&
      crossfadeTrackRef.current !== currentTrack.id
    ) {
      void startCrossfade(preloadedNextTrack);
      return;
    }
    if (
      currentTrack &&
      (!preloadedNextTrack || playbackMode === "stopAfterCurrent") &&
      audioDuration > END_FADE_SECONDS * 2 &&
      audioDuration - nextTime <= END_FADE_SECONDS &&
      endFadeTrackRef.current !== currentTrack.id
    ) {
      endFadeTrackRef.current = currentTrack.id;
      const fadeGuardMs = 100;

      const remainingMs = Math.max(0, (audioDuration - nextTime) * 1000);
      const fadeDuration = Math.min(fadeMs, Math.max(0, remainingMs - fadeGuardMs));

      fadeVolume(0, fadeDuration);
    }
  }

  async function handleEnded() {
    if (!currentTrack) {
      return;
    }
    if (crossfadeTrackRef.current === currentTrack.id) {
      return;
    }
    await onTrackEnded(currentTrack.id);
    if (playbackMode === "stopAfterCurrent") {
      setIsPlaying(false);
      setStatus("Stopped after current track");
      return;
    }
    if (playbackMode === "repeatOne") {
      seekTo(0);
      void playWithFade();
      return;
    }
    if (hasNext) {
      onSelectTrack(queue[currentIndex + 1], queue, { suppressExitRecord: true });
    } else if (playbackMode === "repeatQueue" && queue.length > 0) {
      onSelectTrack(queue[0], queue, { suppressExitRecord: true });
    } else {
      setStatus("Queue finished");
    }
  }

  const artworkSrc = currentTrack && !artworkFailed ? albumArtworkUrl(currentTrack.id) : null;

  miniPlayerCommandRef.current = (command: MiniPlayerCommand) => {
    if (command.type === "playPause") {
      void togglePlayback();
    } else if (command.type === "previous") {
      playRelative(-1);
    } else if (command.type === "next") {
      playRelative(1);
    } else if (command.type === "seek") {
      seekTo(command.seconds);
    }
  };

  smtcActionRef.current = (payload: SmtcButtonPayload) => {
    if (payload.command === "play") {
      if (currentTrack && audioRef.current?.paused) {
        void playWithFade();
      }
      return;
    }
    if (payload.command === "pause") {
      if (currentTrack && !audioRef.current?.paused) {
        pauseWithFade();
      }
      return;
    }
    if (payload.command === "stop") {
      pauseWithFade();
      seekTo(0);
      return;
    }
    if (payload.command === "next") {
      if (hasNext) {
        playRelative(1);
      }
      return;
    }
    if (payload.command === "previous") {
      if (currentTime > 4) {
        seekTo(0);
      } else if (hasPrevious) {
        playRelative(-1);
      }
      return;
    }
    if (payload.command === "seek" && typeof payload.position_seconds === "number") {
      seekTo(payload.position_seconds);
    }
  };

  useEffect(() => {
    function handleLocalAudioKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (event.key === "MediaPlayPause" || event.code === "Space" || event.key.toLowerCase() === "k") {
        if (event.repeat || !currentTrack) {
          return;
        }
        event.preventDefault();
        void togglePlayback();
        return;
      }

      if (event.key === "MediaTrackNext") {
        event.preventDefault();
        playRelative(1);
        return;
      }

      if (event.key === "MediaTrackPrevious") {
        event.preventDefault();
        if (currentTime > 4) {
          seekTo(0);
        } else {
          playRelative(-1);
        }
        return;
      }

      if (!event.altKey) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + 5);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - 5);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        changeVolume(volume + 0.05);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        changeVolume(volume - 0.05);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMuted();
      }
    }

    window.addEventListener("keydown", handleLocalAudioKeyDown);
    return () => window.removeEventListener("keydown", handleLocalAudioKeyDown);
  }, [currentTrack, currentTime, volume, muted, hasPrevious, hasNext, queue, currentIndex, outputVolume]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listenForSmtcButtons((payload) => smtcActionRef.current(payload)).then((cleanup) => {
      unlisten = cleanup;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void updateSmtcState({
      track: currentTrack,
      isPlaying,
      positionSeconds: smtcPositionSecond,
      durationSeconds: effectiveDuration,
      canPrevious: hasPrevious,
      canNext: hasNext,
    }).catch(() => {
      // SMTC is best-effort; playback should never depend on Windows media UI.
    });
  }, [currentTrack, isPlaying, smtcPositionSecond, effectiveDuration, hasPrevious, hasNext]);

  useEffect(() => {
    publishMiniPlayerSnapshot(miniPlayerChannelRef.current, {
      track: currentTrack ? miniPlayerTrackSnapshot(currentTrack) : null,
      isPlaying,
      currentTime,
      duration: effectiveDuration,
      hasPrevious,
      hasNext,
      updatedAt: new Date().toISOString(),
    });
  }, [currentTrack, isPlaying, smtcPositionSecond, effectiveDuration, hasPrevious, hasNext]);

  useEffect(() => {
    return () => {
      void clearSmtcState();
    };
  }, []);

  return (
    <section
      className={`grid shrink-0 items-center border-t border-line bg-[rgb(var(--color-sidebar))] px-4 ${
        miniPlayer
          ? "h-20 grid-cols-[minmax(180px,280px)_1fr_minmax(120px,150px)] gap-3"
          : "h-28 grid-cols-[minmax(240px,360px)_1fr_minmax(150px,210px)] gap-5"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded border border-line bg-panel text-moss shadow-inner">
          {artworkSrc ? (
            <img
              key={artworkSrc}
              alt=""
              className="h-full w-full object-cover"
              src={artworkSrc}
              onError={() => setArtworkFailed(true)}
            />
          ) : (
            <Volume2 size={22} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing"}
          </div>
          <div className="truncate text-xs text-muted">
            {currentTrack
              ? `${display(currentTrack.artist)} - ${display(currentTrack.album, "Unknown album")}`
              : "Select a track from Library or AutoDJ"}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-center gap-3">
          <button
            className="icon-button"
            type="button"
            title="Previous track"
            disabled={!hasPrevious}
            onClick={() => playRelative(-1)}
          >
            <SkipBack size={17} />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-ember text-ink shadow-sm shadow-black/25 transition hover:bg-[rgb(var(--color-primary-hover))] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            title={isPlaying ? "Pause" : "Play"}
            disabled={!currentTrack}
            onClick={togglePlayback}
          >
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </button>
          <button
            className="icon-button"
            type="button"
            title="Next track"
            disabled={!hasNext}
            onClick={() => playRelative(1)}
          >
            <SkipForward size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Skip and learn"
            disabled={!currentTrack}
            onClick={() => void skipCurrent()}
          >
            <CheckCircle2 size={17} />
          </button>
        </div>

        {currentTrack ? (
          <audio
            key={currentTrack.id}
            ref={audioRef}
            className="hidden"
            preload="auto"
            src={audioUrl(currentTrack.id)}
            onLoadedMetadata={syncDuration}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onCanPlay={() => {
              syncDuration();
            }}
            onEnded={handleEnded}
            onError={() => {
              const code = audioRef.current?.error?.code;
              const message =
                code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                  ? "This file or stream could not be played by the current WebView codec stack."
                  : "Audio source failed to load. The backend may need a restart, or the file may be missing.";
              setStatus(message);
            }}
          />
        ) : (
          <audio ref={audioRef} className="hidden" />
        )}
        {preloadedNextTrack && (
          <audio
            key={`next-${preloadedNextTrack.id}`}
            ref={nextAudioRef}
            className="hidden"
            preload="auto"
            src={audioUrl(preloadedNextTrack.id)}
          />
        )}

        <div className="grid grid-cols-[42px_1fr_42px] items-center gap-3 text-xs tabular-nums text-muted">
          <span className="text-right">{formatPlaybackTime(currentTime)}</span>
          <input
            aria-label="Playback position"
            className="player-progress"
            disabled={!currentTrack || effectiveDuration <= 0}
            max={Math.max(effectiveDuration, 0)}
            min={0}
            step={1}
            style={{ "--progress": `${progressPercent}%` } as CSSProperties}
            type="range"
            value={effectiveDuration > 0 ? Math.min(currentTime, effectiveDuration) : 0}
            onChange={handleSeek}
          />
          <span>{formatPlaybackTime(effectiveDuration)}</span>
        </div>
      </div>

      <div className="min-w-0 text-right text-xs text-muted">
        {currentTrack && !miniPlayer && (
          <>
            <div className="truncate">{display(trackGenre(currentTrack), "")}</div>
            <div className="mt-1 truncate text-neutral-400">{display(currentTrack.year, "")}</div>
          </>
        )}
        <div className="mt-2 flex items-center justify-end gap-2">
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
            className="h-2 w-24 accent-moss"
            max={1}
            min={0}
            step={0.01}
            type="range"
            value={volume}
            onChange={handleVolumeChange}
          />
        </div>
        {currentTrack && !miniPlayer && (
          <div className="mt-2 flex justify-end">
            <RatingStars rating={currentTrack.rating} onChange={(rating) => onRating(currentTrack.id, rating)} />
          </div>
        )}
        <div className="mt-2 flex justify-end gap-1">
          <button
            className="icon-button h-7 w-7"
            type="button"
            title="Open detached mini player"
            onClick={() => void onOpenMiniPlayer()}
          >
            <ExternalLink size={13} />
          </button>
          <button
            className={`icon-button h-7 w-7 ${
              playbackMode === "repeatQueue" || playbackMode === "repeatOne" ? "border-moss text-moss" : ""
            }`}
            type="button"
            title={playbackMode === "repeatOne" ? "Repeat one" : "Repeat queue"}
            onClick={() =>
              setPlaybackMode(
                playbackMode === "normal"
                  ? "repeatQueue"
                  : playbackMode === "repeatQueue"
                    ? "repeatOne"
                    : "normal",
              )
            }
          >
            <Repeat size={13} />
          </button>
          <button
            className={`icon-button h-7 w-7 ${playbackMode === "stopAfterCurrent" ? "border-ember text-ember" : ""}`}
            type="button"
            title="Stop after current"
            onClick={() => setPlaybackMode(playbackMode === "stopAfterCurrent" ? "normal" : "stopAfterCurrent")}
          >
            <CircleStop size={13} />
          </button>
        </div>
      </div>
    </section>
  );
}
