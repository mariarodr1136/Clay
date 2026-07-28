import { router } from "../trpc";
import { agentRouter } from "./agent";
import { commentsRouter } from "./comments";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { viewsRouter } from "./views";

export const appRouter = router({
  agent: agentRouter,
  comments: commentsRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  views: viewsRouter,
});

export type AppRouter = typeof appRouter;
