import {
Cog,
FolderOpen,
Plus,
RefreshCw,
X,
} from "lucide-react";
import {
useState,
} from "react";

import type {
FolderWatchStatus,
ScanProgress,
ScanResult,
} from "../../types/api";
import type {
SourceScanRule,
SourceScanRules,
} from "../shared";
import {
fileName,
formatTime,
} from "../shared";
import { FolderWatchSection } from "./sources/FolderWatchSection";

function uniqueSourceFolders(paths: string[]) {
  const seen = new Set<string>();
  return paths
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => {
      const key = path.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

const defaultSourceScanRule: SourceScanRule = {
  enabled: true,
  removeMissing: true,
};

function sourceScanRuleKey(path: string) {
  return path.trim().toLowerCase();
}

export function SourcesPage({
  folderPath,
  setFolderPath,
  libraryFolders,
  setLibraryFolders,
  suggestedMusicPath,
  onBrowse,
  onScan,
  onCancelScan,
  onRetryScan,
  onRemoveSource,
  scanResult,
  scanProgress,
  scanStuck,
  scanStuckMessage,
  isScanning,
  folderWatchStatus,
  onStartFolderWatch,
  onStopFolderWatch,
  onRefreshFolderWatch,
  onApplyFolderWatch,
  onAcknowledgeFolderWatchNotifications,
  sourceScanRules,
  onSourceScanRuleChange,
}: {
  folderPath: string;
  setFolderPath: (value: string) => void;
  libraryFolders: string[];
  setLibraryFolders: (value: string[]) => void;
  suggestedMusicPath?: string | null;
  onBrowse: () => void;
  onScan: (pathOverride?: string | string[], options?: { cleanupFolderPaths?: string[] }) => void | Promise<void>;
  onCancelScan: () => void | Promise<void>;
  onRetryScan: () => void | Promise<void>;
  onRemoveSource: (path: string) => void | Promise<void>;
  scanResult: ScanResult | null;
  scanProgress: ScanProgress | null;
  scanStuck: boolean;
  scanStuckMessage: string | null;
  isScanning: boolean;
  folderWatchStatus: FolderWatchStatus | null;
  onStartFolderWatch: (intervalSeconds: number) => void | Promise<void>;
  onStopFolderWatch: () => void | Promise<void>;
  onRefreshFolderWatch: () => void | Promise<void>;
  onApplyFolderWatch: (changeIds: string[], applyAll?: boolean) => void | Promise<void>;
  onAcknowledgeFolderWatchNotifications: (notificationIds: string[], allNotifications?: boolean) => void | Promise<void>;
  sourceScanRules: SourceScanRules;
  onSourceScanRuleChange: (path: string, rule: SourceScanRule) => void;
}) {
  const [openRulePath, setOpenRulePath] = useState<string | null>(null);
  const normalizedLibraryFolders = uniqueSourceFolders(libraryFolders);
  const scanRuleFor = (path: string) => sourceScanRules[sourceScanRuleKey(path)] ?? defaultSourceScanRule;
  const enabledLibraryFolders = normalizedLibraryFolders.filter((path) => scanRuleFor(path).enabled);
  const cleanupFoldersFor = (paths: string[]) => paths.filter((path) => scanRuleFor(path).removeMissing);
  const pendingFolderPath = folderPath.trim();
  const suggestedFolderAvailable = Boolean(
    suggestedMusicPath &&
      !normalizedLibraryFolders.some((path) => path.toLowerCase() === suggestedMusicPath.trim().toLowerCase()),
  );
  const progressPercent = Math.max(0, Math.min(100, scanProgress?.percent ?? 0));
  const hasScanCount = Boolean(scanProgress && scanProgress.total_files > 0);

  function addTypedFolder() {
    if (!pendingFolderPath) {
      return;
    }
    const next = uniqueSourceFolders([...libraryFolders, pendingFolderPath]);
    setLibraryFolders(next);
    setFolderPath("");
  }

  function addSuggestedMusicFolder() {
    if (!suggestedMusicPath) {
      return;
    }
    const next = uniqueSourceFolders([...libraryFolders, suggestedMusicPath]);
    setLibraryFolders(next);
    setFolderPath("");
  }

  function runFolderScan(paths: string[]) {
    const targetPaths = uniqueSourceFolders(paths).filter((path) => scanRuleFor(path).enabled);
    if (targetPaths.length === 0) {
      return;
    }
    return onScan(targetPaths, { cleanupFolderPaths: cleanupFoldersFor(targetPaths) });
  }

  function updateScanRule(path: string, patch: Partial<SourceScanRule>) {
    onSourceScanRuleChange(path, {
      ...defaultSourceScanRule,
      ...scanRuleFor(path),
      ...patch,
    });
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Sources</h1>
          <p className="text-xs text-muted">Choose the local folders FLAC Cafe scans for music.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button h-10" type="button" onClick={onBrowse} disabled={isScanning}>
            <FolderOpen size={17} />
            Browse
          </button>
          <button
            className="primary-button h-10"
            type="button"
            disabled={isScanning || enabledLibraryFolders.length === 0}
            onClick={() => void runFolderScan(normalizedLibraryFolders)}
          >
            <RefreshCw size={17} />
            {isScanning ? "Scanning" : "Rescan All"}
          </button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-auto p-6">
        <div className="grid max-w-5xl gap-5">
          <div className="rounded border border-line bg-panel p-4 shadow-sm shadow-black/10">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="grid gap-2 text-sm text-neutral-200">
                <span className="text-xs uppercase text-muted">Add Folder</span>
                <input
                  value={folderPath}
                  onChange={(event) => setFolderPath(event.target.value)}
                  className="h-10 rounded border border-line bg-ink px-3 text-white outline-none ring-moss/40 placeholder:text-muted focus:ring-2"
                  placeholder="C:\\Users\\you\\Music"
                />
              </label>
              <button className="secondary-button h-10" type="button" onClick={addTypedFolder} disabled={isScanning || !pendingFolderPath}>
                <Plus size={17} />
                Add
              </button>
            </div>
            {suggestedFolderAvailable && suggestedMusicPath && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded border border-ember/30 bg-ember/10 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-white">Use your Windows Music folder?</div>
                  <div className="truncate text-xs text-muted">{suggestedMusicPath}</div>
                </div>
                <button className="secondary-button shrink-0" type="button" onClick={addSuggestedMusicFolder}>
                  <FolderOpen size={15} />
                  Use Folder
                </button>
              </div>
            )}
          </div>

          <div className="rounded border border-line bg-panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Library Folders</div>
                <div className="text-xs text-muted">
                  {normalizedLibraryFolders.length
                    ? `${normalizedLibraryFolders.length.toLocaleString()} source folder${normalizedLibraryFolders.length === 1 ? "" : "s"}`
                    : "No folders selected yet"}
                  {normalizedLibraryFolders.length > 0 ? " - removing a source also removes its tracks from the library, not from disk" : ""}
                </div>
              </div>
              <button
                className="secondary-button h-9"
                type="button"
                disabled={isScanning || normalizedLibraryFolders.length === 0}
                onClick={() => void runFolderScan(normalizedLibraryFolders)}
              >
                <RefreshCw size={15} />
                Rescan All
              </button>
            </div>

            <div className="grid gap-2">
              {normalizedLibraryFolders.length > 0 ? (
                normalizedLibraryFolders.map((path) => {
                  const rule = scanRuleFor(path);
                  const isRulesOpen = openRulePath === path;
                  return (
                    <div key={path} className="grid min-w-0 gap-2 rounded border border-line/70 bg-ink px-3 py-2">
                      <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div className="flex min-w-0 items-center gap-2">
                          <FolderOpen size={15} className="shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 truncate text-sm text-neutral-200" title={path}>{path}</span>
                          {!rule.enabled && <span className="rounded border border-line px-2 py-0.5 text-[11px] uppercase text-muted">off</span>}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="icon-button h-8 w-8"
                            type="button"
                            title="Folder scan rules"
                            aria-expanded={isRulesOpen}
                            onClick={() => setOpenRulePath(isRulesOpen ? null : path)}
                          >
                            <Cog size={14} />
                          </button>
                          <button
                            className="secondary-button h-8"
                            type="button"
                            disabled={isScanning || !rule.enabled}
                            onClick={() => void runFolderScan([path])}
                          >
                            <RefreshCw size={15} />
                            Rescan
                          </button>
                          <button
                            className="icon-button h-8 w-8"
                            type="button"
                            title="Remove source and its tracks from the library"
                            disabled={isScanning}
                            onClick={() => void onRemoveSource(path)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      {isRulesOpen && (
                        <div className="grid gap-2 rounded border border-line/70 bg-panel p-3 text-sm md:grid-cols-2">
                          <label className="flex items-center justify-between gap-3 rounded border border-line/60 bg-ink px-3 py-2">
                            <span className="text-muted">Include in Rescan All</span>
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-moss"
                              checked={rule.enabled}
                              onChange={(event) => updateScanRule(path, { enabled: event.target.checked })}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-3 rounded border border-line/60 bg-ink px-3 py-2">
                            <span className="text-muted">Remove missing tracks</span>
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-ember"
                              checked={rule.removeMissing}
                              onChange={(event) => updateScanRule(path, { removeMissing: event.target.checked })}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded border border-dashed border-line bg-ink px-3 py-10 text-center text-sm text-muted">
                  Browse for a folder or paste a path above to begin.
                </div>
              )}
            </div>
          </div>

          <FolderWatchSection
            folderPath={normalizedLibraryFolders[0] ?? folderPath}
            folderWatchStatus={folderWatchStatus}
            onStartFolderWatch={onStartFolderWatch}
            onStopFolderWatch={onStopFolderWatch}
            onRefreshFolderWatch={onRefreshFolderWatch}
            onApplyFolderWatch={onApplyFolderWatch}
            onAcknowledgeFolderWatchNotifications={onAcknowledgeFolderWatchNotifications}
          />

          {scanProgress && !["completed", "failed", "cancelled"].includes(scanProgress.status) && (
            <div className="rounded border border-line bg-panel p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-white">
                    {scanProgress.status === "cancelling"
                      ? "Cancelling scan"
                      : scanProgress.status === "cleaning"
                        ? "Removing missing files"
                        : hasScanCount
                          ? "Scanning library"
                          : "Finding audio files"}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {hasScanCount
                      ? `${scanProgress.processed_files.toLocaleString()} of ${scanProgress.total_files.toLocaleString()} files`
                      : "Counting supported audio files"}
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>Elapsed {formatTime(scanProgress.elapsed_seconds)}</div>
                  <div>ETA {formatTime(scanProgress.eta_seconds)}</div>
                </div>
                <div className="flex gap-2">
                  <button className="secondary-button h-8" type="button" disabled={scanProgress.status === "cancelling"} onClick={() => void onCancelScan()}>
                    Cancel
                  </button>
                  {scanStuck && (
                    <button className="primary-button h-8" type="button" onClick={() => void onRetryScan()}>
                      Retry
                    </button>
                  )}
                </div>
              </div>
              {scanStuck && (
                <div className="mb-3 rounded border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember">
                  {scanStuckMessage ?? "This scan has stopped reporting progress. You can cancel or retry it."}
                </div>
              )}

              <div className="h-2 overflow-hidden rounded bg-ink">
                <div
                  className={`h-full rounded bg-moss transition-all duration-300 ${hasScanCount ? "" : "w-1/3 animate-pulse"}`}
                  style={hasScanCount ? { width: `${progressPercent}%` } : undefined}
                />
              </div>

              <div className="mt-3 grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="font-semibold text-white">{scanProgress.inserted}</div>
                  <div className="text-xs text-muted">Inserted</div>
                </div>
                <div>
                  <div className="font-semibold text-ember">{scanProgress.updated}</div>
                  <div className="text-xs text-muted">Updated</div>
                </div>
                <div>
                  <div className="font-semibold text-red-200">{scanProgress.removed}</div>
                  <div className="text-xs text-muted">Removed</div>
                </div>
                <div>
                  <div className="font-semibold text-red-300">{scanProgress.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
                <div>
                  <div className="font-semibold text-moss">{progressPercent.toFixed(0)}%</div>
                  <div className="text-xs text-muted">Progress</div>
                </div>
              </div>

              {scanProgress.current_path && (
                <div className="mt-3 truncate text-xs text-muted" title={scanProgress.current_path}>
                  {fileName(scanProgress.current_path)}
                </div>
              )}
            </div>
          )}

          {scanProgress?.status === "failed" && (
            <div className="grid gap-3 rounded border border-red-400/40 bg-red-950/20 p-4 text-red-200">
              <div>{scanProgress.error ?? "Scan failed"}</div>
              <button className="secondary-button h-8 w-fit" type="button" onClick={() => void onRetryScan()}>
                Retry Scan
              </button>
            </div>
          )}

          {scanProgress?.status === "cancelled" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-panel p-4 text-sm text-muted">
              <span>Scan cancelled.</span>
              <button className="secondary-button h-8" type="button" onClick={() => void onRetryScan()}>
                Retry Scan
              </button>
            </div>
          )}

          {scanResult && (
            <div className="rounded border border-line bg-panel p-4">
              <div className="mb-2 truncate font-medium text-white" title={scanResult.folder_paths.join("; ") || scanResult.folder_path}>
                {scanResult.folder_paths.length > 1
                  ? `${scanResult.folder_paths.length.toLocaleString()} source folders`
                  : scanResult.folder_path}
              </div>
              <div className="grid grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-white">{scanResult.scanned_files}</div>
                  <div className="text-xs text-muted">Scanned</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-moss">{scanResult.inserted}</div>
                  <div className="text-xs text-muted">Inserted</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-ember">{scanResult.updated}</div>
                  <div className="text-xs text-muted">Updated</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-200">{scanResult.removed}</div>
                  <div className="text-xs text-muted">Removed</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-300">{scanResult.skipped}</div>
                  <div className="text-xs text-muted">Skipped</div>
                </div>
              </div>
              {scanResult.errors.length > 0 && (
                <details className="mt-3 text-xs text-muted">
                  <summary>Scan errors</summary>
                  <ul className="mt-2 grid gap-1">
                    {scanResult.errors.slice(0, 20).map((error) => (
                      <li key={error} className="truncate">
                        {error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
