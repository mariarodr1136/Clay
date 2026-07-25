import { format } from "date-fns";
import { demoViewById } from "@/fixtures/demo-dashboards";
import { demoPerson } from "@/fixtures/demo-data";
import { DemoPrintDocument } from "@/components/demo/demo-print-document";

// No token here, deliberately: /demo is public sample data, so this page
// exposes nothing the demo pages don't already ship to the browser.
function parseFilters(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value] as const] : []
      )
    );
  } catch {
    return {};
  }
}

export default async function DemoPrintViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ viewId: string }>;
  searchParams: Promise<{ filters?: string }>;
}) {
  const { viewId } = await params;
  const { filters } = await searchParams;

  const view = demoViewById(viewId);
  if (!view) {
    return <p className="text-destructive text-sm">View not found.</p>;
  }

  return (
    <DemoPrintDocument
      view={view}
      creatorName={demoPerson(view.creatorId).name}
      generatedAt={format(new Date(), "PPp")}
      filters={parseFilters(filters)}
    />
  );
}
