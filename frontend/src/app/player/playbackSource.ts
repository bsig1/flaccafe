import type {
  DesktopPlaybackSource,
  desktopDspSettings,
} from "../../lib/desktopPlayback";
import type {
  RadioStation,
  Track,
} from "../../types/api";
import type {
  EqualizerBandMode,
  ReplayGainMode,
} from "../shared";
import {
  normalizeEqualizerGains,
  replayGainMultiplier,
} from "../shared";

export type CrossfadeContext = "manual" | "natural";

export type CrossfadeDurations = {
  manualMs: number;
  naturalMs: number;
  albumMs: number;
};

export type ReplayGainSettings = {
  mode: ReplayGainMode;
  targetVolumePercent: number;
  preampDb: number;
  preventClipping: boolean;
};

export type DspSettings = ReplayGainSettings & {
  equalizerEnabled: boolean;
  equalizerBandMode: EqualizerBandMode;
  equalizerPreampDb: number;
  equalizerGains: number[];
  limiterEnabled: boolean;
};

export function sameAlbumForCrossfade(left: Track | null, right: Track | null) {
  if (!left || !right) {
    return false;
  }
  const leftAlbum = (left.album ?? "").trim().toLowerCase();
  const rightAlbum = (right.album ?? "").trim().toLowerCase();
  if (!leftAlbum || leftAlbum !== rightAlbum) {
    return false;
  }
  const leftArtist = (left.album_artist ?? "").trim().toLowerCase();
  const rightArtist = (right.album_artist ?? "").trim().toLowerCase();
  return !leftArtist || !rightArtist || leftArtist === rightArtist;
}

export function crossfadeMsForTrackChange(
  currentTrack: Track | null,
  nextTrack: Track | null,
  context: CrossfadeContext,
  durations: CrossfadeDurations,
) {
  if (sameAlbumForCrossfade(currentTrack, nextTrack)) {
    return durations.albumMs;
  }
  return context === "natural" ? durations.naturalMs : durations.manualMs;
}

export function replayGainForTrack(track: Track | null, settings: ReplayGainSettings) {
  return replayGainMultiplier(
    track,
    settings.mode,
    settings.preampDb,
    settings.preventClipping,
    settings.targetVolumePercent,
  );
}

export function playbackSourceForTrack(track: Track): DesktopPlaybackSource {
  if (track.path.startsWith("cdda://")) {
    const [driveId = "", trackText = "1"] = track.path.slice("cdda://".length).split("/track/");
    const trackNumber = Number.parseInt(trackText, 10);
    return {
      kind: "cd_track",
      drive_id: driveId,
      track_number: Number.isFinite(trackNumber) && trackNumber > 0 ? trackNumber : track.track_number ?? 1,
      title: track.title ?? null,
    };
  }
  if (track.audio_url) {
    return {
      kind: "url",
      url: track.audio_url,
      cache_key: `track-${track.id}`,
      title: track.title ?? null,
      live: false,
    };
  }
  return { kind: "file", path: track.path };
}

export function playbackSourceForRadio(station: RadioStation): DesktopPlaybackSource {
  return {
    kind: "url",
    url: station.stream_url,
    cache_key: `radio-${station.id}`,
    title: station.name ?? null,
    live: true,
  };
}

export function playbackSourceIdentity(source: DesktopPlaybackSource): string {
  if (source.kind === "file") {
    return source.path;
  }
  if (source.kind === "url") {
    return source.url;
  }
  return `cdda://${source.drive_id}/track/${String(source.track_number).padStart(2, "0")}`;
}

export function desktopDspSettingsForTrack(track: Track | null, settings: DspSettings): desktopDspSettings {
  return {
    normalizationGain: replayGainForTrack(track, settings),
    equalizerEnabled: settings.equalizerEnabled,
    equalizerBandMode: settings.equalizerBandMode,
    equalizerPreampDb: settings.equalizerPreampDb,
    equalizerGains: normalizeEqualizerGains(settings.equalizerGains, settings.equalizerBandMode),
    limiterEnabled: settings.limiterEnabled,
  };
}
