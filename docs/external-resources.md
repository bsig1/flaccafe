# External Resources

This file lists external services, pages, and downloadable resources the app links to or talks to directly. Local media URLs such as `http://flaccafe-media.localhost/...` are app-private loopback URLs and are not external services.

## User-Facing Links

- AcoustID API key page: <https://acoustid.org/api-key>
  - Used by API key setup in Settings and File Management metadata tools.
- Last.fm API page: <https://www.last.fm/api>
  - Used by Settings and Scrobbling setup.
- Last.fm authorization page: <https://www.last.fm/api/auth/>
  - Used for generated scrobbling sign-in URLs.
- FFmpeg builds page: <https://www.gyan.dev/ffmpeg/builds/>
  - Opened from optional dependency setup.
- Wikipedia article pages: returned dynamically by Wikipedia lookup results.
  - Opened from the Artist page.

## Metadata And Lyrics APIs

- LRCLIB exact lyric lookup: <https://lrclib.net/api/get>
- LRCLIB lyric search: <https://lrclib.net/api/search>
- Wikipedia page summary API: <https://en.wikipedia.org/api/rest_v1/page/summary/>
- Wikipedia search API: <https://en.wikipedia.org/w/api.php>
- MusicBrainz API: <https://musicbrainz.org/ws/2>
- Cover Art Archive API: <https://coverartarchive.org>
- AcoustID API: <https://api.acoustid.org/v2>
- ListenBrainz submit API: <https://api.listenbrainz.org/1/submit-listens>
- Last.fm API service: <https://ws.audioscrobbler.com/2.0/>

## Downloaded Optional Dependencies

- FFmpeg essentials ZIP: <https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip>
- PyTorch CPU wheels: <https://download.pytorch.org/whl/cpu>
- PyTorch CUDA wheels: <https://download.pytorch.org/whl/cu128>

## Bundled Third-Party Tool References

These are not downloaded by normal app use, but they are linked from notices or diagnostics because bundled binaries need visible upstream/source references.

- Chromaprint project: <https://github.com/acoustid/chromaprint>
- Chromaprint releases: <https://github.com/acoustid/chromaprint/releases>
- cdrtools Windows bundle: <https://sourceforge.net/projects/cdrtools/files/alpha/win32/cdrtools-1.11a04-win32-bin.zip/download>
- cdrtools source index: <https://sourceforge.net/projects/cdrtools/files/alpha/>
- Cygwin licensing information for bundled cdrtools DLLs: <https://cygwin.org/licensing.html>

## User-Provided URLs

- Radio station stream and homepage URLs.
- Podcast feed, episode audio, and show site URLs.
- User-provided artwork URLs.
- Extension/provider URLs from local extension manifests.
- Optional dependency source URLs if manually overridden in config.
