import type {
RadioStation,
Track,
} from "../../types/api";
import type {
desktopOutputBackendMode,
EqualizerBandMode,
KeyboardShortcut,
KeyboardShortcutAction,
PlaybackMode,
} from "../shared";

export type ExternalTrackRequest = {
  id: number;
  track: Track;
  queue: Track[];
  resumePositionSeconds?: number | null;
};

export type PlayerBarProps = {
  currentTrack: Track | null;
  currentRadioStation: RadioStation | null;
  radioPlaybackRequestId: number;
  queue: Track[];
  externalTrackRequest: ExternalTrackRequest | null;
  onSelectTrack: (track: Track, queue: Track[], options?: { suppressExitRecord?: boolean; resumePositionSeconds?: number | null }) => void;
  onCommitExternalTrackRequest: (request: ExternalTrackRequest, options?: { suppressExitRecord?: boolean }) => void;
  onTrackEnded: (trackId: number) => Promise<void>;
  onTrackSkipped: (trackId: number) => Promise<void>;
  onPlaybackTime: (seconds: number) => void;
  resumePositionSeconds: number | null;
  onResumePositionApplied: () => void;
  onRating: (trackId: number, rating: number | null) => void;
  displayRatingsAsNumbers: boolean;
  autoPlay: boolean;
  fadeMs: number;
  crossfadeManualMs: number;
  crossfadeNaturalMs: number;
  crossfadeAlbumMs: number;
  crossfadeRadioMs: number;
  skipThresholdPercent: number;
  desktopOutputBackend: desktopOutputBackendMode;
  desktopOutputDeviceId: string;
  desktopBufferFrames: number;
  showOutputDiagnosticsButton: boolean;
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
  onOpenCurrentArtistInfo: (track: Track) => void;
  onOpenCurrentAlbum: (track: Track) => void;
  setStatus: (message: string) => void;
};
