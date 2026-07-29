ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Archived projects are excluded from every list, so the index that backs
-- those lists should skip them too.
CREATE INDEX IF NOT EXISTS "projects_org_active_idx" ON "projects" USING btree ("organization_id") WHERE "archived_at" IS NULL;
