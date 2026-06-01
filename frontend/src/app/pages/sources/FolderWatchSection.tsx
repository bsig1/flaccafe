import {
Bell,
CheckCircle2,
Eye,
ListChecks,
RefreshCw,
} from "lucide-react";
import {
useEffect,
useState,
} from "react";

import type {
FolderWatchChange,
FolderWatchStatus,
} from "../../../types/api";
import {
DisclosureSection,
NumberField,
} from "../../components/common";

function folderWatchTypeLabel(change: FolderWatchChange): string {
  if (change.change_type === "added") {
    return "Add";
  }
  if (change.change_type === "modified") {
    return "Update tags";
  }
  if (change.change_type === "removed") {
    return "Remove";
  }
  return "Move";
}

function folderWatchTrackLabel(change: FolderWatchChange): string {
  const title = change.title?.trim() || change.new_path?.split(/[\\/]/).pop() || change.old_path?.split(/[\\/]/).pop() || "Audio file";
  const artist = change.artist?.trim();
  return artist ? `${title} - ${artist}` : title;
}

export function FolderWatchSection({
  folderPath,
  folderWatchStatus,
  onStartFolderWatch,
  onStopFolderWatch,
  onRefreshFolderWatch,
  onApplyFolderWatch,
  onAcknowledgeFolderWatchNotifications,
}: {
  folderPath: string;
  folderWatchStatus: FolderWatchStatus | null;
  onStartFolderWatch: (intervalSeconds: number) => void | Promise<void>;
  onStopFolderWatch: () => void | Promise<void>;
  onRefreshFolderWatch: () => void | Promise<void>;
  onApplyFolderWatch: (changeIds: string[], applyAll?: boolean) => void | Promise<void>;
  onAcknowledgeFolderWatchNotifications: (notificationIds: string[], allNotifications?: boolean) => void | Promise<void>;
}) {
  const [watchIntervalSeconds, setWatchIntervalSeconds] = useState(folderWatchStatus?.interval_seconds ?? 45);
  const [acceptedFolderWatchIds, setAcceptedFolderWatchIds] = useState<Set<string>>(() => new Set());
  const folderWatchChanges = folderWatchStatus?.changes ?? [];
  const activeFolderWatchNotifications = (folderWatchStatus?.notifications ?? []).filter((notification) => !notification.acknowledged);
  const folderWatchChangeKey = folderWatchChanges.map((change) => change.id).join("|");
  const selectedWatchCount = folderWatchChanges.filter((change) => acceptedFolderWatchIds.has(change.id)).length;

  useEffect(() => {
    setWatchIntervalSeconds(folderWatchStatus?.interval_seconds ?? 45);
  }, [folderWatchStatus?.interval_seconds]);

  useEffect(() => {
    setAcceptedFolderWatchIds(new Set(folderWatchChanges.map((change) => change.id)));
  }, [folderWatchChangeKey]);

  function toggleFolderWatchChange(changeId: string) {
    setAcceptedFolderWatchIds((current) => {
      const next = new Set(current);
      if (next.has(changeId)) {
        next.delete(changeId);
      } else {
        next.add(changeId);
      }
      return next;
    });
  }

  function toggleAllFolderWatchChanges() {
    setAcceptedFolderWatchIds((current) =>
      current.size === folderWatchChanges.length ? new Set() : new Set(folderWatchChanges.map((change) => change.id)),
    );
  }

  return (
    <DisclosureSection title="Folder Watch" description="Background change detection with a review step before the database changes">
      <div className="grid gap-4 text-sm text-neutral-200">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded border px-2 py-1 text-xs uppercase ${
                  folderWatchStatus?.enabled
                    ? "border-moss/40 bg-moss/10 text-moss"
                    : "border-line bg-panel text-muted"
                }`}
              >
                {folderWatchStatus?.enabled ? "watching" : "stopped"}
              </span>
              <span className="rounded border border-line bg-panel px-2 py-1 text-xs uppercase text-muted">
                {folderWatchStatus?.status ?? "idle"}
              </span>
              <span className="rounded border border-line bg-panel px-2 py-1 text-xs uppercase text-muted">
                {folderWatchStatus?.pending_count ?? 0} pending
              </span>
            </div>
            <div className="mt-2 truncate text-xs text-muted" title={folderWatchStatus?.folder_path ?? folderPath}>
              {(folderWatchStatus?.folder_path ?? folderPath) || "No watched folder yet"}
            </div>
            {folderWatchStatus?.error && <div className="mt-2 text-xs text-ember">{folderWatchStatus.error}</div>}
          </div>
          <div className="grid gap-2 sm:grid-cols-[130px_auto] sm:items-end">
            <NumberField
              label="Seconds"
              min={10}
              max={3600}
              value={watchIntervalSeconds}
              onChange={setWatchIntervalSeconds}
            />
            <div className="flex flex-wrap gap-2">
              <button className="secondary-button" type="button" onClick={() => void onRefreshFolderWatch()}>
                <RefreshCw size={15} />
                Check Now
              </button>
              <button className="secondary-button" type="button" onClick={() => void onStartFolderWatch(watchIntervalSeconds)}>
                <Eye size={15} />
                Watch
              </button>
              <button className="secondary-button" type="button" onClick={() => void onStopFolderWatch()}>
                Stop
              </button>
            </div>
          </div>
        </div>

        {activeFolderWatchNotifications.length > 0 && (
          <div className="grid gap-2 rounded border border-moss/30 bg-moss/10 px-3 py-2">
            {activeFolderWatchNotifications.slice(-3).map((notification) => (
              <div key={notification.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Bell size={15} className="text-moss" />
                    {notification.title}
                  </div>
                  <div className="truncate text-xs text-muted">{notification.message}</div>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onAcknowledgeFolderWatchNotifications([notification.id])}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-4">
          {(["added", "modified", "moved", "removed"] as const).map((kind) => (
            <div key={kind} className="rounded border border-line/70 bg-ink px-3 py-2">
              <div className="text-lg font-semibold text-white">{folderWatchStatus?.counts?.[kind] ?? 0}</div>
              <div className="text-xs uppercase text-muted">
                {kind === "modified" ? "updates" : kind}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="secondary-button"
            type="button"
            disabled={folderWatchChanges.length === 0}
            onClick={toggleAllFolderWatchChanges}
          >
            <ListChecks size={15} />
            {acceptedFolderWatchIds.size === folderWatchChanges.length ? "Clear" : "Select All"}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">
              {selectedWatchCount.toLocaleString()} selected
              {folderWatchStatus && folderWatchStatus.pending_count > folderWatchChanges.length
                ? `, showing ${folderWatchChanges.length.toLocaleString()} of ${folderWatchStatus.pending_count.toLocaleString()}`
                : ""}
            </span>
            <button
              className="primary-button"
              type="button"
              disabled={selectedWatchCount === 0}
              onClick={() => void onApplyFolderWatch(Array.from(acceptedFolderWatchIds), false)}
            >
              <CheckCircle2 size={15} />
              Apply Selected
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={(folderWatchStatus?.pending_count ?? 0) === 0}
              onClick={() => void onApplyFolderWatch([], true)}
            >
              Apply All
            </button>
          </div>
        </div>

        {folderWatchChanges.length > 0 ? (
          <div className="max-h-96 overflow-auto rounded border border-line/70">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-panel text-[11px] uppercase text-muted">
                <tr>
                  <th className="w-10 px-2 py-2">
                    <span className="sr-only">Apply</span>
                  </th>
                  <th className="px-2 py-2">Change</th>
                  <th className="px-2 py-2">Track</th>
                  <th className="px-2 py-2">Path</th>
                  <th className="px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {folderWatchChanges.map((change) => (
                  <tr key={change.id} className="border-t border-line/60 bg-ink/70">
                    <td className="px-2 py-2 align-top">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-moss"
                        checked={acceptedFolderWatchIds.has(change.id)}
                        onChange={() => toggleFolderWatchChange(change.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-top font-medium text-neutral-200">
                      {folderWatchTypeLabel(change)}
                    </td>
                    <td className="max-w-56 px-2 py-2 align-top">
                      <div className="truncate text-neutral-200" title={folderWatchTrackLabel(change)}>
                        {folderWatchTrackLabel(change)}
                      </div>
                      {change.album && <div className="truncate text-muted">{change.album}</div>}
                    </td>
                    <td className="max-w-80 px-2 py-2 align-top">
                      {change.change_type === "moved" ? (
                        <div className="grid gap-1">
                          <div className="truncate text-muted" title={change.old_path ?? undefined}>
                            {change.old_path}
                          </div>
                          <div className="truncate text-neutral-200" title={change.new_path ?? undefined}>
                            {change.new_path}
                          </div>
                        </div>
                      ) : (
                        <div className="truncate text-muted" title={change.new_path ?? change.old_path ?? undefined}>
                          {change.new_path ?? change.old_path}
                        </div>
                      )}
                    </td>
                    <td className="max-w-56 px-2 py-2 align-top">
                      <div className="truncate text-muted">{change.summary}</div>
                      {change.previous_modified_at && change.file_modified_at && (
                        <div className="truncate text-muted">
                          {change.previous_modified_at} {"->"} {change.file_modified_at}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded border border-line/70 bg-ink px-3 py-6 text-center text-xs text-muted">
            No pending folder changes. The watcher will keep checking in the background while it is enabled.
          </div>
        )}
      </div>
    </DisclosureSection>
  );
}
