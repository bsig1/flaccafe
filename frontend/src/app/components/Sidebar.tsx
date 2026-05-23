import {
  BarChart3,
  BookOpen,
  Clock3,
  Coffee,
  FileText,
  FolderCog,
  FolderOpen,
  Library,
  Podcast,
  Radio,
  Send,
  Settings,
  UserRound,
  Wand2,
} from "lucide-react";

import {
  Page,
} from "../shared";

export function Sidebar({
  activePage,
  setActivePage,
  hasDiagnosticsIssue,
  hasAnalysisIssue,
  coffeeAnimating,
  onCoffeeClick,
}: {
  activePage: Page;
  setActivePage: (page: Page) => void;
  hasDiagnosticsIssue: boolean;
  hasAnalysisIssue: boolean;
  coffeeAnimating: boolean;
  onCoffeeClick: () => void;
}) {
  const mainItems = [
    { id: "library" as const, label: "Library", icon: Library },
    { id: "artist" as const, label: "Artist", icon: UserRound },
    { id: "nowPlaying" as const, label: "Now Playing", icon: FileText },
    { id: "autodj" as const, label: "AutoDJ", icon: Wand2 },
  ];
  const secondarySections = [
    {
      title: "Collection",
      items: [
        { id: "audiobooks" as const, label: "Audiobooks", icon: BookOpen },
        { id: "history" as const, label: "History", icon: Clock3 },
      ],
    },
    {
      title: "Streams",
      items: [
        { id: "podcasts" as const, label: "Podcasts", icon: Podcast },
        { id: "radio" as const, label: "Web Radio", icon: Radio },
        { id: "scrobbling" as const, label: "Scrobbling", icon: Send },
      ],
    },
    {
      title: "Tools",
      items: [
        { id: "sources" as const, label: "Sources", icon: FolderOpen },
        { id: "analysis" as const, label: "Analysis", icon: BarChart3 },
        { id: "fileManagement" as const, label: "File Management", icon: FolderCog },
        { id: "settings" as const, label: "Settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-[rgb(var(--color-sidebar))]">
      <button
        className="flex h-14 items-center gap-3 border-b border-line px-4 text-left transition hover:bg-white/[0.035]"
        type="button"
        title="Tap the cup"
        onClick={onCoffeeClick}
      >
        <div className={`grid h-8 w-8 place-items-center rounded bg-ember text-ink shadow-sm shadow-black/20 ${coffeeAnimating ? "animate-cafe-cup" : ""}`}>
          <Coffee size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">FLAC Cafe</div>
          <div className="text-xs text-muted">Smart local player</div>
        </div>
      </button>
      <nav className="flex flex-1 flex-col gap-1 overflow-hidden px-3 py-3">
        {mainItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex h-9 items-center gap-3 rounded px-3 text-sm transition ${
                active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
        {secondarySections.map((section) => (
          <div key={section.title} className="mt-2 grid gap-1 first:mt-3">
            <div className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted/70">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex h-8 items-center gap-3 rounded px-3 text-sm transition ${
                    active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => setActivePage(item.id)}
                >
                  <Icon size={17} />
                  <span className="min-w-0 flex-1 text-left">{item.label}</span>
                  {item.id === "analysis" && hasAnalysisIssue && (
                    <span className="h-2 w-2 rounded-full bg-ember" title="Audio analysis needs attention" />
                  )}
                  {item.id === "settings" && hasDiagnosticsIssue && (
                    <span className="h-2 w-2 rounded-full bg-ember" title="Startup self-check found issues" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
