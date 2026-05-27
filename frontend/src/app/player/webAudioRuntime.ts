import type { MutableRefObject } from "react";

import type { desktopDspSettings } from "../../lib/desktopPlayback";
import type { Track } from "../../types/api";
import {
  VISUALIZER_FRAME_EVENT,
  VisualizerFrame,
  clampNumber,
  dbToGain,
  equalizerFrequenciesForMode,
  normalizeEqualizerGains,
} from "../shared";

const WEB_HANDOFF_FADE_MS = 90;

export function createWebAudioRuntime(ctx: any) {
  const {
    replayGainForTrack, equalizerEnabled, equalizerBandMode, equalizerPreampDb, equalizerGains, dspLimiterEnabled, currentTrack, isPlaying, usePlayback, outputVolume, replayGain, smoothFadeProgress, cancelFade,
    audioRef, nextAudioRef, audioContextRef, currentSourceRef, currentSourceElementRef, nextSourceRef, nextSourceElementRef, currentSourceGainRef, nextSourceGainRef, dspInputRef, dspNormalizationRef, dspPreampRef, dspFiltersRef, dspCompressorRef, analyserRef, dspModeRef, dspLimiterRef, handoffSourceRef, handoffSourceGainRef, fadeTimerRef, visualizerFrameRef,
  } = ctx;

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
    if (usePlayback) {
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

  return {
    desktopDspSettingsForTrack, currentPlaybackDspSettings, disconnectAudioNode, ensureAudioContext, connectMediaElementSource, rebuildDspTail, ensureWebAudioGraph, updateDspSettings, resumeWebAudioGraph, emitVisualizerFrame, emitVisualizerState, holdAudioParam, setWebSourceGain, rampHtmlAudioVolume, rampWebGainNode, finishWebHandoffToMain, fadeWebSourceGain, smoothFadeCurve, cancelWebSourceGainAutomation, cancelVisualizerLoop,
  };
}
