import {
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Info,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type {
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
  onCreateSupportBundle,
  supportBundlePath,
  onCopySupportBundlePath,
  onClearArtistCache,
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
  onCreateSupportBundle: () => void;
  supportBundlePath: string | null;
  onCopySupportBundlePath: () => void;
  onClearArtistCache: () => void;
}) {
  const reviewItems = startupDiagnostics?.items.filter((item) => !item.ok) ?? [];

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
      </div>
    </DisclosureSection>
  );
}
