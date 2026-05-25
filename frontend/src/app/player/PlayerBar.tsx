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
import type {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  WheelEvent as ReactWheelEvent,
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
  nativeFadeVolume as nativeFadeVolumeCommand,
  nativePause,
  nativePlayFile,
  nativePrepareNextFile,
  nativeResume,
  nativeSeek,
  nativeSetDsp,
  nativeSetVolume,
  nativeStatus,
  nativeStop,
  nativeVisualizerFrame,
} from "../../lib/nativePlayback";
import type { NativeDspSettings } from "../../lib/nativePlayback";
import type { SmtcButtonPayload } from "../../lib/tauriMedia";
import {
  clearSmtcState,
  listenForSmtcButtons,
  updateSmtcState,
} from "../../lib/tauriMedia";
import type {
  RadioStation,
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

type ExternalTrackRequest = {
  id: number;
  track: Track;
  queue: Track[];
};

const WEB_HANDOFF_FADE_MS = 90;

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
  nativeOutputDeviceId,
  nativeBufferFrames,
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
}: {
  currentTrack: Track | null;
  currentRadioStation: RadioStation | null;
  radioPlaybackRequestId: number;
  queue: Track[];
  externalTrackRequest: ExternalTrackRequest | null;
  onSelectTrack: (track: Track, queue: Track[], options?: { suppressExitRecord?: boolean }) => void;
  onCommitExternalTrackRequest: (request: ExternalTrackRequest, options?: { suppressExitRecord?: boolean }) => void;
  onTrackEnded: (trackId: number) => Promise<void>;
  onTrackSkipped: (trackId: number) => Promise<void>;
  onPlaybackTime: (seconds: number) => void;
  resumePositionSeconds: number | null;
  onResumePositionApplied: () => void;
  onRating: (trackId: number, rating: number | null) => void;
  autoPlay: boolean;
  fadeMs: number;
  skipThresholdPercent: number;
  playbackEngine: PlaybackEngine;
  nativeOutputDeviceId: string;
  nativeBufferFrames: number;
  miniPlayer: boolean;
  replayGainMode: "off" | "track" | "album";
  replayGainTargetVolumePercent: number;
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
  onOpenLyricsView: () => void;
  onOpenQueueView: () => void;
  onOpenCurrentTrack: (track: Track) => void;
  onOpenCurrentArtist: (track: Track) => void;
  onOpenCurrentAlbum: (track: Track) => void;
  setStatus: (message: string) => void;
}) {
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
  const nativeFadeTimerRef = useRef<number | null>(null);
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
  const nativeLoadedTrackIdRef = useRef<number | null>(null);
  const nativeEndedTrackIdRef = useRef<number | null>(null);
  const lastNativeStreamErrorRef = useRef<string | null>(null);
  const handledExternalTrackRequestRef = useRef<number | null>(null);
  const activeSourceKeyRef = useRef("empty");
  const suppressWebPlaybackErrorsUntilRef = useRef(0);
  const suppressWebPauseUntilRef = useRef(0);
  const smtcActionRef = useRef<(payload: SmtcButtonPayload) => void>(() => {});
  const miniPlayerChannelRef = useRef<BroadcastChannel | null>(null);
  const miniPlayerCommandRef = useRef<(command: MiniPlayerCommand) => void>(() => {});
  const artworkPreviewTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(readStoredVolume);
  const [volumePercentDraft, setVolumePercentDraft] = useState<string | null>(null);
  const [muted, setMuted] = useState(readStoredMuted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [artworkFailed, setArtworkFailed] = useState(false);
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
  const useNativePlayback = playbackEngine === "native" && !isRadioSource && !currentTrack?.audio_url;
  const preloadedNextTrack =
    !isRadioSource && hasNext
      ? queue[currentIndex + 1]
      : !isRadioSource && playbackMode === "repeatQueue" && queue.length > 0
        ? queue[0]
        : null;
  const canPreloadNextTrack = Boolean(preloadedNextTrack && !preloadedNextTrack.is_preview && !preloadedNextTrack.audio_url);
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
  const trackAudioSourceUrl = (track: Track) => track.audio_url ?? audioUrl(track.id);
  const trackNeedsWebPlayback = (track: Track | null) =>
    Boolean(track?.audio_url || track?.is_preview || track?.path?.startsWith("cdda://"));
  const webAudioSourceUrl = currentRadioStation?.stream_url ?? (currentTrack ? trackAudioSourceUrl(currentTrack) : null);
  const webAudioKey = currentRadioStation ? `radio-${currentRadioStation.id}` : currentTrack ? `track-${currentTrack.id}-${currentTrack.audio_url ?? ""}` : "empty";
  const visualizerTrackId = currentTrack?.id ?? (currentRadioStation ? -currentRadioStation.id : null);
  activeSourceKeyRef.current = activeSourceKey;

  function nativeDspSettingsForTrack(track: Track | null): NativeDspSettings {
    return {
      normalizationGain: replayGainForTrack(track),
      equalizerEnabled,
      equalizerBandMode,
      equalizerPreampDb,
      equalizerGains: normalizeEqualizerGains(equalizerGains, equalizerBandMode),
      limiterEnabled: dspLimiterEnabled,
    };
  }

  function currentNativeDspSettings(): NativeDspSettings {
    return nativeDspSettingsForTrack(currentTrack);
  }

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
    gainRef: MutableRefObject<GainNode | null>,
    input: GainNode,
    initialGain: number,
  ) {
    if (!element) {
      disconnectAudioNode(sourceRef.current);
      disconnectAudioNode(gainRef.current);
      sourceRef.current = null;
      elementRef.current = null;
      gainRef.current = null;
      return false;
    }
    if (
      elementRef.current === element &&
      sourceRef.current &&
      gainRef.current &&
      gainRef.current.context === input.context
    ) {
      return true;
    }
    disconnectAudioNode(sourceRef.current);
    disconnectAudioNode(gainRef.current);
    try {
      const context = input.context as AudioContext;
      const source = context.createMediaElementSource(element);
      const sourceGain = context.createGain();
      sourceGain.gain.value = clampNumber(initialGain, 0, 1);
      source.connect(sourceGain);
      sourceGain.connect(input);
      sourceRef.current = source;
      elementRef.current = element;
      gainRef.current = sourceGain;
      element.volume = 1;
      return true;
    } catch {
      // A browser can reject media-element source creation in preview mode.
      // Direct audio playback still works; it just bypasses the EQ chain.
      sourceRef.current = null;
      elementRef.current = element;
      gainRef.current = null;
      element.volume = clampNumber(initialGain, 0, 1);
      return false;
    }
  }

  function rebuildDspTail(context: AudioContext, input: GainNode) {
    disconnectAudioNode(input);
    disconnectAudioNode(dspNormalizationRef.current);
    disconnectAudioNode(dspPreampRef.current);
    for (const filter of dspFiltersRef.current) {
      disconnectAudioNode(filter);
    }
    disconnectAudioNode(dspCompressorRef.current);
    disconnectAudioNode(analyserRef.current);

    const normalization = context.createGain();
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
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;

    input.connect(normalization);
    normalization.connect(preamp);
    let previous: AudioNode = preamp;
    for (const filter of filters) {
      previous.connect(filter);
      previous = filter;
    }
    if (dspLimiterEnabled) {
      previous.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(context.destination);
    } else {
      previous.connect(analyser);
      analyser.connect(context.destination);
    }

    dspNormalizationRef.current = normalization;
    dspPreampRef.current = preamp;
    dspFiltersRef.current = filters;
    dspCompressorRef.current = compressor;
    analyserRef.current = analyser;
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
    connectMediaElementSource(audioRef.current, currentSourceRef, currentSourceElementRef, currentSourceGainRef, input, outputVolume);
    if (!handoffSourceRef.current) {
      connectMediaElementSource(nextAudioRef.current, nextSourceRef, nextSourceElementRef, nextSourceGainRef, input, 0);
    }
    if (dspModeRef.current !== equalizerBandMode || dspLimiterRef.current !== dspLimiterEnabled || !dspPreampRef.current) {
      rebuildDspTail(context, input);
    }
    updateDspSettings();
    return context;
  }

  function updateDspSettings() {
    const context = audioContextRef.current;
    if (!context || !dspNormalizationRef.current || !dspPreampRef.current || dspFiltersRef.current.length === 0) {
      return;
    }
    const now = context.currentTime;
    dspNormalizationRef.current.gain.setTargetAtTime(replayGain, now, 0.01);
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

  function emitVisualizerFrame(frame: VisualizerFrame) {
    window.dispatchEvent(new CustomEvent<VisualizerFrame>(VISUALIZER_FRAME_EVENT, { detail: frame }));
  }

  function emitVisualizerState(isLive = false) {
    emitVisualizerFrame({
      trackId: currentTrack?.id ?? null,
      isPlaying,
      isLive,
      level: 0,
      frequencyBins: [],
      waveform: [],
      timestamp: window.performance.now(),
    });
  }

  function holdAudioParam(param: AudioParam, atTime: number) {
    try {
      param.cancelAndHoldAtTime(atTime);
    } catch {
      const currentValue = param.value;
      param.cancelScheduledValues(atTime);
      param.setValueAtTime(currentValue, atTime);
    }
  }

  function setWebSourceGain(
    element: HTMLAudioElement | null,
    gainRef: MutableRefObject<GainNode | null>,
    value: number,
  ) {
    const clamped = clampNumber(value, 0, 1);
    const sourceGain = gainRef.current;
    if (!sourceGain) {
      if (element) {
        element.volume = clamped;
      }
      return false;
    }
    const now = sourceGain.context.currentTime;
    holdAudioParam(sourceGain.gain, now);
    sourceGain.gain.setValueAtTime(clamped, now);
    if (element) {
      element.volume = 1;
    }
    return true;
  }

  function rampHtmlAudioVolume(
    element: HTMLAudioElement,
    startVolume: number,
    targetVolume: number,
    durationMs: number,
    afterFade?: () => void,
  ) {
    const clampedStart = clampNumber(startVolume, 0, 1);
    const clampedTarget = clampNumber(targetVolume, 0, 1);
    if (durationMs <= 0) {
      element.volume = clampedTarget;
      afterFade?.();
      return;
    }
    const startedAt = window.performance.now();
    element.volume = clampedStart;
    const step = () => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = smoothFadeProgress(progress);
      element.volume = clampedStart + (clampedTarget - clampedStart) * eased;
      if (progress >= 1) {
        element.volume = clampedTarget;
        afterFade?.();
        return;
      }
      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  function rampWebGainNode(
    element: HTMLAudioElement,
    gainNode: GainNode | null,
    startVolume: number,
    targetVolume: number,
    durationMs: number,
    afterFade?: () => void,
  ) {
    const clampedStart = clampNumber(startVolume, 0, 1);
    const clampedTarget = clampNumber(targetVolume, 0, 1);
    if (!gainNode) {
      rampHtmlAudioVolume(element, clampedStart, clampedTarget, durationMs, afterFade);
      return;
    }

    const context = gainNode.context;
    const now = context.currentTime;
    holdAudioParam(gainNode.gain, now);
    element.volume = 1;
    if (durationMs <= 0) {
      gainNode.gain.setValueAtTime(clampedTarget, now);
      afterFade?.();
      return;
    }

    const durationSeconds = Math.max(0.001, durationMs / 1000);
    gainNode.gain.setValueAtTime(clampedStart, now);
    gainNode.gain.setValueCurveAtTime(smoothFadeCurve(clampedStart, clampedTarget), now, durationSeconds);
    window.setTimeout(() => {
      const finishedAt = context.currentTime;
      gainNode.gain.cancelScheduledValues(finishedAt);
      gainNode.gain.setValueAtTime(clampedTarget, finishedAt);
      afterFade?.();
    }, durationMs + 25);
  }

  function finishWebHandoffToMain(audio: HTMLAudioElement, handoffSource: HTMLAudioElement | null) {
    rampWebGainNode(audio, currentSourceGainRef.current, 0, outputVolume, WEB_HANDOFF_FADE_MS);
    if (!handoffSource || handoffSource === audio) {
      handoffSourceRef.current = null;
      handoffSourceGainRef.current = null;
      return;
    }
    const handoffGain = handoffSourceGainRef.current ?? nextSourceGainRef.current;
    rampWebGainNode(handoffSource, handoffGain, outputVolume, 0, WEB_HANDOFF_FADE_MS, () => {
      handoffSource.pause();
      if (handoffSource !== audioRef.current) {
        setWebSourceGain(handoffSource, nextSourceGainRef, 0);
      }
      handoffSourceRef.current = null;
      handoffSourceGainRef.current = null;
      ensureWebAudioGraph();
    });
  }

  function fadeWebSourceGain(
    element: HTMLAudioElement,
    gainRef: MutableRefObject<GainNode | null>,
    targetVolume: number,
    durationMs: number,
    afterFade?: () => void,
  ) {
    const sourceGain = gainRef.current;
    if (!sourceGain) {
      return false;
    }

    cancelFade();
    const clampedTarget = clampNumber(targetVolume, 0, 1);
    const context = sourceGain.context;
    const now = context.currentTime;
    holdAudioParam(sourceGain.gain, now);
    const startVolume = clampNumber(sourceGain.gain.value, 0, 1);
    element.volume = 1;
    if (durationMs <= 0) {
      sourceGain.gain.setValueAtTime(clampedTarget, now);
      afterFade?.();
      return true;
    }

    const durationSeconds = Math.max(0.001, durationMs / 1000);
    const curve = smoothFadeCurve(startVolume, clampedTarget);
    sourceGain.gain.setValueCurveAtTime(curve, now, durationSeconds);
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null;
      const finishedAt = context.currentTime;
      sourceGain.gain.cancelScheduledValues(finishedAt);
      sourceGain.gain.setValueAtTime(clampedTarget, finishedAt);
      afterFade?.();
    }, durationMs + 25);
    return true;
  }

  function smoothFadeCurve(startVolume: number, targetVolume: number) {
    const curve = new Float32Array(64);
    for (let index = 0; index < curve.length; index += 1) {
      const progress = index / (curve.length - 1);
      const eased = smoothFadeProgress(progress);
      curve[index] = startVolume + (targetVolume - startVolume) * eased;
    }
    return curve;
  }

  function cancelWebSourceGainAutomation(gainRef: MutableRefObject<GainNode | null>) {
    const sourceGain = gainRef.current;
    if (!sourceGain) {
      return;
    }
    holdAudioParam(sourceGain.gain, sourceGain.context.currentTime);
  }

  function cancelVisualizerLoop() {
    if (visualizerFrameRef.current !== null) {
      window.cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      cancelFade();
      cancelNativeFade();
      cancelCrossfade();
      clearArtworkPreviewTimer();
      cancelVisualizerLoop();
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
      setWebSourceGain(audioRef.current, currentSourceGainRef, outputVolume);
      setWebSourceGain(nextAudioRef.current, nextSourceGainRef, 0);
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
    if (!canPreloadNextTrack) {
      nextAudioRef.current?.pause();
      return;
    }
    const audio = nextAudioRef.current;
    if (audio) {
      audio.load();
    }
  }, [canPreloadNextTrack, preloadedNextTrack?.id]);

  useEffect(() => {
    if (useNativePlayback) {
      return;
    }
    ensureWebAudioGraph();
  }, [
    useNativePlayback,
    activeSourceKey,
    preloadedNextTrack?.id,
    equalizerEnabled,
    equalizerBandMode,
    equalizerPreampDb,
    equalizerGains,
    dspLimiterEnabled,
    replayGain,
  ]);

  useEffect(() => {
    if (!useNativePlayback) {
      return;
    }
    void nativeSetDsp(currentNativeDspSettings()).catch(() => {
      // Browser preview and older installed builds may not expose the native DSP command.
    });
  }, [
    useNativePlayback,
    equalizerEnabled,
    equalizerBandMode,
    equalizerPreampDb,
    equalizerGains,
    dspLimiterEnabled,
    replayGain,
  ]);

  useEffect(() => {
    emitVisualizerState(false);
    cancelVisualizerLoop();
    if (!isPlaying || visualizerTrackId === null) {
      return;
    }
    if (useNativePlayback) {
      if (!currentTrack) {
        return;
      }
      let nativeVisualizerInFlight = false;
      const tick = (timestamp: number) => {
        if (!nativeVisualizerInFlight && timestamp - visualizerLastEmitRef.current >= 33) {
          nativeVisualizerInFlight = true;
          void nativeVisualizerFrame()
            .then((frame) => {
              emitVisualizerFrame({
                trackId: currentTrack.id,
                isPlaying,
                isLive: frame.is_live,
                level: frame.level,
                frequencyBins: frame.frequency_bins,
                waveform: frame.waveform,
                timestamp,
              });
              visualizerLastEmitRef.current = timestamp;
            })
            .catch(() => {
              emitVisualizerState(false);
              visualizerLastEmitRef.current = timestamp;
            })
            .finally(() => {
              nativeVisualizerInFlight = false;
            });
        }
        visualizerFrameRef.current = window.requestAnimationFrame(tick);
      };

      visualizerFrameRef.current = window.requestAnimationFrame(tick);
      return cancelVisualizerLoop;
    }

    ensureWebAudioGraph();
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const waveformData = new Uint8Array(analyser.fftSize);
    const binCount = 48;
    const waveCount = 96;

    const tick = (timestamp: number) => {
      if (timestamp - visualizerLastEmitRef.current >= 33) {
        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(waveformData);
        const frequencyBins = Array.from({ length: binCount }, (_, index) => {
          const start = Math.floor((index / binCount) * frequencyData.length);
          const end = Math.max(start + 1, Math.floor(((index + 1) / binCount) * frequencyData.length));
          let sum = 0;
          for (let cursor = start; cursor < end; cursor += 1) {
            sum += frequencyData[cursor] ?? 0;
          }
          return sum / (end - start) / 255;
        });
        const waveform = Array.from({ length: waveCount }, (_, index) => {
          const sourceIndex = Math.floor((index / waveCount) * waveformData.length);
          return ((waveformData[sourceIndex] ?? 128) - 128) / 128;
        });
        const level = frequencyBins.reduce((sum, value) => sum + value, 0) / Math.max(1, frequencyBins.length);
        emitVisualizerFrame({
          trackId: visualizerTrackId,
          isPlaying,
          isLive: true,
          level,
          frequencyBins,
          waveform,
          timestamp,
        });
        visualizerLastEmitRef.current = timestamp;
      }
      visualizerFrameRef.current = window.requestAnimationFrame(tick);
    };

    visualizerFrameRef.current = window.requestAnimationFrame(tick);
    return cancelVisualizerLoop;
  }, [useNativePlayback, isPlaying, visualizerTrackId, equalizerEnabled, equalizerBandMode, dspLimiterEnabled, replayGain]);

  function cancelFade() {
    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    cancelWebSourceGainAutomation(currentSourceGainRef);
  }

  function cancelNativeFade() {
    if (nativeFadeTimerRef.current !== null) {
      window.clearTimeout(nativeFadeTimerRef.current);
      nativeFadeTimerRef.current = null;
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

  function hardStopWebAudioElement(element: HTMLAudioElement | null) {
    if (!element) {
      return;
    }
    suppressWebPlaybackErrorsUntilRef.current = window.performance.now() + 1500;
    try {
      element.pause();
      element.removeAttribute("src");
      element.load();
    } catch {
      // Media teardown is best-effort; the next source render will recover.
    }
  }

  function clearArtworkPreviewTimer() {
    if (artworkPreviewTimerRef.current !== null) {
      window.clearTimeout(artworkPreviewTimerRef.current);
      artworkPreviewTimerRef.current = null;
    }
  }

  function scheduleArtworkPreview() {
    if (!artworkSrc) {
      return;
    }
    clearArtworkPreviewTimer();
    artworkPreviewTimerRef.current = window.setTimeout(() => {
      setShowArtworkPreview(true);
      artworkPreviewTimerRef.current = null;
    }, 1050);
  }

  function hideArtworkPreview() {
    clearArtworkPreviewTimer();
    setShowArtworkPreview(false);
  }

  function fadeVolume(targetVolume: number, durationMs: number, afterFade?: () => void) {
    const audio = audioRef.current;
    if (!audio) {
      afterFade?.();
      return;
    }
    if (fadeWebSourceGain(audio, currentSourceGainRef, targetVolume, durationMs, afterFade)) {
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
      const eased = smoothFadeProgress(progress);
      audio.volume = startVolume + (clampedTarget - startVolume) * eased;
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
    const prepareFade =
      typeof startVolumeOverride === "number"
        ? nativeSetVolume(clampNumber(startVolumeOverride, 0, 1.5))
        : Promise.resolve();
    void prepareFade
      .then(() => nativeFadeVolumeCommand(clampedTarget, durationMs))
      .catch(() => nativeSetVolume(clampedTarget))
      .catch(() => {
        // Keep the UI responsive even if the native engine is unavailable.
      });
    nativeFadeTimerRef.current = window.setTimeout(() => {
      nativeFadeTimerRef.current = null;
      afterFade?.();
    }, durationMs + 25);
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
        dspSettings: currentNativeDspSettings(),
      });
      nativeLoadedTrackIdRef.current = track.id;
      nativeEndedTrackIdRef.current = null;
      lastNativeStreamErrorRef.current = null;
      setDuration(status.duration_seconds ?? track.duration_seconds ?? 0);
      setCurrentTime(status.position_seconds);
      onPlaybackTime(status.position_seconds);
      pendingResumePositionRef.current = null;
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

  async function startNativeCrossfade(
    nextTrack: Track,
    recordCompletion = true,
    nextQueue: Track[] = queue,
    commitSelection = true,
  ): Promise<boolean> {
    if (!currentTrack || trackNeedsWebPlayback(nextTrack) || crossfadeTrackRef.current === currentTrack.id) {
      return false;
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
        dspSettings: nativeDspSettingsForTrack(nextTrack),
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
      if (commitSelection) {
        onSelectTrack(nextTrack, nextQueue, { suppressExitRecord: true });
      }
      return true;
    } catch (error) {
      crossfadeTrackRef.current = null;
      setStatus(error instanceof Error ? error.message : "Native crossfade could not start.");
      return false;
    }
  }

  async function resumeNativeWithFade() {
    if (!currentTrack) {
      return;
    }
    if (nativeLoadedTrackIdRef.current !== currentTrack.id || nativeEndedTrackIdRef.current === currentTrack.id) {
      await startNativeTrack(currentTrack, currentTime);
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

  function createWebCrossfadeElement(track: Track) {
    const audio = document.createElement("audio");
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.src = trackAudioSourceUrl(track);
    audio.load();
    return audio;
  }

  function webCrossfadeSourceFor(track: Track) {
    return preloadedNextTrack?.id === track.id && nextAudioRef.current
      ? nextAudioRef.current
      : createWebCrossfadeElement(track);
  }

  async function startCrossfade(
    nextTrack: Track,
    options: {
      nextQueue?: Track[];
      recordCompletion?: boolean;
      commitSelection?: boolean;
      onCommit?: () => void;
      sourceElement?: HTMLAudioElement | null;
    } = {},
  ): Promise<boolean> {
    const {
      nextQueue = queue,
      recordCompletion = true,
      commitSelection = true,
      onCommit,
      sourceElement = nextAudioRef.current,
    } = options;
    const currentAudio = audioRef.current;
    const nextAudio = sourceElement;
    if (!currentTrack || !currentAudio || !nextAudio || currentAudio.paused || crossfadeTrackRef.current === currentTrack.id) {
      return false;
    }

    crossfadeTrackRef.current = currentTrack.id;
    cancelFade();
    cancelCrossfade();
    crossfadeSourceRef.current = nextAudio;
    ensureWebAudioGraph();
    if (nextAudio !== nextAudioRef.current && dspInputRef.current) {
      connectMediaElementSource(nextAudio, nextSourceRef, nextSourceElementRef, nextSourceGainRef, dspInputRef.current, 0);
      updateDspSettings();
    }
    setWebSourceGain(currentAudio, currentSourceGainRef, outputVolume);
    setWebSourceGain(nextAudio, nextSourceGainRef, 0);

    try {
      nextAudio.currentTime = 0;
      await resumeWebAudioGraph();
      await nextAudio.play();
    } catch {
      crossfadeTrackRef.current = null;
      return false;
    }

    const finishCrossfade = () => {
      handoffRef.current = { trackId: nextTrack.id, currentTime: nextAudio.currentTime };
      suppressWebPauseUntilRef.current = window.performance.now() + 1200;
      currentAudio.pause();
      setIsPlaying(true);
      setWebSourceGain(currentAudio, currentSourceGainRef, outputVolume);
      if (recordCompletion) {
        void onTrackEnded(currentTrack.id);
      }
      handoffSourceRef.current = nextAudio;
      if (onCommit) {
        onCommit();
      } else if (commitSelection) {
        onSelectTrack(nextTrack, nextQueue, { suppressExitRecord: true });
      }
      window.setTimeout(() => {
        if (handoffSourceRef.current === nextAudio && nextAudio !== audioRef.current) {
          rampWebGainNode(nextAudio, handoffSourceGainRef.current ?? nextSourceGainRef.current, outputVolume, 0, WEB_HANDOFF_FADE_MS, () => {
            nextAudio.pause();
            setWebSourceGain(nextAudio, nextSourceGainRef, 0);
          });
          handoffSourceGainRef.current = null;
          handoffSourceRef.current = null;
        }
      }, 1200);
      crossfadeSourceRef.current = null;
    };

    const durationMs = Math.max(120, fadeMs);
    const currentGain = currentSourceGainRef.current;
    const nextGain = nextSourceGainRef.current;
    if (currentGain && nextGain && currentGain.context === nextGain.context) {
      const context = currentGain.context;
      const now = context.currentTime;
      holdAudioParam(currentGain.gain, now);
      holdAudioParam(nextGain.gain, now);
      const durationSeconds = Math.max(0.001, durationMs / 1000);
      currentGain.gain.setValueCurveAtTime(
        smoothFadeCurve(clampNumber(currentGain.gain.value, 0, 1), 0),
        now,
        durationSeconds,
      );
      nextGain.gain.setValueCurveAtTime(
        smoothFadeCurve(clampNumber(nextGain.gain.value, 0, 1), outputVolume),
        now,
        durationSeconds,
      );
      crossfadeTimerRef.current = window.setTimeout(() => {
        crossfadeTimerRef.current = null;
        const finishedAt = context.currentTime;
        currentGain.gain.cancelScheduledValues(finishedAt);
        nextGain.gain.cancelScheduledValues(finishedAt);
        currentGain.gain.setValueAtTime(0, finishedAt);
        nextGain.gain.setValueAtTime(outputVolume, finishedAt);
        handoffSourceGainRef.current = nextGain;
        finishCrossfade();
      }, durationMs + 25);
      return true;
    }

    setWebSourceGain(currentAudio, currentSourceGainRef, 1);
    setWebSourceGain(nextAudio, nextSourceGainRef, 1);
    currentAudio.volume = outputVolume;
    nextAudio.volume = 0;
    const startedAt = window.performance.now();
    crossfadeTimerRef.current = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = smoothFadeProgress(progress);
      currentAudio.volume = Math.max(0, outputVolume * (1 - eased));
      nextAudio.volume = Math.min(outputVolume, outputVolume * eased);

      if (progress >= 1) {
        if (crossfadeTimerRef.current !== null) {
          window.clearInterval(crossfadeTimerRef.current);
          crossfadeTimerRef.current = null;
        }
        currentAudio.volume = outputVolume;
        handoffSourceGainRef.current = null;
        finishCrossfade();
      }
    }, 16);
    return true;
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
    const requestedSourceKey = activeSourceKey;
    cancelFade();
    if (pendingResumePositionRef.current !== null && audio.currentTime < 1) {
      applyPendingResumeToAudio();
    }
    ensureWebAudioGraph();
    setWebSourceGain(audio, currentSourceGainRef, 0);
    try {
      await resumeWebAudioGraph();
      await audio.play();
      setIsPlaying(true);
      fadeVolume(outputVolume, fadeMs);
    } catch (error: unknown) {
      const isStaleAttempt = activeSourceKeyRef.current !== requestedSourceKey;
      const isSuppressedTeardownError = window.performance.now() < suppressWebPlaybackErrorsUntilRef.current;
      const isIntentionalCdAbort = isCdPreviewTrack && error instanceof DOMException && error.name === "AbortError";
      if (isStaleAttempt || isSuppressedTeardownError || isIntentionalCdAbort) {
        return;
      }
      setWebSourceGain(audio, currentSourceGainRef, outputVolume);
      if (audio.error) {
        setStatus(isRadioSource ? "Radio stream could not be loaded." : "Audio source failed to load. Restart the app if the backend was updated recently.");
        return;
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setStatus(isRadioSource ? "Press play to start the radio stream." : "Press play to start playback.");
        return;
      }
      setStatus(isRadioSource ? "Radio stream could not start." : "Playback could not start for this file.");
    }
  }

  function pauseWithFade() {
    if (useNativePlayback) {
      fadeNativeVolume(0, fadeMs, () => {
        void nativePause()
          .then(() => {
            setIsPlaying(false);
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
      setIsPlaying(false);
    });
  }

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
      cancelFade();
      const audio = audioRef.current;
      hardStopWebAudioElement(audio);
      commitTrackRequest();
      return;
    }

    if (!hasPlayableSource || !isPlaying || trackSwitchFadeMs <= 0) {
      if (useNativePlayback) {
        void nativeStop().finally(commitTrackRequest);
        return;
      }
      commitTrackRequest();
      return;
    }

    if (useNativePlayback) {
      if (trackNeedsWebPlayback(externalTrackRequest.track)) {
        void recordCurrentTrackExit();
        fadeNativeVolume(0, trackSwitchFadeMs, () => {
          void nativeStop().finally(() => commitTrackRequest({ suppressExitRecord: true }));
        });
        return;
      }
      if (isPlaying && trackSwitchFadeMs > 0) {
        void recordCurrentTrackExit();
        void startNativeCrossfade(externalTrackRequest.track, false, externalTrackRequest.queue, false).then((started) => {
          if (started) {
            commitTrackRequest({ suppressExitRecord: true });
            return;
          }
          fadeNativeVolume(0, trackSwitchFadeMs, () => {
            void nativeStop().finally(() => commitTrackRequest({ suppressExitRecord: true }));
          });
        });
        return;
      }
      fadeNativeVolume(0, trackSwitchFadeMs, () => {
        void nativeStop().finally(commitTrackRequest);
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
    nativeEndedTrackIdRef.current = null;
    pendingResumePositionRef.current = null;

    if (!hasPlayableSource) {
      if (useNativePlayback) {
        nativeLoadedTrackIdRef.current = null;
        void nativeStop().catch(() => {
          // Native playback may not be available in browser preview.
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
  }, [activeSourceKey, radioPlaybackRequestId, autoPlay, useNativePlayback]);

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
    if (!useNativePlayback && audio) {
      applyPendingResumeToAudio();
    } else if (useNativePlayback && nativeLoadedTrackIdRef.current === currentTrack.id) {
      void nativeSeek(boundedTime).catch(() => {
        // A restored position can still be used when playback starts.
      });
      pendingResumePositionRef.current = null;
    }

    onResumePositionApplied();
  }, [currentTrack?.id, resumePositionSeconds, useNativePlayback]);

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
    if (!audio || !hasPlayableSource) {
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
      const audio = audioRef.current;
      if (recordExit) {
        void recordCurrentTrackExit();
      }
      cancelCrossfade();
      crossfadeTrackRef.current = null;
      nextAudioRef.current?.pause();
      if (isCdPreviewTrack) {
        cancelFade();
        hardStopWebAudioElement(audio);
        setIsPlaying(false);
        onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
        return;
      }
      if (useNativePlayback) {
        if (trackNeedsWebPlayback(nextTrack)) {
          fadeNativeVolume(0, trackSwitchFadeMs, () => {
            void nativeStop().finally(() => {
              onSelectTrack(nextTrack, queue, { suppressExitRecord: true });
            });
          });
          return;
        }
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
    const crossfadeLeadSeconds = Math.max(0.12, fadeMs / 1000);
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
        const waitingForNativeResume =
          pendingResumePositionRef.current !== null &&
          Boolean(currentTrack) &&
          nativeLoadedTrackIdRef.current !== currentTrack?.id &&
          !status.is_playing;
        if (!waitingForNativeResume) {
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
        if (latestStreamError && latestStreamError !== lastNativeStreamErrorRef.current) {
          lastNativeStreamErrorRef.current = latestStreamError;
          setStatus(latestStreamError);
        }
        const nativeDuration = status.duration_seconds ?? currentTrack?.duration_seconds ?? 0;
        const nativeCrossfadeLeadSeconds = Math.max(0.12, fadeMs / 1000);
        if (
          currentTrack &&
          preloadedNextTrack &&
          canPreloadNextTrack &&
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
  }, [useNativePlayback, currentTrack?.id, playbackMode, currentIndex, queue, fadeMs, preloadedNextTrack?.id, canPreloadNextTrack, outputVolume]);

  useEffect(() => {
    if (!useNativePlayback || !preloadedNextTrack || !canPreloadNextTrack || playbackMode === "stopAfterCurrent") {
      return;
    }
    void nativePrepareNextFile(preloadedNextTrack.path).catch(() => {
      // Preparation failures are recorded by the native diagnostics panel.
    });
  }, [useNativePlayback, preloadedNextTrack?.id, preloadedNextTrack?.path, canPreloadNextTrack, playbackMode]);

  const artworkSrc =
    currentTrack && !isRadioSource && !isPreviewTrack && !artworkFailed
      ? albumArtworkUrl(currentTrack.id, currentTrack.file_modified_at)
      : null;
  const hasCurrentArtist = Boolean(currentTrack?.artist?.trim());
  const currentAlbumLabel = displayAlbumForTrack(currentTrack);
  const hasCurrentAlbum = Boolean(currentAlbumLabel);
  const isCurrentPodcast = Boolean(currentTrack?.genre?.toLowerCase().includes("podcast"));
  const currentArtistLabel = display(currentTrack?.artist, isCurrentPodcast ? "Podcast" : "Unknown artist");
  const playerTitle = currentRadioStation ? display(currentRadioStation.name, "Radio stream") : currentTrack ? display(currentTrack.title, "Untitled") : "Nothing playing";

  useEffect(() => {
    hideArtworkPreview();
  }, [artworkSrc]);

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
      if (hasPlayableSource && !isPlaying) {
        void playWithFade();
      }
      return;
    }
    if (payload.command === "pause") {
      if (hasPlayableSource && isPlaying) {
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

      const isPlainArrowSeek =
        hasPlayableSource &&
        !isRadioSource &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight");

      if (isPlainArrowSeek) {
        event.preventDefault();
        seekTo(currentTime + (event.key === "ArrowRight" ? 5 : -5));
        return;
      }

      if (event.key === "MediaPlayPause" || shortcutMatchesEvent(keyboardShortcuts["playback.playPause"], event)) {
        if (event.repeat || !hasPlayableSource) {
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
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.repeatCycle"], event)) {
        event.preventDefault();
        cycleRepeatMode();
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.repeatQueue"], event)) {
        event.preventDefault();
        setPlaybackMode(playbackMode === "repeatQueue" ? "normal" : "repeatQueue");
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.repeatOne"], event)) {
        event.preventDefault();
        setPlaybackMode(playbackMode === "repeatOne" ? "normal" : "repeatOne");
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.stopAfterCurrent"], event)) {
        event.preventDefault();
        toggleStopAfterCurrent();
      }
    }

    window.addEventListener("keydown", handleLocalAudioKeyDown);
    return () => window.removeEventListener("keydown", handleLocalAudioKeyDown);
  }, [currentTrack, currentRadioStation, currentTime, volume, muted, hasPrevious, hasNext, queue, currentIndex, outputVolume, keyboardShortcuts, playbackMode]);

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
                key={artworkSrc}
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
            disabled={!hasPlayableSource}
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
        </div>

        {!useNativePlayback && webAudioSourceUrl ? (
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
        ) : !useNativePlayback ? (
          <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
        ) : null}
        {!useNativePlayback && preloadedNextTrack && canPreloadNextTrack && (
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
