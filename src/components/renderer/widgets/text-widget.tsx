import type { z } from "zod";
import type { textWidgetSchema } from "@/lib/dsl/schema";
import { Card, CardContent } from "@/components/ui/card";

// Plain text only — React escapes it by default, so this is safe without a
// sanitizer. Markdown rendering (with rehype-sanitize) is Phase 6 hardening.
export function TextWidget({ widget }: { widget: z.infer<typeof textWidgetSchema> }) {
  return (
    <Card className="h-full">
      <CardContent className="text-sm whitespace-pre-wrap">{widget.config.content}</CardContent>
    </Card>
  );
}
