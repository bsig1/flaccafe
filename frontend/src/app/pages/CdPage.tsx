import type {
  Track,
} from "../../types/api";
import { CdRipperSection } from "./file-management/CdRipperSection";

export function CdPage({
  defaultTargetFolder,
  onBrowseTarget,
  onPlayPreviewTrack,
  setStatus,
}: {
  defaultTargetFolder: string;
  onBrowseTarget: () => Promise<string | null>;
  onPlayPreviewTrack: (track: Track, queue?: Track[]) => void;
  setStatus: (message: string) => void;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-ink">
      <div className="border-b border-line bg-panel px-6 py-4">
        <div className="text-lg font-semibold text-white">CD</div>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Play inserted discs through the main player, look up metadata, or rip selected tracks to your library.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <CdRipperSection
          defaultTargetFolder={defaultTargetFolder}
          standalone
          onBrowseTarget={onBrowseTarget}
          onPlayPreviewTrack={onPlayPreviewTrack}
          setStatus={setStatus}
        />
      </div>
    </main>
  );
}
