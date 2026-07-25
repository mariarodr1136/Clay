"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";

const noopSubscribe = () => () => {};

// The server and the client would format two different instants, so this
// renders nothing until it's running in the browser. The server snapshot is
// `false`, meaning hydration compares empty against empty and only then fills
// the time in. It only ever appears in printed output, so the first pass
// showing nothing costs nothing.
export function PrintTimestamp({ filters }: { filters: Record<string, string> }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const applied = Object.entries(filters);
  return (
    <>
      {mounted ? format(new Date(), "PPp") : null}
      {applied.length > 0 &&
        ` · Filters: ${applied.map(([key, value]) => `${key} = ${value}`).join(", ")}`}
    </>
  );
}
