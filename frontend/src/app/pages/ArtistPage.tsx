import {
  ExternalLink,
  Pencil,
  RefreshCw,
  Save,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ArtistInfoResponse,
  Track,
} from "../../types/api";
import {
  display,
  formatRating,
  splitArtistNames,
} from "../shared";

function artistInfoMatchesName(info: ArtistInfoResponse | null | undefined, name: string) {
  const lowerName = name.toLowerCase();
  return info?.query?.toLowerCase() === lowerName || info?.artist_name?.toLowerCase() === lowerName;
}

type ArtistSummaryBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string };

const WIKIPEDIA_HEADING_PATTERN = /(={2,6})\s*([^=]+?)\s*\1/g;

export function artistSummaryBlocks(summary: string | null | undefined): ArtistSummaryBlock[] {
  const text = summary?.trim();
  if (!text) {
    return [];
  }
  const blocks: ArtistSummaryBlock[] = [];
  let cursor = 0;

  function pushParagraph(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized) {
      blocks.push({ kind: "paragraph", text: normalized });
    }
  }

  for (const match of text.matchAll(WIKIPEDIA_HEADING_PATTERN)) {
    const headingStart = match.index ?? 0;
    pushParagraph(text.slice(cursor, headingStart));
    blocks.push({
      kind: "heading",
      level: Math.min(match[1].length, 4),
      text: match[2].replace(/\s+/g, " ").trim(),
    });
    cursor = headingStart + match[0].length;
  }
  pushParagraph(text.slice(cursor));
  return blocks;
}

function ArtistSummaryText({ summary }: { summary: string | null | undefined }) {
  const blocks = artistSummaryBlocks(summary);
  if (blocks.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-5 text-neutral-100">
      {blocks.map((block, index) =>
        block.kind === "heading" ? (
          <h3
            key={`${block.kind}-${index}`}
            className={block.level <= 2 ? "pt-3 text-lg font-semibold text-white" : "pt-1 text-base font-semibold text-neutral-100"}
          >
            {block.text}
          </h3>
        ) : (
          <p key={`${block.kind}-${index}`} className="text-lg leading-8 text-neutral-100">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}

export function ArtistPage({
  currentTrack,
  artistInfo,
  artistTracks,
  isArtistLoading,
  onRefresh,
  onPlayTrack,
  onOpenExternalUrl,
  onSaveArtistInfoOverride,
}: {
  currentTrack: Track | null;
  artistInfo: ArtistInfoResponse | null;
  artistTracks: Track[];
  isArtistLoading: boolean;
  onRefresh: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onOpenExternalUrl: (url: string) => void;
  onSaveArtistInfoOverride: (artistName: string, wikipediaTitleOrUrl: string) => Promise<ArtistInfoResponse>;
}) {
  const [activeArtistIndex, setActiveArtistIndex] = useState(0);
  const [overrideDraft, setOverrideDraft] = useState("");
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const rawArtistName = display(currentTrack?.artist, "").trim();
  const splitArtistNamesForTrack = useMemo(() => {
    const names = splitArtistNames(currentTrack?.artist);
    if (names.length > 0) {
      return names;
    }
    return rawArtistName ? [rawArtistName] : [];
  }, [currentTrack?.artist, rawArtistName]);
  const relatedArtistNames = useMemo(() => {
    const related = artistInfo?.related_artists?.length ? artistInfo.related_artists : [];
    return related.map((info) => info.query || info.artist_name).filter(Boolean);
  }, [artistInfo]);
  const artistNames = useMemo(() => {
    if (relatedArtistNames.length > 0) {
      const splitNameSet = new Set(splitArtistNamesForTrack.map((name) => name.toLowerCase()));
      const rawLower = rawArtistName.toLowerCase();
      const relatedMatchesTrack = relatedArtistNames.some((name) => {
        const lowerName = name.toLowerCase();
        return lowerName === rawLower || splitNameSet.has(lowerName);
      });
      if (relatedMatchesTrack) {
        return relatedArtistNames;
      }
    }
    return splitArtistNamesForTrack;
  }, [rawArtistName, relatedArtistNames, splitArtistNamesForTrack]);
  const artistInfos = useMemo<(ArtistInfoResponse | null)[]>(() => {
    const related = artistInfo?.related_artists?.length ? artistInfo.related_artists : artistInfo ? [artistInfo] : [];
    if (artistNames.length === 0) {
      return related;
    }
    return artistNames.map((name) => related.find((info) => artistInfoMatchesName(info, name)) ?? null);
  }, [artistInfo, artistNames]);
  const activeArtistName =
    artistNames[activeArtistIndex] ?? artistInfos[activeArtistIndex]?.query ?? artistInfo?.query ?? "";
  const activeArtistInfo = artistInfos[activeArtistIndex] ?? null;
  const activeArtistTracks = activeArtistInfo?.local_tracks ?? (activeArtistIndex === 0 ? artistTracks : []);
  const hasImage = Boolean(activeArtistInfo?.image_url);
  const canSaveOverride = Boolean(activeArtistName && overrideDraft.trim() && !isSavingOverride);

  useEffect(() => {
    setActiveArtistIndex(0);
    setOverrideDraft("");
    setIsOverrideOpen(false);
  }, [currentTrack?.artist]);

  useEffect(() => {
    if (activeArtistIndex >= Math.max(artistNames.length, artistInfos.length, 1)) {
      setActiveArtistIndex(0);
    }
  }, [activeArtistIndex, artistInfos.length, artistNames.length]);

  async function handleSaveOverride() {
    const wikipediaTitleOrUrl = overrideDraft.trim();
    if (!activeArtistName || !wikipediaTitleOrUrl) {
      return;
    }
    setIsSavingOverride(true);
    try {
      await onSaveArtistInfoOverride(activeArtistName, wikipediaTitleOrUrl);
      setOverrideDraft("");
      setIsOverrideOpen(false);
    } finally {
      setIsSavingOverride(false);
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-line px-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Artist</h1>
          <p className="text-xs text-muted">
            {activeArtistName ? `About ${activeArtistName}` : "Select a track to see artist details"}
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={!activeArtistName || isArtistLoading}
          onClick={onRefresh}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-auto p-6 xl:grid-cols-[minmax(260px,340px)_1fr] xl:overflow-hidden">
        <section className="min-h-0 min-w-0 xl:overflow-auto">
          <div className="aspect-[4/5] overflow-hidden rounded border border-line bg-panel shadow-xl">
            {hasImage ? (
              <img
                alt=""
                className="h-full w-full object-cover"
                src={activeArtistInfo?.image_url ?? ""}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-moss">
                <UserRound size={64} />
              </div>
            )}
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="truncate text-2xl font-semibold text-white">
              {activeArtistInfo?.artist_name ?? (activeArtistName || "No artist selected")}
            </h2>
            <div className="mt-2 truncate text-sm text-muted">
              {currentTrack ? `${display(currentTrack.title, "Current track")} - ${display(currentTrack.album, "Unknown album")}` : ""}
            </div>
          </div>

          {activeArtistTracks.length > 0 && (
            <div className="mt-5 overflow-hidden rounded border border-line bg-panel">
              <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm font-semibold text-white">
                <span className="truncate">Top Local Tracks</span>
                <span className="shrink-0 text-xs font-normal text-muted">{activeArtistTracks.length}</span>
              </div>
              <div>
                {activeArtistTracks.slice(0, 12).map((track) => (
                  <button
                    key={track.id}
                    className="flex w-full items-center justify-between gap-3 border-b border-line/60 px-3 py-2 text-left text-sm hover:bg-white/[0.035]"
                    type="button"
                    onClick={() => onPlayTrack(track, activeArtistTracks)}
                  >
                    <span className="min-w-0 flex-1 truncate text-white">{display(track.title, "Untitled")}</span>
                    <span className="shrink-0 text-xs text-muted">{formatRating(track.rating)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid min-h-[420px] min-w-0 grid-rows-[auto_minmax(0,1fr)] rounded border border-line bg-panel xl:min-h-0">
          <div>
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
              <div className="text-sm font-semibold text-white">Background</div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
                {activeArtistInfo?.source && <span className="truncate text-xs text-muted">{activeArtistInfo.source}</span>}
                {activeArtistInfo?.page_url && (
                  <button
                    className="inline-flex items-center gap-1 text-xs text-moss hover:text-white"
                    type="button"
                    onClick={() => activeArtistInfo.page_url && onOpenExternalUrl(activeArtistInfo.page_url)}
                  >
                    Open
                    <ExternalLink size={13} />
                  </button>
                )}
                <button
                  aria-label="Fix Wikipedia lookup"
                  className={`grid h-8 w-8 place-items-center rounded text-muted transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40 ${isOverrideOpen ? "bg-white/[0.06] text-moss" : ""}`}
                  title="Fix Wikipedia lookup"
                  type="button"
                  disabled={!activeArtistName}
                  onClick={() => setIsOverrideOpen((value) => !value)}
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
            {artistNames.length > 1 && (
              <div className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2">
                {artistNames.map((name, index) => (
                  <button
                    key={`${name}-${index}`}
                    className={`secondary-button h-8 shrink-0 ${index === activeArtistIndex ? "border-moss text-moss" : ""}`}
                    type="button"
                    onClick={() => {
                      setActiveArtistIndex(index);
                      setOverrideDraft("");
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-auto px-7 py-6">
            {isOverrideOpen && (
              <form
                className="mb-5 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveOverride();
                }}
              >
                <input
                  aria-label="Wikipedia title or URL"
                  className="min-w-[220px] flex-1 rounded border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-moss"
                  placeholder="Wikipedia title or URL"
                  value={overrideDraft}
                  onChange={(event) => setOverrideDraft(event.target.value)}
                />
                <button className="secondary-button h-9" type="submit" disabled={!canSaveOverride}>
                  <Save size={14} />
                  Use Page
                </button>
              </form>
            )}
            {isArtistLoading && !activeArtistInfo?.found && <div className="text-sm text-muted">Loading artist info...</div>}
            {isArtistLoading && activeArtistInfo?.found && (
              <div className="mb-5 rounded border border-line bg-ink px-3 py-2 text-xs text-muted">
                Refreshing artist info...
              </div>
            )}
            {!isArtistLoading && !activeArtistName && (
              <div className="grid h-full place-items-center text-sm text-muted">No artist selected.</div>
            )}
            {!isArtistLoading && activeArtistName && !activeArtistInfo?.found && (
              <div className="grid h-full place-items-center text-center text-sm text-muted">
                {activeArtistInfo?.error ?? "No artist background found yet."}
              </div>
            )}
            {!isArtistLoading && activeArtistInfo?.found && (
              <div className="mx-auto max-w-3xl">
                <ArtistSummaryText summary={activeArtistInfo.summary} />
                {activeArtistInfo.from_cache && (
                  <div className="mt-5 text-xs text-muted">
                    {activeArtistInfo.stale ? "Showing cached result while refreshing" : "Cached locally"}
                    {activeArtistInfo.updated_at ? ` on ${new Date(activeArtistInfo.updated_at).toLocaleString()}` : ""}.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
