import { eq } from "drizzle-orm";
import { db } from "./client";
import { views, viewVersions } from "./schema";
import { viewSchema } from "@/lib/dsl/schema";
import { buildDemoViews } from "@/fixtures/demo-views";

export async function seedDemoViews(organizationId: string, ownerId: string, projectId: string) {
  for (const fixture of buildDemoViews(projectId)) {
    const schema = viewSchema.parse(fixture.schema);

    const [view] = await db
      .insert(views)
      .values({ organizationId, ownerId, scope: schema.scope, name: fixture.name })
      .returning();

    const [version] = await db
      .insert(viewVersions)
      .values({
        viewId: view.id,
        schemaJson: schema,
        createdBy: "user",
        promptText: fixture.prompt,
      })
      .returning();

    await db.update(views).set({ currentVersionId: version.id }).where(eq(views.id, view.id));
  }
}
