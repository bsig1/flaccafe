import type {
  RadioStation,
  Track,
} from "../../types/api";
import type {
  EqualizerBandMode,
  KeyboardShortcut,
  KeyboardShortcutAction,
  PlaybackEngine,
  PlaybackMode,
} from "../shared";

export type ExternalTrackRequest = {
  id: number;
  track: Track;
  queue: Track[];
};

export type PlayerBarProps = {
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
  desktopOutputDeviceId: string;
  desktopBufferFrames: number;
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
};
