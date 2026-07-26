// E2E runner: builds and tests against the values in .env.local.
//
// Why not just `next build && vitest`: a `vercel env pull` leaves
// .env.production.local behind with redacted values (the literal string
// "[SENSITIVE]") and the production DATABASE_URL — and that file outranks
// .env.local for production builds. Real OS environment outranks every .env
// file, so we lift .env.local into the environment for both the build and
// the test run. This also guarantees a local e2e run can never point at the
// production database.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const local = existsSync(".env.local") ? (dotenv.config({ path: ".env.local", processEnv: {} }).parsed ?? {}) : {};
const env = { ...process.env, ...local };

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run("npx", ["next", "build"]);
run("npx", ["vitest", "run", "--config", "vitest.e2e.config.ts"]);
