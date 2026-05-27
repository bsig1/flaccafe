import {
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import type {
  BulkLyricsProgress,
  LogTailResponse,
  StartupDiagnosticsResponse,
} from "../../../types/api";
import {
  DisclosureSection,
} from "../../components/common";
import type {
  BackendStatus,
  UiPreferences,
} from "../../shared";

export function MaintenanceSection({
  backendStatus,
  backendStatusClass,
  backendMessage,
  backendCheckedAt,
  startupDiagnostics,
  backendLog,
  uiPreferences,
  setUiPreferences,
  onCheckBackend,
  onRunStartupDiagnostics,
  onOpenBackendLog,
  onRestartBackend,
  onOpenSourceFolder,
  onBackupDatabase,
  onResetLocalData,
  onCreateSupportBundle,
  supportBundlePath,
  onCopySupportBundlePath,
  onClearArtistCache,
  bulkLyricsProgress,
  bulkLyricsIncludeOnline,
  bulkLyricsOnlyMissing,
  bulkLyricsLimit,
  isStartingBulkLyrics,
  onBulkLyricsIncludeOnlineChange,
  onBulkLyricsOnlyMissingChange,
  onBulkLyricsLimitChange,
  onStartBulkLyrics,
  onCancelBulkLyrics,
}: {
  backendStatus: BackendStatus;
  backendStatusClass: string;
  backendMessage: string;
  backendCheckedAt: string | null;
  startupDiagnostics: StartupDiagnosticsResponse | null;
  backendLog: LogTailResponse | null;
  uiPreferences: UiPreferences;
  setUiPreferences: (updater: (current: UiPreferences) => UiPreferences) => void;
  onCheckBackend: () => void;
  onRunStartupDiagnostics: () => void;
  onOpenBackendLog: () => void;
  onRestartBackend: () => void;
  onOpenSourceFolder: () => void;
  onBackupDatabase: () => void;
  onResetLocalData: () => void;
  onCreateSupportBundle: () => void;
  supportBundlePath: string | null;
  onCopySupportBundlePath: () => void;
  onClearArtistCache: () => void;
  bulkLyricsProgress: BulkLyricsProgress | null;
  bulkLyricsIncludeOnline: boolean;
  bulkLyricsOnlyMissing: boolean;
  bulkLyricsLimit: string;
  isStartingBulkLyrics: boolean;
  onBulkLyricsIncludeOnlineChange: (value: boolean) => void;
  onBulkLyricsOnlyMissingChange: (value: boolean) => void;
  onBulkLyricsLimitChange: (value: string) => void;
  onStartBulkLyrics: () => void;
  onCancelBulkLyrics: () => void;
}) {
  const reviewItems = startupDiagnostics?.items.filter((item) => !item.ok) ?? [];
  const bulkLyricsActive = Boolean(
    bulkLyricsProgress && ["pending", "scanning", "cancelling"].includes(bulkLyricsProgress.status),
  );
  const bulkLyricsReady =
    (bulkLyricsProgress?.already_cached ?? 0) +
    (bulkLyricsProgress?.embedded_found ?? 0) +
    (bulkLyricsProgress?.online_found ?? 0);

  return (
    <DisclosureSection title="Maintenance" description="Background services and database helpers">
      <div className="grid gap-3 text-sm text-neutral-200">
        <div className="rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-white">Backend service</div>
              <div className="mt-1 truncate text-xs text-muted">
                {backendCheckedAt ? `Last checked ${backendCheckedAt}` : "Not checked yet"}
              </div>
            </div>
            <span className={`shrink-0 rounded border px-2 py-1 text-xs uppercase ${backendStatusClass}`}>
              {backendStatus}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted">{backendMessage}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={onCheckBackend}>
              <RefreshCw size={15} />
              Check Backend
            </button>
            <button className="secondary-button" type="button" onClick={onRestartBackend} disabled={backendStatus === "restarting"}>
              <RefreshCw size={15} />
              {backendStatus === "restarting" ? "Restarting" : "Restart Backend"}
            </button>
            <button className="secondary-button" type="button" onClick={onOpenSourceFolder}>
              <FolderOpen size={15} />
              Open Source Folder
            </button>
          </div>
        </div>

        <div className="rounded border border-line/70 bg-ink p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-white">Startup self-check</div>
              <div className="mt-1 truncate text-xs text-muted">
                {startupDiagnostics
                  ? `Last run ${new Date(startupDiagnostics.generated_at).toLocaleString()}`
                  : "Not run yet"}
              </div>
            </div>
            <span
              className={`shrink-0 rounded border px-2 py-1 text-xs uppercase ${
                startupDiagnostics?.ok
                  ? "border-moss/40 bg-moss/10 text-moss"
                  : startupDiagnostics
                    ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-100"
                    : "border-line bg-panel text-muted"
              }`}
            >
              {startupDiagnostics ? (startupDiagnostics.ok ? "ok" : "review") : "unknown"}
            </span>
          </div>
          {startupDiagnostics && (
            <div className="mt-3 grid gap-2">
              {reviewItems.length > 0 && (
                <div className="rounded border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
                  {reviewItems.length.toLocaleString()} self-check note{reviewItems.length === 1 ? "" : "s"} to review.
                  Optional features and ignored shutdown noise do not mean FLAC Cafe is broken.
                </div>
              )}
              {startupDiagnostics.items.map((item) => (
                <div key={item.key} className="flex items-start gap-2 text-xs">
                  {item.ok ? (
                    <CheckCircle2 className="mt-0.5 shrink-0 text-moss" size={14} />
                  ) : (
                    <Info className="mt-0.5 shrink-0 text-yellow-100" size={14} />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-200">{item.label}</div>
                    <div className="truncate text-muted" title={item.path ?? item.message}>
                      {item.message}
                      {item.path ? ` - ${item.path}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={onRunStartupDiagnostics}>
              <ShieldCheck size={15} />
              Run Self-Check
            </button>
            <button className="secondary-button" type="button" onClick={onOpenBackendLog}>
              <FileText size={15} />
              Open Log
            </button>
          </div>
          {backendLog && (
            <details className="mt-3 rounded border border-line bg-panel p-2 text-xs text-muted">
              <summary className="cursor-pointer text-neutral-200">
                {backendLog.exists ? `Log tail (${backendLog.lines.length} lines)` : "No backend log yet"}
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5">
                {backendLog.lines.join("\n") || backendLog.path}
              </pre>
            </details>
          )}
        </div>

        <div className="rounded border border-line/70 bg-ink p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-white">Bulk lyric lookup</div>
              <div className="mt-1 text-xs text-muted">
                Preloads embedded lyrics into SQLite and can fill missing songs from LRCLIB.
              </div>
            </div>
            <span className="shrink-0 rounded border border-line bg-panel px-2 py-1 text-xs uppercase text-muted">
              {bulkLyricsProgress?.status ?? "idle"}
            </span>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_8rem]">
            <label className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2">
              <span className="text-xs text-muted">Only missing lyrics</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={bulkLyricsOnlyMissing}
                disabled={bulkLyricsActive}
                onChange={(event) => onBulkLyricsOnlyMissingChange(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2">
              <span className="text-xs text-muted">Include online lookup</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-moss"
                checked={bulkLyricsIncludeOnline}
                disabled={bulkLyricsActive}
                onChange={(event) => onBulkLyricsIncludeOnlineChange(event.target.checked)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs uppercase text-muted">Limit</span>
              <input
                className="h-9 rounded border border-line bg-panel px-3 text-sm text-white outline-none ring-moss/40 focus:ring-2 disabled:opacity-60"
                value={bulkLyricsLimit}
                inputMode="numeric"
                disabled={bulkLyricsActive}
                onChange={(event) => onBulkLyricsLimitChange(event.target.value.replace(/[^\d]/g, ""))}
              />
            </label>
          </div>

          {bulkLyricsProgress && (
            <div className="mt-3 grid gap-2">
              <div className="h-2 overflow-hidden rounded bg-panel">
                <div
                  className="h-full bg-moss transition-[width]"
                  style={{ width: `${Math.round(bulkLyricsProgress.percent)}%` }}
                />
              </div>
              <div className="grid gap-1 text-xs text-muted sm:grid-cols-2">
                <div>
                  {bulkLyricsProgress.processed_tracks.toLocaleString()} / {bulkLyricsProgress.total_tracks.toLocaleString()} tracks
                  {bulkLyricsProgress.current_title ? ` - ${bulkLyricsProgress.current_title}` : ""}
                </div>
                <div className="sm:text-right">
                  {bulkLyricsReady.toLocaleString()} ready, {bulkLyricsProgress.missing.toLocaleString()} missing, {bulkLyricsProgress.failed.toLocaleString()} failed
                </div>
              </div>
              {bulkLyricsProgress.errors.length > 0 && (
                <details className="rounded border border-line bg-panel p-2 text-xs text-muted">
                  <summary className="cursor-pointer text-neutral-200">Recent lyric lookup errors</summary>
                  <div className="mt-2 grid gap-1">
                    {bulkLyricsProgress.errors.map((error) => (
                      <div key={error} className="truncate" title={error}>{error}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="secondary-button"
              type="button"
              disabled={bulkLyricsActive || isStartingBulkLyrics}
              onClick={onStartBulkLyrics}
            >
              <Search size={15} />
              {isStartingBulkLyrics ? "Starting" : "Start Lookup"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!bulkLyricsActive}
              onClick={onCancelBulkLyrics}
            >
              <X size={15} />
              Cancel
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between gap-4">
          <span className="text-muted">Artist lookup</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={uiPreferences.enableArtistLookup}
            onChange={(event) =>
              setUiPreferences((current) => ({ ...current, enableArtistLookup: event.target.checked }))
            }
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span className="text-muted">Toast notifications</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={uiPreferences.showToasts}
            onChange={(event) =>
              setUiPreferences((current) => ({ ...current, showToasts: event.target.checked }))
            }
          />
        </label>
        <div className="flex gap-2">
          <button className="secondary-button" type="button" onClick={onBackupDatabase}>
            <Download size={15} />
            Backup DB
          </button>
          <button className="secondary-button" type="button" onClick={onCreateSupportBundle}>
            <FileText size={15} />
            Support Bundle
          </button>
          <button className="secondary-button" type="button" disabled={!supportBundlePath} onClick={onCopySupportBundlePath}>
            <FileText size={15} />
            Copy Path
          </button>
          <button className="secondary-button" type="button" onClick={onClearArtistCache}>
            <RefreshCw size={15} />
            Clear Artist Cache
          </button>
        </div>
        {supportBundlePath && (
          <div className="truncate rounded border border-line/70 bg-panel px-3 py-2 text-xs text-muted" title={supportBundlePath}>
            {supportBundlePath}
          </div>
        )}

        <details className="rounded border border-line/70 bg-ink px-3 py-2 text-xs">
          <summary className="cursor-pointer text-muted hover:text-white">Advanced maintenance</summary>
          <div className="mt-3 grid gap-2 rounded border border-ember/30 bg-ember/10 p-3">
            <div className="font-medium text-ember">Reset local data</div>
            <p className="text-muted">
              Backs up and clears the SQLite library database, cached lyrics, and generated cache files. Your music files are not deleted.
            </p>
            <button className="secondary-button h-8 w-fit border-ember/50 text-ember" type="button" onClick={onResetLocalData}>
              <Trash2 size={14} />
              Reset Local Data
            </button>
          </div>
        </details>
      </div>
    </DisclosureSection>
  );
}
