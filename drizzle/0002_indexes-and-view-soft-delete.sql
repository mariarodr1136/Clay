ALTER TABLE "views" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_org_created_at_idx" ON "activity_log" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_task_id_created_at_idx" ON "comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_org_created_at_idx" ON "projects" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_project_idx" ON "tasks" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_status_idx" ON "tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_due_date_idx" ON "tasks" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_assignee_idx" ON "tasks" USING btree ("organization_id","assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_created_at_idx" ON "tasks" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_org_updated_at_idx" ON "tasks" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "view_versions_view_id_created_at_idx" ON "view_versions" USING btree ("view_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "view_versions_created_at_idx" ON "view_versions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "views_org_updated_at_idx" ON "views" USING btree ("organization_id","updated_at" DESC NULLS LAST);
