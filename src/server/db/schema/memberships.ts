import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
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
    // Deliberately NOT unique any more. It used to be, because each user had
    // exactly one workspace; with Clerk Organizations a user belongs to their
    // personal workspace plus every org they are invited to. The composite
    // (organization_id, user_id) index below is what keeps memberships
    // themselves unique.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: membershipRoles }).notNull().default("member"),
    // Marks the private workspace auto-created on first sign-in, as opposed
    // to a Clerk-backed shared organization. The partial unique index keeps
    // it to exactly one per user, which is what makes personal-workspace
    // provisioning race-safe now that user_id alone can repeat.
    isPersonal: boolean("is_personal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("memberships_org_user_idx").on(table.organizationId, table.userId),
    uniqueIndex("memberships_personal_idx")
      .on(table.userId)
      .where(sql`${table.isPersonal}`),
    index("memberships_user_idx").on(table.userId),
  ]
);
