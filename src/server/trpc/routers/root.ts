import { router } from "../trpc";
import { agentRouter } from "./agent";
import { commentsRouter } from "./comments";
import { importRouter } from "./import";
import { membersRouter } from "./members";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { viewsRouter } from "./views";

export const appRouter = router({
  agent: agentRouter,
  comments: commentsRouter,
  import: importRouter,
  members: membersRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  views: viewsRouter,
});

export type AppRouter = typeof appRouter;
