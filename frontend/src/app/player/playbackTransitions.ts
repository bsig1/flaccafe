import {
desktopCrossfadeToSource,
desktopFadeVolume as desktopFadeVolumeCommand,
desktopPause,
desktopPlaySource,
desktopResume,
desktopSetVolume,
} from "../../lib/desktopPlayback";
import type { Track } from "../../types/api";
import { clampNumber } from "../shared";

const CD_SKIP_SETTLE_SECONDS = 1.15;

export function createPlaybackTransitions(ctx: any) {
  const {
    crossfadeTrackRef,
    pendingResumePositionRef,
    desktopLoadedTrackIdRef,
    desktopEndedTrackIdRef,
    lastPlaybackStreamErrorRef,
    artworkPreviewTimerRef,
    desktopFadeTimerRef,
    currentTrack,
    currentRadioStation,
    currentTime,
    isPlaying,
    isCdPreviewTrack,
    outputVolume,
    fadeMs,
    radioFadeMs,
    desktopOutputBackend,
    desktopOutputDeviceId,
    desktopBufferFrames,
    queue,
    playbackSourceForTrack,
    playbackSourceForRadio,
    getArtworkSrc,
    setShowArtworkPreview,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    setStatus,
    onPlaybackTime,
    onTrackEnded,
    onSelectTrack,
    cancelPlaybackFade,
    cancelCrossfade,
    suppressDesktopEarlyEndWarning,
    currentPlaybackDspSettings,
    desktopDspSettingsForTrack,
  } = ctx;

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
    return isCdPreviewTrack && isPlaying && currentTime < CD_SKIP_SETTLE_SECONDS;
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

  async function startPlaybackTrack(track: Track, startSeconds = 0, fadeDurationMs = fadeMs) {
    cancelPlaybackFade();
    cancelCrossfade();
    const startVolume = fadeDurationMs > 0 ? 0 : outputVolume;
    try {
      const status = await desktopPlaySource({
        source: playbackSourceForTrack(track),
        volume: startVolume,
        startSeconds,
        outputBackend: desktopOutputBackend,
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
      if (fadeDurationMs > 0) {
        fadePlaybackVolume(outputVolume, fadeDurationMs, undefined, 0);
      }
    } catch (error) {
      if (desktopOutputBackend === "wasapiExclusive") {
        try {
          const status = await desktopPlaySource({
            source: playbackSourceForTrack(track),
            volume: startVolume,
            startSeconds,
            outputBackend: "cpalShared",
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
          setStatus("WASAPI exclusive stopped; continuing with shared Rust output.");
          if (fadeDurationMs > 0) {
            fadePlaybackVolume(outputVolume, fadeDurationMs, undefined, 0);
          }
          return;
        } catch {
          // Report the original WASAPI failure below; the fallback was best effort.
        }
      }
      setIsPlaying(false);
      desktopLoadedTrackIdRef.current = null;
      setStatus(error instanceof Error ? error.message : "Rust playback could not start for this source.");
    }
  }

  async function startPlaybackCrossfade(
    nextTrack: Track,
    recordCompletion = true,
    nextQueue: Track[] = queue,
    commitSelection = true,
    fadeDurationMs = fadeMs,
  ): Promise<boolean> {
    const safeFadeDurationMs = Math.max(0, fadeDurationMs);
    if (!currentTrack || safeFadeDurationMs <= 0 || crossfadeTrackRef.current === currentTrack.id) {
      return false;
    }
    crossfadeTrackRef.current = currentTrack.id;
    cancelPlaybackFade();
    try {
      const status = await desktopCrossfadeToSource({
        source: playbackSourceForTrack(nextTrack),
        volume: outputVolume,
        durationMs: safeFadeDurationMs,
        outputBackend: desktopOutputBackend,
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
    if (!currentTrack && !currentRadioStation) {
      return;
    }
    if (!currentTrack && currentRadioStation) {
      const fadeDurationMs = Math.max(0, radioFadeMs ?? fadeMs);
      cancelPlaybackFade();
      cancelCrossfade();
      try {
        const status = await desktopPlaySource({
          source: playbackSourceForRadio(currentRadioStation),
          volume: fadeDurationMs > 0 ? 0 : outputVolume,
          outputBackend: desktopOutputBackend,
          deviceId: desktopOutputDeviceId,
          bufferFrames: desktopBufferFrames,
          dspSettings: currentPlaybackDspSettings(),
        });
        desktopLoadedTrackIdRef.current = -currentRadioStation.id;
        desktopEndedTrackIdRef.current = null;
        lastPlaybackStreamErrorRef.current = null;
        setDuration(0);
        setCurrentTime(status.position_seconds);
        onPlaybackTime(status.position_seconds);
        pendingResumePositionRef.current = null;
        setIsPlaying(true);
        if (fadeDurationMs > 0) {
          fadePlaybackVolume(outputVolume, fadeDurationMs, undefined, 0);
        }
      } catch (error) {
        setIsPlaying(false);
        desktopLoadedTrackIdRef.current = null;
        setStatus(error instanceof Error ? error.message : "Rust radio playback could not start.");
      }
      return;
    }
    const restartingEndedTrack = desktopEndedTrackIdRef.current === currentTrack.id;
    if (desktopLoadedTrackIdRef.current !== currentTrack.id || restartingEndedTrack) {
      await startPlaybackTrack(
        currentTrack,
        restartingEndedTrack ? 0 : pendingResumePositionRef.current ?? currentTime,
      );
      return;
    }
    try {
      const fadeDurationMs = Math.max(0, fadeMs);
      cancelPlaybackFade();
      await desktopSetVolume(fadeDurationMs > 0 ? 0 : outputVolume);
      await desktopResume();
      setIsPlaying(true);
      if (fadeDurationMs > 0) {
        fadePlaybackVolume(outputVolume, fadeDurationMs, undefined, 0);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rust playback could not resume.");
    }
  }

  async function playWithFade() {
    await resumePlaybackWithFade();
  }

  function pauseWithFade() {
    const fadeDurationMs = Math.max(0, currentRadioStation ? radioFadeMs ?? fadeMs : fadeMs);
    fadePlaybackVolume(0, fadeDurationMs, () => {
      void desktopPause()
        .then(() => {
          setIsPlaying(false);
        })
        .catch((error) => {
          setStatus(error instanceof Error ? error.message : "Rust playback could not pause.");
        });
    });
  }

  return {
    clearArtworkPreviewTimer,
    scheduleArtworkPreview,
    hideArtworkPreview,
    cdStreamIsSettling,
    fadePlaybackVolume,
    startPlaybackTrack,
    startPlaybackCrossfade,
    resumePlaybackWithFade,
    playWithFade,
    pauseWithFade,
  };
}
