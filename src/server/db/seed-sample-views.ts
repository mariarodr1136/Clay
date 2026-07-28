import { viewSchema } from "@/lib/dsl/schema";
import { buildDemoViews } from "@/fixtures/sample-views";
import { createView } from "./create-view";

export async function seedSampleViews(organizationId: string, ownerId: string, projectId: string) {
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
