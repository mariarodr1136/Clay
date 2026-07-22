import { viewSchema } from "@/lib/dsl/schema";
import { buildDemoViews } from "@/fixtures/demo-views";
import { createView } from "./create-view";

export async function seedDemoViews(organizationId: string, ownerId: string, projectId: string) {
  for (const fixture of buildDemoViews(projectId)) {
    await createView({
      organizationId,
      ownerId,
      name: fixture.name,
      schema: viewSchema.parse(fixture.schema),
      createdBy: "user",
      promptText: fixture.prompt,
    });
  }
}
