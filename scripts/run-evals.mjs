// Live eval runner: drives the real agent against a real throwaway
// workspace and grades the results.
//
// Deliberately not part of `npm test` — it calls the Anthropic API, so it
// costs money and needs a key. The grader and the structural rules it grades
// against are unit tested and do run on every commit; this is what you run
// after changing the system prompt, adding a catalog query, or switching the
// default model.
//
//   ANTHROPIC_API_KEY=sk-ant-... npm run evals
//   ANTHROPIC_API_KEY=... EVAL_MODEL=claude-opus-5 npm run evals
//   ANTHROPIC_API_KEY=... EVAL_ONLY=dashboard/delivery npm run evals
//
// Lifts .env.local into the environment for the same reason run-e2e.mjs
// does: a `vercel env pull` leaves .env.production.local behind holding
// redacted values and the production DATABASE_URL, and evals must never
// point at production.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const local = existsSync(".env.local")
  ? (dotenv.config({ path: ".env.local", processEnv: {} }).parsed ?? {})
  : {};
const env = { ...process.env, ...local, ...pickOverrides(process.env) };

// Real OS env still wins for the three knobs the runner reads, so
// `ANTHROPIC_API_KEY=... npm run evals` behaves the way it looks.
function pickOverrides(source) {
  const overrides = {};
  for (const key of ["ANTHROPIC_API_KEY", "EVAL_MODEL", "EVAL_ONLY"]) {
    if (source[key]) overrides[key] = source[key];
  }
  return overrides;
}

if (!env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set. The evals call the real API — export a key, or add one to .env.local."
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.evals.config.ts", ...process.argv.slice(2)],
  { stdio: "inherit", env }
);
process.exit(result.status ?? 1);
