import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// Bearer tokens for programmatic access — today, the MCP endpoint that lets
// an external agent query a workspace.
//
// Only a hash is stored. The token is shown once at creation and is
// unrecoverable afterwards, so a database dump can't be replayed as a set of
// working credentials. `prefix` is the first few characters, kept in clear
// so the UI can say which token is which without being able to reconstruct
// one.
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // The token acts as this user, in this organization. Both are frozen at
    // creation: a token never follows its owner into a workspace they join
    // later, and never widens if their role changes.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    // Revocation is a tombstone rather than a delete, so a revoked token
    // stays visible in the list as evidence it existed.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("api_tokens_org_created_at_idx").on(table.organizationId, table.createdAt)]
);
