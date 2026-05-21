import {
  FolderOpen,
  Library,
  Settings,
  X,
} from "lucide-react";


export function QuickStartPanel({
  isScanning,
  suggestedMusicPath,
  onChooseMusicFolder,
  onUseSuggestedFolder,
  onOpenSettings,
  onDismiss,
}: {
  isScanning: boolean;
  suggestedMusicPath?: string | null;
  onChooseMusicFolder: () => void;
  onUseSuggestedFolder: (path: string) => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="grid min-h-0 flex-1 place-items-center overflow-auto bg-[rgb(var(--color-quiet))] px-6 py-8">
      <div className="w-full max-w-3xl rounded border border-ember/25 bg-panel/80 p-5 shadow-sm shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Library size={16} />
            Start your FLAC Cafe library
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Choose the folder that holds your downloaded music. FLAC Cafe will scan it into SQLite and keep the first pass focused.
          </p>
          {suggestedMusicPath && (
            <button
              className="mt-4 flex w-full min-w-0 items-center gap-3 rounded border border-line bg-ink px-3 py-2 text-left text-sm hover:border-ember/60"
              type="button"
              onClick={() => onUseSuggestedFolder(suggestedMusicPath)}
            >
              <FolderOpen className="shrink-0 text-ember" size={17} />
              <span className="min-w-0">
                <span className="block font-medium text-white">Use Windows Music folder</span>
                <span className="block truncate text-xs text-muted">{suggestedMusicPath}</span>
              </span>
            </button>
          )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="primary-button h-10" type="button" disabled={isScanning} onClick={onChooseMusicFolder}>
              <FolderOpen size={17} />
              {isScanning ? "Scanning" : "Choose Music Folder"}
            </button>
            <button className="secondary-button h-10" type="button" onClick={onOpenSettings}>
              <Settings size={16} />
              Settings
            </button>
            <button className="icon-button h-10 w-10" type="button" title="Dismiss quick start" onClick={onDismiss}>
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
