import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Disc3,
  Download,
  ListChecks,
  Music2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelCdRip,
  fetchCdRipProgress,
  fetchCdRipSetup,
  lookupCdRipMetadata,
  playCdTrack,
  startCdRip,
  stopCdPlayback,
} from "../../../lib/api";
import type {
  CdRipOutputFormat,
  CdRipProgress,
  CdRipReleaseCandidate,
  CdRipSetupResponse,
  CdRipTrackMetadata,
} from "../../../types/api";
import {
  DisclosureSection,
  NumberField,
} from "../../components/common";

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) {
    return "";
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function defaultTracks(count: number): CdRipTrackMetadata[] {
  return Array.from({ length: Math.max(1, Math.min(120, count)) }, (_item, index) => ({
    track_number: index + 1,
    disc_number: 1,
    title: `Track ${(index + 1).toString().padStart(2, "0")}`,
    artist: null,
    duration_seconds: null,
    source_label: "Manual",
  }));
}

function statusTone(ready: boolean) {
  return ready ? "border-moss/40 bg-moss/10 text-moss" : "border-ember/40 bg-ember/10 text-ember";
}

export function CdRipperSection({ setStatus }: { setStatus: (message: string) => void }) {
  const [setup, setSetup] = useState<CdRipSetupResponse | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [outputFolder, setOutputFolder] = useState("");
  const [outputFormat, setOutputFormat] = useState<CdRipOutputFormat>("flac");
  const [secureMode, setSecureMode] = useState(true);
  const [verify, setVerify] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [bitrateKbps, setBitrateKbps] = useState(320);
  const [manualTrackCount, setManualTrackCount] = useState(12);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumArtist, setAlbumArtist] = useState("");
  const [year, setYear] = useState(0);
  const [genre, setGenre] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [tracks, setTracks] = useState<CdRipTrackMetadata[]>(() => defaultTracks(12));
  const [selectedTrackNumbers, setSelectedTrackNumbers] = useState<Set<number>>(() => new Set(defaultTracks(12).map((track) => track.track_number)));
  const [candidates, setCandidates] = useState<CdRipReleaseCandidate[]>([]);
  const [progress, setProgress] = useState<CdRipProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedDrive = setup?.drives.find((drive) => drive.id === selectedDriveId) ?? setup?.drives[0] ?? null;
  const activeJob = Boolean(progress && !["completed", "failed", "canceled"].includes(progress.status));
  const progressPercent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const chosenTracks = useMemo(
    () => tracks.filter((track) => selectedTrackNumbers.has(track.track_number)),
    [selectedTrackNumbers, tracks],
  );

  async function loadSetup(showToast = false) {
    try {
      const response = await fetchCdRipSetup();
      setSetup(response);
      const nextDrive = selectedDriveId || response.drives[0]?.id || "";
      setSelectedDriveId(nextDrive);
      const drive = response.drives.find((item) => item.id === nextDrive) ?? response.drives[0];
      if (drive?.tracks.length) {
        setTracks(drive.tracks);
        setSelectedTrackNumbers(new Set(drive.tracks.map((track) => track.track_number)));
      }
      if (showToast) {
        setStatus(response.message);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check CD setup");
    }
  }

  useEffect(() => {
    void loadSetup(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!jobId || !activeJob) {
      return undefined;
    }
    const timer = window.setInterval(async () => {
      try {
        const latest = await fetchCdRipProgress(jobId);
        setProgress(latest);
        if (["completed", "failed", "canceled"].includes(latest.status)) {
          window.clearInterval(timer);
          setStatus(latest.error ?? latest.message ?? "CD rip finished");
        }
      } catch (error) {
        window.clearInterval(timer);
        setStatus(error instanceof Error ? error.message : "Could not refresh CD rip progress");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeJob, jobId, setStatus]);

  function toggleTrack(trackNumber: number) {
    setSelectedTrackNumbers((current) => {
      const next = new Set(current);
      if (next.has(trackNumber)) {
        next.delete(trackNumber);
      } else {
        next.add(trackNumber);
      }
      return next;
    });
  }

  function seedManualTracks() {
    const seeded = defaultTracks(manualTrackCount);
    setTracks(seeded);
    setSelectedTrackNumbers(new Set(seeded.map((track) => track.track_number)));
    setCandidates([]);
  }

  function useCandidate(candidate: CdRipReleaseCandidate) {
    const candidateTracks = candidate.tracks.length ? candidate.tracks : defaultTracks(candidate.track_count || manualTrackCount);
    setAlbumTitle(candidate.title ?? "");
    setAlbumArtist(candidate.artist ?? "");
    setYear(candidate.year ?? 0);
    setReleaseId(candidate.release_id);
    setTracks(candidateTracks);
    setSelectedTrackNumbers(new Set(candidateTracks.map((track) => track.track_number)));
    setStatus(`Loaded ${candidate.title ?? "MusicBrainz"} metadata`);
  }

  async function handleLookupMetadata() {
    setLoading(true);
    try {
      const response = await lookupCdRipMetadata({
        drive_id: selectedDriveId || null,
        album_title: albumTitle || null,
        album_artist: albumArtist || null,
        release_id: releaseId || null,
        limit: 5,
      });
      setCandidates(response.candidates);
      if (response.candidates[0]) {
        useCandidate(response.candidates[0]);
      }
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not look up CD metadata");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartRip() {
    if (!selectedDriveId) {
      setStatus("Choose a CD drive first");
      return;
    }
    if (!outputFolder.trim()) {
      setStatus("Choose a CD rip output folder first");
      return;
    }
    if (!chosenTracks.length) {
      setStatus("Select at least one CD track");
      return;
    }
    if (!window.confirm(`Rip ${chosenTracks.length} CD track${chosenTracks.length === 1 ? "" : "s"} to ${outputFormat.toUpperCase()}?`)) {
      return;
    }
    try {
      setProgress(null);
      const started = await startCdRip({
        drive_id: selectedDriveId,
        output_folder: outputFolder,
        output_format: outputFormat,
        track_numbers: chosenTracks.map((track) => track.track_number),
        tracks: chosenTracks,
        album_title: albumTitle || null,
        album_artist: albumArtist || null,
        year: year > 0 ? year : null,
        genre: genre || null,
        secure_mode: secureMode,
        verify,
        overwrite,
        bitrate_kbps: outputFormat === "mp3" ? bitrateKbps : null,
      });
      setJobId(started.job_id);
      const latest = await fetchCdRipProgress(started.job_id);
      setProgress(latest);
      setStatus(latest.message ?? "CD rip started");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start CD rip");
    }
  }

  async function handleCancelRip() {
    if (!jobId) {
      return;
    }
    try {
      const latest = await cancelCdRip(jobId);
      setProgress(latest);
      setStatus(latest.message ?? "Canceling CD rip");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not cancel CD rip");
    }
  }

  async function handlePlayCd() {
    try {
      const trackNumber = chosenTracks[0]?.track_number ?? tracks[0]?.track_number ?? 1;
      const response = await playCdTrack(trackNumber, selectedDriveId);
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play CD track");
    }
  }

  async function handleStopCd() {
    try {
      const response = await stopCdPlayback();
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not stop CD playback");
    }
  }

  return (
    <DisclosureSection title="CD Ripper" description="CD playback, secure extraction, MusicBrainz metadata, and local verification">
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="grid gap-2 md:grid-cols-4">
          <div className={`rounded border px-3 py-2 ${statusTone(Boolean(setup?.secure_ripping_available))}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase">
              <ShieldCheck size={14} />
              Secure Rip
            </div>
            <div className="mt-1 text-xs">{setup?.secure_ripping_available ? "Ready" : "Tool needed"}</div>
          </div>
          <div className={`rounded border px-3 py-2 ${statusTone(Boolean(setup?.ffmpeg_available))}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase">
              <Download size={14} />
              Encoder
            </div>
            <div className="mt-1 text-xs">{setup?.ffmpeg_available ? "FFmpeg ready" : "FFmpeg needed"}</div>
          </div>
          <div className={`rounded border px-3 py-2 ${statusTone(Boolean(setup?.cd_text_available))}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase">
              <ListChecks size={14} />
              CD-Text
            </div>
            <div className="mt-1 text-xs">{setup?.cd_text_available ? "Tool ready" : "Tool needed"}</div>
          </div>
          <div className={`rounded border px-3 py-2 ${statusTone(Boolean(setup?.accuraterip_available))}`}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase">
              <CheckCircle2 size={14} />
              AccurateRip
            </div>
            <div className="mt-1 text-xs">{setup?.accuraterip_available ? "Verifier found" : "Hashes only"}</div>
          </div>
        </div>

        <div className="rounded border border-line bg-ink p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Disc3 size={16} />
              <span className="truncate">{setup?.message ?? "Checking CD tools"}</span>
            </div>
            <button className="secondary-button h-8" type="button" onClick={() => void loadSetup(true)}>
              <RefreshCw size={14} />
              Check
            </button>
          </div>
          {setup?.tool_directory && <div className="truncate text-muted">Portable tools folder: {setup.tool_directory}</div>}
          {setup?.warnings.slice(0, 4).map((warning) => (
            <div key={warning} className="mt-1 flex min-w-0 items-center gap-2 text-ember">
              <AlertTriangle size={13} className="shrink-0" />
              <span className="truncate">{warning}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Drive</span>
            <select
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={selectedDriveId}
              onChange={(event) => setSelectedDriveId(event.target.value)}
            >
              {setup?.drives.length ? setup.drives.map((drive) => (
                <option key={drive.id} value={drive.id}>
                  {drive.id} - {drive.label}{drive.track_count ? ` (${drive.track_count} tracks)` : ""}
                </option>
              )) : <option value="">No CD drive detected</option>}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Output Folder</span>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={outputFolder}
              placeholder="Example: D:\\Ripped CDs"
              onChange={(event) => setOutputFolder(event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Album</span>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={albumTitle}
              placeholder="Album title"
              onChange={(event) => setAlbumTitle(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Artist</span>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={albumArtist}
              placeholder="Album artist"
              onChange={(event) => setAlbumArtist(event.target.value)}
            />
          </label>
          <button className="secondary-button self-end" type="button" disabled={loading} onClick={() => void handleLookupMetadata()}>
            <Search size={15} />
            Lookup
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Format</span>
            <select
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 focus:ring-2"
              value={outputFormat}
              onChange={(event) => setOutputFormat(event.target.value as CdRipOutputFormat)}
            >
              <option value="flac">FLAC</option>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          <NumberField label="MP3 Kbps" value={bitrateKbps} min={96} max={320} onChange={setBitrateKbps} />
          <NumberField label="Year" value={year} min={0} max={3000} onChange={setYear} />
          <label className="grid gap-2">
            <span className="text-xs uppercase text-muted">Genre</span>
            <input
              className="h-9 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
              value={genre}
              placeholder="Optional"
              onChange={(event) => setGenre(event.target.value)}
            />
          </label>
          <NumberField label="Track Count" value={manualTrackCount} min={1} max={120} onChange={setManualTrackCount} />
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Secure mode</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={secureMode} onChange={(event) => setSecureMode(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Verify hashes</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={verify} onChange={(event) => setVerify(event.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded border border-line/70 bg-ink px-3 py-2">
            <span className="text-muted">Overwrite</span>
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
          </label>
          <button className="secondary-button h-10" type="button" onClick={seedManualTracks}>
            <Music2 size={15} />
            Reset Tracks
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" disabled={!selectedDriveId} onClick={() => void handlePlayCd()}>
            <Play size={15} />
            Play CD
          </button>
          <button className="secondary-button" type="button" onClick={() => void handleStopCd()}>
            <Square size={15} />
            Stop
          </button>
          <button className="primary-button" type="button" disabled={activeJob} onClick={() => void handleStartRip()}>
            <Download size={15} />
            Rip Selected
          </button>
          <button className="secondary-button" type="button" disabled={!activeJob} onClick={() => void handleCancelRip()}>
            <Ban size={15} />
            Cancel
          </button>
        </div>

        {candidates.length > 1 && (
          <div className="grid gap-2 rounded border border-line bg-ink p-3 text-xs">
            <div className="font-medium text-neutral-200">Metadata Candidates</div>
            <div className="grid gap-2 md:grid-cols-2">
              {candidates.slice(0, 6).map((candidate) => (
                <button
                  key={candidate.release_id}
                  className="grid min-w-0 gap-1 rounded border border-line/70 bg-panel p-2 text-left hover:border-moss/60"
                  type="button"
                  onClick={() => useCandidate(candidate)}
                >
                  <span className="truncate text-neutral-100">{candidate.title ?? "Untitled release"}</span>
                  <span className="truncate text-muted">
                    {candidate.artist ?? "Unknown artist"} · {candidate.year ?? "no year"} · {(candidate.confidence * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded border border-line bg-ink p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-neutral-200">
              {chosenTracks.length.toLocaleString()} of {tracks.length.toLocaleString()} track{tracks.length === 1 ? "" : "s"} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="secondary-button h-8" type="button" onClick={() => setSelectedTrackNumbers(new Set(tracks.map((track) => track.track_number)))}>
                All
              </button>
              <button className="secondary-button h-8" type="button" onClick={() => setSelectedTrackNumbers(new Set())}>
                None
              </button>
            </div>
          </div>
          <div className="grid max-h-80 gap-1 overflow-auto pr-1">
            {tracks.map((track) => (
              <label key={`${track.disc_number ?? 1}-${track.track_number}`} className="grid grid-cols-[auto_3rem_1fr_auto] items-center gap-2 rounded bg-panel px-2 py-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={selectedTrackNumbers.has(track.track_number)}
                  onChange={() => toggleTrack(track.track_number)}
                />
                <span className="text-muted">{track.track_number.toString().padStart(2, "0")}</span>
                <span className="min-w-0 truncate text-neutral-100">{track.title ?? `Track ${track.track_number.toString().padStart(2, "0")}`}</span>
                <span className="text-muted">{formatDuration(track.duration_seconds)}</span>
              </label>
            ))}
          </div>
        </div>

        {progress && (
          <div className="rounded border border-line bg-ink p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-neutral-200">
                <Disc3 size={15} />
                <span className="truncate">{progress.message ?? progress.status}</span>
              </div>
              <div className="text-muted">{progressPercent.toFixed(0)}%</div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel">
              <div className="h-full rounded-full bg-moss transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-muted">
              <span>{progress.processed_tracks.toLocaleString()} / {progress.total_tracks.toLocaleString()}</span>
              <span>{progress.ripped_tracks.toLocaleString()} ripped</span>
              <span>{progress.skipped_tracks.toLocaleString()} skipped</span>
              {progress.current_track && <span>{progress.current_track}</span>}
            </div>
            {progress.errors.slice(0, 5).map((error) => (
              <div key={error} className="mt-1 truncate text-ember">{error}</div>
            ))}
            {progress.verification.length > 0 && (
              <div className="mt-3 grid gap-1">
                <div className="font-medium text-neutral-200">Verification</div>
                {progress.verification.slice(0, 8).map((entry) => (
                  <div key={`${entry.track_number}-${entry.sha256}`} className="truncate text-muted">
                    Track {entry.track_number.toString().padStart(2, "0")} · {entry.sha256.slice(0, 16)} · {entry.bytes.toLocaleString()} bytes
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedDrive && (
          <div className="text-xs text-muted">
            Selected drive: {selectedDrive.id} · {selectedDrive.label}{selectedDrive.volume_name ? ` · ${selectedDrive.volume_name}` : ""}
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
