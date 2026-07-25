import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

let instance: Db | null = null;

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return drizzle(postgres(url), { schema });
}

// Connected on first use rather than at module scope. `next build` imports
// every route to collect page data, so a module-scope postgres() call turns
// an unusable DATABASE_URL into a build failure instead of a runtime one —
// and `vercel env pull` writes the literal string "[SENSITIVE]" for redacted
// variables, which is exactly that case. A genuinely bad URL still fails
// loudly; it just fails where the query runs.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    instance ??= connect();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
