import {
  desktopCrossfadeToFile,
  desktopFadeVolume as desktopFadeVolumeCommand,
  desktopPause,
  desktopPlayFile,
  desktopResume,
  desktopSetVolume,
} from "../../lib/desktopPlayback";
import type { Track } from "../../types/api";
import { clampNumber } from "../shared";

const WEB_HANDOFF_FADE_MS = 90;
const WEB_HANDOFF_FALLBACK_MS = 650;
const WEB_HANDOFF_SUPPRESS_MS = 650;
const WEB_CROSSFADE_MIN_MS = 80;
const WEB_CROSSFADE_MAX_MS = 900;
const CD_SKIP_SETTLE_SECONDS = 1.15;

export function webCrossfadeDurationMs(fadeMs: number) {
  const requested = Math.max(0, fadeMs);
  return requested > 0 ? Math.max(WEB_CROSSFADE_MIN_MS, Math.min(requested, WEB_CROSSFADE_MAX_MS)) : 0;
}

export function createPlaybackTransitions(ctx: any) {
  const {
    audioRef, nextAudioRef, currentSourceGainRef, nextSourceGainRef, crossfadeSourceRef, crossfadeTrackRef, handoffRef, handoffSourceRef, handoffSourceGainRef, pendingResumePositionRef, desktopLoadedTrackIdRef, desktopEndedTrackIdRef, lastPlaybackStreamErrorRef, suppressWebPlaybackErrorsUntilRef, suppressWebPauseUntilRef, artworkPreviewTimerRef, fadeTimerRef, dspInputRef, currentSourceRef, currentSourceElementRef, nextSourceRef, nextSourceElementRef, desktopFadeTimerRef, crossfadeTimerRef,
    currentTrack, currentTime, isPlaying, isCdPreviewTrack, usePlayback, outputVolume, fadeMs, desktopOutputDeviceId, desktopBufferFrames, queue, preloadedNextTrack, activeSourceKey, activeSourceKeyRef, isRadioSource, getArtworkSrc, setShowArtworkPreview, setDuration, setCurrentTime, setIsPlaying, setStatus, onPlaybackTime, onTrackEnded, onSelectTrack, trackNeedsWebPlayback, trackAudioSourceUrl, applyPendingResumeToAudio, cancelFade, cancelPlaybackFade, cancelCrossfade, smoothFadeProgress, suppressDesktopEarlyEndWarning, currentPlaybackDspSettings, desktopDspSettingsForTrack, fadeWebSourceGain, setWebSourceGain, cancelWebSourceGainAutomation, ensureWebAudioGraph, connectMediaElementSource, updateDspSettings, resumeWebAudioGraph, rampWebGainNode, smoothFadeCurve, holdAudioParam,
  } = ctx;

  function pauseWebAudioForPreviewSwitch(element: HTMLAudioElement | null) {
    cancelFade();
    suppressWebPlaybackErrorsUntilRef.current = window.performance.now() + 1500;
    suppressWebPauseUntilRef.current = window.performance.now() + 1200;
    if (!element) {
      return;
    }
    try {
      element.pause();
      setWebSourceGain(element, currentSourceGainRef, 0);
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
    if (!getArtworkSrc()) {
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

  function cdStreamIsSettling() {
    if (!isCdPreviewTrack || !isPlaying) {
      return false;
    }
    const audioTime = audioRef.current?.currentTime;
    const playbackSeconds = typeof audioTime === "number" && Number.isFinite(audioTime) ? audioTime : currentTime;
    return playbackSeconds < CD_SKIP_SETTLE_SECONDS;
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

  function fadePlaybackVolume(targetVolume: number, durationMs: number, afterFade?: () => void, startVolumeOverride?: number) {
    cancelPlaybackFade();
    if (targetVolume <= 0) {
      suppressDesktopEarlyEndWarning?.();
    }
    const clampedTarget = clampNumber(targetVolume, 0, 1.5);
    if (durationMs <= 0) {
      void desktopSetVolume(clampedTarget).finally(() => afterFade?.());
      return;
    }
    const prepareFade =
      typeof startVolumeOverride === "number"
        ? desktopSetVolume(clampNumber(startVolumeOverride, 0, 1.5))
        : Promise.resolve();
    void prepareFade
      .then(() => desktopFadeVolumeCommand(clampedTarget, durationMs))
      .catch(() => desktopSetVolume(clampedTarget))
      .catch(() => {
        // Keep the UI responsive even if the Rust audio engine is unavailable.
      });
    desktopFadeTimerRef.current = window.setTimeout(() => {
      desktopFadeTimerRef.current = null;
      afterFade?.();
    }, durationMs + 25);
  }

  async function startPlaybackTrack(track: Track, startSeconds = 0) {
    cancelPlaybackFade();
    cancelCrossfade();
    const startVolume = fadeMs > 0 ? 0 : outputVolume;
    try {
      const status = await desktopPlayFile({
        path: track.path,
        volume: startVolume,
        startSeconds,
        deviceId: desktopOutputDeviceId,
        bufferFrames: desktopBufferFrames,
        dspSettings: currentPlaybackDspSettings(),
      });
      desktopLoadedTrackIdRef.current = track.id;
      desktopEndedTrackIdRef.current = null;
      lastPlaybackStreamErrorRef.current = null;
      setDuration(status.duration_seconds ?? track.duration_seconds ?? 0);
      setCurrentTime(status.position_seconds);
      onPlaybackTime(status.position_seconds);
      pendingResumePositionRef.current = null;
      setIsPlaying(true);
      if (fadeMs > 0) {
        fadePlaybackVolume(outputVolume, fadeMs, undefined, 0);
      }
    } catch (error) {
      setIsPlaying(false);
      desktopLoadedTrackIdRef.current = null;
      setStatus(error instanceof Error ? error.message : "Rust playback could not start for this file.");
    }
  }

  async function startPlaybackCrossfade(
    nextTrack: Track,
    recordCompletion = true,
    nextQueue: Track[] = queue,
    commitSelection = true,
  ): Promise<boolean> {
    if (!currentTrack || trackNeedsWebPlayback(nextTrack) || crossfadeTrackRef.current === currentTrack.id) {
      return false;
    }
    crossfadeTrackRef.current = currentTrack.id;
    cancelPlaybackFade();
    try {
      const status = await desktopCrossfadeToFile({
        path: nextTrack.path,
        volume: outputVolume,
        durationMs: Math.max(0, fadeMs),
        deviceId: desktopOutputDeviceId,
        bufferFrames: desktopBufferFrames,
        dspSettings: desktopDspSettingsForTrack(nextTrack),
      });
      desktopLoadedTrackIdRef.current = nextTrack.id;
      desktopEndedTrackIdRef.current = null;
      lastPlaybackStreamErrorRef.current = null;
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
      setStatus(error instanceof Error ? error.message : "Rust crossfade could not start.");
      return false;
    }
  }

  async function resumePlaybackWithFade() {
    if (!currentTrack) {
      return;
    }
    const restartingEndedTrack = desktopEndedTrackIdRef.current === currentTrack.id;
    if (desktopLoadedTrackIdRef.current !== currentTrack.id || restartingEndedTrack) {
      await startPlaybackTrack(currentTrack, restartingEndedTrack ? 0 : currentTime);
      return;
    }
    try {
      cancelPlaybackFade();
      await desktopSetVolume(fadeMs > 0 ? 0 : outputVolume);
      await desktopResume();
      setIsPlaying(true);
      if (fadeMs > 0) {
        fadePlaybackVolume(outputVolume, fadeMs, undefined, 0);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rust playback could not resume.");
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
      suppressWebPauseUntilRef.current = window.performance.now() + WEB_HANDOFF_SUPPRESS_MS;
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
      }, WEB_HANDOFF_FALLBACK_MS);
      crossfadeSourceRef.current = null;
    };

    const durationMs = webCrossfadeDurationMs(fadeMs);
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
    if (usePlayback) {
      await resumePlaybackWithFade();
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
    if (usePlayback) {
      fadePlaybackVolume(0, fadeMs, () => {
        void desktopPause()
          .then(() => {
            setIsPlaying(false);
          })
          .catch((error) => {
            setStatus(error instanceof Error ? error.message : "Rust playback could not pause.");
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

  return {
    pauseWebAudioForPreviewSwitch, clearArtworkPreviewTimer, scheduleArtworkPreview, hideArtworkPreview, cdStreamIsSettling, fadeVolume, fadePlaybackVolume, startPlaybackTrack, startPlaybackCrossfade, resumePlaybackWithFade, createWebCrossfadeElement, webCrossfadeSourceFor, startCrossfade, playWithFade, pauseWithFade,
  };
}
