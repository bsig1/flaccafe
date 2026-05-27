import { useEffect } from "react";

import type { SmtcButtonPayload } from "../../lib/tauriMedia";
import {
  clearSmtcState,
  listenForSmtcButtons,
  updateSmtcState,
} from "../../lib/tauriMedia";
import {
  MiniPlayerCommand,
  miniPlayerTrackSnapshot,
  publishMiniPlayerSnapshot,
  shortcutMatchesEvent,
} from "../shared";

export function usePlayerBarMediaEffects(ctx: any) {
  const {
    hideArtworkPreview, artworkSrc, miniPlayerCommandRef, togglePlayback, playRelative, seekTo, smtcActionRef, hasPlayableSource, isPlaying, playWithFade, pauseWithFade, hasNext, currentTime, hasPrevious, isRadioSource, keyboardShortcuts, changeVolume, volume, muted, toggleMuted, cycleRepeatMode, toggleStopAfterCurrent, setPlaybackMode, playbackMode, currentTrack, currentRadioStation, queue, currentIndex, outputVolume, effectiveDuration, smtcPositionSecond, miniPlayerChannelRef, hasPrevious: canPrevious, hasNext: canNext,
  } = ctx;

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
}
