# Playback

Playback is intentionally local and lightweight. FLAC Cafe defaults to the Tauri WebView audio element, with an experimental native Rust engine available in Settings > Player.

## Codec Coverage

WebView playback depends on the codecs supported by the installed WebView2 runtime. MP3 and most common AAC files are expected to work. FLAC works on current Windows WebView2 builds. Ogg, Opus, WAV, and AIFF may vary by runtime and file encoding.

Unsupported files should remain in the library, recommendation engine, and playlists even when direct playback is unavailable.

Settings > Player includes a WebView codec diagnostic that calls the local audio element's `canPlayType` support check for MP3, FLAC, AAC, Ogg Vorbis, Opus, WAV, and AIFF. Treat "probably" as good, "maybe" as worth trying, and "not reported" as a warning that WebView2 may refuse direct playback for that format.

The native Rust engine uses `rodio` for playback, `cpal` for output, and Symphonia-backed decoding through rodio's codec features. It is meant to prove the lower-level path without making it the only playback option yet. Native output stream errors are captured and surfaced through the player status toast when the desktop command reports them.

Settings > Player can list native output devices in the desktop app. The selected device and buffer size are passed into the Rust engine when playback starts. On Windows this is currently cpal's WASAPI shared-mode path; exclusive mode needs a dedicated WASAPI backend rather than the generic rodio bridge.

Settings > Player also includes a compact Native diagnostics panel. It shows the current native output configuration plus the most recent rodio, cpal, Symphonia, file-open, stream-callback, and seek failures. The panel can refresh or clear the in-memory diagnostics without affecting normal playback.

## Player Behavior

- The queue lives in React state and can be reordered from the queue handle.
- The WebView engine preloads the next track for smoother transitions.
- Fade and crossfade duration is controlled by the Player settings. WebView crossfade uses two audio elements; native crossfade uses overlapping rodio players on the same mixer, then stops the old player after the fade.
- Volume and mute are stored locally in browser storage.
- ReplayGain can be applied from embedded track or album gain tags with an optional preamp.
- Now Playing supports Studio, Theater, and Party layouts, with optional lyrics, queue, album-art backgrounds, and bars/wave/radial visualizers.
- The compact bottom player is a single setting; older saved `playerLayout: "compact"` preferences are still treated as compact mode.
- The detached mini player communicates with the main app through `BroadcastChannel`, and its always-on-top state plus snap size are persisted.
- If a file cannot be decoded by WebView2, the player bar can open it in the user's default Windows audio app.
- Native playback diagnostics are kept in memory for the current app session and capped to the most recent failures.

## Now Playing And Visualizers

Settings > Player controls the default Now Playing layout, visualizer style, background, lyric size, and whether the lyrics or queue panels are shown. The Now Playing header also exposes quick switches for layout, visualizer style, lyrics, queue, and fullscreen.

The visualizer reads live Web Audio analyzer data when the WebView engine is active. Native playback does not currently expose decoded PCM frames to the frontend, so the visualizer falls back to a playback-reactive ambient animation for that engine.

## ReplayGain

Library scans read common `replaygain_track_gain`, `track_gain`, `replaygain_album_gain`, `album_gain`, `replaygain_track_peak`, `track_peak`, `replaygain_album_peak`, and `album_peak` tags into SQLite. Settings > Player exposes Off, Track, and Album modes plus a small preamp control.

The player applies ReplayGain as a volume multiplier during WebView or native playback. When peak protection is enabled, FLAC Cafe caps the multiplier using embedded peak tags to avoid obvious digital clipping. Tracks without ReplayGain tags keep normal volume, and the app does not write ReplayGain tags back into audio files.

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

- A fully custom native decoder pipeline.
- WASAPI exclusive mode or ASIO.
- Native queue preloading and sample-accurate gapless transition validation.
- DSP effects beyond equalizer, limiter, volume, fade, crossfade, and ReplayGain scheduling.
- Guaranteed gapless playback for every codec.
