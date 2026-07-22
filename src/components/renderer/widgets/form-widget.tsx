"use client";

import { useState } from "react";
import type { z } from "zod";
import { toast } from "sonner";
import type { formWidgetSchema } from "@/lib/dsl/schema";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Only "createTask" is supported today — see the DSL schema for why this
// isn't a generic form builder yet.
export function FormWidget({ widget }: { widget: z.infer<typeof formWidgetSchema> }) {
  const [title, setTitle] = useState("");
  const utils = trpc.useUtils();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setTitle("");
      utils.views.runQuery.invalidate();
      toast.success("Task created");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="h-full">
      {widget.title && (
        <CardHeader>
          <CardTitle className="text-sm">{widget.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createTask.mutate({ projectId: widget.config.projectId, title: title.trim() });
          }}
        >
          <Input
            placeholder="New task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" disabled={createTask.isPending}>
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
