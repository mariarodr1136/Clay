"use client";

import type { z } from "zod";
import type { filterBarWidgetSchema } from "@/lib/dsl/schema";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ALL_VALUE = "__all__";

export function FilterBarWidget({
  widget,
  filters,
  onFilterChange,
}: {
  widget: z.infer<typeof filterBarWidgetSchema>;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
}) {
  const { filterKey, label, options } = widget.config;
  const value = filters[filterKey] ?? ALL_VALUE;

  return (
    <Card className="flex h-full items-center">
      <CardContent className="flex w-full items-center gap-2">
        <Label className="text-muted-foreground text-xs whitespace-nowrap">{label}</Label>
        <Select
          value={value}
          onValueChange={(v) => onFilterChange(filterKey, v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
