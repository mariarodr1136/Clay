import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/server/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export { noIndex as metadata } from "@/lib/no-index";

async function checkDb() {
  // Without this, the page prerenders at build time and every later request
  // is served a health check frozen at whenever the build ran. connection()
  // stops prerendering here so the query runs per request — and unlike the
  // `dynamic` segment config, it keeps working if Cache Components is
  // enabled later.
  await connection();
  try {
    const result = await db.execute(sql`select now() as now`);
    const row = result[0] as { now: string };
    return { ok: true as const, now: row.now };
  } catch (error) {
    // The error detail is logged server-side and never rendered. This route
    // is intentionally public (see the middleware matcher), and driver
    // errors disclose the database host ("getaddrinfo ENOTFOUND
    // ep-....neon.tech") or the role name when credentials fail ("password
    // authentication failed for user ..."). The page reports only that the
    // database is unreachable.
    console.error("[health] database check failed", error);
    return { ok: false as const };
  }
}

export default async function HealthPage() {
  const dbStatus = await checkDb();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-(--status-done)" />
            App
            <Badge variant="outline" className="border-transparent bg-accent text-accent-foreground">
              ok
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>Next.js server is running.</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {dbStatus.ok ? (
              <CheckCircle2 className="size-4 text-(--status-done)" />
            ) : (
              <XCircle className="text-destructive size-4" />
            )}
            Database
            <Badge
              variant="outline"
              className={
                dbStatus.ok
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-transparent bg-destructive/10 text-destructive"
              }
            >
              {dbStatus.ok ? "connected" : "error"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {dbStatus.ok ? (
            <p>server time: {new Date(dbStatus.now).toISOString()}</p>
          ) : (
            <p className="text-destructive">
              Could not reach the database. See the server logs for details.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
