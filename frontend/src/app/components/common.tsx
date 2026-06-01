import {
ArrowDown,
ArrowUp,
ChevronDown,
GripVertical,
Star,
} from "lucide-react";
import type {
DragEvent as ReactDragEvent,
MouseEvent as ReactMouseEvent,
ReactNode,
} from "react";
import {
createContext,
useCallback,
useContext,
useEffect,
useMemo,
useState,
} from "react";

import type {
DragGhost,
SortKey,
SortState,
} from "../shared";
import { formatRating } from "../shared";

export function sortIndicator(sort: SortState, key?: SortKey) {
  if (!key || sort.key !== key) {
    return null;
  }
  return sort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
}

export function ResizableHeader({
  label,
  column,
  width,
  sortKey,
  sort,
  onSort,
  onResize,
  align = "left",
  draggableColumn,
  isDragging = false,
  isDragOver = false,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDrop,
  onColumnDragEnd,
  onColumnPointerDragStart,
}: {
  label: string;
  column: string;
  width: number;
  sortKey?: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onResize: (column: string, width: number) => void;
  align?: "left" | "right";
  draggableColumn?: string;
  isDragging?: boolean;
  isDragOver?: boolean;
  onColumnDragStart?: (event: ReactDragEvent<HTMLTableCellElement>, column: string) => void;
  onColumnDragOver?: (event: ReactDragEvent<HTMLTableCellElement>, column: string) => void;
  onColumnDrop?: (event: ReactDragEvent<HTMLTableCellElement>, column: string) => void;
  onColumnDragEnd?: () => void;
  onColumnPointerDragStart?: (event: ReactMouseEvent<HTMLButtonElement>, column: string) => void;
}) {
  const headerLabel = label || (column === "play" ? "Play" : column);
  function handleResizeStart(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: MouseEvent) {
      onResize(column, Math.max(48, startWidth + moveEvent.clientX - startX));
    }

    function handleUp() {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return (
    <th
      className={`relative border-r border-line/50 px-3 py-0 font-medium transition ${
        draggableColumn ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-45" : ""} ${isDragOver ? "bg-moss/10 ring-1 ring-inset ring-moss/40" : ""}`}
      draggable={Boolean(draggableColumn)}
      data-library-column={draggableColumn}
      style={{ width }}
      title={draggableColumn ? `Drag to move ${headerLabel} column` : undefined}
      onDragStart={(event) => draggableColumn && onColumnDragStart?.(event, draggableColumn)}
      onDragOver={(event) => draggableColumn && onColumnDragOver?.(event, draggableColumn)}
      onDrop={(event) => draggableColumn && onColumnDrop?.(event, draggableColumn)}
      onDragEnd={onColumnDragEnd}
    >
      {draggableColumn && (
        <button
          type="button"
          className="absolute left-0 top-0 grid h-full w-4 cursor-grab place-items-center text-line hover:text-moss active:cursor-grabbing"
          title={`Move ${headerLabel} column`}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => onColumnPointerDragStart?.(event, draggableColumn)}
        >
          <GripVertical size={12} />
        </button>
      )}
      {sortKey ? (
        <button
          type="button"
          className={`flex h-10 w-full items-center gap-1.5 uppercase hover:text-white ${draggableColumn ? "pl-2" : ""} ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
          onClick={() => onSort(sortKey)}
        >
          {label}
          {sortIndicator(sort, sortKey)}
        </button>
      ) : (
        <div className={`flex h-10 items-center uppercase ${draggableColumn ? "pl-2" : ""}`}>{label}</div>
      )}
      <button
        type="button"
        className="absolute right-0 top-0 grid h-full w-3 cursor-col-resize place-items-center text-line hover:text-moss"
        title={`Resize ${label} column`}
        onMouseDown={handleResizeStart}
      >
        <GripVertical size={12} />
      </button>
    </th>
  );
}



export function RatingStars({
  rating,
  displayAsNumber = false,
  onChange,
}: {
  rating: number | null;
  displayAsNumber?: boolean;
  onChange: (rating: number | null) => void;
}) {
  const currentRating = rating ?? 0;
  const ratingNumber = rating === null || rating === undefined
    ? "--"
    : Number.isInteger(rating)
      ? rating.toFixed(0)
      : rating.toFixed(1);

  if (displayAsNumber) {
    return (
      <div
        className="relative flex h-7 w-16 items-center justify-center overflow-hidden rounded border border-line bg-panel text-sm font-semibold tabular-nums text-ember"
        aria-label={`Rating ${formatRating(rating)}`}
        title="Click across the control to set half-star ratings"
      >
        <span className={rating === null || rating === undefined ? "text-muted" : undefined}>{ratingNumber}</span>
        <div className="absolute inset-0 grid grid-cols-10">
          {Array.from({ length: 10 }, (_, index) => {
            const nextRating = (index + 1) / 2;
            return (
              <button
                key={nextRating}
                type="button"
                className="cursor-pointer transition hover:bg-white/10"
                title={formatRating(nextRating)}
                aria-label={`Set rating to ${formatRating(nextRating)}`}
                onClick={() => onChange(rating === nextRating ? null : nextRating)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-36 items-center gap-1" aria-label={`Rating ${formatRating(rating)}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillPercent = Math.max(0, Math.min(1, currentRating - (star - 1))) * 100;
        return (
          <div key={star} className="relative h-7 w-7 rounded transition hover:bg-white/10">
            <Star
              size={18}
              strokeWidth={1.8}
              className="absolute left-1 top-1 text-muted"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fillPercent}%` }}
            >
              <Star
                size={18}
                strokeWidth={1.8}
                className="absolute left-1 top-1 fill-ember text-ember"
              />
            </div>
            {[0.5, 1].map((step) => {
              const nextRating = star - 1 + step;
              return (
                <button
                  key={step}
                  type="button"
                  className={`absolute top-0 h-full cursor-pointer ${
                    step === 0.5 ? "left-0 w-1/2" : "right-0 w-1/2"
                  }`}
                  title={formatRating(nextRating)}
                  aria-label={`Set rating to ${formatRating(nextRating)}`}
                  onClick={() => onChange(rating === nextRating ? null : nextRating)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}



export function DragGhostPreview({ ghost }: { ghost: DragGhost | null }) {
  if (!ghost) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-[90] w-72 rounded border border-moss/50 bg-[rgb(var(--color-popover))] px-3 py-2 text-sm text-white opacity-95 shadow-2xl"
      style={{ left: ghost.x + 14, top: ghost.y + 14 }}
    >
      <div className="truncate font-medium">{ghost.title}</div>
      <div className="truncate text-xs text-muted">{ghost.subtitle}</div>
    </div>
  );
}



const DisclosureAccordionContext = createContext<{
  openSectionId: string | null;
  setOpenSectionId: (sectionId: string | null) => void;
} | null>(null);

export function DisclosureAccordionProvider({
  openSectionId,
  onOpenSectionChange,
  children,
}: {
  openSectionId: string | null;
  onOpenSectionChange: (sectionId: string | null) => void;
  children: ReactNode;
}) {
  const contextValue = useMemo(
    () => ({
      openSectionId,
      setOpenSectionId: onOpenSectionChange,
    }),
    [onOpenSectionChange, openSectionId],
  );

  return (
    <DisclosureAccordionContext.Provider value={contextValue}>
      {children}
    </DisclosureAccordionContext.Provider>
  );
}

export function DisclosureSection({
  title,
  description,
  defaultOpen = false,
  openSignal,
  accordionId,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  openSignal?: unknown;
  accordionId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const accordion = useContext(DisclosureAccordionContext);
  const accordionOpenSectionId = accordion?.openSectionId;
  const accordionSetOpenSectionId = accordion?.setOpenSectionId;
  const sectionId = accordionId ?? title;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [defaultOpenApplied, setDefaultOpenApplied] = useState(false);
  const isPropControlled = controlledOpen !== undefined;
  const isAccordionControlled = !isPropControlled && Boolean(accordionSetOpenSectionId);
  const open = isPropControlled
    ? controlledOpen
    : isAccordionControlled
      ? accordionOpenSectionId === sectionId
      : uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (isPropControlled) {
        onOpenChange?.(nextOpen);
        return;
      }
      if (isAccordionControlled && accordionSetOpenSectionId) {
        accordionSetOpenSectionId(nextOpen ? sectionId : null);
        return;
      }
      setUncontrolledOpen(nextOpen);
    },
    [accordionSetOpenSectionId, isAccordionControlled, isPropControlled, onOpenChange, sectionId],
  );

  useEffect(() => {
    if (defaultOpen && !defaultOpenApplied) {
      setOpen(true);
      setDefaultOpenApplied(true);
    }
  }, [defaultOpen, defaultOpenApplied, setOpen]);

  useEffect(() => {
    if (openSignal !== undefined && openSignal !== null) {
      setOpen(true);
    }
  }, [openSignal, setOpen]);

  return (
    <details className="group rounded border border-line bg-panel" open={open}>
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setOpen(!open);
        }}
      >
        <div className="min-w-0">
          <div className="font-medium text-white">{title}</div>
          {description && <div className="mt-1 truncate text-xs text-muted">{description}</div>}
        </div>
        <ChevronDown className="shrink-0 text-muted transition group-open:rotate-180" size={17} />
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}



export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-neutral-200">
      <span className="text-xs uppercase text-muted">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 rounded border border-line bg-panel px-3 text-white outline-none ring-moss/40 focus:ring-2"
      />
    </label>
  );
}
