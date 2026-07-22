import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// id mirrors the Clerk user id (e.g. "user_...") — no separate identity to keep in sync.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
