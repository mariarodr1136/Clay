import { router } from "../trpc";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";

export const appRouter = router({
  projects: projectsRouter,
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
