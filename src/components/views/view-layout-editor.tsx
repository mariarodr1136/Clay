"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { parseView } from "@/lib/dsl/validate";
import type { LayoutItem } from "@/lib/dsl/schema";
import { GridLayoutEditor } from "@/components/renderer/grid-layout-editor";
import { WidgetSwitch } from "@/components/renderer/view-renderer";
import { Button } from "@/components/ui/button";

// Edit-layout mode for a live view: same widgets, same grid, but draggable —
// and saving writes a normal new version, so the manual tweak shows up in
// history (and is revertable) exactly like an agent edit.
export function ViewLayoutEditor({
  viewId,
  schema,
  onDone,
}: {
  viewId: string;
  schema: unknown;
  onDone: () => void;
}) {
  const parsed = parseView(schema);
  const [layout, setLayout] = useState<LayoutItem[]>(
    parsed.success ? parsed.data.layout.widgets : []
  );

  const saveLayout = trpc.views.saveLayout.useMutation({
    onSuccess: () => {
      toast.success("Layout saved as a new version");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!parsed.success) {
    return <p className="text-destructive text-sm">Can&apos;t edit this view: {parsed.error}</p>;
  }

  const widgetsById = new Map(parsed.data.widgets.map((w) => [w.id, w]));
  const dirty = JSON.stringify(layout) !== JSON.stringify(parsed.data.layout.widgets);

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-2.5">
        <p className="text-muted-foreground text-sm">
          Drag a widget to move it; use the corner handle to resize. Saving keeps the old
          arrangement in history.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDone} disabled={saveLayout.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!dirty || saveLayout.isPending}
            onClick={() => saveLayout.mutate({ viewId, layout: { widgets: layout } })}
          >
            {saveLayout.isPending ? "Saving…" : "Save layout"}
          </Button>
        </div>
      </div>
      <GridLayoutEditor
        layout={layout}
        onChange={setLayout}
        widgetLabel={(id) => {
          const widget = widgetsById.get(id);
          return widget?.title ?? widget?.type ?? id;
        }}
        renderWidget={(id) => {
          const widget = widgetsById.get(id);
          if (!widget) return null;
          return <WidgetSwitch widget={widget} filters={{}} onFilterChange={() => {}} />;
        }}
      />
    </div>
  );
}
