import { Download } from "lucide-react";
import type { ReactNode } from "react";

import type { Track } from "../../../types/api";
import { NowPlayingLyricsEditor } from "./NowPlayingLyricsEditor";

export function LyricsLookupProgress({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) {
  return (
    <div className="mb-4 grid gap-2 text-sm text-muted">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink">
        <div
          className="h-full rounded-full bg-moss transition-[width] duration-200"
          style={{ width: `${Math.max(6, Math.min(96, progress))}%` }}
        />
      </div>
    </div>
  );
}

export function NowPlayingLyricsContent({
  containerClass,
  currentTrack,
  editorClass,
  emptyClass,
  hasLyrics,
  isEditingLyrics,
  lyricLines,
  lyricsBusy,
  lyricsClass,
  lyricsEditorModel,
  lookupLabel,
  lookupProgress,
  onFetchLyrics,
  renderLyricLine,
  showLookupProgress,
  spacious,
}: {
  containerClass: string;
  currentTrack: Track | null;
  editorClass: string;
  emptyClass: string;
  hasLyrics: boolean;
  isEditingLyrics: boolean;
  lyricLines: string[];
  lyricsBusy: boolean;
  lyricsClass: string;
  lyricsEditorModel: unknown;
  lookupLabel: string;
  lookupProgress: number;
  onFetchLyrics: () => void;
  renderLyricLine: (line: string, index: number, spacious?: boolean) => ReactNode;
  showLookupProgress: boolean;
  spacious?: boolean;
}) {
  return (
    <div className={containerClass}>
      {showLookupProgress && <LyricsLookupProgress label={lookupLabel} progress={lookupProgress} />}
      {!currentTrack && (
        <div className="grid h-full place-items-center text-sm text-muted">No track selected.</div>
      )}
      {currentTrack && isEditingLyrics && !showLookupProgress && (
        <NowPlayingLyricsEditor model={lyricsEditorModel} containerClass={editorClass} />
      )}
      {currentTrack && !isEditingLyrics && !hasLyrics && !showLookupProgress && (
        <div className={emptyClass}>
          <div>
            <div>No embedded, database, or sidecar lyrics found for this track.</div>
            <button className="primary-button mx-auto mt-4" type="button" disabled={lyricsBusy} onClick={onFetchLyrics}>
              <Download size={15} />
              Fetch Lyrics
            </button>
          </div>
        </div>
      )}
      {currentTrack && !isEditingLyrics && hasLyrics && (
        <div className={lyricsClass}>
          {lyricLines.map((line, index) => renderLyricLine(line, index, spacious))}
        </div>
      )}
    </div>
  );
}
