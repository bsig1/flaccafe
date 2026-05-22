import {
  Download,
  Plus,
  Wand2,
  X,
} from "lucide-react";

export function AutoDjHeader({
  queueLength,
  busy,
  onGenerate,
  onExport,
  onAddQueue,
  onClear,
}: {
  queueLength: number;
  busy: boolean;
  onGenerate: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onAddQueue: () => void;
  onClear: () => void;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-line px-6">
      <div>
        <h1 className="text-lg font-semibold text-white">AutoDJ</h1>
        <p className="text-xs text-muted">{queueLength} tracks in queue</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="primary-button" type="button" onClick={() => void onGenerate()} disabled={busy}>
          <Wand2 size={17} />
          {busy ? "Generating" : "Generate Queue"}
        </button>
        <button className="secondary-button" type="button" onClick={() => void onExport()}>
          <Download size={17} />
          Export .m3u
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
    </header>
  );
}
