# Third-Party Notices

FLAC Cafe bundles a few small native command-line tools so common fingerprinting and CD-ripping workflows work without a separate installer. These tools are not owned by FLAC Cafe. They are invoked as separate executables and are included unmodified.

This file is a practical redistribution disclosure, not legal advice. Keep this notice with source archives and packaged builds that include the bundled tools below.

## Chromaprint fpcalc

- Bundled file: `backend/tools/chromaprint/fpcalc.exe`
- Version currently checked in: `fpcalc version 1.6.0`
- Upstream project: <https://github.com/acoustid/chromaprint>
- Binary release source: <https://github.com/acoustid/chromaprint/releases>
- License summary: Chromaprint is distributed under the GNU LGPL 2.1 or later. The official Windows `fpcalc` build also reports linked FFmpeg libraries, so keep the upstream release/source links visible when redistributing.
- How FLAC Cafe uses it: optional acoustic fingerprint generation for duplicate review and fingerprint-assisted tagging.
- Source availability: FLAC Cafe redistributes the upstream Windows binary unmodified. Matching source is available from the upstream Chromaprint project and releases linked above.

## cdrtools / cdda2wav Windows tools

- Bundled folder: `backend/tools/cd-rip/`
- Primary executable used by FLAC Cafe: `cdda2wav.exe`
- Additional tools from the same Windows bundle are included because the package expects them together: `cdrecord.exe`, `readcd.exe`, `mkisofs.exe`, `isoinfo.exe`, `isodump.exe`, `isovfy.exe`, `scgcheck.exe`, `devdump.exe`, `rscsi.exe`, `mount.exe`, `sh.exe`, and `cygwin1.dll`.
- Binary release source: <https://sourceforge.net/projects/cdrtools/files/alpha/win32/cdrtools-1.11a04-win32-bin.zip/download>
- Upstream source index: <https://sourceforge.net/projects/cdrtools/files/alpha/>
- Cygwin licensing information: <https://cygwin.org/licensing.html>
- License summary: cdrtools packages contain open-source tools with component-specific license terms. The included `cygwin1.dll` is covered by Cygwin's own licensing terms. Preserve upstream notices and keep the matching binary/source links visible when redistributing.
- How FLAC Cafe uses it: optional CD audio extraction and CD-Text support. FLAC/MP3 encoding still requires FFmpeg.
- Source availability: FLAC Cafe redistributes the upstream Windows bundle unmodified. Matching source and license material should be obtained from the upstream cdrtools/Cygwin distribution links above.

## Optional tools not bundled

- FFmpeg remains an optional managed install because it is substantially larger and has codec-specific licensing considerations.
- CLAP/Torch runtimes remain optional managed installs because they are very large and device-specific.

## Maintainer Checklist

- Do not modify bundled third-party binaries without recording the exact source, version, and build flags.
- Keep this notice in packaged MSI resources and in source releases.
- For a release announcement, link users to this file and to the upstream source locations above.
