"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { DemoLayoutItem, DemoViewDef } from "@/fixtures/demo-dashboards";
import { GridLayoutEditor } from "@/components/renderer/grid-layout-editor";
import { DemoWidgetSwitch } from "./demo-view-renderer";
import { Button } from "@/components/ui/button";

// The live layout editor's demo twin: identical drag/resize interaction, but
// "saving" only updates this tab — the fixtures are shared, public sample
// data, so nothing persists.
export function DemoLayoutEditor({
  view,
  layout: initialLayout,
  onSave,
  onCancel,
}: {
  view: DemoViewDef;
  layout: DemoLayoutItem[];
  onSave: (layout: DemoLayoutItem[]) => void;
  onCancel: () => void;
}) {
  const [layout, setLayout] = useState<DemoLayoutItem[]>(initialLayout);
  const widgetsById = new Map(view.widgets.map((w) => [w.id, w]));
  const dirty = JSON.stringify(layout) !== JSON.stringify(initialLayout);

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-2.5">
        <p className="text-muted-foreground text-sm">
          Drag a widget to move it; use the corner handle to resize. In the live app this saves as
          a new version — here it lasts for this tab.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => {
              onSave(layout);
              toast.success("Layout updated for this tab — sign up to save real versions.");
            }}
          >
            Save layout
          </Button>
        </div>
      </div>
      <GridLayoutEditor
        layout={layout}
        onChange={setLayout}
        rowHeight={96}
        renderWidget={(id) => {
          const widget = widgetsById.get(id);
          if (!widget) return null;
          return <DemoWidgetSwitch widget={widget} filters={{}} onFilterChange={() => {}} />;
        }}
      />
    </div>
  );
}
