import { useEffect } from "react";

import {
  desktopSetDsp,
  desktopSetVolume,
  desktopStop,
  desktopVisualizerFrame,
} from "../../lib/desktopPlayback";
import {
  MiniPlayerCommand,
  miniPlayerChannelName,
  writeStoredAudioControls,
} from "../shared";

export function usePlayerBarAudioEffects(ctx: any) {
  const {
    cancelFade, cancelPlaybackFade, cancelCrossfade, clearArtworkPreviewTimer, cancelVisualizerLoop, miniPlayerChannelRef, audioContextRef, volume, muted, usePlayback, desktopFadeTimerRef, outputVolume, fadeTimerRef, crossfadeTimerRef, audioRef, currentSourceGainRef, nextAudioRef, nextSourceGainRef, desktopLoadedTrackIdRef, desktopEndedTrackIdRef, miniPlayerCommandRef, canPreloadNextTrack, preloadedNextTrack, ensureWebAudioGraph, activeSourceKey, equalizerEnabled, equalizerBandMode, equalizerPreampDb, equalizerGains, dspLimiterEnabled, replayGain, currentPlaybackDspSettings, emitVisualizerState, isPlaying, visualizerTrackId, currentTrack, visualizerLastEmitRef, emitVisualizerFrame, visualizerFrameRef, analyserRef, setWebSourceGain,
  } = ctx;

  useEffect(() => {
    return () => {
      cancelFade();
      cancelPlaybackFade();
      cancelCrossfade();
      clearArtworkPreviewTimer();
      cancelVisualizerLoop();
      miniPlayerChannelRef.current?.close();
      void audioContextRef.current?.close().catch(() => {
        // Closing the graph is best-effort during app teardown.
      });
      void desktopStop().catch(() => {
        // Rust playback is best-effort during shutdown.
      });
    };
  }, []);

  useEffect(() => {
    writeStoredAudioControls(volume, muted);
    if (usePlayback) {
      if (desktopFadeTimerRef.current === null) {
        void desktopSetVolume(outputVolume).catch(() => {
          // The Rust audio engine may be unavailable in browser preview.
        });
      }
      return;
    }
    if (fadeTimerRef.current === null && crossfadeTimerRef.current === null) {
      setWebSourceGain(audioRef.current, currentSourceGainRef, outputVolume);
      setWebSourceGain(nextAudioRef.current, nextSourceGainRef, 0);
    }
  }, [volume, muted, outputVolume, usePlayback]);

  useEffect(() => {
    if (usePlayback) {
      audioRef.current?.pause();
      return;
    }
    desktopLoadedTrackIdRef.current = null;
    desktopEndedTrackIdRef.current = null;
    void desktopStop().catch(() => {
      // The command is not available in a plain Vite browser preview.
    });
  }, [usePlayback]);

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
    if (usePlayback) {
      return;
    }
    ensureWebAudioGraph();
  }, [
    usePlayback,
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
    if (!usePlayback) {
      return;
    }
    void desktopSetDsp(currentPlaybackDspSettings()).catch(() => {
      // Browser preview and older installed builds may not expose the Rust DSP command.
    });
  }, [
    usePlayback,
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
    if (usePlayback) {
      if (!currentTrack) {
        return;
      }
      let desktopVisualizerInFlight = false;
      const tick = (timestamp: number) => {
        if (!desktopVisualizerInFlight && timestamp - visualizerLastEmitRef.current >= 33) {
          desktopVisualizerInFlight = true;
          void desktopVisualizerFrame()
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
              desktopVisualizerInFlight = false;
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
  }, [usePlayback, isPlaying, visualizerTrackId, equalizerEnabled, equalizerBandMode, dspLimiterEnabled, replayGain]);
}
