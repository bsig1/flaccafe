import {
  FileText,
  Info,
  RefreshCw,
} from "lucide-react";


export function BackendRecoveryPage({
  backendMessage,
  backendCheckedAt,
  onCheckBackend,
  onRestartBackend,
  onOpenBackendLog,
}: {
  backendMessage: string;
  backendCheckedAt: string | null;
  onCheckBackend: () => void;
  onRestartBackend: () => void;
  onOpenBackendLog: () => void;
}) {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Recovery</h1>
          <p className="text-xs text-muted">
            {backendCheckedAt ? `Backend last checked ${backendCheckedAt}` : "Backend status unavailable"}
          </p>
        </div>
      </header>
      <section className="grid min-h-0 flex-1 place-items-center overflow-auto p-6">
        <div className="w-full max-w-2xl rounded border border-ember/40 bg-[rgb(var(--color-popover))] p-6 shadow-2xl">
          <div className="mb-4 flex items-start gap-3">
            <Info className="mt-1 shrink-0 text-ember" size={22} />
            <div>
              <h2 className="text-lg font-semibold text-white">FLAC Cafe cannot reach its local backend</h2>
              <p className="mt-2 text-sm text-muted">{backendMessage}</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-neutral-200">
            <div className="rounded border border-line/70 bg-ink p-3">
              The UI is still running, but library scans, ratings, playback URLs, and AutoDJ need the Python service on
              `127.0.0.1:8765`.
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="primary-button" type="button" onClick={onCheckBackend}>
                <RefreshCw size={15} />
                Check Again
              </button>
              <button className="secondary-button" type="button" onClick={onRestartBackend}>
                <RefreshCw size={15} />
                Restart Backend
              </button>
              <button className="secondary-button" type="button" onClick={onOpenBackendLog}>
                <FileText size={15} />
                Open Log
              </button>
            </div>
            <div className="text-xs text-muted">
              In development, start the backend with `npm run backend:dev`. In the installed app, Restart Backend should relaunch the bundled service.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
