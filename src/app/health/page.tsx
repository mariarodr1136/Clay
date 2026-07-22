import { sql } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/server/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function checkDb() {
  try {
    const result = await db.execute(sql`select now() as now, current_database() as db`);
    const row = result[0] as { now: string; db: string };
    return { ok: true as const, now: row.now, database: row.db };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
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
            <>
              <p>database: {dbStatus.database}</p>
              <p>server time: {new Date(dbStatus.now).toISOString()}</p>
            </>
          ) : (
            <p className="text-destructive">{dbStatus.error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
