"use client";

import { agentModels, type AgentModelId } from "@/lib/agent-models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// BYOK model choice — the user pays for these calls, so which model runs is
// their decision, not ours. The server re-validates against the same list.
export function ModelPicker({
  value,
  onChange,
  className,
}: {
  value: AgentModelId;
  onChange: (value: AgentModelId) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AgentModelId)}>
      <SelectTrigger size="sm" className={className} aria-label="Model">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {agentModels.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="font-medium">{m.label}</span>
            <span className="text-muted-foreground text-xs"> — {m.hint}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
