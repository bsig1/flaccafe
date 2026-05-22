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
  MutableRefObject,
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
import {
  nativeCrossfadeToFile,
  nativePause,
  nativePlayFile,
  nativeResume,
  nativeSeek,
  nativeSetVolume,
  nativeStatus,
  nativeStop,
} from "../../lib/nativePlayback";
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
  EqualizerBandMode,
  KeyboardShortcutAction,
  KeyboardShortcut,
  MiniPlayerCommand,
  PlaybackEngine,
  PlaybackMode,
  clampNumber,
  dbToGain,
  display,
  equalizerFrequenciesForMode,
  formatPlaybackTime,
  miniPlayerChannelName,
  miniPlayerTrackSnapshot,
  publishMiniPlayerSnapshot,
  readStoredMuted,
  readStoredVolume,
  replayGainMultiplier,
  shouldRecordTrackAsPlayed,
  shortcutMatchesEvent,
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
  playbackEngine,
  nativeOutputDeviceId,
  nativeBufferFrames,
  miniPlayer,
  replayGainMode,
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
  playbackEngine: PlaybackEngine;
  nativeOutputDeviceId: string;
  nativeBufferFrames: number;
  miniPlayer: boolean;
  replayGainMode: "off" | "track" | "album";
  replayGainPreampDb: number;
  replayGainPreventClipping: boolean;
  equalizerEnabled: boolean;
  equalizerBandMode: EqualizerBandMode;
  equalizerPreampDb: number;
  equalizerGains: number[];
  dspLimiterEnabled: boolean;
  keyboardShortcuts: Record<KeyboardShortcutAction, KeyboardShortcut>;
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  onOpenMiniPlayer: () => void | Promise<void>;
  setStatus: (message: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentSourceElementRef = useRef<HTMLAudioElement | null>(null);
  const nextSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const nextSourceElementRef = useRef<HTMLAudioElement | null>(null);
  const dspInputRef = useRef<GainNode | null>(null);
  const dspPreampRef = useRef<GainNode | null>(null);
  const dspFiltersRef = useRef<BiquadFilterNode[]>([]);
  const dspCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const dspModeRef = useRef<EqualizerBandMode | null>(null);
  const dspLimiterRef = useRef<boolean | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const nativeFadeTimerRef = useRef<number | null>(null);
  const crossfadeTimerRef = useRef<number | null>(null);
  const endFadeTrackRef = useRef<number | null>(null);
  const crossfadeTrackRef = useRef<number | null>(null);
  const handoffRef = useRef<{ trackId: number; currentTime: number } | null>(null);
  const nativeLoadedTrackIdRef = useRef<number | null>(null);
  const nativeEndedTrackIdRef = useRef<number | null>(null);
  const lastNativeStreamErrorRef = useRef<string | null>(null);
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
  const replayGain = replayGainMultiplier(currentTrack, replayGainMode, replayGainPreampDb, replayGainPreventClipping);
  const outputVolume = muted ? 0 : clampNumber(volume * replayGain, 0, 1);
  const useNativePlayback = playbackEngine === "native";

  function disconnectAudioNode(node: AudioNode | null) {
    try {
      node?.disconnect();
    } catch {
      // Web Audio nodes may already be disconnected when tracks swap quickly.
    }
  }

  function ensureAudioContext(): AudioContext | null {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    return audioContextRef.current;
  }

  function connectMediaElementSource(
    element: HTMLAudioElement | null,
    sourceRef: MutableRefObject<MediaElementAudioSourceNode | null>,
    elementRef: MutableRefObject<HTMLAudioElement | null>,
    input: GainNode,
  ) {
    if (!element) {
      disconnectAudioNode(sourceRef.current);
      sourceRef.current = null;
      elementRef.current = null;
      return;
    }
    if (elementRef.current === element && sourceRef.current) {
      return;
    }
    disconnectAudioNode(sourceRef.current);
    try {
      const context = input.context as AudioContext;
      const source = context.createMediaElementSource(element);
      source.connect(input);
      sourceRef.current = source;
      elementRef.current = element;
    } catch {
      // A browser can reject media-element source creation in preview mode.
      // Direct audio playback still works; it just bypasses the EQ chain.
      sourceRef.current = null;
      elementRef.current = element;
    }
  }

  function rebuildDspTail(context: AudioContext, input: GainNode) {
    disconnectAudioNode(input);
    disconnectAudioNode(dspPreampRef.current);
    for (const filter of dspFiltersRef.current) {
      disconnectAudioNode(filter);
    }
    disconnectAudioNode(dspCompressorRef.current);

    const preamp = context.createGain();
    const frequencies = equalizerFrequenciesForMode(equalizerBandMode);
    const filters = frequencies.map((frequency, index) => {
      const filter = context.createBiquadFilter();
      filter.frequency.value = frequency;
      filter.Q.value = index === 0 || index === frequencies.length - 1 ? 0.7 : 1.1;
      filter.type = index === 0 ? "lowshelf" : index === frequencies.length - 1 ? "highshelf" : "peaking";
      return filter;
    });
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -1.5;
    compressor.knee.value = 0;
    compressor.ratio.value = 16;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;

    input.connect(preamp);
    let previous: AudioNode = preamp;
    for (const filter of filters) {
      previous.connect(filter);
      previous = filter;
    }
    if (dspLimiterEnabled) {
      previous.connect(compressor);
      compressor.connect(context.destination);
    } else {
      previous.connect(context.destination);
    }

    dspPreampRef.current = preamp;
    dspFiltersRef.current = filters;
    dspCompressorRef.current = compressor;
    dspModeRef.current = equalizerBandMode;
    dspLimiterRef.current = dspLimiterEnabled;
  }

  function ensureWebAudioGraph() {
    if (useNativePlayback) {
      return null;
    }
    const context = ensureAudioContext();
    if (!context) {
      return null;
    }
    if (!dspInputRef.current || dspInputRef.current.context !== context) {
      dspInputRef.current = context.createGain();
      dspModeRef.current = null;
      dspLimiterRef.current = null;
    }
    const input = dspInputRef.current;
    connectMediaElementSource(audioRef.current, currentSourceRef, currentSourceElementRef, input);
    connectMediaElementSource(nextAudioRef.current, nextSourceRef, nextSourceElementRef, input);
    if (dspModeRef.current !== equalizerBandMode || dspLimiterRef.current !== dspLimiterEnabled || !dspPreampRef.current) {
      rebuildDspTail(context, input);
    }
    updateDspSettings();
    return context;
  }

  function updateDspSettings() {
    const context = audioContextRef.current;
    if (!context || !dspPreampRef.current || dspFiltersRef.current.length === 0) {
      return;
    }
    const now = context.currentTime;
    const preampGain = equalizerEnabled ? dbToGain(equalizerPreampDb) : 1;
    dspPreampRef.current.gain.setTargetAtTime(preampGain, now, 0.01);
    for (const [index, filter] of dspFiltersRef.current.entries()) {
      const gain = equalizerEnabled ? clampNumber(equalizerGains[index] ?? 0, -12, 12) : 0;
      filter.gain.setTargetAtTime(gain, now, 0.01);
    }
  }

  async function resumeWebAudioGraph() {
    const context = ensureWebAudioGraph();
    if (context?.state === "suspended") {
      await context.resume();
    }
  }

  useEffect(() => {
    return () => {
      cancelFade();
      cancelNativeFade();
      cancelCrossfade();
      miniPlayerChannelRef.current?.close();
      void audioContextRef.current?.close().catch(() => {
        // Closing the graph is best-effort during app teardown.
      });
      void nativeStop().catch(() => {
        // Native playback is best-effort during shutdown.
      });
    };
  }, []);

  useEffect(() => {
    writeStoredAudioControls(volume, muted);
    if (useNativePlayback) {
      if (nativeFadeTimerRef.current === null) {
        void nativeSetVolume(outputVolume).catch(() => {
          // The native engine may be unavailable in browser preview.
        });
      }
      return;
    }
    if (fadeTimerRef.current === null && crossfadeTimerRef.current === null) {
      if (audioRef.current) {
        audioRef.current.volume = outputVolume;
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.volume = 0;
      }
    }
  }, [volume, muted, outputVolume, useNativePlayback]);

  useEffect(() => {
    if (useNativePlayback) {
      audioRef.current?.pause();
      return;
    }
    nativeLoadedTrackIdRef.current = null;
    nativeEndedTrackIdRef.current = null;
    void nativeStop().catch(() => {
      // The command is not available in a plain Vite browser preview.
    });
  }, [useNativePlayback]);

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

  useEffect(() => {
    if (useNativePlayback) {
      return;
    }
    ensureWebAudioGraph();
  }, [
    useNativePlayback,
    currentTrack?.id,
    preloadedNextTrack?.id,
    equalizerEnabled,
    equalizerBandMode,
    equalizerPreampDb,
    equalizerGains,
    dspLimiterEnabled,
  ]);

  function cancelFade() {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }

  function cancelNativeFade() {
    if (nativeFadeTimerRef.current !== null) {
      window.clearInterval(nativeFadeTimerRef.current);
      nativeFadeTimerRef.current = null;
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

  function fadeNativeVolume(targetVolume: number, durationMs: number, afterFade?: () => void, startVolumeOverride?: number) {
    cancelNativeFade();
    const clampedTarget = clampNumber(targetVolume, 0, 1.5);
    if (durationMs <= 0) {
      void nativeSetVolume(clampedTarget).finally(() => afterFade?.());
      return;
    }
    const startVolume = startVolumeOverride ?? (muted ? 0 : outputVolume);
    const startedAt = window.performance.now();
    nativeFadeTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const nextVolume = startVolume + (clampedTarget - startVolume) * progress;
      void nativeSetVolume(nextVolume).catch(() => {
        // Keep the UI responsive even if the native engine is unavailable.
      });
      if (progress >= 1) {
        cancelNativeFade();
        afterFade?.();
      }
    }, 16);
  }

  async function startNativeTrack(track: Track, startSeconds = 0) {
    cancelNativeFade();
    cancelCrossfade();
    const startVolume = fadeMs > 0 ? 0 : outputVolume;
    try {
      const status = await nativePlayFile({
        path: track.path,
        volume: startVolume,
        startSeconds,
        deviceId: nativeOutputDeviceId,
        bufferFrames: nativeBufferFrames,
      });
      nativeLoadedTrackIdRef.current = track.id;
      nativeEndedTrackIdRef.current = null;
      lastNativeStreamErrorRef.current = null;
      setDuration(status.duration_seconds ?? track.duration_seconds ?? 0);
      setCurrentTime(status.position_seconds);
      onPlaybackTime(status.position_seconds);
      setIsPlaying(true);
      if (fadeMs > 0) {
        fadeNativeVolume(outputVolume, fadeMs, undefined, 0);
      }
    } catch (error) {
      setIsPlaying(false);
      nativeLoadedTrackIdRef.current = null;
      setStatus(error instanceof Error ? error.message : "Native playback could not start for this file.");
    }
  }

  async function startNativeCrossfade(nextTrack: Track, recordCompletion = true) {
    if (!currentTrack || crossfadeTrackRef.current === currentTrack.id) {
      return;
    }
    crossfadeTrackRef.current = currentTrack.id;
    cancelNativeFade();
    try {
      const status = await nativeCrossfadeToFile({
        path: nextTrack.path,
        volume: outputVolume,
        durationMs: Math.max(0, fadeMs),
        deviceId: nativeOutputDeviceId,
        bufferFrames: nativeBufferFrames,
      });
      nativeLoadedTrackIdRef.current = nextTrack.id;
      nativeEndedTrackIdRef.current = null;
      lastNativeStreamErrorRef.current = null;
      setDuration(status.duration_seconds ?? nextTrack.duration_seconds ?? 0);
      setCurrentTime(status.position_seconds);
      onPlaybackTime(status.position_seconds);
      setIsPlaying(true);
      if (recordCompletion) {
        void onTrackEnded(currentTrack.id);
      }
      onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
    } catch (error) {
      crossfadeTrackRef.current = null;
      setStatus(error instanceof Error ? error.message : "Native crossfade could not start.");
    }
  }

  async function resumeNativeWithFade() {
    if (!currentTrack) {
      return;
    }
    if (nativeLoadedTrackIdRef.current !== currentTrack.id || nativeEndedTrackIdRef.current === currentTrack.id) {
      await startNativeTrack(currentTrack);
      return;
    }
    try {
      cancelNativeFade();
      await nativeSetVolume(fadeMs > 0 ? 0 : outputVolume);
      await nativeResume();
      setIsPlaying(true);
      if (fadeMs > 0) {
        fadeNativeVolume(outputVolume, fadeMs, undefined, 0);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Native playback could not resume.");
    }
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
      await resumeWebAudioGraph();
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
    if (useNativePlayback) {
      await resumeNativeWithFade();
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    cancelFade();
    audio.volume = 0;
    try {
      await resumeWebAudioGraph();
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
    if (useNativePlayback) {
      fadeNativeVolume(0, fadeMs, () => {
        void nativePause()
          .then(() => {
            setIsPlaying(false);
            return nativeSetVolume(outputVolume);
          })
          .catch((error) => {
            setStatus(error instanceof Error ? error.message : "Native playback could not pause.");
          });
      });
      return;
    }
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
    nativeEndedTrackIdRef.current = null;

    if (!currentTrack) {
      if (useNativePlayback) {
        nativeLoadedTrackIdRef.current = null;
        void nativeStop().catch(() => {
          // Native playback may not be available in browser preview.
        });
      }
      return;
    }
    if (useNativePlayback) {
      if (autoPlay) {
        if (nativeLoadedTrackIdRef.current === currentTrack.id) {
          setIsPlaying(true);
          return;
        }
        void startNativeTrack(currentTrack);
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
      audio.currentTime = handoff.currentTime;
      audio.volume = outputVolume;
      void resumeWebAudioGraph()
        .then(() => audio.play())
        .then(() => setIsPlaying(true))
        .catch(() => {
          setStatus("Playback could not continue after crossfade.");
        });
      return;
    }
    if (autoPlay) {
      void playWithFade();
    }
  }, [currentTrack?.id, autoPlay, useNativePlayback]);

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
    if (useNativePlayback) {
      void nativeSeek(boundedTime).catch((error) => {
        setStatus(error instanceof Error ? error.message : "Native seek failed.");
      });
      return;
    }
    if (audio && Number.isFinite(nextTime)) {
      audio.currentTime = boundedTime;
    }
  }

  async function togglePlayback() {
    if (useNativePlayback) {
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

  async function openCurrentTrackExternally() {
    if (!currentTrack) {
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_file_with_default_app", { path: currentTrack.path });
      setStatus("Opened track in the system default audio app");
    } catch {
      setStatus("This file may not be supported by WebView playback. Use Reveal to open it with another local player.");
    }
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
      if (useNativePlayback) {
        if (isPlaying && fadeMs > 0) {
          void startNativeCrossfade(nextTrack, false);
          return;
        }
        fadeNativeVolume(0, trackSwitchFadeMs, () => {
          void nativeStop().finally(() => {
            onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
          });
        });
        return;
      }
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
      if (useNativePlayback) {
        await nativeStop().catch(() => {
          // Native stop is best-effort here; the UI state still updates.
        });
        nativeLoadedTrackIdRef.current = null;
      }
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

  useEffect(() => {
    if (!useNativePlayback) {
      return;
    }
    let canceled = false;
    const pollNativeStatus = async () => {
      try {
        const status = await nativeStatus();
        if (canceled) {
          return;
        }
        setIsPlaying(status.is_playing);
        setCurrentTime(status.position_seconds);
        onPlaybackTime(status.position_seconds);
        if (status.duration_seconds !== null) {
          setDuration(status.duration_seconds);
        }
        const latestStreamError = status.stream_errors.length
          ? status.stream_errors[status.stream_errors.length - 1]
          : null;
        if (latestStreamError && latestStreamError !== lastNativeStreamErrorRef.current) {
          lastNativeStreamErrorRef.current = latestStreamError;
          setStatus(latestStreamError);
        }
        const nativeDuration = status.duration_seconds ?? currentTrack?.duration_seconds ?? 0;
        const nativeCrossfadeLeadSeconds = Math.max(0.12, fadeMs / 1000);
        if (
          currentTrack &&
          preloadedNextTrack &&
          playbackMode !== "stopAfterCurrent" &&
          playbackMode !== "repeatOne" &&
          fadeMs > 0 &&
          status.is_playing &&
          nativeDuration > nativeCrossfadeLeadSeconds * 2 &&
          nativeDuration - status.position_seconds <= nativeCrossfadeLeadSeconds &&
          crossfadeTrackRef.current !== currentTrack.id
        ) {
          await startNativeCrossfade(preloadedNextTrack);
          return;
        }
        if (
          currentTrack &&
          status.ended &&
          nativeLoadedTrackIdRef.current === currentTrack.id &&
          nativeEndedTrackIdRef.current !== currentTrack.id
        ) {
          nativeEndedTrackIdRef.current = currentTrack.id;
          await handleEnded();
        }
      } catch {
        // Native status is unavailable in browser preview and before the desktop command is ready.
      }
    };
    void pollNativeStatus();
    const timer = window.setInterval(() => {
      void pollNativeStatus();
    }, 120);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [useNativePlayback, currentTrack?.id, playbackMode, currentIndex, queue, fadeMs, preloadedNextTrack?.id, outputVolume]);

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
      if (currentTrack && !isPlaying) {
        void playWithFade();
      }
      return;
    }
    if (payload.command === "pause") {
      if (currentTrack && isPlaying) {
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

      if (event.key === "MediaPlayPause" || shortcutMatchesEvent(keyboardShortcuts["playback.playPause"], event)) {
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

      if (shortcutMatchesEvent(keyboardShortcuts["playback.next"], event)) {
        event.preventDefault();
        playRelative(1);
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.previous"], event)) {
        event.preventDefault();
        if (currentTime > 4) {
          seekTo(0);
        } else {
          playRelative(-1);
        }
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.seekForward"], event)) {
        event.preventDefault();
        seekTo(currentTime + 5);
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.seekBackward"], event)) {
        event.preventDefault();
        seekTo(currentTime - 5);
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.volumeUp"], event)) {
        event.preventDefault();
        changeVolume(volume + 0.05);
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.volumeDown"], event)) {
        event.preventDefault();
        changeVolume(volume - 0.05);
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.mute"], event)) {
        event.preventDefault();
        toggleMuted();
      }
    }

    window.addEventListener("keydown", handleLocalAudioKeyDown);
    return () => window.removeEventListener("keydown", handleLocalAudioKeyDown);
  }, [currentTrack, currentTime, volume, muted, hasPrevious, hasNext, queue, currentIndex, outputVolume, keyboardShortcuts]);

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
          : "h-28 grid-cols-[minmax(220px,340px)_1fr_minmax(260px,320px)] gap-5"
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

        {!useNativePlayback && currentTrack ? (
          <audio
            key={currentTrack.id}
            ref={audioRef}
            className="hidden"
            crossOrigin="anonymous"
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
                  ? "This file is not supported by the current WebView codec stack. Use the external-player button for a fallback."
                  : "Audio source failed to load. The backend may need a restart, or the file may be missing.";
              setStatus(message);
            }}
          />
        ) : !useNativePlayback ? (
          <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
        ) : null}
        {!useNativePlayback && preloadedNextTrack && (
          <audio
            key={`next-${preloadedNextTrack.id}`}
            ref={nextAudioRef}
            className="hidden"
            crossOrigin="anonymous"
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

      <div className="flex min-w-0 flex-col items-end justify-center gap-1.5 text-right text-xs text-muted">
        {currentTrack && !miniPlayer && (
          <div className="w-full truncate text-neutral-400">
            {[trackGenre(currentTrack), currentTrack.year].filter(Boolean).join(" - ")}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
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
        <div className="flex max-w-full items-center justify-end gap-2">
          {currentTrack && !miniPlayer && (
            <div className="shrink min-w-0 scale-90 origin-right">
              <RatingStars rating={currentTrack.rating} onChange={(rating) => onRating(currentTrack.id, rating)} />
            </div>
          )}
          <div className="flex shrink-0 justify-end gap-1">
            <button
              className="icon-button h-7 w-7"
              type="button"
              title="Open detached mini player"
              onClick={() => void onOpenMiniPlayer()}
            >
              <ExternalLink size={13} />
            </button>
            <button
              className="icon-button h-7 w-7"
              type="button"
              title="Open in default audio app"
              disabled={!currentTrack}
              onClick={() => void openCurrentTrackExternally()}
            >
              <CircleStop size={13} />
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
      </div>
    </section>
  );
}
