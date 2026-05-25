import {
  Album,
  Inbox,
  ListMusic,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsPosition, setToolsPosition] = useState({ left: 0, top: 0 });
  const toolsButtonRef = useRef<HTMLButtonElement | null>(null);
  const primaryLibraryViews = [
    { id: "tracks" as const, label: "Tracks", icon: ListMusic },
    { id: "artists" as const, label: "Artists", icon: UserRound },
    { id: "albums" as const, label: "Albums", icon: Album },
    { id: "playlists" as const, label: "Playlists", icon: ListMusic },
  ];
  const utilityLibraryViews = [
    { id: "inbox" as const, label: "Inbox", icon: Inbox },
    { id: "health" as const, label: "Library Health", icon: ShieldCheck },
  ];

  function toggleTools() {
    const rect = toolsButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 208;
      setToolsPosition({
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
        top: Math.min(rect.bottom + 6, window.innerHeight - 120),
      });
    }
    setToolsOpen((current) => !current);
  }

  useEffect(() => {
    if (!toolsOpen) {
      return;
    }

    function closeTools(event: Event) {
      if (event instanceof MouseEvent && toolsButtonRef.current?.contains(event.target as Node | null)) {
        return;
      }
      setToolsOpen(false);
    }

    function closeToolsOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setToolsOpen(false);
      }
    }

    window.addEventListener("click", closeTools);
    window.addEventListener("resize", closeTools);
    window.addEventListener("scroll", closeTools, true);
    window.addEventListener("keydown", closeToolsOnEscape);
    return () => {
      window.removeEventListener("click", closeTools);
      window.removeEventListener("resize", closeTools);
      window.removeEventListener("scroll", closeTools, true);
      window.removeEventListener("keydown", closeToolsOnEscape);
    };
  }, [toolsOpen]);

  return (
    <div className="flex w-full max-w-full items-center gap-1 overflow-x-auto rounded border border-line bg-panel p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {primaryLibraryViews.map((item) => {
        const Icon = item.icon;
        const active = libraryView === item.id;
        return (
          <button
            key={item.id}
            className={`inline-flex h-8 shrink-0 items-center gap-2 rounded px-2 text-sm transition min-[980px]:px-3 ${
              active ? "bg-white/10 text-white" : "text-muted hover:text-white"
            }`}
            type="button"
            title={item.label}
            onClick={() => setLibraryView(item.id)}
          >
            <Icon size={15} />
            <span className="hidden min-[980px]:inline">{item.label}</span>
          </button>
        );
      })}
      <div className="relative shrink-0">
        <button
          ref={toolsButtonRef}
          className={`inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded px-2 text-sm transition min-[980px]:px-3 [&::-webkit-details-marker]:hidden ${
            libraryView === "inbox" || libraryView === "health"
              ? "bg-white/10 text-white"
              : "text-muted hover:text-white"
          }`}
          type="button"
          title="Library tools"
          aria-expanded={toolsOpen}
          onClick={(event) => {
            event.stopPropagation();
            toggleTools();
          }}
        >
          <MoreHorizontal size={15} />
          <span className="hidden min-[980px]:inline">Tools</span>
        </button>
        {toolsOpen && (
          <div
            className="fixed z-50 w-52 overflow-hidden rounded border border-line bg-[rgb(var(--color-popover))] py-1 text-sm shadow-2xl"
            style={{ left: toolsPosition.left, top: toolsPosition.top }}
            onClick={(event) => event.stopPropagation()}
          >
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
                  onClick={() => {
                    setLibraryView(item.id);
                    setToolsOpen(false);
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
