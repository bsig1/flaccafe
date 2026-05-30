import { FileText, ListMusic, Pause, Play, Radio, Repeat, Repeat1, Repeat2, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, WheelEvent as ReactWheelEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { albumArtworkUrl } from "../../lib/api";
import {
  desktopPrepareNextSource,
  desktopSeek,
  desktopStatus,
  desktopStop,
} from "../../lib/desktopPlayback";
import type { DesktopPlaybackSource, desktopDspSettings } from "../../lib/desktopPlayback";
import type { SmtcButtonPayload } from "../../lib/tauriMedia";
import { clearSmtcState, listenForSmtcButtons, updateSmtcState } from "../../lib/tauriMedia";
import type { RadioStation, Track } from "../../types/api";
import type { PlayerBarProps } from "./PlayerBarTypes";
import { PlayerBarView } from "./PlayerBarView";
import { createPlaybackTransitions } from "./playbackTransitions";
import { playbackEndedEarly } from "./playbackEarlyEnd";
import { usePlayerBarAudioEffects } from "./usePlayerBarAudioEffects";
import { usePlayerBarMediaEffects } from "./usePlayerBarMediaEffects";
import { RatingStars } from "../components/common";
import {
  MiniPlayerCommand,
  VISUALIZER_FRAME_EVENT,
  VisualizerFrame,
  clampNumber,
  display,
  displayAlbumForTrack,
  miniPlayerChannelName,
  miniPlayerTrackSnapshot,
  normalizeEqualizerGains,
  publishMiniPlayerSnapshot,
  readStoredMuted,
  readStoredVolume,
  replayGainMultiplier,
  shouldRecordTrackAsPlayed,
  shortcutMatchesEvent,
  writeStoredAudioControls,
} from "../shared";

const CD_SKIP_SETTLE_SECONDS = 1.15;
const INTENTIONAL_PLAYBACK_STOP_SUPPRESS_MS = 2500;
const PLAYBACK_SEEK_END_GUARD_SECONDS = 0.25;
const PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS = 5;

export function PlayerBar({
  currentTrack,
  currentRadioStation,
  radioPlaybackRequestId,
  queue,
  externalTrackRequest,
  onSelectTrack,
  onCommitExternalTrackRequest,
  onTrackEnded,
  onTrackSkipped,
  onPlaybackTime,
  resumePositionSeconds,
  onResumePositionApplied,
  onRating,
  autoPlay,
  fadeMs,
  skipThresholdPercent,
  desktopOutputDeviceId,
  desktopBufferFrames,
  miniPlayer,
  replayGainMode,
  replayGainTargetVolumePercent,
  replayGainPreampDb,
  replayGainPreventClipping,
  equalizerEnabled,
  equalizerBandMode,
  equalizerPreampDb,
  equalizerGains,
  dspLimiterEnabled,
  keyboardShortcuts,
  playbackMode,
  setPlaybackMode,
  onOpenMiniPlayer,
  onOpenLyricsView,
  onOpenQueueView,
  onOpenCurrentTrack,
  onOpenCurrentArtist,
  onOpenCurrentArtistInfo,
  onOpenCurrentAlbum,
  setStatus,
}: PlayerBarProps) {
  const desktopFadeTimerRef = useRef<number | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);
  const visualizerLastEmitRef = useRef(0);
  const crossfadeTrackRef = useRef<number | null>(null);
  const pendingResumePositionRef = useRef<number | null>(null);
  const desktopLoadedTrackIdRef = useRef<number | null>(null);
  const desktopEndedTrackIdRef = useRef<number | null>(null);
  const desktopEarlyEndSuppressUntilRef = useRef(0);
  const lastPlaybackStreamErrorRef = useRef<string | null>(null);
  const handledExternalTrackRequestRef = useRef<number | null>(null);
  const preparedNextPathRef = useRef<string | null>(null);
  const prepareNextInFlightRef = useRef(false);
  const prepareNextPendingPathRef = useRef<string | null>(null);
  const activeSourceKeyRef = useRef("empty");
  const smtcActionRef = useRef<(payload: SmtcButtonPayload) => void>(() => {});
  const miniPlayerChannelRef = useRef<BroadcastChannel | null>(null);
  const miniPlayerCommandRef = useRef<(command: MiniPlayerCommand) => void>(() => {});
  const artworkPreviewTimerRef = useRef<number | null>(null);
  const artworkCacheRef = useRef<Set<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(readStoredVolume);
  const [volumePercentDraft, setVolumePercentDraft] = useState<string | null>(null);
  const [muted, setMuted] = useState(readStoredMuted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [displayedArtworkSrc, setDisplayedArtworkSrc] = useState<string | null>(null);
  const [showArtworkPreview, setShowArtworkPreview] = useState(false);
  const isRadioSource = Boolean(currentRadioStation);
  const isPreviewTrack = Boolean(currentTrack?.is_preview) || (currentTrack?.id ?? 0) < 0;
  const isCdPreviewTrack = Boolean(currentTrack?.path?.startsWith("cdda://"));
  const isLibraryTrack = Boolean(currentTrack && currentTrack.id > 0 && !currentTrack.is_preview);
  const hasPlayableSource = Boolean(currentTrack || currentRadioStation);
  const activeSourceKey = currentRadioStation ? `radio:${currentRadioStation.id}` : currentTrack ? `track:${currentTrack.id}` : "empty";
  const currentIndex = currentTrack && !isRadioSource ? queue.findIndex((track) => track.id === currentTrack.id) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < queue.length - 1;
  const canPreviousAction = hasPrevious || Boolean(currentTrack && !isRadioSource);
  const cdSkipIsSettling = isCdPreviewTrack && isPlaying && currentTime < CD_SKIP_SETTLE_SECONDS;
  const preloadedNextTrack =
    !isRadioSource && hasNext
      ? queue[currentIndex + 1]
      : !isRadioSource && playbackMode === "repeatQueue" && queue.length > 0
        ? queue[0]
        : null;
  const canPreloadNextTrack = Boolean(preloadedNextTrack);
  const effectiveDuration = isRadioSource ? 0 : duration || currentTrack?.duration_seconds || 0;
  const progressRatio = effectiveDuration > 0 ? clampNumber(currentTime / effectiveDuration, 0, 1) : 0;
  const progressPercent = progressRatio * 100;
  const progressFill = progressRatio > 0 ? `calc(${progressPercent}% + ${7 - progressRatio * 14}px)` : "0px";
  const smtcPositionSecond = Math.floor(currentTime);
  const trackSwitchFadeMs = Math.max(0, fadeMs);
  function replayGainForTrack(track: Track | null) {
    return replayGainMultiplier(
      track,
      replayGainMode,
      replayGainPreampDb,
      replayGainPreventClipping,
      replayGainTargetVolumePercent,
    );
  }

  const replayGain = replayGainForTrack(currentTrack);
  const outputVolume = muted ? 0 : clampNumber(volume, 0, 1);
  const radioSubtitle = currentRadioStation ? display(currentRadioStation.genre, "Live web radio") : null;
  const visualizerTrackId = currentTrack?.id ?? (currentRadioStation ? -currentRadioStation.id : null);
  activeSourceKeyRef.current = activeSourceKey;

  function playbackSourceForTrack(track: Track): DesktopPlaybackSource {
    if (track.path.startsWith("cdda://")) {
      const [driveId = "", trackText = "1"] = track.path.slice("cdda://".length).split("/track/");
      const trackNumber = Number.parseInt(trackText, 10);
      return {
        kind: "cd_track",
        drive_id: driveId,
        track_number: Number.isFinite(trackNumber) && trackNumber > 0 ? trackNumber : track.track_number ?? 1,
        title: track.title ?? null,
      };
    }
    if (track.audio_url) {
      return {
        kind: "url",
        url: track.audio_url,
        cache_key: `track-${track.id}`,
        title: track.title ?? null,
        live: false,
      };
    }
    return { kind: "file", path: track.path };
  }

  function playbackSourceForRadio(station: RadioStation): DesktopPlaybackSource {
    return {
      kind: "url",
      url: station.stream_url,
      cache_key: `radio-${station.id}`,
      title: station.name ?? null,
      live: true,
    };
  }

  function playbackSourceIdentity(source: DesktopPlaybackSource): string {
    if (source.kind === "file") {
      return source.path;
    }
    if (source.kind === "url") {
      return source.url;
    }
    return `cdda://${source.drive_id}/track/${String(source.track_number).padStart(2, "0")}`;
  }

  function desktopDspSettingsForTrack(track: Track | null): desktopDspSettings {
    return {
      normalizationGain: replayGainForTrack(track),
      equalizerEnabled,
      equalizerBandMode,
      equalizerPreampDb,
      equalizerGains: normalizeEqualizerGains(equalizerGains, equalizerBandMode),
      limiterEnabled: dspLimiterEnabled,
    };
  }

  function currentPlaybackDspSettings(): desktopDspSettings {
    return desktopDspSettingsForTrack(currentTrack);
  }

  function emitVisualizerFrame(frame: VisualizerFrame) {
    window.dispatchEvent(new CustomEvent<VisualizerFrame>(VISUALIZER_FRAME_EVENT, { detail: frame }));
  }

  function emitVisualizerState(isLive = false) {
    emitVisualizerFrame({
      trackId: visualizerTrackId,
      isPlaying,
      isLive,
      level: 0,
      frequencyBins: [],
      waveform: [],
      timestamp: window.performance.now(),
    });
  }

  function cancelVisualizerLoop() {
    if (visualizerFrameRef.current !== null) {
      window.cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = null;
    }
  }

  function cancelPlaybackFade() {
    if (desktopFadeTimerRef.current !== null) {
      window.clearTimeout(desktopFadeTimerRef.current);
      desktopFadeTimerRef.current = null;
    }
  }

  function cancelCrossfade() {
    crossfadeTrackRef.current = null;
  }

  function suppressDesktopEarlyEndWarning(durationMs = INTENTIONAL_PLAYBACK_STOP_SUPPRESS_MS) {
    desktopEarlyEndSuppressUntilRef.current = Math.max(
      desktopEarlyEndSuppressUntilRef.current,
      window.performance.now() + durationMs,
    );
  }

  const playbackTransitions = createPlaybackTransitions({
    crossfadeTrackRef, pendingResumePositionRef, desktopLoadedTrackIdRef, desktopEndedTrackIdRef, lastPlaybackStreamErrorRef, artworkPreviewTimerRef, desktopFadeTimerRef,
    currentTrack, currentRadioStation, currentTime, isPlaying, isCdPreviewTrack, outputVolume, fadeMs, desktopOutputDeviceId, desktopBufferFrames, queue, getArtworkSrc: () => artworkSrc, setShowArtworkPreview, setDuration, setCurrentTime, setIsPlaying, setStatus, onPlaybackTime, onTrackEnded, onSelectTrack, playbackSourceForTrack, playbackSourceForRadio, cancelPlaybackFade, cancelCrossfade, suppressDesktopEarlyEndWarning, currentPlaybackDspSettings, desktopDspSettingsForTrack,
  });
  const {
    clearArtworkPreviewTimer, scheduleArtworkPreview, hideArtworkPreview, cdStreamIsSettling, fadePlaybackVolume, startPlaybackTrack, startPlaybackCrossfade, playWithFade, pauseWithFade,
  } = playbackTransitions;

  usePlayerBarAudioEffects({
    cancelPlaybackFade, cancelCrossfade, clearArtworkPreviewTimer, cancelVisualizerLoop, miniPlayerChannelRef, volume, muted, desktopFadeTimerRef, outputVolume, desktopLoadedTrackIdRef, desktopEndedTrackIdRef, miniPlayerCommandRef, equalizerEnabled, equalizerBandMode, equalizerPreampDb, equalizerGains, dspLimiterEnabled, replayGain, currentPlaybackDspSettings, emitVisualizerState, isPlaying, visualizerTrackId, visualizerLastEmitRef, emitVisualizerFrame, visualizerFrameRef,
  });

  useEffect(() => {
    if (!externalTrackRequest || handledExternalTrackRequestRef.current === externalTrackRequest.id) {
      return;
    }

    handledExternalTrackRequestRef.current = externalTrackRequest.id;
    const commitTrackRequest = (options?: { suppressExitRecord?: boolean }) =>
      onCommitExternalTrackRequest(externalTrackRequest, options);

    cancelCrossfade();
    crossfadeTrackRef.current = null;

    if (!hasPlayableSource || !isPlaying || trackSwitchFadeMs <= 0) {
      if (hasPlayableSource) {
        suppressDesktopEarlyEndWarning();
        void desktopStop().finally(commitTrackRequest);
        return;
      }
      commitTrackRequest();
      return;
    }

    if (isPlaying && trackSwitchFadeMs > 0) {
      void recordCurrentTrackExit();
      void startPlaybackCrossfade(externalTrackRequest.track, false, externalTrackRequest.queue, false).then((started) => {
        if (started) {
          commitTrackRequest({ suppressExitRecord: true });
          return;
        }
        fadePlaybackVolume(0, trackSwitchFadeMs, () => {
          suppressDesktopEarlyEndWarning();
          void desktopStop().finally(() => commitTrackRequest({ suppressExitRecord: true }));
        });
      });
      return;
    }
    fadePlaybackVolume(0, trackSwitchFadeMs, () => {
      suppressDesktopEarlyEndWarning();
      void desktopStop().finally(commitTrackRequest);
    });
  }, [externalTrackRequest?.id]);

  useEffect(() => {
    cancelPlaybackFade();
    setCurrentTime(0);
    onPlaybackTime(0);
    setDuration(isRadioSource ? 0 : currentTrack?.duration_seconds ?? 0);
    setArtworkFailed(false);
    setIsPlaying(false);
    crossfadeTrackRef.current = null;
    desktopEndedTrackIdRef.current = null;
    pendingResumePositionRef.current = null;

    if (!hasPlayableSource) {
      desktopLoadedTrackIdRef.current = null;
      void desktopStop().catch(() => {
        // Rust playback may not be available in browser preview.
      });
      return;
    }
    if (isRadioSource) {
      if (autoPlay) {
        void playWithFade();
      }
      return;
    }
    if (!currentTrack) {
      return;
    }
    if (autoPlay) {
      if (desktopLoadedTrackIdRef.current === currentTrack.id) {
        setIsPlaying(true);
        return;
      }
      void startPlaybackTrack(currentTrack);
    }
  }, [activeSourceKey, radioPlaybackRequestId, autoPlay, hasPlayableSource]);

  useEffect(() => {
    if (!currentTrack) {
      if (resumePositionSeconds !== null) {
        onResumePositionApplied();
      }
      return;
    }
    if (resumePositionSeconds === null) {
      return;
    }

    const boundedTime =
      effectiveDuration > 0
        ? Math.min(Math.max(0, resumePositionSeconds), Math.max(0, effectiveDuration - 1))
        : Math.max(0, resumePositionSeconds);
    if (!Number.isFinite(boundedTime) || boundedTime <= 0) {
      onResumePositionApplied();
      return;
    }

    setCurrentTime(boundedTime);
    onPlaybackTime(boundedTime);
    pendingResumePositionRef.current = boundedTime;

    if (desktopLoadedTrackIdRef.current === currentTrack.id) {
      void desktopSeek(boundedTime).catch(() => {
        // A restored position can still be used when playback starts.
      });
      pendingResumePositionRef.current = null;
    }

    onResumePositionApplied();
  }, [currentTrack?.id, resumePositionSeconds]);

  function handleSeek(event: ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    seekTo(nextTime);
  }

  function handleProgressKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(currentTime + (event.key === "ArrowRight" ? PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS : -PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS));
      return;
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      if (hasPlayableSource) {
        void togglePlayback();
      }
    }
  }

  function clampSeekTime(nextTime: number) {
    const finiteTime = Number.isFinite(nextTime) ? nextTime : 0;
    if (effectiveDuration <= 0) {
      return Math.max(0, finiteTime);
    }
    const endGuard = Math.min(PLAYBACK_SEEK_END_GUARD_SECONDS, effectiveDuration / 2);
    const maxSeekTime = Math.max(0, effectiveDuration - endGuard);
    return Math.min(Math.max(0, finiteTime), maxSeekTime);
  }

  function seekTo(nextTime: number) {
    if (isRadioSource) {
      return;
    }
    const boundedTime = clampSeekTime(nextTime);
    setCurrentTime(boundedTime);
    onPlaybackTime(boundedTime);
    pendingResumePositionRef.current = null;
    const restartEndedTrack = currentTrack && desktopEndedTrackIdRef.current === currentTrack.id;
    desktopEndedTrackIdRef.current = null;
    if (restartEndedTrack) {
      void startPlaybackTrack(currentTrack, boundedTime);
      return;
    }
    void desktopSeek(boundedTime).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Rust seek failed.");
    });
  }

  async function togglePlayback() {
    if (!hasPlayableSource) {
      return;
    }
    if (isPlaying) {
      pauseWithFade();
    } else {
      await playWithFade();
    }
  }

  function handlePreviousTrack() {
    if (cdSkipIsSettling || !canPreviousAction) {
      return;
    }
    if (currentTrack && desktopEndedTrackIdRef.current === currentTrack.id) {
      seekTo(0);
      return;
    }
    if (currentTime > 4 || !hasPrevious) {
      seekTo(0);
      return;
    }
    playRelative(-1);
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

  function commitVolumePercent(rawValue: string) {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return;
    }
    const percent = Number(trimmed);
    if (!Number.isFinite(percent)) {
      return;
    }
    changeVolume(clampNumber(percent, 0, 100) / 100);
  }

  function handleVolumePercentChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value.replace(/[^\d.]/g, "");
    setVolumePercentDraft(nextValue);
    if (nextValue.trim()) {
      commitVolumePercent(nextValue);
    }
  }

  function handleVolumePercentKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setVolumePercentDraft(null);
      event.currentTarget.blur();
    }
  }

  function handleVolumeWheel(event: ReactWheelEvent) {
    event.preventDefault();
    changeVolume(volume + (event.deltaY < 0 ? 0.05 : -0.05));
  }

  function toggleMuted() {
    setMuted((current) => !current);
  }

  function cycleRepeatMode() {
    setPlaybackMode(
      playbackMode === "normal"
        ? "repeatQueue"
        : playbackMode === "repeatQueue"
          ? "repeatOne"
          : "normal",
    );
  }

  function toggleStopAfterCurrent() {
    setPlaybackMode(playbackMode === "stopAfterCurrent" ? "normal" : "stopAfterCurrent");
  }

  function playRelative(offset: number, recordExit = true) {
    const nextTrack = queue[currentIndex + offset];
    if (nextTrack) {
      if (cdStreamIsSettling()) {
        return;
      }
      if (recordExit) {
        void recordCurrentTrackExit();
      }
      cancelCrossfade();
      crossfadeTrackRef.current = null;
      if (isPlaying && fadeMs > 0) {
        void startPlaybackCrossfade(nextTrack, false);
        return;
      }
      fadePlaybackVolume(0, trackSwitchFadeMs, () => {
        suppressDesktopEarlyEndWarning();
        void desktopStop().finally(() => {
          onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
        });
      });
    }
  }

  function recordCurrentTrackExit() {
    if (!currentTrack) {
      return;
    }
    if (currentTrack.id <= 0 || currentTrack.is_preview) {
      return;
    }
    if (shouldRecordTrackAsPlayed(currentTime, effectiveDuration, skipThresholdPercent)) {
      void onTrackEnded(currentTrack.id);
    } else {
      void onTrackSkipped(currentTrack.id);
    }
  }

  async function handleEnded() {
    if (!currentTrack) {
      return;
    }
    if (crossfadeTrackRef.current === currentTrack.id) {
      return;
    }
    const endedAt = currentTime;
    if (isCdPreviewTrack && effectiveDuration > 15 && endedAt < effectiveDuration - 8) {
      setIsPlaying(false);
      setStatus("CD playback stopped early. Use the play button in the player bar to retry, or refresh the CD page if the disc changed.");
      return;
    }
    if (!isCdPreviewTrack && playbackEndedEarly(endedAt, effectiveDuration)) {
      setIsPlaying(false);
      setStatus("Track appears corrupted or truncated; playback stopped before the saved duration.");
      return;
    }
    void onTrackEnded(currentTrack.id);
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

  useEffect(() => {
    if (!hasPlayableSource) {
      return;
    }
    let canceled = false;
    let pollInFlight = false;
    const pollPlaybackStatus = async () => {
      if (pollInFlight) {
        return;
      }
      pollInFlight = true;
      try {
        const status = await desktopStatus();
        if (canceled) {
          return;
        }
        const waitingForPlaybackResume =
          pendingResumePositionRef.current !== null &&
          Boolean(currentTrack) &&
          desktopLoadedTrackIdRef.current !== currentTrack?.id &&
          !status.is_playing;
        if (!waitingForPlaybackResume) {
          setIsPlaying(status.is_playing);
          setCurrentTime(status.position_seconds);
          onPlaybackTime(status.position_seconds);
        }
        if (status.duration_seconds !== null) {
          setDuration(status.duration_seconds);
        }
        const latestStreamError = status.stream_errors.length
          ? status.stream_errors[status.stream_errors.length - 1]
          : null;
        if (latestStreamError && latestStreamError !== lastPlaybackStreamErrorRef.current) {
          lastPlaybackStreamErrorRef.current = latestStreamError;
          setStatus(latestStreamError);
        }
        const desktopDuration = status.duration_seconds ?? currentTrack?.duration_seconds ?? 0;
        const desktopCrossfadeLeadSeconds = Math.max(0.12, fadeMs / 1000);
        if (
          currentTrack &&
          preloadedNextTrack &&
          canPreloadNextTrack &&
          playbackMode !== "stopAfterCurrent" &&
          playbackMode !== "repeatOne" &&
          fadeMs > 0 &&
          status.is_playing &&
          desktopDuration > desktopCrossfadeLeadSeconds * 2 &&
          desktopDuration - status.position_seconds <= desktopCrossfadeLeadSeconds &&
          crossfadeTrackRef.current !== currentTrack.id
        ) {
          await startPlaybackCrossfade(preloadedNextTrack);
          return;
        }
        if (
          currentTrack &&
          status.ended &&
          !status.is_paused &&
          status.current_path === playbackSourceIdentity(playbackSourceForTrack(currentTrack)) &&
          desktopLoadedTrackIdRef.current === currentTrack.id &&
          desktopEndedTrackIdRef.current !== currentTrack.id
        ) {
          if (window.performance.now() < desktopEarlyEndSuppressUntilRef.current) {
            setIsPlaying(false);
            return;
          }
          desktopEndedTrackIdRef.current = currentTrack.id;
          await handleEnded();
        }
      } catch {
        // Rust playback status is unavailable in browser preview and before the desktop command is ready.
      } finally {
        pollInFlight = false;
      }
    };
    void pollPlaybackStatus();
    const timer = window.setInterval(() => {
      void pollPlaybackStatus();
    }, 120);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [hasPlayableSource, currentTrack?.id, playbackMode, currentIndex, queue, fadeMs, preloadedNextTrack?.id, canPreloadNextTrack, outputVolume]);

  useEffect(() => {
    if (!hasPlayableSource || !preloadedNextTrack || !canPreloadNextTrack || playbackMode === "stopAfterCurrent") {
      return;
    }
    const requestedSource = playbackSourceForTrack(preloadedNextTrack);
    const requestedPath = JSON.stringify(requestedSource);
    if (preparedNextPathRef.current === requestedPath) {
      return;
    }
    prepareNextPendingPathRef.current = requestedPath;
    if (prepareNextInFlightRef.current) {
      return;
    }
    const drainPrepareQueue = () => {
      const nextPath = prepareNextPendingPathRef.current;
      if (!nextPath || preparedNextPathRef.current === nextPath) {
        prepareNextPendingPathRef.current = null;
        return;
      }
      prepareNextPendingPathRef.current = null;
      prepareNextInFlightRef.current = true;
      const nextSource = playbackSourceForTrack(preloadedNextTrack);
      void desktopPrepareNextSource(nextSource)
        .then(() => {
          preparedNextPathRef.current = nextPath;
        })
        .catch(() => {
          // Preparation failures are recorded by the Rust playback diagnostics panel.
        })
        .finally(() => {
          prepareNextInFlightRef.current = false;
          if (prepareNextPendingPathRef.current) {
            drainPrepareQueue();
          }
        });
    };
    drainPrepareQueue();
  }, [hasPlayableSource, preloadedNextTrack?.id, preloadedNextTrack?.path, canPreloadNextTrack, playbackMode]);

  const artworkSrc =
    currentTrack && !isRadioSource && (!isPreviewTrack || isCdPreviewTrack) && !artworkFailed
      ? albumArtworkUrl(currentTrack.id, currentTrack.file_modified_at)
      : null;
  useEffect(() => {
    if (!artworkSrc) {
      setDisplayedArtworkSrc(null);
      return undefined;
    }
    if (artworkCacheRef.current.has(artworkSrc)) {
      setDisplayedArtworkSrc(artworkSrc);
      return undefined;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }
      artworkCacheRef.current.add(artworkSrc);
      setDisplayedArtworkSrc(artworkSrc);
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      setArtworkFailed(true);
      setDisplayedArtworkSrc(null);
    };
    image.src = artworkSrc;
    return () => {
      cancelled = true;
    };
  }, [artworkSrc]);
  const hasCurrentArtist = Boolean(currentTrack?.artist?.trim());
  const currentAlbumLabel = displayAlbumForTrack(currentTrack);
  const hasCurrentAlbum = Boolean(currentAlbumLabel);
  const isCurrentPodcast = Boolean(currentTrack?.genre?.toLowerCase().includes("podcast"));
  const currentArtistLabel = display(currentTrack?.artist, isCurrentPodcast ? "Podcast" : "Unknown artist");
  const playerTitle = currentRadioStation ? display(currentRadioStation.name, "Radio stream") : currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing";

  usePlayerBarMediaEffects({
    hideArtworkPreview, artworkSrc, miniPlayerCommandRef, togglePlayback, playRelative, seekTo, smtcActionRef, hasPlayableSource, isPlaying, playWithFade, pauseWithFade, hasNext, currentTime, hasPrevious, canPreviousAction, handlePreviousTrack, isRadioSource, keyboardShortcuts, changeVolume, volume, muted, toggleMuted, cycleRepeatMode, toggleStopAfterCurrent, setPlaybackMode, playbackMode, currentTrack, currentRadioStation, queue, currentIndex, outputVolume, effectiveDuration, smtcPositionSecond, miniPlayerChannelRef,
  });

  const playerBarViewModel = {
    miniPlayer, artworkSrc: displayedArtworkSrc, playerTitle, hideArtworkPreview, scheduleArtworkPreview, setArtworkFailed, isRadioSource, isPreviewTrack, isLibraryTrack, currentTrack, currentRadioStation, radioSubtitle, hasCurrentArtist, currentArtistLabel, onOpenCurrentArtist, onOpenCurrentArtistInfo, hasCurrentAlbum, currentAlbumLabel, onOpenCurrentAlbum, onOpenCurrentTrack, cdSkipIsSettling, hasPrevious, canPreviousAction, handlePreviousTrack, playRelative, isPlaying, hasPlayableSource, togglePlayback, hasNext, effectiveDuration, currentTime, progressPercent, progressFill, handleSeek, handleProgressKeyDown, playbackSeekStepSeconds: PLAYBACK_KEYBOARD_SEEK_STEP_SECONDS, playbackMode, cycleRepeatMode, onOpenLyricsView, onOpenQueueView, muted, volume, handleVolumeWheel, toggleMuted, handleVolumeChange, volumePercentDraft, commitVolumePercent, setVolumePercentDraft, handleVolumePercentChange, handleVolumePercentKeyDown, onRating, showArtworkPreview,
  };

  return <PlayerBarView model={playerBarViewModel} />;
}
