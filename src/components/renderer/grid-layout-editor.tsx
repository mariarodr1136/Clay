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

function clampMove(item: LayoutItem, dx: number, dy: number): LayoutItem {
  return {
    ...item,
    x: Math.min(Math.max(item.x + dx, 0), COLS - item.w),
    y: Math.max(item.y + dy, 0),
  };
}

function clampResize(item: LayoutItem, dw: number, dh: number): LayoutItem {
  return {
    ...item,
    w: Math.min(Math.max(item.w + dw, 1), COLS - item.x),
    h: Math.min(Math.max(item.h + dh, 1), MAX_H),
  };
}

function sameGeometry(a: LayoutItem, b: LayoutItem) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

// Dependency-free drag/resize editor over the same 12-column grid contract
// the renderers use. It owns nothing but geometry: widgets come in through a
// render prop, and every change is reported as a full new layout array —
// persistence (a new view version live, tab-local state in the demo) is the
// caller's business.
//
// Every gesture has a keyboard equivalent. Tab reaches each widget, arrows
// move it, shift+arrows resize it, and each change is announced in a live
// region — a drag-only editor is unusable for anyone not using a mouse, and
// "describe the view you need" is a promise the editing surface has to keep
// too. touch-action: none on the drag surfaces is what makes the same
// gestures work on a tablet instead of scrolling the page.
export function GridLayoutEditor({
  layout,
  onChange,
  renderWidget,
  widgetLabel,
  rowHeight = 100,
}: {
  layout: LayoutItem[];
  onChange: (next: LayoutItem[]) => void;
  renderWidget: (id: string) => React.ReactNode;
  // Human-readable name for announcements; falls back to the widget id.
  widgetLabel?: (id: string) => string;
  rowHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const labelFor = (id: string) => widgetLabel?.(id) ?? id;

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
      drag.mode === "move" ? clampMove(origin, dx, dy) : clampResize(origin, dx, dy);

    const current = layout.find((l) => l.id === drag.id);
    if (current && !sameGeometry(current, next)) {
      onChange(layout.map((l) => (l.id === drag.id ? next : l)));
    }
  };

  const endDrag = () => setDrag(null);

  const nudge = (event: React.KeyboardEvent, id: string) => {
    const item = layout.find((l) => l.id === id);
    if (!item) return;

    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = deltas[event.key];
    if (!delta) return;

    event.preventDefault();
    const [dx, dy] = delta;
    const resizing = event.shiftKey;
    const next = resizing ? clampResize(item, dx, dy) : clampMove(item, dx, dy);

    if (sameGeometry(item, next)) {
      // Hitting an edge is silent visually; say so rather than leaving a
      // keyboard user pressing a key that appears to do nothing.
      setAnnouncement(
        resizing
          ? `${labelFor(id)} can't resize further in that direction.`
          : `${labelFor(id)} can't move further in that direction.`
      );
      return;
    }

    onChange(layout.map((l) => (l.id === id ? next : l)));
    setAnnouncement(
      resizing
        ? `${labelFor(id)} resized to ${next.w} by ${next.h}.`
        : `${labelFor(id)} moved to column ${next.x + 1}, row ${next.y + 1}.`
    );
  };

  return (
    <>
      <p className="text-muted-foreground mb-3 text-xs">
        Drag to move, or focus a widget and use the arrow keys — hold shift to resize.
      </p>

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
                so charts and selects never fight the drag for pointer events.
                It's a real button so it lands in the tab order and answers to
                the keyboard, not just the pointer. */}
            <button
              type="button"
              aria-label={`${labelFor(item.id)}: column ${item.x + 1}, row ${item.y + 1}, ${item.w} by ${item.h}. Arrow keys move, shift and arrow keys resize.`}
              className="focus-visible:ring-ring group-hover:ring-ring/40 absolute inset-0 cursor-grab rounded-2xl ring-2 ring-transparent transition-shadow focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => beginDrag(e, item.id, "move")}
              onPointerMove={applyDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(e) => nudge(e, item.id)}
            >
              <span className="bg-card/90 text-muted-foreground absolute top-2 right-2 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <GripVertical className="size-3" />
                {item.w}×{item.h}
              </span>
            </button>
            {/* Pointer affordance only — resizing by keyboard is shift+arrow
                on the widget itself, so this stays out of the tab order
                rather than doubling every widget's tab stops. */}
            <div
              aria-hidden
              className="border-ring/60 bg-card absolute -right-1 -bottom-1 z-10 size-4 cursor-nwse-resize rounded-sm border-r-2 border-b-2 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => beginDrag(e, item.id, "resize")}
              onPointerMove={applyDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>
        ))}
      </div>

      {/* Geometry changes are purely visual, so without this a keyboard or
          screen-reader user gets no confirmation that anything happened. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
