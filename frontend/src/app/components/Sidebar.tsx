import {
  BarChart3,
  BookOpen,
  Clock3,
  Coffee,
  Disc3,
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
import type {
  LucideIcon,
} from "lucide-react";
import type {
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Page,
} from "../shared";

type SidebarSectionKey = "main" | "collection" | "streams" | "tools";
type SidebarDropPlacement = "before" | "after";

interface SidebarDropTarget {
  sectionKey: SidebarSectionKey;
  page?: Page;
  placement: SidebarDropPlacement;
}

interface SidebarItem {
  id: Page;
  label: string;
  icon: LucideIcon;
}

interface SidebarSectionDefinition {
  key: SidebarSectionKey;
  title: string | null;
  items: SidebarItem[];
}

const sidebarOrderStorageKey = "flac-cafe-sidebar-order";

const defaultSidebarSections: SidebarSectionDefinition[] = [
  {
    key: "main",
    title: null,
    items: [
      { id: "library", label: "Library", icon: Library },
      { id: "nowPlaying", label: "Now Playing", icon: FileText },
      { id: "artist", label: "Artist", icon: UserRound },
      { id: "autodj", label: "AutoDJ", icon: Wand2 },
    ],
  },
  {
    key: "collection",
    title: "Collection",
    items: [
      { id: "audiobooks", label: "Audiobooks", icon: BookOpen },
      { id: "history", label: "History", icon: Clock3 },
    ],
  },
  {
    key: "streams",
    title: "Streams",
    items: [
      { id: "podcasts", label: "Podcasts", icon: Podcast },
      { id: "radio", label: "Web Radio", icon: Radio },
      { id: "scrobbling", label: "Scrobbling", icon: Send },
      { id: "cd", label: "CD", icon: Disc3 },
    ],
  },
  {
    key: "tools",
    title: "Tools",
    items: [
      { id: "sources", label: "Sources", icon: FolderOpen },
      { id: "analysis", label: "Analysis", icon: BarChart3 },
      { id: "fileManagement", label: "File Management", icon: FolderCog },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const allSidebarItems = defaultSidebarSections.flatMap((section) => section.items);
const sidebarItemById = new Map(allSidebarItems.map((item) => [item.id, item]));
const defaultSidebarSectionById = new Map(
  defaultSidebarSections.flatMap((section) => section.items.map((item) => [item.id, section.key] as const)),
);

type SidebarOrder = Record<SidebarSectionKey, Page[]>;
const oldMainDefaultOrder: Page[] = ["library", "artist", "nowPlaying", "autodj"];

function defaultSidebarOrder(): SidebarOrder {
  return Object.fromEntries(
    defaultSidebarSections.map((section) => [section.key, section.items.map((item) => item.id)]),
  ) as SidebarOrder;
}

function normalizeSidebarOrder(candidate: unknown): SidebarOrder {
  const defaults = defaultSidebarOrder();
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }
  const source = candidate as Partial<Record<SidebarSectionKey, unknown>>;
  const seen = new Set<Page>();
  const order = { ...defaults };
  defaultSidebarSections.forEach((section) => {
    const rawStored = source[section.key];
    const stored: unknown[] = Array.isArray(rawStored) ? rawStored : [];
    order[section.key] = stored.filter((id): id is Page => {
      if (typeof id !== "string" || !sidebarItemById.has(id as Page) || seen.has(id as Page)) {
        return false;
      }
      seen.add(id as Page);
      return true;
    });
  });
  allSidebarItems.forEach((item) => {
    if (!seen.has(item.id)) {
      order[defaultSidebarSectionById.get(item.id) ?? "tools"].push(item.id);
    }
  });
  if (
    order.main.length === oldMainDefaultOrder.length &&
    order.main.every((page, index) => page === oldMainDefaultOrder[index])
  ) {
    order.main = defaults.main;
  }
  return order;
}

function readSidebarOrder() {
  if (typeof window === "undefined") {
    return defaultSidebarOrder();
  }
  try {
    return normalizeSidebarOrder(JSON.parse(window.localStorage.getItem(sidebarOrderStorageKey) ?? "null"));
  } catch {
    return defaultSidebarOrder();
  }
}

function writeSidebarOrder(order: SidebarOrder) {
  try {
    window.localStorage.setItem(sidebarOrderStorageKey, JSON.stringify(order));
  } catch {
    // Local storage can be unavailable in hardened WebView settings; dragging still works for the session.
  }
}

function isSidebarSectionKey(value: string | undefined): value is SidebarSectionKey {
  return value === "main" || value === "collection" || value === "streams" || value === "tools";
}

function buildSidebarSections(order: SidebarOrder, showCdPage: boolean): SidebarSectionDefinition[] {
  const assigned = new Set<Page>();
  const sections = defaultSidebarSections.map((section) => {
    const items = order[section.key]
      .map((id) => sidebarItemById.get(id))
      .filter((item): item is SidebarItem => {
        if (!item || assigned.has(item.id)) {
          return false;
        }
        if (item.id === "cd" && !showCdPage) {
          return false;
        }
        assigned.add(item.id);
        return true;
      });
    return { ...section, items };
  });
  allSidebarItems.forEach((item) => {
    if (item.id === "cd" && !showCdPage) {
      return;
    }
    if (!assigned.has(item.id)) {
      const sectionKey = defaultSidebarSectionById.get(item.id) ?? "tools";
      sections.find((section) => section.key === sectionKey)?.items.push(item);
    }
  });
  return sections;
}

export function Sidebar({
  activePage,
  setActivePage,
  hasDiagnosticsIssue,
  hasAnalysisIssue,
  showCdPage,
  coffeeAnimating,
  onCoffeeClick,
}: {
  activePage: Page;
  setActivePage: (page: Page) => void;
  hasDiagnosticsIssue: boolean;
  hasAnalysisIssue: boolean;
  showCdPage: boolean;
  coffeeAnimating: boolean;
  onCoffeeClick: () => void;
}) {
  const [sidebarOrder, setSidebarOrder] = useState(readSidebarOrder);
  const [draggedPage, setDraggedPage] = useState<Page | null>(null);
  const [dragTarget, setDragTarget] = useState<SidebarDropTarget | null>(null);
  const suppressNextClickRef = useRef<Page | null>(null);
  const sections = useMemo(() => buildSidebarSections(sidebarOrder, showCdPage), [sidebarOrder, showCdPage]);

  function moveSidebarItem(
    page: Page,
    targetSectionKey: SidebarSectionKey,
    targetPage?: Page,
    placement: SidebarDropPlacement = "before",
  ) {
    setSidebarOrder((current) => {
      const normalized = normalizeSidebarOrder(current);
      const next = Object.fromEntries(
        defaultSidebarSections.map((section) => [
          section.key,
          normalized[section.key].filter((id) => id !== page),
        ]),
      ) as SidebarOrder;
      const target = next[targetSectionKey];
      const targetIndex = targetPage ? target.indexOf(targetPage) : -1;
      const insertAt = targetIndex >= 0 ? targetIndex + (placement === "after" ? 1 : 0) : target.length;
      target.splice(insertAt, 0, page);
      writeSidebarOrder(next);
      return next;
    });
  }

  function resolveDropTarget(clientX: number, clientY: number): SidebarDropTarget | null {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const targetElement = element?.closest<HTMLElement>("[data-sidebar-drop-target]");
    const sectionKey = targetElement?.dataset.sidebarSection;
    if (!targetElement || !isSidebarSectionKey(sectionKey)) {
      return null;
    }
    const page = targetElement.dataset.sidebarPage;
    if (!page || !sidebarItemById.has(page as Page)) {
      return { sectionKey, placement: "after" };
    }
    const bounds = targetElement.getBoundingClientRect();
    return {
      sectionKey,
      page: page as Page,
      placement: clientY > bounds.top + bounds.height / 2 ? "after" : "before",
    };
  }

  function finishDrag() {
    setDraggedPage(null);
    setDragTarget(null);
  }

  function clearSuppressedClick(page: Page) {
    window.setTimeout(() => {
      if (suppressNextClickRef.current === page) {
        suppressNextClickRef.current = null;
      }
    }, 0);
  }

  function beginSidebarDrag(event: ReactMouseEvent<HTMLButtonElement>, item: SidebarItem, sectionKey: SidebarSectionKey) {
    if (event.button !== 0) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let latestTarget: SidebarDropTarget = { sectionKey, page: item.id, placement: "before" };

    function cleanup() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("blur", handleCancel);
    }

    function startDrag() {
      if (active) {
        return;
      }
      active = true;
      suppressNextClickRef.current = item.id;
      setDraggedPage(item.id);
    }

    function handleMove(mouseEvent: MouseEvent) {
      const distance = Math.hypot(mouseEvent.clientX - startX, mouseEvent.clientY - startY);
      if (!active && distance < 6) {
        return;
      }
      startDrag();
      mouseEvent.preventDefault();
      const nextTarget = resolveDropTarget(mouseEvent.clientX, mouseEvent.clientY);
      if (nextTarget) {
        latestTarget = nextTarget;
        setDragTarget(nextTarget);
      }
    }

    function handleUp(mouseEvent: MouseEvent) {
      cleanup();
      if (!active) {
        return;
      }
      mouseEvent.preventDefault();
      const finalTarget = resolveDropTarget(mouseEvent.clientX, mouseEvent.clientY) ?? latestTarget;
      if (finalTarget.page !== item.id) {
        moveSidebarItem(item.id, finalTarget.sectionKey, finalTarget.page, finalTarget.placement);
      }
      finishDrag();
      clearSuppressedClick(item.id);
    }

    function handleCancel() {
      cleanup();
      finishDrag();
      clearSuppressedClick(item.id);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("blur", handleCancel);
  }

  function renderItem(item: SidebarItem, sectionKey: SidebarSectionKey) {
    const Icon = item.icon;
    const active = activePage === item.id;
    const prominent = sectionKey === "main";
    const isDragging = draggedPage === item.id;
    const isDragOver = dragTarget?.page === item.id && draggedPage !== item.id;
    return (
      <button
        key={item.id}
        data-sidebar-drop-target
        data-sidebar-page={item.id}
        data-sidebar-section={sectionKey}
        type="button"
        className={`flex ${prominent ? "h-9" : "h-8"} cursor-pointer items-center gap-3 rounded px-3 text-sm transition ${
          active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
        } ${isDragging ? "opacity-45" : ""} ${isDragOver ? "ring-1 ring-moss/60" : ""}`}
        onClick={() => {
          if (suppressNextClickRef.current === item.id) {
            suppressNextClickRef.current = null;
            return;
          }
          setActivePage(item.id);
        }}
        onMouseDown={(event) => beginSidebarDrag(event, item, sectionKey)}
      >
        <Icon size={prominent ? 18 : 17} />
        <span className="min-w-0 flex-1 text-left">{item.label}</span>
        {item.id === "analysis" && hasAnalysisIssue && (
          <span className="h-2 w-2 rounded-full bg-ember" title="Audio analysis needs attention" />
        )}
        {item.id === "settings" && hasDiagnosticsIssue && (
          <span className="h-2 w-2 rounded-full bg-ember" title="Backend needs attention" />
        )}
      </button>
    );
  }

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
        {sections.map((section) => (
          <div
            key={section.key}
            data-sidebar-drop-target
            data-sidebar-section={section.key}
            className={`${section.key === "main" ? "grid gap-1" : "mt-2 grid gap-1 first:mt-3"} rounded transition ${
              draggedPage ? "pb-1" : ""
            } ${dragTarget?.sectionKey === section.key && !dragTarget.page ? "ring-1 ring-moss/50" : ""}`}
          >
            {section.title && (
              <div className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted/70">{section.title}</div>
            )}
            {section.items.map((item) => renderItem(item, section.key))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
