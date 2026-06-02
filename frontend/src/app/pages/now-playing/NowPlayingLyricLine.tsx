import {
  isTimestampOnlyLyricLine,
  stripLyricTimestamp,
} from "../../shared";

export function NowPlayingLyricLine({
  line,
  index,
  active,
  spacious = false,
  setActiveNode,
}: {
  line: string;
  index: number;
  active: boolean;
  spacious?: boolean;
  setActiveNode?: (node: HTMLElement | null) => void;
}) {
  if (line.trim().length === 0) {
    return <div key={`space-${index}`} className={spacious ? "h-4" : "h-3"} />;
  }
  if (isTimestampOnlyLyricLine(line)) {
    return (
      <div
        key={`${index}-${line}`}
        ref={setActiveNode}
        className={`mx-auto my-2 h-px rounded-full transition ${
          active ? "w-28 bg-moss/70" : "w-16 bg-line"
        }`}
        title="No lyrics in this section"
      />
    );
  }
  return (
    <p
      key={`${index}-${line}`}
      ref={setActiveNode}
      className={`whitespace-pre-wrap transition ${
        active ? `${spacious ? "scale-[1.02] " : ""}text-moss` : spacious ? "text-neutral-300" : "text-neutral-100"
      }`}
    >
      {stripLyricTimestamp(line)}
    </p>
  );
}
