import { describe, expect, it } from "vitest";

import {
  defaultKeyboardShortcuts,
  formatDuration,
  formatPlaybackTime,
  formatShortcut,
  normalizeEqualizerGains,
  normalizeKeyboardShortcuts,
  readUiPreferences,
  replayGainMultiplier,
  shortcutConflictGroups,
  shortcutFromEvent,
  shortcutMatchesEvent,
} from "./shared";
import type { Track } from "../types/api";

describe("keyboard shortcuts", () => {
  it("keeps defaults when stored shortcuts are missing or malformed", () => {
    const shortcuts = normalizeKeyboardShortcuts({
      "page.library": { key: "l", ctrl: true },
      "playback.next": { key: "" },
    });

    expect(shortcuts["page.library"]).toEqual({ key: "l", ctrl: true, alt: false, shift: false });
    expect(shortcuts["playback.next"]).toEqual(defaultKeyboardShortcuts["playback.next"]);
  });

  it("captures and matches shortcut key combinations", () => {
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true });
    const shortcut = shortcutFromEvent(event);

    expect(shortcut).toEqual({ key: "ArrowRight", ctrl: false, alt: true, shift: false });
    expect(shortcut && shortcutMatchesEvent(shortcut, event)).toBe(true);
    expect(shortcut && formatShortcut(shortcut)).toBe("Alt + ArrowRight");
  });

  it("reports shortcut conflicts for imported presets", () => {
    const shortcuts = normalizeKeyboardShortcuts({
      "page.library": { key: "L", ctrl: true, alt: false, shift: false },
      "page.autodj": { key: "L", ctrl: true, alt: false, shift: false },
    });

    expect(shortcutConflictGroups(shortcuts)).toContainEqual(["page.library", "page.autodj"]);
  });
});

describe("UI preferences", () => {
  it("keeps valid Now Playing customization and repairs invalid values", () => {
    localStorage.setItem(
      "flac-cafe-ui-preferences",
      JSON.stringify({
        nowPlayingLayout: "party",
        nowPlayingVisualizerStyle: "radial",
        nowPlayingBackground: "soft",
        nowPlayingShowLyrics: false,
        nowPlayingShowQueue: false,
        nowPlayingLyricSize: "large",
        nowPlayingAutoScrollLyrics: false,
        autoFetchLrcWhenPlainPresent: true,
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      nowPlayingLayout: "party",
      nowPlayingVisualizerStyle: "radial",
      nowPlayingBackground: "soft",
      nowPlayingShowLyrics: false,
      nowPlayingShowQueue: false,
      nowPlayingLyricSize: "large",
      nowPlayingAutoScrollLyrics: false,
      autoFetchLrcWhenPlainPresent: true,
    });

    localStorage.setItem(
      "flac-cafe-ui-preferences",
      JSON.stringify({
        nowPlayingLayout: "floaty",
        nowPlayingVisualizerStyle: "lasers",
        nowPlayingBackground: "storm",
        nowPlayingLyricSize: "massive",
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      nowPlayingLayout: "theater",
      nowPlayingVisualizerStyle: "bars",
      nowPlayingBackground: "artwork",
      nowPlayingLyricSize: "medium",
    });
  });
});

describe("duration formatting", () => {
  it("uses hours and days for long durations", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(90061)).toBe("1d 1:01:01");
    expect(formatPlaybackTime(3661)).toBe("1:01:01");
  });
});

describe("ReplayGain", () => {
  const track = {
    replaygain_track_gain_db: -6,
    replaygain_album_gain_db: -3,
  } as Track;

  it("leaves volume untouched when disabled or missing tags", () => {
    expect(replayGainMultiplier(track, "off", 6)).toBe(1);
    expect(replayGainMultiplier(null, "track", 0)).toBe(1);
    expect(replayGainMultiplier({} as Track, "album", 0)).toBe(1);
  });

  it("converts track and album gain tags into volume multipliers", () => {
    expect(replayGainMultiplier(track, "track", 0)).toBeCloseTo(0.501, 3);
    expect(replayGainMultiplier(track, "album", 0)).toBeCloseTo(0.708, 3);
    expect(replayGainMultiplier(track, "track", 3)).toBeCloseTo(0.708, 3);
  });

  it("uses ReplayGain peak tags to prevent clipping", () => {
    const loudTrack = {
      replaygain_track_gain_db: 6,
      replaygain_track_peak: 1.25,
    } as Track;

    expect(replayGainMultiplier(loudTrack, "track", 0, true)).toBeCloseTo(0.8, 3);
    expect(replayGainMultiplier(loudTrack, "track", 0, false)).toBeGreaterThan(1);
  });
});

describe("equalizer settings", () => {
  it("normalizes equalizer gains to the selected band count and range", () => {
    expect(normalizeEqualizerGains([20, -20, 3], "10")).toEqual([12, -12, 3, 0, 0, 0, 0, 0, 0, 0]);
    expect(normalizeEqualizerGains([1, 2, 3], "15")).toHaveLength(15);
  });
});
