import { router } from "../trpc";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { viewsRouter } from "./views";

export const appRouter = router({
  projects: projectsRouter,
  tasks: tasksRouter,
  views: viewsRouter,
});

export type AppRouter = typeof appRouter;
