import {
  parseLyricTimestamp,
  stripLyricTimestamp,
} from "../../shared";

export type LyricsEditMode = "text" | "sync";

export interface LrcBuilderLine {
  id: string;
  text: string;
  time: number | null;
  gap: boolean;
}

export function formatLrcTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return "--:--.--";
  }
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const centiseconds = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 100);
  return `${minutes.toString().padStart(2, "0")}:${wholeSeconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

export function lrcDraftFromBuilderLines(lines: LrcBuilderLine[]): string {
  return lines
    .map((line) => {
      const text = line.gap ? "" : line.text.trimEnd();
      if (line.time === null) {
        return text;
      }
      const timestamp = `[${formatLrcTimestamp(line.time)}]`;
      return text ? `${timestamp} ${text}` : timestamp;
    })
    .join("\n");
}

export function builderLinesFromLyricsText(
  text: string,
  createBuilderLine: (text?: string, time?: number | null, gap?: boolean) => LrcBuilderLine,
): LrcBuilderLine[] {
  const rows = text.split(/\r?\n/).map((line) => {
    const time = parseLyricTimestamp(line);
    const lyricText = stripLyricTimestamp(line).trimEnd();
    return createBuilderLine(lyricText, time, time !== null && lyricText.trim().length === 0);
  });
  return rows.length > 0 ? rows : [createBuilderLine()];
}
