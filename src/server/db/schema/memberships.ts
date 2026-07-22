import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const membershipRoles = ["owner", "member"] as const;
export type MembershipRole = (typeof membershipRoles)[number];

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Unique per user (not just per org+user pair): today each user has
    // exactly one personal org, and this constraint is what makes
    // first-sign-in provisioning race-safe (see ensureUserOrg). Revisit
    // when real multi-org membership (Clerk Organizations) is added.
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: membershipRoles }).notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("memberships_org_user_idx").on(table.organizationId, table.userId)]
);
