import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Disc3,
  Download,
  FolderOpen,
  ListChecks,
  Music2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
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
} from "../../../lib/api";
import type {
  CdRipOutputFormat,
  CdRipProgress,
  CdRipReleaseCandidate,
  CdRipSetupResponse,
  CdRipTrackMetadata,
  Track,
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

export function CdRipperSection({
  defaultTargetFolder,
  onBrowseTarget,
  onPlayPreviewTrack,
  setStatus,
  standalone = false,
}: {
  defaultTargetFolder: string;
  onBrowseTarget: () => Promise<string | null>;
  onPlayPreviewTrack: (track: Track, queue?: Track[]) => void;
  setStatus: (message: string) => void;
  standalone?: boolean;
}) {
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
  const [preparingPlayback, setPreparingPlayback] = useState(false);

  const selectedDrive = setup?.drives.find((drive) => drive.id === selectedDriveId) ?? setup?.drives[0] ?? null;
  const activeJob = Boolean(progress && !["completed", "failed", "canceled"].includes(progress.status));
  const progressPercent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const chosenTracks = useMemo(
    () => tracks.filter((track) => selectedTrackNumbers.has(track.track_number)),
    [selectedTrackNumbers, tracks],
  );
  const setupWarnings = setup?.warnings ?? [];
  const visibleSetupWarnings = setupWarnings.filter(
    (warning) =>
      !warning.includes("native Windows CDDA") &&
      !warning.includes("AccurateRip") &&
      !warning.includes("SHA-256 verification"),
  );
  const compactInputClass = "h-8 min-w-0 rounded border border-line bg-ink px-2.5 text-sm text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2";
  const selectedDriveLabel = selectedDrive
    ? `${selectedDrive.id} - ${selectedDrive.label}${selectedDrive.volume_name ? ` - ${selectedDrive.volume_name}` : ""}`
    : "No CD drive detected";
  const statusPills = [
    {
      key: "secure",
      icon: <ShieldCheck size={13} />,
      label: "Secure",
      ready: Boolean(setup?.secure_ripping_available),
      value: setup?.secure_ripping_available ? "Ready" : "Tool",
    },
    {
      key: "encoder",
      icon: <Download size={13} />,
      label: "Encoder",
      ready: Boolean(setup?.ffmpeg_available),
      value: setup?.ffmpeg_available ? "Ready" : "FFmpeg",
    },
    {
      key: "text",
      icon: <ListChecks size={13} />,
      label: "CD-Text",
      ready: Boolean(setup?.cd_text_available),
      value: setup?.cd_text_available ? "Ready" : "Tool",
    },
    {
      key: "verify",
      icon: <CheckCircle2 size={13} />,
      label: "Verify",
      ready: Boolean(setup?.accuraterip_available),
      value: setup?.accuraterip_available ? "AccurateRip" : "SHA",
    },
  ];

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
    if (!defaultTargetFolder) {
      return;
    }
    setOutputFolder((current) => current || defaultTargetFolder);
  }, [defaultTargetFolder]);

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
    if (preparingPlayback) {
      return;
    }
    if (!selectedDriveId) {
      setStatus("Choose a CD drive first");
      return;
    }
    if (!chosenTracks.length) {
      setStatus("Select at least one CD track to play");
      return;
    }
    setPreparingPlayback(true);
    try {
      setStatus(`Preparing ${chosenTracks.length.toLocaleString()} selected CD track${chosenTracks.length === 1 ? "" : "s"}...`);
      const playbackQueue: Track[] = [];
      for (const [index, track] of chosenTracks.entries()) {
        setStatus(
          `Preparing CD track ${track.track_number.toString().padStart(2, "0")} (${index + 1}/${chosenTracks.length})...`,
        );
        const response = await playCdTrack(track.track_number, selectedDriveId, {
          albumTitle: albumTitle || null,
          albumArtist: albumArtist || null,
          year: year > 0 ? year : null,
          genre: genre || null,
          tracks: [track],
        });
        if (response.track) {
          playbackQueue.push(response.track);
        }
      }
      if (playbackQueue[0]) {
        onPlayPreviewTrack(playbackQueue[0], playbackQueue);
      }
      setStatus(
        playbackQueue.length > 1
          ? `Playing ${playbackQueue.length.toLocaleString()} selected CD tracks`
          : playbackQueue[0]
            ? `Playing CD track ${playbackQueue[0].track_number?.toString().padStart(2, "0") ?? ""}`.trim()
            : "No playable CD tracks were prepared",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not play CD track");
    } finally {
      setPreparingPlayback(false);
    }
  }

  async function browseOutputFolder() {
    const selected = await onBrowseTarget();
    if (selected) {
      setOutputFolder(selected);
    }
  }

  const content = (
      <div className="grid min-w-0 gap-3 text-sm text-neutral-200">
        <div className="rounded border border-line bg-ink px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Disc3 size={15} className="shrink-0 text-muted" />
              <span className="min-w-0 truncate text-neutral-200">{setup?.message ?? "Checking CD tools"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {statusPills.map((pill) => (
                <span
                  key={pill.key}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${statusTone(pill.ready)}`}
                  title={`${pill.label}: ${pill.value}`}
                >
                  {pill.icon}
                  <span>{pill.label}</span>
                  <span className="text-current/70">{pill.value}</span>
                </span>
              ))}
            </div>
            <button className="secondary-button h-8 shrink-0" type="button" onClick={() => void loadSetup(true)}>
              <RefreshCw size={14} />
              Check
            </button>
          </div>
          {visibleSetupWarnings.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted hover:text-white">
                Setup notes{visibleSetupWarnings.length ? ` (${visibleSetupWarnings.length})` : ""}
              </summary>
              <div className="mt-2 grid gap-1">
                {visibleSetupWarnings.slice(0, 4).map((warning) => (
                  <div key={warning} className="flex min-w-0 items-center gap-2 text-ember">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span className="truncate">{warning}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,390px)]">
          <div className="grid min-w-0 gap-3 rounded border border-line bg-ink p-3">
            <div className="grid min-w-0 gap-2 md:grid-cols-2">
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Drive</span>
                <select
                  className={compactInputClass}
                  value={selectedDriveId}
                  onChange={(event) => setSelectedDriveId(event.target.value)}
                  title={selectedDriveLabel}
                >
                  {setup?.drives.length ? setup.drives.map((drive) => (
                    <option key={drive.id} value={drive.id}>
                      {drive.id} - {drive.label}{drive.track_count ? ` (${drive.track_count})` : ""}
                    </option>
                  )) : <option value="">No CD drive detected</option>}
                </select>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Output Folder</span>
                <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    className={compactInputClass}
                    value={outputFolder}
                    placeholder={defaultTargetFolder || "D:\\Ripped CDs"}
                    onChange={(event) => setOutputFolder(event.target.value)}
                  />
                  <button
                    className="secondary-button h-8 justify-center"
                    type="button"
                    disabled={!defaultTargetFolder}
                    onClick={() => setOutputFolder(defaultTargetFolder)}
                  >
                    Default
                  </button>
                  <button className="secondary-button h-8 justify-center" type="button" onClick={() => void browseOutputFolder()}>
                    <FolderOpen size={14} />
                    Browse
                  </button>
                </div>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Album</span>
                <input
                  className={compactInputClass}
                  value={albumTitle}
                  placeholder="Album title"
                  onChange={(event) => setAlbumTitle(event.target.value)}
                />
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Artist</span>
                <input
                  className={compactInputClass}
                  value={albumArtist}
                  placeholder="Album artist"
                  onChange={(event) => setAlbumArtist(event.target.value)}
                />
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Year</span>
                <input
                  type="number"
                  min={0}
                  max={3000}
                  className={compactInputClass}
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                />
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Genre</span>
                <input
                  className={compactInputClass}
                  value={genre}
                  placeholder="Optional"
                  onChange={(event) => setGenre(event.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="secondary-button h-8" type="button" disabled={loading} onClick={() => void handleLookupMetadata()}>
                <Search size={14} />
                Lookup
              </button>
              <button className="secondary-button h-8" type="button" disabled={!selectedDriveId || preparingPlayback || !chosenTracks.length} onClick={() => void handlePlayCd()}>
                <Play size={14} />
                {preparingPlayback ? "Preparing" : `Play Selected (${chosenTracks.length.toLocaleString()})`}
              </button>
              <button className="primary-button h-8" type="button" disabled={activeJob} onClick={() => void handleStartRip()}>
                <Download size={14} />
                Rip {chosenTracks.length.toLocaleString()}
              </button>
              <button className="secondary-button h-8" type="button" disabled={!activeJob} onClick={() => void handleCancelRip()}>
                <Ban size={14} />
                Cancel
              </button>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 rounded border border-line bg-ink p-3">
            <div className={outputFormat === "mp3" ? "grid grid-cols-[minmax(0,1fr)_110px] gap-2" : "grid gap-2"}>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-[11px] uppercase text-muted">Format</span>
                <select
                  className={compactInputClass}
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value as CdRipOutputFormat)}
                >
                  <option value="flac">FLAC</option>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </label>
              {outputFormat === "mp3" && (
                <NumberField label="MP3 Kbps" value={bitrateKbps} min={96} max={320} onChange={setBitrateKbps} />
              )}
            </div>

            <details className="rounded border border-line/70 bg-panel px-3 py-2 text-xs">
              <summary className="cursor-pointer text-muted hover:text-white">Rip options</summary>
              <div className="mt-3 grid gap-2">
                <NumberField label="Track Count" value={manualTrackCount} min={1} max={120} onChange={setManualTrackCount} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center justify-between gap-2 rounded border border-line/70 bg-ink px-2 py-1.5">
                    <span className="text-muted">Secure</span>
                    <input type="checkbox" className="h-4 w-4 accent-moss" checked={secureMode} onChange={(event) => setSecureMode(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded border border-line/70 bg-ink px-2 py-1.5">
                    <span className="text-muted">Verify</span>
                    <input type="checkbox" className="h-4 w-4 accent-moss" checked={verify} onChange={(event) => setVerify(event.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded border border-line/70 bg-ink px-2 py-1.5">
                    <span className="text-muted">Overwrite</span>
                    <input type="checkbox" className="h-4 w-4 accent-moss" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
                  </label>
                </div>
                <button className="secondary-button h-8 justify-center" type="button" onClick={seedManualTracks}>
                  <Music2 size={14} />
                  Reset Manual Tracks
                </button>
              </div>
            </details>

            <div className="rounded border border-line/70 bg-panel p-2 text-xs">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="truncate text-neutral-200">
                  {chosenTracks.length.toLocaleString()} / {tracks.length.toLocaleString()} selected
                </div>
                <div className="flex gap-1">
                  <button className="secondary-button h-7 px-2" type="button" onClick={() => setSelectedTrackNumbers(new Set(tracks.map((track) => track.track_number)))}>
                    All
                  </button>
                  <button className="secondary-button h-7 px-2" type="button" onClick={() => setSelectedTrackNumbers(new Set())}>
                    None
                  </button>
                </div>
              </div>
              <div className="grid max-h-56 gap-1 overflow-auto pr-1">
                {tracks.map((track) => (
                  <label key={`${track.disc_number ?? 1}-${track.track_number}`} className="grid grid-cols-[auto_2.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded bg-ink px-2 py-1">
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
          </div>
        </div>

        {candidates.length > 1 && (
          <details className="rounded border border-line bg-ink p-3 text-xs" open>
            <summary className="cursor-pointer font-medium text-neutral-200">Metadata Candidates</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {candidates.slice(0, 6).map((candidate) => (
                <button
                  key={candidate.release_id}
                  className="grid min-w-0 gap-1 rounded border border-line/70 bg-panel p-2 text-left hover:border-moss/60"
                  type="button"
                  onClick={() => useCandidate(candidate)}
                >
                  <span className="truncate text-neutral-100">{candidate.title ?? "Untitled release"}</span>
                  <span className="truncate text-muted">
                    {candidate.artist ?? "Unknown artist"} - {candidate.year ?? "no year"} - {(candidate.confidence * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}

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
              {progress.current_track && <span className="min-w-0 truncate">{progress.current_track}</span>}
            </div>
            {progress.errors.slice(0, 5).map((error) => (
              <div key={error} className="mt-1 truncate text-ember">{error}</div>
            ))}
            {progress.verification.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-neutral-200">Verification</summary>
                <div className="mt-2 grid gap-1">
                  {progress.verification.slice(0, 8).map((entry) => (
                    <div key={`${entry.track_number}-${entry.sha256}`} className="truncate text-muted">
                      Track {entry.track_number.toString().padStart(2, "0")} - {entry.sha256.slice(0, 16)} - {entry.bytes.toLocaleString()} bytes
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {selectedDrive && (
          <div className="truncate text-xs text-muted" title={selectedDriveLabel}>
            Selected drive: {selectedDriveLabel}
          </div>
        )}
      </div>
  );

  if (standalone) {
    return content;
  }

  return (
    <DisclosureSection title="CD Ripper" description="CD playback, secure extraction, MusicBrainz metadata, and local verification">
      {content}
    </DisclosureSection>
  );
}
