ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "lead_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "target_date" date;--> statement-breakpoint
ALTER TABLE "view_versions" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'created' NOT NULL;--> statement-breakpoint
-- Backfill before anything reads the column. Every existing version defaults
-- to 'created', but a version with a parent was an edit — without this, the
-- audit log would relabel a workspace's entire history as first drafts.
-- Reverts aren't recoverable retroactively; they were recorded only as the
-- prompt text patchView wrote at the time.
UPDATE "view_versions" SET "kind" = 'refined' WHERE "parent_version_id" IS NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_users_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
