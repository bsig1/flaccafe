import {
  Album,
  Inbox,
  ListMusic,
  MoreHorizontal,
  ShieldCheck,
  Wand2,
} from "lucide-react";

import type {
  LibraryView,
} from "../../shared";

export function LibraryViewTabs({
  libraryView,
  setLibraryView,
}: {
  libraryView: LibraryView;
  setLibraryView: (view: LibraryView) => void;
}) {
  const primaryLibraryViews = [
    { id: "tracks" as const, label: "Tracks", icon: ListMusic },
    { id: "albums" as const, label: "Albums", icon: Album },
    { id: "playlists" as const, label: "Playlists", icon: ListMusic },
  ];
  const utilityLibraryViews = [
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "smart" as const, label: "Smart Playlists", icon: Wand2 },
    { id: "health" as const, label: "Library Health", icon: ShieldCheck },
  ];

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1 rounded border border-line bg-panel p-1">
      {primaryLibraryViews.map((item) => {
        const Icon = item.icon;
        const active = libraryView === item.id;
        return (
          <button
            key={item.id}
            className={`inline-flex h-8 items-center gap-2 rounded px-3 text-sm transition ${
              active ? "bg-white/10 text-white" : "text-muted hover:text-white"
            }`}
            type="button"
            onClick={() => setLibraryView(item.id)}
          >
            <Icon size={15} />
            {item.label}
          </button>
        );
      })}
      <details className="relative" data-auto-close>
        <summary
          className={`inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded px-3 text-sm transition [&::-webkit-details-marker]:hidden ${
            libraryView === "inbox" || libraryView === "smart" || libraryView === "health"
              ? "bg-white/10 text-white"
              : "text-muted hover:text-white"
          }`}
          title="Library tools"
        >
          <MoreHorizontal size={15} />
          Tools
        </summary>
        <div className="absolute left-0 top-10 z-40 w-52 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm shadow-2xl">
          {utilityLibraryViews.map((item) => {
            const Icon = item.icon;
            const active = libraryView === item.id;
            return (
              <button
                key={item.id}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/10 ${
                  active ? "text-white" : "text-muted"
                }`}
                type="button"
                onClick={(event) => {
                  setLibraryView(item.id);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
