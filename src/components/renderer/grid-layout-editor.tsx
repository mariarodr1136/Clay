"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { LayoutItem } from "@/lib/dsl/schema";

const COLS = 12;
const GAP = 16;
const MAX_H = 12;

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origin: LayoutItem;
};

// Dependency-free drag/resize editor over the same 12-column grid contract
// the renderers use. It owns nothing but geometry: widgets come in through a
// render prop, and every change is reported as a full new layout array —
// persistence (a new view version live, tab-local state in the demo) is the
// caller's business.
export function GridLayoutEditor({
  layout,
  onChange,
  renderWidget,
  rowHeight = 100,
}: {
  layout: LayoutItem[];
  onChange: (next: LayoutItem[]) => void;
  renderWidget: (id: string) => React.ReactNode;
  rowHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const beginDrag = (e: React.PointerEvent, id: string, mode: DragState["mode"]) => {
    const item = layout.find((l) => l.id === id);
    if (!item) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ id, mode, startX: e.clientX, startY: e.clientY, origin: item });
  };

  const applyDrag = (e: React.PointerEvent) => {
    if (!drag || !containerRef.current) return;
    const width = containerRef.current.getBoundingClientRect().width;
    const cellW = (width - GAP * (COLS - 1)) / COLS + GAP;
    const cellH = rowHeight + GAP;
    const dx = Math.round((e.clientX - drag.startX) / cellW);
    const dy = Math.round((e.clientY - drag.startY) / cellH);
    const { origin } = drag;

    const next =
      drag.mode === "move"
        ? {
            ...origin,
            x: Math.min(Math.max(origin.x + dx, 0), COLS - origin.w),
            y: Math.max(origin.y + dy, 0),
          }
        : {
            ...origin,
            w: Math.min(Math.max(origin.w + dx, 1), COLS - origin.x),
            h: Math.min(Math.max(origin.h + dy, 1), MAX_H),
          };

    const current = layout.find((l) => l.id === drag.id);
    if (current && (current.x !== next.x || current.y !== next.y || current.w !== next.w || current.h !== next.h)) {
      onChange(layout.map((l) => (l.id === drag.id ? next : l)));
    }
  };

  const endDrag = () => setDrag(null);

  return (
    <div
      ref={containerRef}
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        gridAutoRows: `${rowHeight}px`,
        gap: GAP,
        // Faint column guides so snapping has something visible to snap to.
        backgroundImage:
          "repeating-linear-gradient(to right, color-mix(in oklch, var(--border), transparent 40%) 0 1px, transparent 1px calc((100% + 16px) / 12))",
      }}
    >
      {layout.map((item) => (
        <div
          key={item.id}
          className="group relative min-w-0"
          style={{
            gridColumn: `${item.x + 1} / span ${item.w}`,
            gridRow: `${item.y + 1} / span ${item.h}`,
            opacity: drag && drag.id !== item.id ? 0.6 : 1,
          }}
        >
          {renderWidget(item.id)}
          {/* Transparent capture layer: the widget stays visible but inert,
              so charts and selects never fight the drag for pointer events. */}
          <div
            className="absolute inset-0 cursor-grab rounded-2xl ring-2 ring-transparent transition-shadow group-hover:ring-ring/40 active:cursor-grabbing"
            onPointerDown={(e) => beginDrag(e, item.id, "move")}
            onPointerMove={applyDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="bg-card/90 text-muted-foreground absolute top-2 right-2 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <GripVertical className="size-3" />
              {item.w}×{item.h}
            </span>
          </div>
          <div
            aria-label="Resize widget"
            className="border-ring/60 bg-card absolute -right-1 -bottom-1 z-10 size-4 cursor-nwse-resize rounded-sm border-r-2 border-b-2 opacity-0 transition-opacity group-hover:opacity-100"
            onPointerDown={(e) => beginDrag(e, item.id, "resize")}
            onPointerMove={applyDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
      ))}
    </div>
  );
}
