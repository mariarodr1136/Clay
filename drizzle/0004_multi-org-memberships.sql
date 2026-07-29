ALTER TABLE "memberships" DROP CONSTRAINT IF EXISTS "memberships_user_id_unique";--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "is_personal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill before the partial unique index exists. Every membership written
-- before this migration was a personal workspace, because a user could only
-- ever have one. Without this, resolveActiveOrg would find no personal
-- membership for an existing user and mint them a second, empty workspace —
-- silently orphaning everything they had.
UPDATE "memberships" SET "is_personal" = true
WHERE "organization_id" IN (SELECT "id" FROM "organizations" WHERE "clerk_org_id" IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_personal_idx" ON "memberships" USING btree ("user_id") WHERE "memberships"."is_personal";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_user_idx" ON "memberships" USING btree ("user_id");
