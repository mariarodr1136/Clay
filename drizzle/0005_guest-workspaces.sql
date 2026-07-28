ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "guest_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_guest_expires_at_idx" ON "organizations" USING btree ("guest_expires_at");
