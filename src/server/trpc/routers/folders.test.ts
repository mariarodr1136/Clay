import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { organizations, users, projects } from "@/server/db/schema";
import { appRouter } from "./root";
import { createQueryMemo } from "@/server/data-access/catalog";
import type { MembershipRole } from "@/server/db/schema";

describe("project folders", () => {
  let orgA: typeof organizations.$inferSelect;
  let orgB: typeof organizations.$inferSelect;
  let user: typeof users.$inferSelect;
  let projectInA: typeof projects.$inferSelect;

  const caller = (organizationId: string, role: MembershipRole = "owner") =>
    appRouter.createCaller({
      userId: user.id,
      organizationId,
      role,
      isGuest: false,
      queryMemo: createQueryMemo(),
    });

  beforeAll(async () => {
    [orgA] = await db.insert(organizations).values({ name: "Folder Org A" }).returning();
    [orgB] = await db.insert(organizations).values({ name: "Folder Org B" }).returning();
    [user] = await db
      .insert(users)
      .values({ id: "test_folder_user", email: "f@example.com", name: "Folder User" })
      .returning();
    [projectInA] = await db
      .insert(projects)
      .values({ organizationId: orgA.id, name: "Grouped project", createdBy: user.id })
      .returning();
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
    await db.delete(users).where(eq(users.id, user.id));
  });

  it("creates a folder and moves a project into it", async () => {
    const folder = await caller(orgA.id).folders.create({ name: "Client work" });
    await caller(orgA.id).projects.move({ projectId: projectInA.id, folderId: folder.id });

    const listed = await caller(orgA.id).folders.list();
    expect(listed.find((f) => f.id === folder.id)?.projectCount).toBe(1);
  });

  it("moves a project back out again", async () => {
    await caller(orgA.id).projects.move({ projectId: projectInA.id, folderId: null });
    const [project] = await db.select().from(projects).where(eq(projects.id, projectInA.id));
    expect(project.folderId).toBeNull();
  });

  it("refuses to file a project into another organization's folder", async () => {
    // The adversarial case: a real folder id, just not this workspace's.
    const foreign = await caller(orgB.id).folders.create({ name: "Theirs" });
    await expect(
      caller(orgA.id).projects.move({ projectId: projectInA.id, folderId: foreign.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never returns another organization's folders", async () => {
    const listed = await caller(orgA.id).folders.list();
    expect(listed.some((folder) => folder.name === "Theirs")).toBe(false);
  });

  it("keeps the projects when a folder is deleted", async () => {
    // The whole reason folder_id is ON DELETE SET NULL: a folder is a label,
    // and deleting a label must never delete the work under it.
    const folder = await caller(orgA.id).folders.create({ name: "Temporary" });
    await caller(orgA.id).projects.move({ projectId: projectInA.id, folderId: folder.id });
    await caller(orgA.id).folders.delete({ folderId: folder.id });

    const [project] = await db.select().from(projects).where(eq(projects.id, projectInA.id));
    expect(project).toBeDefined();
    expect(project.folderId).toBeNull();
  });

  it("only lets owners delete a folder", async () => {
    const folder = await caller(orgA.id).folders.create({ name: "Members can't bin this" });
    await expect(
      caller(orgA.id, "member").folders.delete({ folderId: folder.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("orders folders as arranged, newest last", async () => {
    const listed = await caller(orgA.id).folders.list();
    const indexes = listed.map((folder) => folder.orderIndex);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });
});
