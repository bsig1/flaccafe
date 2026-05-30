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
    cancelPlaybackFade,
    cancelCrossfade,
    clearArtworkPreviewTimer,
    cancelVisualizerLoop,
    miniPlayerChannelRef,
    volume,
    muted,
    desktopFadeTimerRef,
    outputVolume,
    desktopLoadedTrackIdRef,
    desktopEndedTrackIdRef,
    miniPlayerCommandRef,
    equalizerEnabled,
    equalizerBandMode,
    equalizerPreampDb,
    equalizerGains,
    dspLimiterEnabled,
    replayGain,
    currentPlaybackDspSettings,
    emitVisualizerState,
    isPlaying,
    visualizerTrackId,
    visualizerLastEmitRef,
    emitVisualizerFrame,
    visualizerFrameRef,
  } = ctx;

  useEffect(() => {
    return () => {
      cancelPlaybackFade();
      cancelCrossfade();
      clearArtworkPreviewTimer();
      cancelVisualizerLoop();
      miniPlayerChannelRef.current?.close();
      void desktopStop().catch(() => {
        // Rust playback is best-effort during shutdown.
      });
    };
  }, []);

  useEffect(() => {
    writeStoredAudioControls(volume, muted);
    if (desktopFadeTimerRef.current === null) {
      void desktopSetVolume(outputVolume).catch(() => {
        // The Rust audio engine may be unavailable in browser preview.
      });
    }
  }, [volume, muted, outputVolume]);

  useEffect(() => {
    desktopLoadedTrackIdRef.current = null;
    desktopEndedTrackIdRef.current = null;
  }, []);

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
    void desktopSetDsp(currentPlaybackDspSettings()).catch(() => {
      // Browser preview and older installed builds may not expose the Rust DSP command.
    });
  }, [
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

    let desktopVisualizerInFlight = false;
    const tick = (timestamp: number) => {
      if (!desktopVisualizerInFlight && timestamp - visualizerLastEmitRef.current >= 33) {
        desktopVisualizerInFlight = true;
        void desktopVisualizerFrame()
          .then((frame) => {
            emitVisualizerFrame({
              trackId: visualizerTrackId,
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
  }, [isPlaying, visualizerTrackId, equalizerEnabled, equalizerBandMode, dspLimiterEnabled, replayGain]);
}
