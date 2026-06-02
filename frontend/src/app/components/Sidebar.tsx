import {
Check,
Coffee,
Plus,
RotateCcw,
Trash2,
} from "lucide-react";
import type { ChangeEvent,MouseEvent as ReactMouseEvent } from "react";
import { useEffect,useMemo,useRef,useState } from "react";

import { closeFloatingMenus,listenForCloseFloatingMenus } from "../menuEvents";
import type { Page } from "../shared";
import {
coffeeTapCountLabel,
readCoffeeTapCount,
writeCoffeeTapCount,
} from "./sidebarCoffeeCounter";
import { SidebarMasterSearch } from "./SidebarMasterSearch";
import {
type SidebarSearchTarget,
} from "./sidebarSearch";
import {
allSidebarItems,
buildSidebarSections,
clampSidebarMenuPosition,
customSidebarSectionPrefix,
defaultSidebarConfig,
defaultSidebarOrder,
defaultSidebarSectionById,
defaultSidebarSectionByKey,
defaultSidebarSectionKeys,
normalizeSidebarConfig,
normalizeSidebarOrder,
readSidebarConfig,
readSidebarOrder,
sidebarItemById,
uniqueValues,
writeSidebarConfig,
writeSidebarOrder,
type SidebarConfig,
type SidebarDropPlacement,
type SidebarDropTarget,
type SidebarItem,
type SidebarOrder,
type SidebarSectionDefinition,
type SidebarSectionDropTarget,
type SidebarSectionKey,
} from "./sidebarConfig";

export function Sidebar({
  activePage,
  setActivePage,
  hasDiagnosticsIssue,
  hasAnalysisIssue,
  showCdPage,
  sidebarWidthPx,
  sidebarPlacement,
  librarySearchEnabled,
  coffeeAnimating,
  onCoffeeClick,
  onOpenSearchTarget,
}: {
  activePage: Page;
  setActivePage: (page: Page) => void;
  hasDiagnosticsIssue: boolean;
  hasAnalysisIssue: boolean;
  showCdPage: boolean;
  sidebarWidthPx: number;
  sidebarPlacement: "left" | "right";
  librarySearchEnabled: boolean;
  coffeeAnimating: boolean;
  onCoffeeClick: () => void;
  onOpenSearchTarget: (target: SidebarSearchTarget, query: string) => void;
}) {
  const [sidebarOrder, setSidebarOrder] = useState(readSidebarOrder);
  const [sidebarConfig, setSidebarConfig] = useState(readSidebarConfig);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [autoHideOpen, setAutoHideOpen] = useState(false);
  const [draggedPage, setDraggedPage] = useState<Page | null>(null);
  const [draggedSectionKey, setDraggedSectionKey] = useState<SidebarSectionKey | null>(null);
  const [dragTarget, setDragTarget] = useState<SidebarDropTarget | null>(null);
  const [sectionDragTarget, setSectionDragTarget] = useState<SidebarSectionDropTarget | null>(null);
  const [editingSectionKey, setEditingSectionKey] = useState<SidebarSectionKey | null>(null);
  const [editingSectionLabel, setEditingSectionLabel] = useState("");
  const [coffeeTapCount, setCoffeeTapCount] = useState(readCoffeeTapCount);
  const [showCoffeeTapCount, setShowCoffeeTapCount] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef<Page | null>(null);
  const sections = useMemo(
    () => buildSidebarSections(sidebarOrder, sidebarConfig, showCdPage),
    [sidebarOrder, sidebarConfig, showCdPage],
  );
  const customSections = sections.filter((section) => section.custom);
  const sidebarEdgeClass = sidebarPlacement === "right" ? "right-0 border-l" : "left-0 border-r";
  const sidebarDockBorderClass = sidebarPlacement === "right" ? "border-l" : "border-r";
  const sidebarClosedTransform = sidebarPlacement === "right" ? "translate-x-full" : "-translate-x-full";

  useEffect(() => listenForCloseFloatingMenus(() => setContextMenu(null)), []);

  useEffect(() => {
    document.documentElement.dataset.sidebarLayout = sidebarConfig.autoHide ? "auto-hide" : "docked";
    return () => {
      delete document.documentElement.dataset.sidebarLayout;
    };
  }, [sidebarConfig.autoHide]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenu(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  function updateSidebarConfig(updater: (current: SidebarConfig) => SidebarConfig) {
    setSidebarConfig((current) => {
      const next = normalizeSidebarConfig(updater(current));
      writeSidebarConfig(next);
      return next;
    });
  }

  function moveSidebarItem(
    page: Page,
    targetSectionKey: SidebarSectionKey,
    targetPage?: Page,
    placement: SidebarDropPlacement = "before",
  ) {
    setSidebarOrder((current) => {
      const normalized = normalizeSidebarOrder(current);
      normalized[targetSectionKey] ??= [];
      const next = Object.fromEntries(
        Object.keys(normalized).map((sectionKey) => [
          sectionKey,
          normalized[sectionKey].filter((id) => id !== page),
        ]),
      ) as SidebarOrder;
      next[targetSectionKey] ??= [];
      const target = next[targetSectionKey];
      const targetIndex = targetPage ? target.indexOf(targetPage) : -1;
      const insertAt = targetIndex >= 0 ? targetIndex + (placement === "after" ? 1 : 0) : target.length;
      target.splice(insertAt, 0, page);
      writeSidebarOrder(next);
      return next;
    });
  }

  function moveSidebarSection(sourceKey: SidebarSectionKey, target: SidebarSectionDropTarget) {
    if (sourceKey === target.sectionKey && target.page) {
      const targetPage = target.page;
      setSidebarOrder((current) => {
        const normalized = normalizeSidebarOrder(current);
        const sourceItems = normalized[sourceKey] ?? [];
        const targetIndex = sourceItems.indexOf(targetPage);
        if (targetIndex < 0) {
          return current;
        }
        const splitAt = targetIndex + (target.placement === "after" ? 1 : 0);
        if (splitAt <= 0) {
          return current;
        }
        const sectionKeys = uniqueValues([...sidebarConfig.sectionOrder, ...defaultSidebarSectionKeys, ...Object.keys(normalized)]);
        const sourceIndex = sectionKeys.indexOf(sourceKey);
        const previousKey = sourceIndex > 0 ? sectionKeys[sourceIndex - 1] : null;
        if (!previousKey) {
          return current;
        }
        const next = { ...normalized };
        next[previousKey] = uniqueValues([...(next[previousKey] ?? []), ...sourceItems.slice(0, splitAt)]);
        next[sourceKey] = sourceItems.slice(splitAt);
        writeSidebarOrder(next);
        return next;
      });
      return;
    }
    if (sourceKey === target.sectionKey) {
      return;
    }
    if (target.page) {
      const targetPage = target.page;
      setSidebarOrder((current) => {
        const normalized = normalizeSidebarOrder(current);
        const targetItems = normalized[target.sectionKey] ?? [];
        const targetIndex = targetItems.indexOf(targetPage);
        if (targetIndex < 0) {
          return current;
        }
        const sourceItems = normalized[sourceKey] ?? [];
        const splitAt = targetIndex + (target.placement === "after" ? 1 : 0);
        const next = { ...normalized };
        next[target.sectionKey] = targetItems.slice(0, splitAt);
        next[sourceKey] = uniqueValues([...sourceItems, ...targetItems.slice(splitAt)]);
        writeSidebarOrder(next);
        return next;
      });
    }
    updateSidebarConfig((current) => {
      const order = uniqueValues([...current.sectionOrder, ...defaultSidebarSectionKeys, sourceKey, target.sectionKey]);
      const next = order.filter((key) => key !== sourceKey);
      const targetIndex = next.indexOf(target.sectionKey);
      const insertAfterTarget = Boolean(target.page) || target.placement === "after";
      next.splice(targetIndex >= 0 ? targetIndex + (insertAfterTarget ? 1 : 0) : next.length, 0, sourceKey);
      return { ...current, sectionOrder: next };
    });
  }

  function resolveDropTarget(clientX: number, clientY: number): SidebarDropTarget | null {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const targetElement = element?.closest<HTMLElement>("[data-sidebar-drop-target]");
    const sectionKey = targetElement?.dataset.sidebarSection;
    if (!targetElement || !sectionKey) {
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

  function resolveSectionDropTarget(clientX: number, clientY: number): SidebarSectionDropTarget | null {
    // Section labels can drop between section headers or onto menu entries; this
    // lets labels move downward past their current neighbors instead of only up.
    const x = Math.max(8, Math.min(clientX, window.innerWidth - 8));
    const element = document.elementFromPoint(x, clientY) as HTMLElement | null;
    const labelElement = element?.closest<HTMLElement>("[data-sidebar-section-label]");
    const labelSectionKey = labelElement?.dataset.sidebarSection;
    if (labelElement && labelSectionKey) {
      const bounds = labelElement.getBoundingClientRect();
      return {
        sectionKey: labelSectionKey,
        placement: clientY > bounds.top + bounds.height / 2 ? "after" : "before",
      };
    }
    const itemElement = element?.closest<HTMLElement>("[data-sidebar-drop-target][data-sidebar-page]");
    const sectionKey = itemElement?.dataset.sidebarSection;
    const page = itemElement?.dataset.sidebarPage;
    if (!itemElement || !sectionKey || !page || !sidebarItemById.has(page as Page)) {
      return null;
    }
    const bounds = itemElement.getBoundingClientRect();
    return {
      sectionKey,
      page: page as Page,
      placement: clientY > bounds.top + bounds.height / 2 ? "after" : "before",
    };
  }

  function finishDrag() {
    setDraggedPage(null);
    setDraggedSectionKey(null);
    setDragTarget(null);
    setSectionDragTarget(null);
  }

  function clearSuppressedClick(page: Page) {
    window.setTimeout(() => {
      if (suppressNextClickRef.current === page) {
        suppressNextClickRef.current = null;
      }
    }, 0);
  }

  function beginSidebarDrag(event: ReactMouseEvent<HTMLButtonElement>, item: SidebarItem, sectionKey: SidebarSectionKey) {
    if (event.button !== 0 || editingSectionKey) {
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
      if (!active) {
        active = true;
        suppressNextClickRef.current = item.id;
        setDraggedPage(item.id);
      }
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
      if (active) {
        mouseEvent.preventDefault();
        const finalTarget = resolveDropTarget(mouseEvent.clientX, mouseEvent.clientY) ?? latestTarget;
        if (finalTarget.page !== item.id) {
          moveSidebarItem(item.id, finalTarget.sectionKey, finalTarget.page, finalTarget.placement);
        }
        finishDrag();
        clearSuppressedClick(item.id);
      }
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

  function beginSectionDrag(event: ReactMouseEvent<HTMLElement>, sectionKey: SidebarSectionKey) {
    if (event.button !== 0 || editingSectionKey || sectionKey === "main") {
      return;
    }
    event.preventDefault();
    const startY = event.clientY;
    let active = false;
    let latestTarget: SidebarSectionDropTarget = { sectionKey, placement: "before" };
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    function cleanup() {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("blur", handleCancel);
    }
    function handleMove(mouseEvent: MouseEvent) {
      const distance = Math.abs(mouseEvent.clientY - startY);
      if (!active && distance < 6) {
        return;
      }
      active = true;
      setDraggedSectionKey(sectionKey);
      mouseEvent.preventDefault();
      const nextTarget = resolveSectionDropTarget(mouseEvent.clientX, mouseEvent.clientY);
      if (nextTarget) {
        latestTarget = nextTarget;
        setSectionDragTarget(nextTarget);
      }
    }
    function handleUp(mouseEvent: MouseEvent) {
      cleanup();
      if (active) {
        mouseEvent.preventDefault();
        const finalTarget = resolveSectionDropTarget(mouseEvent.clientX, mouseEvent.clientY) ?? latestTarget;
        moveSidebarSection(sectionKey, finalTarget);
      }
      finishDrag();
    }
    function handleCancel() {
      cleanup();
      finishDrag();
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("blur", handleCancel);
  }

  function openSidebarContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenus();
    setContextMenu(clampSidebarMenuPosition(event.clientX, event.clientY));
  }

  function handleCoffeeTap(event: ReactMouseEvent<HTMLButtonElement>) {
    setCoffeeTapCount((current) => {
      const next = current + 1;
      writeCoffeeTapCount(next);
      return next;
    });
    if (event.shiftKey) {
      setShowCoffeeTapCount(true);
      window.setTimeout(() => setShowCoffeeTapCount(false), 2200);
    }
    onCoffeeClick();
  }

  function openSearchTarget(target: SidebarSearchTarget, query: string) {
    if (target.kind === "page") {
      setActivePage(target.page);
    } else {
      onOpenSearchTarget(target, query);
    }
    if (sidebarConfig.autoHide) {
      setAutoHideOpen(false);
    }
  }

  function toggleSidebarPage(page: Page, event: ChangeEvent<HTMLInputElement>) {
    const show = event.target.checked;
    updateSidebarConfig((current) => ({
      ...current,
      hiddenPages: show
        ? current.hiddenPages.filter((id) => id !== page)
        : uniqueValues([...current.hiddenPages, page]),
    }));
  }

  function addSidebarLabel() {
    const key = `${customSidebarSectionPrefix}${Date.now().toString(36)}`;
    updateSidebarConfig((current) => ({
      ...current,
      labels: { ...current.labels, [key]: "" },
      sectionOrder: [...current.sectionOrder, key],
    }));
    setSidebarOrder((current) => {
      const next = { ...normalizeSidebarOrder(current), [key]: [] };
      writeSidebarOrder(next);
      return next;
    });
    setEditingSectionKey(key);
    setEditingSectionLabel("");
    setContextMenu(null);
  }

  function resetSidebarCustomization() {
    const nextOrder = defaultSidebarOrder();
    const nextConfig = defaultSidebarConfig();
    setSidebarOrder(nextOrder);
    setSidebarConfig(nextConfig);
    writeSidebarOrder(nextOrder);
    writeSidebarConfig(nextConfig);
    setContextMenu(null);
  }

  function deleteSidebarLabel(sectionKey: SidebarSectionKey) {
    if (!sectionKey.startsWith(customSidebarSectionPrefix)) {
      updateSidebarConfig((current) => ({
        ...current,
        hiddenLabels: uniqueValues([...current.hiddenLabels, sectionKey]),
      }));
      if (editingSectionKey === sectionKey) {
        setEditingSectionKey(null);
        setEditingSectionLabel("");
      }
      return;
    }
    setSidebarOrder((current) => {
      const normalized = normalizeSidebarOrder(current);
      const pagesToMove = normalized[sectionKey] ?? [];
      const next = { ...normalized };
      delete next[sectionKey];
      pagesToMove.forEach((page) => {
        const fallbackSectionKey = defaultSidebarSectionById.get(page) ?? "tools";
        next[fallbackSectionKey] ??= [];
        if (!next[fallbackSectionKey].includes(page)) {
          next[fallbackSectionKey].push(page);
        }
      });
      writeSidebarOrder(next);
      return next;
    });
    updateSidebarConfig((current) => {
      const labels = { ...current.labels };
      delete labels[sectionKey];
      return {
        ...current,
        labels,
        hiddenLabels: current.hiddenLabels.filter((key) => key !== sectionKey),
        sectionOrder: current.sectionOrder.filter((key) => key !== sectionKey),
      };
    });
    if (editingSectionKey === sectionKey) {
      setEditingSectionKey(null);
      setEditingSectionLabel("");
    }
  }

  function startEditingSection(section: SidebarSectionDefinition) {
    if (!section.title) {
      return;
    }
    setEditingSectionKey(section.key);
    setEditingSectionLabel(section.title);
  }

  function commitSectionLabel() {
    const sectionKey = editingSectionKey;
    if (!sectionKey) {
      return;
    }
    const label = editingSectionLabel.trim();
    updateSidebarConfig((current) => {
      const labels = { ...current.labels };
      if (!label && defaultSidebarSectionByKey.has(sectionKey)) {
        delete labels[sectionKey];
      } else {
        labels[sectionKey] = label || "New Label";
      }
      return { ...current, labels };
    });
    setEditingSectionKey(null);
    setEditingSectionLabel("");
  }

  function renderSectionTitle(section: SidebarSectionDefinition) {
    if (!section.title) {
      return null;
    }
    const isDragOver =
      !sectionDragTarget?.page && sectionDragTarget?.sectionKey === section.key && draggedSectionKey !== section.key;
    if (editingSectionKey === section.key) {
      return (
        <div className="mx-1 flex h-7 items-center gap-1">
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-moss/50 bg-ink px-2 text-[11px] font-medium uppercase text-white outline-none"
            value={editingSectionLabel}
            onBlur={commitSectionLabel}
            onChange={(event) => setEditingSectionLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setEditingSectionKey(null);
                setEditingSectionLabel("");
              }
            }}
          />
          <button
            className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted transition hover:bg-ember/15 hover:text-ember"
            type="button"
            title={`Delete ${section.title}`}
            onClick={() => deleteSidebarLabel(section.key)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      );
    }
    return (
      <div
        data-sidebar-section-label
        data-sidebar-section={section.key}
        className={`flex h-6 select-none items-center rounded px-2 text-[11px] font-medium uppercase tracking-wide text-muted/60 transition hover:text-neutral-300 ${
          draggedSectionKey === section.key ? "opacity-45" : ""
        } ${isDragOver ? "ring-1 ring-moss/60" : ""}`}
        title="Double-click to rename or delete"
        onDoubleClick={() => startEditingSection(section)}
        onMouseDown={(event) => beginSectionDrag(event, section.key)}
      >
        <span className="min-w-0 flex-1 truncate">{section.title}</span>
      </div>
    );
  }

  function renderItem(item: SidebarItem, sectionKey: SidebarSectionKey) {
    const Icon = item.icon;
    const active = activePage === item.id;
    const prominent = sectionKey === "main";
    const isDragging = draggedPage === item.id;
    const isDragOver = dragTarget?.page === item.id && draggedPage !== item.id;
    const isSectionDragOver = sectionDragTarget?.page === item.id && Boolean(draggedSectionKey);
    return (
      <button
        key={item.id}
        data-sidebar-drop-target
        data-sidebar-page={item.id}
        data-sidebar-section={sectionKey}
        type="button"
        className={`flex ${prominent ? "h-9" : "h-8"} cursor-pointer items-center gap-3 rounded px-3 text-sm transition ${
          active ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white"
        } ${isDragging ? "opacity-45" : ""} ${isDragOver || isSectionDragOver ? "ring-1 ring-moss/60" : ""}`}
        onClick={() => {
          if (suppressNextClickRef.current === item.id) {
            suppressNextClickRef.current = null;
            return;
          }
          setActivePage(item.id);
          if (sidebarConfig.autoHide) {
            setAutoHideOpen(false);
          }
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

  const sidebarContent = (
    <>
      <button
        className="flex h-14 items-center gap-3 border-b border-line px-4 text-left transition hover:bg-white/[0.035]"
        type="button"
        title="Tap the cup"
        onClick={handleCoffeeTap}
      >
        <div className={`grid h-8 w-8 place-items-center rounded bg-ember text-ink shadow-sm shadow-black/20 ${coffeeAnimating ? "animate-cafe-cup" : ""}`}>
          <Coffee size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">FLAC Cafe</div>
          <div className="text-xs text-muted">{showCoffeeTapCount ? coffeeTapCountLabel(coffeeTapCount) : "Smart local player"}</div>
        </div>
      </button>
      <SidebarMasterSearch
        enabled={sidebarConfig.masterSearchEnabled}
        showCdPage={showCdPage}
        librarySearchEnabled={librarySearchEnabled}
        onOpenSearchTarget={openSearchTarget}
      >
        <nav className="scrollbar-hidden min-h-0 flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          {sections.map((section) => (
            <div
              key={section.key}
              data-sidebar-drop-target
              data-sidebar-section={section.key}
              className={`${section.key === "main" ? "grid gap-1" : "mt-2 grid gap-1 first:mt-3"} rounded transition ${
                draggedPage ? "pb-1" : ""
              } ${dragTarget?.sectionKey === section.key && !dragTarget.page ? "ring-1 ring-moss/50" : ""}`}
            >
              {renderSectionTitle(section)}
              {section.items.map((item) => renderItem(item, section.key))}
            </div>
          ))}
        </nav>
      </SidebarMasterSearch>
    </>
  );

  const customizationMenu = contextMenu && (
    <div
      ref={contextMenuRef}
      className="fixed z-50 grid max-h-[520px] w-[270px] overflow-hidden rounded border border-line bg-panel py-2 text-sm text-neutral-200 shadow-2xl shadow-black/45"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/[0.04]">
        <input
          className="accent-moss"
          type="checkbox"
          checked={sidebarConfig.autoHide}
          onChange={(event) => {
            updateSidebarConfig((current) => ({ ...current, autoHide: event.target.checked }));
            setAutoHideOpen(!event.target.checked);
          }}
        />
        <span className="min-w-0 flex-1">Auto-hide sidebar</span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/[0.04]">
        <input
          className="accent-moss"
          type="checkbox"
          checked={sidebarConfig.masterSearchEnabled}
          onChange={(event) => updateSidebarConfig((current) => ({ ...current, masterSearchEnabled: event.target.checked }))}
        />
        <span className="min-w-0 flex-1">Master search</span>
      </label>
      <div className="my-1 border-t border-line" />
      <div className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">Show Sections</div>
      <div className="max-h-64 overflow-auto">
        {allSidebarItems.map((item) => {
          const Icon = item.icon;
          const visible = !sidebarConfig.hiddenPages.includes(item.id);
          return (
            <label key={item.id} className="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-white/[0.04]">
              <input className="accent-moss" type="checkbox" checked={visible} onChange={(event) => toggleSidebarPage(item.id, event)} />
              <Icon size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {visible && <Check size={13} className="text-moss" />}
            </label>
          );
        })}
      </div>
      <div className="my-1 border-t border-line" />
      <button className="flex h-8 items-center gap-2 px-3 text-left hover:bg-white/[0.04]" type="button" onClick={addSidebarLabel}>
        <Plus size={14} />
        Add Label
      </button>
      {customSections.length > 0 && (
        <>
          <div className="px-3 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Custom Labels</div>
          {customSections.map((section) => (
            <div key={section.key} className="flex h-8 items-center gap-2 px-3 text-muted hover:bg-white/[0.04] hover:text-white">
              <span className="min-w-0 flex-1 truncate">{section.title}</span>
              <button
                className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted transition hover:bg-ember/15 hover:text-ember"
                type="button"
                title={`Delete ${section.title}`}
                onClick={() => deleteSidebarLabel(section.key)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </>
      )}
      <button className="flex h-8 items-center gap-2 px-3 text-left text-muted hover:bg-white/[0.04] hover:text-white" type="button" onClick={resetSidebarCustomization}>
        <RotateCcw size={14} />
        Reset Sidebar
      </button>
    </div>
  );

  if (sidebarConfig.autoHide) {
    return (
      <>
        <div
          className={`absolute inset-y-0 z-30 w-2 border-line/70 bg-[rgb(var(--color-sidebar))] ${sidebarEdgeClass}`}
          onMouseEnter={() => setAutoHideOpen(true)}
        />
        <aside
          className={`absolute inset-y-0 z-30 flex h-full shrink-0 flex-col border-line bg-[rgb(var(--color-sidebar))] shadow-2xl shadow-black/35 transition-transform duration-150 ${sidebarEdgeClass} ${
            autoHideOpen ? "translate-x-0" : sidebarClosedTransform
          }`}
          style={{ width: sidebarWidthPx }}
          onContextMenu={openSidebarContextMenu}
          onMouseEnter={() => setAutoHideOpen(true)}
          onMouseLeave={() => {
            if (!contextMenu && !editingSectionKey && !draggedPage && !draggedSectionKey) {
              setAutoHideOpen(false);
            }
          }}
        >
          {sidebarContent}
        </aside>
        {customizationMenu}
      </>
    );
  }

  return (
    <>
      <aside
        className={`flex h-full shrink-0 flex-col border-line bg-[rgb(var(--color-sidebar))] ${sidebarDockBorderClass}`}
        style={{ width: sidebarWidthPx }}
        onContextMenu={openSidebarContextMenu}
      >
        {sidebarContent}
      </aside>
      {customizationMenu}
    </>
  );
}
