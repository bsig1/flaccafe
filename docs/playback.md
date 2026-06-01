# Playback

Playback is intentionally local and Rust-owned. The Tauri WebView renders the interface, artwork, and app pages; audio playback goes through the Rust player.

React sends structured playback sources to Rust:

- `file` for scanned local tracks.
- `url` for static audio URLs, previews, podcasts, and live radio streams.
- `cd_track` for optical-disc tracks prepared by the CD page.

The old hidden WebView audio player is not a supported fallback. Unsupported, missing, corrupt, or busy-device cases should surface as Rust playback errors and appear in the diagnostics panel.

## Codec Coverage

The Rust player uses `rodio` for playback, `cpal` for shared output, a Windows WASAPI exclusive path when selected, and Symphonia-backed decoding through rodio's codec features. Unsupported files remain in the library, recommendation engine, and playlists even when direct playback is unavailable.

Settings > Player lists Rust output devices in the desktop app. The selected device, backend mode, and buffer size are passed into the Rust engine when playback starts. Rust output stream errors are captured and surfaced through the player status toast when the desktop command reports them.

Settings > Player also includes a compact Rust audio diagnostics panel. It shows the current Rust output configuration plus the most recent rodio, cpal, Symphonia, file-open, stream-callback, and seek failures. The panel can refresh or clear the in-memory diagnostics without affecting normal playback.

Rust playback prepares the next queued file by opening and decoding it ahead of the transition. This does not yet make every codec sample-perfect, but it catches missing/undecodable files earlier and surfaces failures in Rust audio diagnostics.

## Output Modes

Shared mode is the default and safest output path. FLAC Cafe asks Windows for a normal shared output stream through `cpal`, so other apps can keep using the same device and Windows can apply its normal mixer, device format, and effects.

WASAPI exclusive is Windows-only and optional. FLAC Cafe opens the selected output device directly, bypassing the Windows shared mixer while playback is active. This can reduce resampling and system-mixer interference when the device accepts the requested format, but it also means:

- Other apps may be muted or unable to use that output while FLAC Cafe is playing.
- Playback can fail if another app already owns the device exclusively.
- Device format support is stricter; some devices reject common exclusive formats.
- Latency is not guaranteed to be lower because FLAC Cafe uses conservative buffers for stability.

If exclusive mode cannot open cleanly, FLAC Cafe records a warning and falls back to shared Rust output so playback can continue. Use exclusive mode when you specifically want a direct Windows output path and are comfortable troubleshooting device-format conflicts; use shared mode for everyday reliability.

## Player Behavior

- The queue lives in React state and can be reordered from the queue handle.
- The Rust player prepares the next queued source for smoother transitions when the source supports preparation.
- Fade and crossfade duration is controlled by the Player settings. Rust crossfade uses overlapping players on the same output path, then stops the old player after the fade.
- Volume and mute are stored locally in browser storage.
- ReplayGain can be applied from embedded track or album gain tags with an optional preamp.
- Now Playing supports Queue, Lyrics, and Party layouts, with optional lyrics/queue panels and bars/wave/radial visualizers.
- The compact bottom player is a single setting; older saved `playerLayout: "compact"` preferences are still treated as compact mode.
- The detached mini player communicates with the main app through `BroadcastChannel`, uses a narrow fixed layout, and can reopen the main app window.
- If a file cannot be decoded by the Rust player, reveal it in Explorer from Library or the track details panel and inspect the Rust audio diagnostics.
- Rust playback diagnostics are kept in memory for the current app session and capped to the most recent failures.

## Now Playing And Visualizers

Settings > Player controls the default Now Playing layout, visualizer style, lyric size, and whether the lyrics or queue panels are shown. The Now Playing header also exposes quick switches for layout, visualizer style, lyrics, queue, and fullscreen.

Rust playback exposes sampled PCM-level frames through the Tauri bridge. If no live frame is available, the component falls back to a gentle playback-reactive animation instead of going blank.

## CD Playback

The CD page appears according to the Settings > Sources CD sidebar visibility preference. When a drive is available, selected CD tracks are prepared for Rust playback and played through the normal player bar. The first start can take a moment because the backend has to open the optical drive and prepare audio.

CD ripping lives on the CD page, not inside File Management. The ripper uses the same disc detection and MusicBrainz lookup surface as playback, then writes files to the selected output folder. Ripped files are not added to the normal music library until their output folder is scanned.

## ReplayGain

Library scans read common `replaygain_track_gain`, `track_gain`, `replaygain_album_gain`, `album_gain`, `replaygain_track_peak`, `track_peak`, `replaygain_album_peak`, and `album_peak` tags into SQLite. Settings > Player exposes Off, Track, and Album modes plus a small preamp control.

The player applies ReplayGain as a volume multiplier during Rust playback. When peak protection is enabled, FLAC Cafe caps the multiplier using embedded peak tags to avoid obvious digital clipping. Tracks without ReplayGain tags keep normal volume, and the app does not write ReplayGain tags back into audio files.

## Skip Tracking

Settings exposes a skip threshold percentage. When the current track changes:

- If the listened percentage is below the threshold, FLAC Cafe records a skip.
- If it is at or above the threshold, FLAC Cafe records a play.

The helper logic for this is centralized in `frontend/src/app/App.tsx` so the bottom player and direct track switches use the same rule.

## Media Controls

The Tauri shell exposes Windows System Media Transport Controls through `frontend/src/lib/tauriMedia.ts` and `src-tauri/src/smtc.rs`. The app publishes title, artist, playback state, position, and button availability. Supported buttons include play/pause, previous, next, and stop-style state clearing on shutdown.

Keyboard shortcuts are editable in Settings > Keyboard Shortcuts. Media keys are still supported as a fallback for play/pause, previous, and next. The default local shortcuts are:

- Space: play/pause
- Alt+Comma: previous
- Alt+Period: next
- Alt+Left / Alt+Right: seek
- Alt+Up / Alt+Down: volume
- Alt+M: mute

## Not In Scope Yet

- A fully custom Rust decoder pipeline.
- Guaranteed gapless playback for every codec.
