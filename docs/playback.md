# Playback

Playback is intentionally local and lightweight. FLAC Cafe uses the Tauri WebView audio element instead of a custom decoder engine.

## Codec Coverage

Direct playback depends on the codecs supported by the installed WebView2 runtime. MP3 and most common AAC files are expected to work. FLAC works on current Windows WebView2 builds. Ogg, Opus, WAV, and AIFF may vary by runtime and file encoding.

Unsupported files should remain in the library, recommendation engine, and playlists even when direct playback is unavailable.

## Player Behavior

- The queue lives in React state and can be reordered from the queue handle.
- The next track is preloaded for smoother transitions.
- Fade and crossfade duration is controlled by the Player settings.
- Volume and mute are stored locally in browser storage.
- The compact bottom player is a single setting; older saved `playerLayout: "compact"` preferences are still treated as compact mode.
- The detached mini player communicates with the main app through `BroadcastChannel`.

## Skip Tracking

Settings exposes a skip threshold percentage. When the current track changes:

- If the listened percentage is below the threshold, FLAC Cafe records a skip.
- If it is at or above the threshold, FLAC Cafe records a play.

The helper logic for this is centralized in `frontend/src/app/App.tsx` so the bottom player and direct track switches use the same rule.

## Media Controls

The Tauri shell exposes Windows System Media Transport Controls through `frontend/src/lib/tauriMedia.ts` and `src-tauri/src/smtc.rs`. The app publishes title, artist, playback state, position, and button availability. Supported buttons include play/pause, previous, next, and stop-style state clearing on shutdown.

Keyboard shortcuts are currently hard-coded:

- Space or `K`: play/pause
- Alt+Left: previous
- Alt+Right: next
- Alt+M: mute

The TODO keeps a future shortcut editor as a polish item.

## Not In Scope Yet

- A custom native decoder pipeline.
- DSP effects beyond simple volume/fade scheduling.
- ReplayGain or loudness normalization.
- Guaranteed gapless playback for every codec.
