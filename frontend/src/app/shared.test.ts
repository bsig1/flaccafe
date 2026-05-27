import { beforeEach, describe, expect, it } from "vitest";

import {
  defaultKeyboardShortcuts,
  displayAlbumForTrack,
  formatDuration,
  formatPlaybackTime,
  formatShortcut,
  formatDate,
  isTimestampOnlyLyricLine,
  normalizeAudioAnalysisCoverage,
  normalizeAdvancedHttpShortcuts,
  normalizePlaybackResumePosition,
  normalizeEqualizerGains,
  normalizeKeyboardShortcuts,
  parseLyricTimestamp,
  parseAppDate,
  readUiPreferences,
  replayGainMultiplier,
  shortcutConflictGroups,
  shortcutFromEvent,
  shortcutMatchesEvent,
  splitArtistNames,
  storageKeys,
  stripLyricTimestamp,
} from "./shared";
import { backendRouteCatalog } from "../lib/backendRouteCatalog";
import { playbackEndedEarly } from "./player/playbackEarlyEnd";
import type { Track } from "../types/api";

describe("keyboard shortcuts", () => {
  it("keeps defaults when stored shortcuts are missing or malformed", () => {
    const shortcuts = normalizeKeyboardShortcuts({
      "page.library": { key: "l", ctrl: true },
      "playback.next": { key: 12 },
    });

    expect(shortcuts["page.library"]).toEqual({ key: "l", ctrl: true, alt: false, shift: false });
    expect(shortcuts["playback.next"]).toEqual(defaultKeyboardShortcuts["playback.next"]);
  });

  it("supports unassigned shortcuts without matching or conflicting", () => {
    const shortcuts = normalizeKeyboardShortcuts({
      "playback.next": { key: "" },
      "app.openLyrics": { key: "" },
    });

    expect(shortcuts["playback.next"]).toEqual({ key: "", ctrl: false, alt: false, shift: false });
    expect(formatShortcut(shortcuts["playback.next"])).toBe("Unassigned");
    expect(shortcutMatchesEvent(shortcuts["playback.next"], new KeyboardEvent("keydown", { key: "." }))).toBe(false);
    expect(shortcutConflictGroups(shortcuts).some((group) => group.includes("app.openLyrics"))).toBe(false);
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

  it("normalizes advanced HTTP shortcuts across documented methods", () => {
    const shortcuts = normalizeAdvancedHttpShortcuts([
      {
        id: "rating",
        label: "Rate track",
        method: "patch",
        path: "/tracks/12/rating",
        description: "Updates a rating.",
        bodyJson: "{\"rating\":8}",
        shortcut: { key: "r", ctrl: true },
      },
      {
        method: "HEAD",
        path: "/metadata/artwork/12",
        shortcut: { key: "h", alt: true },
      },
      {
        method: "TRACE",
        path: "/health",
        shortcut: { key: "t" },
      },
    ]);

    expect(shortcuts).toHaveLength(2);
    expect(shortcuts[0]).toMatchObject({ method: "PATCH", path: "/tracks/12/rating", shortcut: { ctrl: true, alt: false } });
    expect(shortcuts[1]).toMatchObject({ method: "HEAD", path: "/metadata/artwork/12", shortcut: { ctrl: false, alt: true } });
  });
});

describe("backend route catalog", () => {
  it("parses methods and descriptions from the markdown route reference", () => {
    expect(backendRouteCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/health" }),
      ]),
    );
    expect(backendRouteCatalog.some((entry) => entry.method === "POST")).toBe(true);
    expect(backendRouteCatalog.every((entry) => entry.description.length > 0)).toBe(true);
  });
});

describe("playback early-end detection", () => {
  it("flags decoder EOF far before the saved track duration", () => {
    expect(playbackEndedEarly(115.879, 181.88)).toBe(true);
    expect(playbackEndedEarly(179.5, 181.88)).toBe(false);
    expect(playbackEndedEarly(4, 181.88)).toBe(true);
    expect(playbackEndedEarly(10, 20)).toBe(false);
  });
});

describe("UI preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults local library playback to Rust", () => {
    expect(readUiPreferences()).toMatchObject({
      playbackEngine: "rust",
    });
    expect(localStorage.getItem(storageKeys.rustPlaybackDefaultMigration)).toBe("done");
  });

  it("moves old stored WebView playback defaults to Rust once", () => {
    localStorage.setItem(
      storageKeys.uiPreferences,
      JSON.stringify({
        playbackEngine: "webview",
        startupPage: "settings",
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      playbackEngine: "rust",
      startupPage: "settings",
    });
    expect(JSON.parse(localStorage.getItem(storageKeys.uiPreferences) ?? "{}")).toMatchObject({
      playbackEngine: "rust",
      startupPage: "settings",
    });
  });

  it("respects WebView playback after the Rust-default migration has run", () => {
    localStorage.setItem(storageKeys.rustPlaybackDefaultMigration, "done");
    localStorage.setItem(
      storageKeys.uiPreferences,
      JSON.stringify({
        playbackEngine: "webview",
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      playbackEngine: "webview",
    });
  });

  it("keeps valid Now Playing customization and repairs invalid values", () => {
    localStorage.setItem(
      storageKeys.uiPreferences,
      JSON.stringify({
        nowPlayingLayout: "party",
        nowPlayingVisualizerStyle: "radial",
        nowPlayingShowLyrics: false,
        nowPlayingShowQueue: false,
        nowPlayingLyricSize: "large",
        nowPlayingAutoScrollLyrics: false,
        autoFetchLrcWhenPlainPresent: true,
        showPodcastFilePaths: true,
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      nowPlayingLayout: "party",
      nowPlayingVisualizerStyle: "radial",
      nowPlayingShowLyrics: false,
      nowPlayingShowQueue: false,
      nowPlayingLyricSize: "large",
      nowPlayingAutoScrollLyrics: false,
      autoFetchLrcWhenPlainPresent: true,
      showPodcastFilePaths: true,
    });

    localStorage.setItem(
      storageKeys.uiPreferences,
      JSON.stringify({
        nowPlayingLayout: "floaty",
        nowPlayingVisualizerStyle: "lasers",
        nowPlayingLyricSize: "massive",
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      nowPlayingLayout: "queue",
      nowPlayingVisualizerStyle: "radial",
      nowPlayingLyricSize: "medium",
      showPodcastFilePaths: false,
    });

    localStorage.setItem(
      storageKeys.uiPreferences,
      JSON.stringify({
        nowPlayingLayout: "theater",
      }),
    );

    expect(readUiPreferences()).toMatchObject({
      nowPlayingLayout: "queue",
    });
  });
});

describe("artist name splitting", () => {
  it("keeps natural ampersand band names together when the right side is an article phrase", () => {
    expect(splitArtistNames("King Gizzard & the Lizard Wizard")).toEqual([
      "King Gizzard & the Lizard Wizard",
    ]);
    expect(splitArtistNames("King Gizzard & The Lizard Wizard")).toEqual([
      "King Gizzard & The Lizard Wizard",
    ]);
  });

  it("splits likely collaboration connectors into separate artist tabs", () => {
    expect(splitArtistNames("AnnenMayKantereit & Giant Rooks")).toEqual([
      "AnnenMayKantereit",
      "Giant Rooks",
    ]);
    expect(splitArtistNames("Clean Bandit feat. Sean Paul & Anne-Marie")).toEqual([
      "Clean Bandit",
      "Sean Paul",
      "Anne-Marie",
    ]);
  });
});

describe("duration formatting", () => {
  it("uses hours and days for long durations", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(90061)).toBe("1d 1:01:01");
    expect(formatPlaybackTime(3661)).toBe("1:01:01");
  });

  it("normalizes saved playback resume positions", () => {
    expect(normalizePlaybackResumePosition(2, 240)).toBeNull();
    expect(normalizePlaybackResumePosition(55, 240)).toBe(55);
    expect(normalizePlaybackResumePosition(238, 240)).toBeNull();
    expect(normalizePlaybackResumePosition("42", null)).toBe(42);
  });
});

describe("lyric timestamp helpers", () => {
  it("parses long LRC timestamps and recognizes blank timed sections", () => {
    expect(parseLyricTimestamp("[123:04.50] long song")).toBeCloseTo(7384.5);
    expect(isTimestampOnlyLyricLine("[01:23.45]")).toBe(true);
    expect(isTimestampOnlyLyricLine("[01:23.45] a line")).toBe(false);
  });

  it("removes enhanced LRC word timestamps for line-level display", () => {
    expect(stripLyricTimestamp("[00:18.019] <00:18.019>I <00:18.200>care")).toBe("I care");
  });
});

describe("audio analysis coverage", () => {
  it("uses the music-library total when stale coverage includes longform tracks", () => {
    const coverage = normalizeAudioAnalysisCoverage(
      {
        total_tracks: 1672,
        analyzed_tracks: 1623,
        unanalyzed_tracks: 49,
        failed_tracks: 0,
        coverage_percent: 97.07,
        provider: "clap",
      },
      1626,
    );

    expect(coverage).toMatchObject({
      total_tracks: 1626,
      analyzed_tracks: 1623,
      unanalyzed_tracks: 3,
      coverage_percent: 99.82,
    });
  });
});

describe("date formatting", () => {
  it("treats SQLite timestamps as UTC before displaying locally", () => {
    expect(parseAppDate("2026-05-23 12:34:56")?.toISOString()).toBe("2026-05-23T12:34:56.000Z");
    expect(formatDate("2026-05-23 12:34:56")).toBe(new Date("2026-05-23T12:34:56Z").toLocaleString());
  });
});

describe("metadata display helpers", () => {
  it("hides explicit and podcast no-album values", () => {
    expect(displayAlbumForTrack({ album: "__FLAC_CAFE_NO_ALBUM__" })).toBeNull();
    expect(displayAlbumForTrack({ album: "Podcast", artist: "Podcast", genre: "Podcast" })).toBeNull();
    expect(displayAlbumForTrack({ album: "Feed Name", artist: "Feed Name", genre: "Podcast" })).toBeNull();
    expect(displayAlbumForTrack({ album: "Real Album", artist: "Artist", genre: "Podcast" })).toBe("Real Album");
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

  it("uses the target volume as a ReplayGain offset", () => {
    expect(replayGainMultiplier(track, "track", 0, true, 75)).toBeCloseTo(0.794, 3);
    expect(replayGainMultiplier(track, "track", 0, true, 0)).toBeCloseTo(0.251, 3);
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
