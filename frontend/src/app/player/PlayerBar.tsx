import { FileText, ListMusic, Pause, Play, Radio, Repeat, Repeat1, Repeat2, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, WheelEvent as ReactWheelEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { albumArtworkUrl, audioUrl } from "../../lib/api";
import {
  desktopCrossfadeToFile,
  desktopFadeVolume as desktopFadeVolumeCommand,
  desktopPause,
  desktopPlayFile,
  desktopPrepareNextFile,
  desktopResume,
  desktopSeek,
  desktopSetDsp,
  desktopSetVolume,
  desktopStatus,
  desktopStop,
  desktopVisualizerFrame,
} from "../../lib/desktopPlayback";
import type { desktopDspSettings } from "../../lib/desktopPlayback";
import type { SmtcButtonPayload } from "../../lib/tauriMedia";
import { clearSmtcState, listenForSmtcButtons, updateSmtcState } from "../../lib/tauriMedia";
import type { RadioStation, Track } from "../../types/api";
import type { PlayerBarProps } from "./PlayerBarTypes";
import { PlayerBarView } from "./PlayerBarView";
import { createWebAudioRuntime } from "./webAudioRuntime";
import { createPlaybackTransitions, webCrossfadeDurationMs } from "./playbackTransitions";
import { playbackEndedEarly } from "./playbackEarlyEnd";
import { usePlayerBarAudioEffects } from "./usePlayerBarAudioEffects";
import { usePlayerBarMediaEffects } from "./usePlayerBarMediaEffects";
import { RatingStars } from "../components/common";
import {
  END_FADE_SECONDS,
  EqualizerBandMode,
  KeyboardShortcutAction,
  KeyboardShortcut,
  MiniPlayerCommand,
  PlaybackEngine,
  PlaybackMode,
  VISUALIZER_FRAME_EVENT,
  VisualizerFrame,
  clampNumber,
  dbToGain,
  display,
  displayAlbumForTrack,
  equalizerFrequenciesForMode,
  formatPlaybackTime,
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
  playbackEngine,
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
  onOpenCurrentAlbum,
  setStatus,
}: PlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentSourceElementRef = useRef<HTMLAudioElement | null>(null);
  const nextSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const nextSourceElementRef = useRef<HTMLAudioElement | null>(null);
  const currentSourceGainRef = useRef<GainNode | null>(null);
  const nextSourceGainRef = useRef<GainNode | null>(null);
  const dspInputRef = useRef<GainNode | null>(null);
  const dspNormalizationRef = useRef<GainNode | null>(null);
  const dspPreampRef = useRef<GainNode | null>(null);
  const dspFiltersRef = useRef<BiquadFilterNode[]>([]);
  const dspCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dspModeRef = useRef<EqualizerBandMode | null>(null);
  const dspLimiterRef = useRef<boolean | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const desktopFadeTimerRef = useRef<number | null>(null);
  const crossfadeTimerRef = useRef<number | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);
  const visualizerLastEmitRef = useRef(0);
  const endFadeTrackRef = useRef<number | null>(null);
  const crossfadeTrackRef = useRef<number | null>(null);
  const crossfadeSourceRef = useRef<HTMLAudioElement | null>(null);
  const handoffSourceGainRef = useRef<GainNode | null>(null);
  const handoffRef = useRef<{ trackId: number; currentTime: number } | null>(null);
  const handoffSourceRef = useRef<HTMLAudioElement | null>(null);
  const pendingResumePositionRef = useRef<number | null>(null);
  const desktopLoadedTrackIdRef = useRef<number | null>(null);
  const desktopEndedTrackIdRef = useRef<number | null>(null);
  const lastPlaybackStreamErrorRef = useRef<string | null>(null);
  const handledExternalTrackRequestRef = useRef<number | null>(null);
  const preparedNextPathRef = useRef<string | null>(null);
  const prepareNextInFlightRef = useRef(false);
  const prepareNextPendingPathRef = useRef<string | null>(null);
  const activeSourceKeyRef = useRef("empty");
  const suppressWebPlaybackErrorsUntilRef = useRef(0);
  const suppressWebPauseUntilRef = useRef(0);
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
  const canPreviousAction = hasPrevious || Boolean(currentTrack && !isRadioSource && !isCdPreviewTrack);
  const cdSkipIsSettling = isCdPreviewTrack && isPlaying && currentTime < CD_SKIP_SETTLE_SECONDS;
  const trackNeedsWebPlayback = (track: Track | null) =>
    Boolean(track?.audio_url || track?.is_preview || track?.path?.startsWith("cdda://"));
  const usePlayback = playbackEngine === "rust" && !isRadioSource && !trackNeedsWebPlayback(currentTrack);
  const preloadedNextTrack =
    !isRadioSource && hasNext
      ? queue[currentIndex + 1]
      : !isRadioSource && playbackMode === "repeatQueue" && queue.length > 0
        ? queue[0]
        : null;
  const canPreloadNextTrack = Boolean(preloadedNextTrack && !trackNeedsWebPlayback(preloadedNextTrack));
  const effectiveDuration = isRadioSource ? 0 : duration || currentTrack?.duration_seconds || 0;
  const progressRatio = effectiveDuration > 0 ? clampNumber(currentTime / effectiveDuration, 0, 1) : 0;
  const progressPercent = progressRatio * 100;
  const progressFill = progressRatio > 0 ? `calc(${progressPercent}% + ${7 - progressRatio * 14}px)` : "0px";
  const smtcPositionSecond = Math.floor(currentTime);
  const trackSwitchFadeMs = Math.max(0, fadeMs);
  const webTrackSwitchFadeMs = webCrossfadeDurationMs(fadeMs);
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
  const trackAudioSourceUrl = (track: Track) => track.audio_url ?? audioUrl(track.id);
  const webAudioSourceUrl = currentRadioStation?.stream_url ?? (currentTrack ? trackAudioSourceUrl(currentTrack) : null);
  const webAudioKey = currentRadioStation ? `radio-${currentRadioStation.id}` : currentTrack ? `track-${currentTrack.id}-${currentTrack.audio_url ?? ""}` : "empty";
  const visualizerTrackId = currentTrack?.id ?? (currentRadioStation ? -currentRadioStation.id : null);
  activeSourceKeyRef.current = activeSourceKey;

  const webAudioRuntime = createWebAudioRuntime({
    replayGainForTrack, equalizerEnabled, equalizerBandMode, equalizerPreampDb, equalizerGains, dspLimiterEnabled, currentTrack, isPlaying, usePlayback, outputVolume, replayGain, smoothFadeProgress, cancelFade,
    audioRef, nextAudioRef, audioContextRef, currentSourceRef, currentSourceElementRef, nextSourceRef, nextSourceElementRef, currentSourceGainRef, nextSourceGainRef, dspInputRef, dspNormalizationRef, dspPreampRef, dspFiltersRef, dspCompressorRef, analyserRef, dspModeRef, dspLimiterRef, handoffSourceRef, handoffSourceGainRef, fadeTimerRef, visualizerFrameRef,
  });
  const {
    desktopDspSettingsForTrack, currentPlaybackDspSettings, ensureWebAudioGraph, connectMediaElementSource, updateDspSettings, resumeWebAudioGraph, emitVisualizerFrame, emitVisualizerState, holdAudioParam, setWebSourceGain, rampWebGainNode, finishWebHandoffToMain, fadeWebSourceGain, smoothFadeCurve, cancelWebSourceGainAutomation, cancelVisualizerLoop,
  } = webAudioRuntime;

  function cancelFade() {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    cancelWebSourceGainAutomation(currentSourceGainRef);
  }

  function cancelPlaybackFade() {
    if (desktopFadeTimerRef.current !== null) {
      window.clearTimeout(desktopFadeTimerRef.current);
      desktopFadeTimerRef.current = null;
    }
  }

  function cancelCrossfade() {
    if (crossfadeTimerRef.current !== null) {
      window.clearInterval(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    const crossfadeSource = crossfadeSourceRef.current;
    if (crossfadeSource && crossfadeSource !== audioRef.current) {
      crossfadeSource.pause();
      setWebSourceGain(crossfadeSource, nextSourceGainRef, 0);
    }
    crossfadeSourceRef.current = null;
    cancelWebSourceGainAutomation(currentSourceGainRef);
    cancelWebSourceGainAutomation(nextSourceGainRef);
  }

  function smoothFadeProgress(progress: number) {
    const bounded = clampNumber(progress, 0, 1);
    return bounded * bounded * (3 - 2 * bounded);
  }

  const playbackTransitions = createPlaybackTransitions({
    audioRef, nextAudioRef, currentSourceGainRef, nextSourceGainRef, crossfadeSourceRef, crossfadeTrackRef, handoffRef, handoffSourceRef, handoffSourceGainRef, pendingResumePositionRef, desktopLoadedTrackIdRef, desktopEndedTrackIdRef, lastPlaybackStreamErrorRef, suppressWebPlaybackErrorsUntilRef, suppressWebPauseUntilRef, artworkPreviewTimerRef, fadeTimerRef, dspInputRef, currentSourceRef, currentSourceElementRef, nextSourceRef, nextSourceElementRef, desktopFadeTimerRef, crossfadeTimerRef,
    currentTrack, currentTime, isPlaying, isCdPreviewTrack, usePlayback, outputVolume, fadeMs, desktopOutputDeviceId, desktopBufferFrames, queue, preloadedNextTrack, activeSourceKey, activeSourceKeyRef, isRadioSource, getArtworkSrc: () => artworkSrc, setShowArtworkPreview, setDuration, setCurrentTime, setIsPlaying, setStatus, onPlaybackTime, onTrackEnded, onSelectTrack, trackNeedsWebPlayback, trackAudioSourceUrl, applyPendingResumeToAudio, cancelFade, cancelPlaybackFade, cancelCrossfade, smoothFadeProgress, currentPlaybackDspSettings, desktopDspSettingsForTrack, fadeWebSourceGain, setWebSourceGain, cancelWebSourceGainAutomation, ensureWebAudioGraph, connectMediaElementSource, updateDspSettings, resumeWebAudioGraph, rampWebGainNode, smoothFadeCurve, holdAudioParam,
  });
  const {
    pauseWebAudioForPreviewSwitch, clearArtworkPreviewTimer, scheduleArtworkPreview, hideArtworkPreview, cdStreamIsSettling, fadeVolume, fadePlaybackVolume, startPlaybackTrack, startPlaybackCrossfade, resumePlaybackWithFade, createWebCrossfadeElement, webCrossfadeSourceFor, startCrossfade, playWithFade, pauseWithFade,
  } = playbackTransitions;

  usePlayerBarAudioEffects({
    cancelFade, cancelPlaybackFade, cancelCrossfade, clearArtworkPreviewTimer, cancelVisualizerLoop, miniPlayerChannelRef, audioContextRef, volume, muted, usePlayback, desktopFadeTimerRef, outputVolume, fadeTimerRef, crossfadeTimerRef, audioRef, currentSourceGainRef, nextAudioRef, nextSourceGainRef, desktopLoadedTrackIdRef, desktopEndedTrackIdRef, miniPlayerCommandRef, canPreloadNextTrack, preloadedNextTrack, ensureWebAudioGraph, activeSourceKey, equalizerEnabled, equalizerBandMode, equalizerPreampDb, equalizerGains, dspLimiterEnabled, replayGain, currentPlaybackDspSettings, emitVisualizerState, isPlaying, visualizerTrackId, currentTrack, visualizerLastEmitRef, emitVisualizerFrame, visualizerFrameRef, analyserRef, setWebSourceGain,
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
    nextAudioRef.current?.pause();

    if (isCdPreviewTrack) {
      const audio = audioRef.current;
      pauseWebAudioForPreviewSwitch(audio);
      commitTrackRequest();
      return;
    }

    if (!hasPlayableSource || !isPlaying || trackSwitchFadeMs <= 0) {
      if (usePlayback) {
        void desktopStop().finally(commitTrackRequest);
        return;
      }
      commitTrackRequest();
      return;
    }

    if (usePlayback) {
      if (trackNeedsWebPlayback(externalTrackRequest.track)) {
        void recordCurrentTrackExit();
        fadePlaybackVolume(0, trackSwitchFadeMs, () => {
          void desktopStop().finally(() => commitTrackRequest({ suppressExitRecord: true }));
        });
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
            void desktopStop().finally(() => commitTrackRequest({ suppressExitRecord: true }));
          });
        });
        return;
      }
      fadePlaybackVolume(0, trackSwitchFadeMs, () => {
        void desktopStop().finally(commitTrackRequest);
      });
      return;
    }

    const audio = audioRef.current;
    if (!audio || audio.paused) {
      commitTrackRequest();
      return;
    }

    void recordCurrentTrackExit();
    void startCrossfade(externalTrackRequest.track, {
      nextQueue: externalTrackRequest.queue,
      recordCompletion: false,
      sourceElement: webCrossfadeSourceFor(externalTrackRequest.track),
      onCommit: () => commitTrackRequest({ suppressExitRecord: true }),
    }).then((started) => {
      if (started) {
        return;
      }
      fadeVolume(0, trackSwitchFadeMs, () => {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // Some codecs do not permit seeking during teardown.
        }
        commitTrackRequest({ suppressExitRecord: true });
      });
    });
    return;
  }, [externalTrackRequest?.id]);

  useEffect(() => {
    cancelFade();
    setCurrentTime(0);
    onPlaybackTime(0);
    setDuration(isRadioSource ? 0 : currentTrack?.duration_seconds ?? 0);
    setArtworkFailed(false);
    setIsPlaying(false);
    endFadeTrackRef.current = null;
    crossfadeTrackRef.current = null;
    desktopEndedTrackIdRef.current = null;
    pendingResumePositionRef.current = null;

    if (!hasPlayableSource) {
      if (usePlayback) {
        desktopLoadedTrackIdRef.current = null;
        void desktopStop().catch(() => {
          // Rust playback may not be available in browser preview.
        });
      }
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
    if (usePlayback) {
      if (autoPlay) {
        if (desktopLoadedTrackIdRef.current === currentTrack.id) {
          setIsPlaying(true);
          return;
        }
        void startPlaybackTrack(currentTrack);
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const handoff = handoffRef.current;
    if (handoff?.trackId === currentTrack.id) {
      handoffRef.current = null;
      const handoffSource = handoffSourceRef.current;
      audio.currentTime = handoff.currentTime;
      ensureWebAudioGraph();
      setWebSourceGain(audio, currentSourceGainRef, 0);
      void resumeWebAudioGraph()
        .then(() => audio.play())
        .then(() => {
          setIsPlaying(true);
          finishWebHandoffToMain(audio, handoffSource);
        })
        .catch(() => {
          setStatus("Playback could not continue after crossfade.");
        });
      return;
    }
    if (autoPlay) {
      void playWithFade();
    }
  }, [activeSourceKey, radioPlaybackRequestId, autoPlay, usePlayback]);

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

    const audio = audioRef.current;
    if (!usePlayback && audio) {
      applyPendingResumeToAudio();
    } else if (usePlayback && desktopLoadedTrackIdRef.current === currentTrack.id) {
      void desktopSeek(boundedTime).catch(() => {
        // A restored position can still be used when playback starts.
      });
      pendingResumePositionRef.current = null;
    }

    onResumePositionApplied();
  }, [currentTrack?.id, resumePositionSeconds, usePlayback]);

  function applyPendingResumeToAudio() {
    const audio = audioRef.current;
    const pendingResumePosition = pendingResumePositionRef.current;
    if (!audio || pendingResumePosition === null || pendingResumePosition <= 0) {
      return false;
    }

    const durationLimit = Number.isFinite(audio.duration)
      ? Math.max(0, audio.duration - 1)
      : effectiveDuration > 0
        ? Math.max(0, effectiveDuration - 1)
        : pendingResumePosition;
    const targetTime = Math.min(pendingResumePosition, durationLimit);

    try {
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
      onPlaybackTime(targetTime);
      return true;
    } catch {
      // Some codecs allow seeking only after metadata finishes loading.
      return false;
    }
  }

  function maybeClearPendingResume(actualTime: number) {
    const pendingResumePosition = pendingResumePositionRef.current;
    if (pendingResumePosition === null) {
      return;
    }
    if (Math.abs(actualTime - pendingResumePosition) <= 1 || actualTime > pendingResumePosition) {
      pendingResumePositionRef.current = null;
    }
  }

  function syncDuration() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    setDuration(isRadioSource ? 0 : Number.isFinite(audio.duration) ? audio.duration : currentTrack?.duration_seconds ?? 0);
    applyPendingResumeToAudio();
  }

  function handleSeek(event: ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    seekTo(nextTime);
  }

  function handleProgressKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== " " && event.code !== "Space") {
      return;
    }
    event.preventDefault();
    if (hasPlayableSource) {
      void togglePlayback();
    }
  }

  function seekTo(nextTime: number) {
    if (isRadioSource || isCdPreviewTrack) {
      return;
    }
    const audio = audioRef.current;
    const boundedTime =
      effectiveDuration > 0 ? Math.min(Math.max(0, nextTime), effectiveDuration) : Math.max(0, nextTime);
    setCurrentTime(boundedTime);
    onPlaybackTime(boundedTime);
    pendingResumePositionRef.current = null;
    if (usePlayback) {
      void desktopSeek(boundedTime).catch((error) => {
        setStatus(error instanceof Error ? error.message : "Rust seek failed.");
      });
      return;
    }
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = boundedTime;
    }
  }

  async function togglePlayback() {
    if (usePlayback) {
      if (!currentTrack) {
        return;
      }
      if (isPlaying) {
        pauseWithFade();
      } else {
        await playWithFade();
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio || !hasPlayableSource) {
      return;
    }
    if (audio.paused) {
      await playWithFade();
    } else {
      pauseWithFade();
    }
  }

  function handlePreviousTrack() {
    if (cdSkipIsSettling || !canPreviousAction) {
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
      const audio = audioRef.current;
      if (recordExit) {
        void recordCurrentTrackExit();
      }
      cancelCrossfade();
      crossfadeTrackRef.current = null;
      nextAudioRef.current?.pause();
      if (isCdPreviewTrack) {
        // CD queue items may need a fresh live stream URL. Let the app prepare
        // that URL before we touch the current stream, otherwise a failed skip
        // leaves the player paused on the old track.
        onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
        return;
      }
      if (usePlayback) {
        if (trackNeedsWebPlayback(nextTrack)) {
          fadePlaybackVolume(0, trackSwitchFadeMs, () => {
            void desktopStop().finally(() => {
              onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
            });
          });
          return;
        }
        if (isPlaying && fadeMs > 0) {
          void startPlaybackCrossfade(nextTrack, false);
          return;
        }
        fadePlaybackVolume(0, trackSwitchFadeMs, () => {
          void desktopStop().finally(() => {
            onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
          });
        });
        return;
      }
      if (audio && !audio.paused) {
        if (trackSwitchFadeMs > 0) {
          void startCrossfade(nextTrack, {
            nextQueue: queue,
            recordCompletion: false,
            sourceElement: webCrossfadeSourceFor(nextTrack),
          }).then((started) => {
            if (started) {
              return;
            }
            fadeVolume(0, trackSwitchFadeMs, () => {
              audio.pause();
              try {
                audio.currentTime = 0;
              } catch {
                // Some codecs do not permit seeking during teardown.
              }
              onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
            });
          });
          return;
        }
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

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const nextTime = audio.currentTime;
    const pendingResumePosition = pendingResumePositionRef.current;
    if (pendingResumePosition !== null) {
      if (nextTime < 1 || nextTime < pendingResumePosition - 2) {
        if (applyPendingResumeToAudio()) {
          return;
        }
      }
      maybeClearPendingResume(nextTime);
    }
    setCurrentTime(nextTime);
    onPlaybackTime(nextTime);
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : effectiveDuration;
    const crossfadeLeadSeconds = Math.max(0.08, webTrackSwitchFadeMs / 1000);
    if (
      currentTrack &&
      preloadedNextTrack &&
      canPreloadNextTrack &&
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
      !isCdPreviewTrack &&
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
    const endedAt = audioRef.current?.currentTime ?? currentTime;
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
    if (!usePlayback) {
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
          desktopLoadedTrackIdRef.current === currentTrack.id &&
          desktopEndedTrackIdRef.current !== currentTrack.id
        ) {
          if (playbackEndedEarly(status.position_seconds, desktopDuration)) {
            desktopEndedTrackIdRef.current = currentTrack.id;
            setIsPlaying(false);
            setStatus("Track appears corrupted or truncated; Rust playback stopped before the saved duration.");
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
  }, [usePlayback, currentTrack?.id, playbackMode, currentIndex, queue, fadeMs, preloadedNextTrack?.id, canPreloadNextTrack, outputVolume]);

  useEffect(() => {
    if (!usePlayback || !preloadedNextTrack || !canPreloadNextTrack || playbackMode === "stopAfterCurrent") {
      return;
    }
    const requestedPath = preloadedNextTrack.path;
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
      void desktopPrepareNextFile(nextPath)
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
  }, [usePlayback, preloadedNextTrack?.id, preloadedNextTrack?.path, canPreloadNextTrack, playbackMode]);

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
    miniPlayer, artworkSrc: displayedArtworkSrc, playerTitle, hideArtworkPreview, scheduleArtworkPreview, setArtworkFailed, isRadioSource, isPreviewTrack, isLibraryTrack, currentTrack, currentRadioStation, radioSubtitle, hasCurrentArtist, currentArtistLabel, onOpenCurrentArtist, hasCurrentAlbum, currentAlbumLabel, onOpenCurrentAlbum, onOpenCurrentTrack, cdSkipIsSettling, hasPrevious, canPreviousAction, handlePreviousTrack, playRelative, isPlaying, hasPlayableSource, togglePlayback, hasNext, usePlayback, webAudioSourceUrl, webAudioKey, audioRef, isCdPreviewTrack, syncDuration, handleTimeUpdate, setIsPlaying, suppressWebPauseUntilRef, maybeClearPendingResume, handleEnded, activeSourceKeyRef, activeSourceKey, suppressWebPlaybackErrorsUntilRef, setStatus, preloadedNextTrack, canPreloadNextTrack, nextAudioRef, trackAudioSourceUrl, effectiveDuration, currentTime, progressPercent, progressFill, handleSeek, handleProgressKeyDown, playbackMode, cycleRepeatMode, onOpenLyricsView, onOpenQueueView, muted, volume, handleVolumeWheel, toggleMuted, handleVolumeChange, volumePercentDraft, commitVolumePercent, setVolumePercentDraft, handleVolumePercentChange, handleVolumePercentKeyDown, onRating, showArtworkPreview,
  };

  return <PlayerBarView model={playerBarViewModel} />;
}
