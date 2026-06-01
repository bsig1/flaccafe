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
import { useTaskbarIconMenu } from "./useTaskbarIconMenu";

export function usePlayerBarMediaEffects(ctx: any) {
  const {
    hideArtworkPreview, artworkSrc, miniPlayerCommandRef, togglePlayback, playRelative, seekTo, smtcActionRef, hasPlayableSource, isPlaying, playWithFade, pauseWithFade, hasNext, currentTime, hasPrevious, canPreviousAction, handlePreviousTrack, isRadioSource, keyboardShortcuts, changeVolume, volume, muted, toggleMuted, cycleRepeatMode, toggleStopAfterCurrent, setPlaybackMode, playbackMode, currentTrack, currentRadioStation, queue, currentIndex, outputVolume, effectiveDuration, smtcPositionSecond, miniPlayerChannelRef, onSelectTrack,
  } = ctx;

  useTaskbarIconMenu({
    currentTrack,
    currentRadioStation,
    isPlaying,
    hasPlayableSource,
    canPreviousAction,
    hasNext,
    currentTime,
    effectiveDuration,
    queue,
    currentIndex,
    togglePlayback,
    handlePreviousTrack,
    playRelative,
    onSelectTrack,
  });

  useEffect(() => {
    hideArtworkPreview();
  }, [artworkSrc]);

  miniPlayerCommandRef.current = (command: MiniPlayerCommand) => {
    if (command.type === "playPause") {
      void togglePlayback();
    } else if (command.type === "previous") {
      handlePreviousTrack();
    } else if (command.type === "next") {
      playRelative(1);
    } else if (command.type === "seek") {
      seekTo(command.seconds);
    } else if (command.type === "playQueueIndex") {
      const track = queue[command.index];
      if (track) {
        onSelectTrack(track, queue, { suppressExitRecord: true });
      }
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
      handlePreviousTrack();
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
        handlePreviousTrack();
        return;
      }

      if (shortcutMatchesEvent(keyboardShortcuts["playback.next"], event)) {
        event.preventDefault();
        playRelative(1);
      } else if (shortcutMatchesEvent(keyboardShortcuts["playback.previous"], event)) {
        event.preventDefault();
        handlePreviousTrack();
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
  }, [currentTrack, currentRadioStation, currentTime, volume, muted, hasPlayableSource, isPlaying, hasPrevious, hasNext, canPreviousAction, queue, currentIndex, outputVolume, keyboardShortcuts, playbackMode]);

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
      canPrevious: canPreviousAction,
      canNext: hasNext,
    }).catch(() => {
      // SMTC is best-effort; playback should never depend on Windows media UI.
    });
  }, [currentTrack, isPlaying, smtcPositionSecond, effectiveDuration, canPreviousAction, hasNext]);

  useEffect(() => {
    publishMiniPlayerSnapshot(miniPlayerChannelRef.current, {
      track: currentTrack ? miniPlayerTrackSnapshot(currentTrack) : null,
      queue: queue.map(miniPlayerTrackSnapshot),
      currentIndex,
      isPlaying,
      currentTime,
      duration: effectiveDuration,
      hasPrevious: canPreviousAction,
      hasNext,
      updatedAt: new Date().toISOString(),
    });
  }, [currentTrack, isPlaying, smtcPositionSecond, effectiveDuration, canPreviousAction, hasNext, queue, currentIndex]);

  useEffect(() => {
    return () => {
      void clearSmtcState();
    };
  }, []);
}
