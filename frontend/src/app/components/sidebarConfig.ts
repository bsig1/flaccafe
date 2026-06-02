import type { LucideIcon } from "lucide-react";
import {
BarChart3,
BookOpen,
Clock3,
Disc3,
FileText,
FolderCog,
FolderOpen,
Library,
Podcast,
Radio,
RadioTower,
Send,
Settings,
UserRound,
} from "lucide-react";

import type { Page } from "../shared";

export type SidebarSectionKey = string;
export type SidebarDropPlacement = "before" | "after";
export type SidebarOrder = Record<SidebarSectionKey, Page[]>;

export interface SidebarDropTarget {
  sectionKey: SidebarSectionKey;
  page?: Page;
  placement: SidebarDropPlacement;
}

export interface SidebarSectionDropTarget {
  sectionKey: SidebarSectionKey;
  page?: Page;
  placement: SidebarDropPlacement;
}

export interface SidebarItem {
  id: Page;
  label: string;
  icon: LucideIcon;
}

export interface SidebarSectionDefinition {
  key: SidebarSectionKey;
  title: string | null;
  items: SidebarItem[];
  custom?: boolean;
}

export interface SidebarConfig {
  hiddenPages: Page[];
  hiddenLabels: SidebarSectionKey[];
  labels: Record<string, string>;
  sectionOrder: SidebarSectionKey[];
  autoHide: boolean;
  masterSearchEnabled: boolean;
}

export const customSidebarSectionPrefix = "custom-";

const sidebarOrderStorageKey = "flac-cafe-sidebar-order";
const sidebarConfigStorageKey = "flac-cafe-sidebar-config";
const sidebarMenuWidth = 270;
const sidebarMenuMaxHeight = 520;

const defaultSidebarSections: SidebarSectionDefinition[] = [
  {
    key: "main",
    title: null,
    items: [
      { id: "library", label: "Library", icon: Library },
      { id: "nowPlaying", label: "Now Playing", icon: FileText },
      { id: "artist", label: "Artist", icon: UserRound },
      { id: "autodj", label: "AutoDJ", icon: RadioTower },
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

export const defaultSidebarSectionKeys = defaultSidebarSections.map((section) => section.key);
export const allSidebarItems = defaultSidebarSections.flatMap((section) => section.items);
export const sidebarItemById = new Map(allSidebarItems.map((item) => [item.id, item]));
export const defaultSidebarSectionById = new Map(
  defaultSidebarSections.flatMap((section) => section.items.map((item) => [item.id, section.key] as const)),
);
export const defaultSidebarSectionByKey = new Map(defaultSidebarSections.map((section) => [section.key, section]));

const oldMainDefaultOrder: Page[] = ["library", "artist", "nowPlaying", "autodj"];

export function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function defaultSidebarOrder(): SidebarOrder {
  return Object.fromEntries(
    defaultSidebarSections.map((section) => [section.key, section.items.map((item) => item.id)]),
  ) as SidebarOrder;
}

export function defaultSidebarConfig(): SidebarConfig {
  return {
    hiddenPages: [],
    hiddenLabels: [],
    labels: {},
    sectionOrder: [...defaultSidebarSectionKeys],
    autoHide: false,
    masterSearchEnabled: false,
  };
}

export function normalizeSidebarConfig(candidate: unknown): SidebarConfig {
  const defaults = defaultSidebarConfig();
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }
  const source = candidate as Partial<SidebarConfig>;
  const labels =
    source.labels && typeof source.labels === "object" && !Array.isArray(source.labels)
      ? Object.fromEntries(
          Object.entries(source.labels)
            .filter(([key, value]) => typeof key === "string" && typeof value === "string")
            .map(([key, value]) => [key, value.trim()]),
        )
      : {};
  const customKeys = Object.keys(labels).filter((key) => key.startsWith(customSidebarSectionPrefix));
  const storedOrder = Array.isArray(source.sectionOrder)
    ? source.sectionOrder.filter((key): key is string => typeof key === "string")
    : [];
  const knownKeys = uniqueValues([...defaultSidebarSectionKeys, ...customKeys, ...storedOrder]);
  const sectionOrder = uniqueValues([...storedOrder, ...defaultSidebarSectionKeys, ...customKeys])
    .filter((key) => knownKeys.includes(key));
  const hiddenPages = Array.isArray(source.hiddenPages)
    ? source.hiddenPages.filter((id): id is Page => typeof id === "string" && sidebarItemById.has(id as Page))
    : [];
  const hiddenLabels = Array.isArray(source.hiddenLabels)
    ? source.hiddenLabels.filter(
        (key): key is string =>
          typeof key === "string" &&
          key !== "main" &&
          (defaultSidebarSectionByKey.has(key) || key.startsWith(customSidebarSectionPrefix)),
      )
    : [];
  return {
    hiddenPages: uniqueValues(hiddenPages),
    hiddenLabels: uniqueValues(hiddenLabels),
    labels,
    sectionOrder,
    autoHide: Boolean(source.autoHide),
    masterSearchEnabled: Boolean(source.masterSearchEnabled),
  };
}

export function normalizeSidebarOrder(candidate: unknown): SidebarOrder {
  const defaults = defaultSidebarOrder();
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }
  const source = candidate as Record<string, unknown>;
  const sectionKeys = uniqueValues([
    ...defaultSidebarSectionKeys,
    ...Object.keys(source).filter((key) => typeof key === "string" && key.length > 0),
  ]);
  const seen = new Set<Page>();
  const order = Object.fromEntries(sectionKeys.map((key) => [key, [] as Page[]])) as SidebarOrder;
  sectionKeys.forEach((key) => {
    const stored: unknown[] = Array.isArray(source[key]) ? source[key] : [];
    order[key] = stored.filter((id): id is Page => {
      if (typeof id !== "string" || !sidebarItemById.has(id as Page) || seen.has(id as Page)) {
        return false;
      }
      seen.add(id as Page);
      return true;
    });
  });
  allSidebarItems.forEach((item) => {
    if (!seen.has(item.id)) {
      const sectionKey = defaultSidebarSectionById.get(item.id) ?? "tools";
      order[sectionKey] ??= [];
      order[sectionKey].push(item.id);
    }
  });
  if (
    order.main?.length === oldMainDefaultOrder.length &&
    order.main.every((page, index) => page === oldMainDefaultOrder[index])
  ) {
    order.main = defaults.main;
  }
  return order;
}

export function readSidebarConfig() {
  if (typeof window === "undefined") {
    return defaultSidebarConfig();
  }
  try {
    return normalizeSidebarConfig(JSON.parse(window.localStorage.getItem(sidebarConfigStorageKey) ?? "null"));
  } catch {
    return defaultSidebarConfig();
  }
}

export function readSidebarOrder() {
  if (typeof window === "undefined") {
    return defaultSidebarOrder();
  }
  try {
    return normalizeSidebarOrder(JSON.parse(window.localStorage.getItem(sidebarOrderStorageKey) ?? "null"));
  } catch {
    return defaultSidebarOrder();
  }
}

export function writeSidebarConfig(config: SidebarConfig) {
  try {
    window.localStorage.setItem(sidebarConfigStorageKey, JSON.stringify(config));
  } catch {
    // Local storage can be unavailable in hardened WebView settings; customization still works for the session.
  }
}

export function writeSidebarOrder(order: SidebarOrder) {
  try {
    window.localStorage.setItem(sidebarOrderStorageKey, JSON.stringify(order));
  } catch {
    // Local storage can be unavailable in hardened WebView settings; dragging still works for the session.
  }
}

export function sectionTitleForKey(sectionKey: SidebarSectionKey, config: SidebarConfig): string | null {
  if (config.hiddenLabels.includes(sectionKey)) {
    return null;
  }
  const custom = config.labels[sectionKey]?.trim();
  if (custom) {
    return custom;
  }
  const definition = defaultSidebarSectionByKey.get(sectionKey);
  if (definition) {
    return definition.title;
  }
  return "New Label";
}

export function buildSidebarSections(order: SidebarOrder, config: SidebarConfig, showCdPage: boolean): SidebarSectionDefinition[] {
  const assigned = new Set<Page>();
  const hidden = new Set(config.hiddenPages);
  const sectionKeys = uniqueValues([...config.sectionOrder, ...defaultSidebarSectionKeys, ...Object.keys(order)]);
  const sections = sectionKeys.map((sectionKey) => {
    const definition = defaultSidebarSectionByKey.get(sectionKey);
    const items = (order[sectionKey] ?? [])
      .map((id) => sidebarItemById.get(id))
      .filter((item): item is SidebarItem => {
        if (!item || assigned.has(item.id) || hidden.has(item.id)) {
          return false;
        }
        if (item.id === "cd" && !showCdPage) {
          return false;
        }
        assigned.add(item.id);
        return true;
      });
    return {
      key: sectionKey,
      title: sectionTitleForKey(sectionKey, config),
      custom: !definition,
      items,
    };
  });
  allSidebarItems.forEach((item) => {
    if ((item.id === "cd" && !showCdPage) || hidden.has(item.id) || assigned.has(item.id)) {
      return;
    }
    const sectionKey = defaultSidebarSectionById.get(item.id) ?? "tools";
    sections.find((section) => section.key === sectionKey)?.items.push(item);
  });
  return sections;
}

export function clampSidebarMenuPosition(clientX: number, clientY: number) {
  const left = Math.max(8, Math.min(clientX, window.innerWidth - sidebarMenuWidth - 8));
  const top = Math.max(8, Math.min(clientY, window.innerHeight - sidebarMenuMaxHeight - 8));
  return { x: left, y: top };
}
