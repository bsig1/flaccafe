# Third-Party Notices

FLAC Cafe bundles a few small native command-line tools so common fingerprinting and CD-ripping workflows work without a separate installer. These tools are not owned by FLAC Cafe. They are invoked as separate executables and are included unmodified.

This file is a practical disclosure, not legal advice. Before a public release, verify the exact upstream package versions and ship any full license texts required by the binary distributors.

## Chromaprint fpcalc

- Bundled file: `backend/tools/chromaprint/fpcalc.exe`
- Version currently checked in: `fpcalc version 1.6.0`
- Upstream project: <https://github.com/acoustid/chromaprint>
- Binary release source: <https://github.com/acoustid/chromaprint/releases>
- License summary: Chromaprint is distributed under the GNU LGPL 2.1 or later. The official Windows `fpcalc` build also reports linked FFmpeg libraries; keep upstream notices and source links available when redistributing.
- How FLAC Cafe uses it: optional acoustic fingerprint generation for duplicate review and fingerprint-assisted tagging.

## cdrtools / cdda2wav Windows tools

- Bundled folder: `backend/tools/cd-rip/`
- Primary executable used by FLAC Cafe: `cdda2wav.exe`
- Additional tools from the same Windows bundle are included because the package expects them together: `cdrecord.exe`, `readcd.exe`, `mkisofs.exe`, `isoinfo.exe`, `isodump.exe`, `isovfy.exe`, `scgcheck.exe`, `devdump.exe`, `rscsi.exe`, `mount.exe`, `sh.exe`, and `cygwin1.dll`.
- Binary release source: <https://sourceforge.net/projects/cdrtools/files/alpha/win32/cdrtools-1.11a04-win32-bin.zip/download>
- License summary: cdrtools packages contain open-source tools with component-specific license terms. Preserve upstream notices, keep the source package link visible, and review the matching source/license texts before a public release.
- How FLAC Cafe uses it: optional CD audio extraction and CD-Text support. FLAC/MP3 encoding still requires FFmpeg.

## Optional tools not bundled

- FFmpeg remains an optional managed install because it is substantially larger and has codec-specific licensing considerations.
- CLAP/Torch runtimes remain optional managed installs because they are very large and device-specific.
