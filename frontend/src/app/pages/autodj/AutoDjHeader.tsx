import {
  Download,
  Plus,
  Repeat2,
  Wand2,
  X,
} from "lucide-react";

export function AutoDjHeader({
  queueLength,
  busy,
  generationProgress,
  generationMessage,
  continuousAutoDjEnabled,
  continuousAutoDjBusy,
  onGenerate,
  onExport,
  onAddQueue,
  onClear,
  onContinuousAutoDjChange,
}: {
  queueLength: number;
  busy: boolean;
  generationProgress: number;
  generationMessage: string | null;
  continuousAutoDjEnabled: boolean;
  continuousAutoDjBusy: boolean;
  onGenerate: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onAddQueue: () => void;
  onClear: () => void;
  onContinuousAutoDjChange: (enabled: boolean) => void;
}) {
  return (
    <header className="relative flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-2">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-white">AutoDJ</h1>
        <p className="text-xs text-muted">{busy && generationMessage ? generationMessage : `${queueLength} tracks in queue`}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <button
          className={`secondary-button ${continuousAutoDjEnabled ? "border-moss text-moss" : ""}`}
          type="button"
          title="Keep filling the upcoming playback queue as it runs low"
          onClick={() => onContinuousAutoDjChange(!continuousAutoDjEnabled)}
        >
          <Repeat2 size={17} />
          {continuousAutoDjBusy ? "Filling" : continuousAutoDjEnabled ? "Continuous On" : "Continuous"}
        </button>
        <button className="primary-button" type="button" onClick={() => void onGenerate()} disabled={busy}>
          <Wand2 size={17} />
          {busy ? "Generating" : "Generate Queue"}
        </button>
        <button className="secondary-button" type="button" onClick={() => void onExport()}>
          <Download size={17} />
          Export
        </button>
        <button className="secondary-button" type="button" disabled={queueLength === 0} onClick={onAddQueue}>
          <Plus size={17} />
          Add Queue
        </button>
        <button className="secondary-button" type="button" disabled={queueLength === 0} onClick={onClear}>
          <X size={17} />
          Clear
        </button>
      </div>
      {busy && (
        <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-ink">
          <div
            className="h-full rounded-r bg-ember transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(4, Math.min(100, generationProgress))}%` }}
          />
        </div>
      )}
    </header>
  );
}
