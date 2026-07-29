import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkOrgId: text("clerk_org_id").unique(),
    name: text("name").notNull(),
    // Set on throwaway workspaces handed to /demo visitors. The demo is the
    // real product against a real (disposable) tenant rather than a
    // hand-authored imitation, so a guest workspace is an ordinary
    // organization in every respect — this column exists only so the sweeper
    // can find them and the UI can say "nothing here is saved".
    guestExpiresAt: timestamp("guest_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("organizations_guest_expires_at_idx").on(table.guestExpiresAt)]
);
