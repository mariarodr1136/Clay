import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.local" });

function definedEnv(keys: string[]): Record<string, string> {
  return Object.fromEntries(
    keys.flatMap((key) => (process.env[key] ? [[key, process.env[key] as string]] : []))
  );
}

// Live agent evals: real Anthropic calls against a real throwaway workspace.
// Files use the .evals.ts suffix so the default `npm test` run never picks
// them up — they cost tokens and need a key.
//
// Run through vitest rather than a bare Node entrypoint so they inherit the
// same module resolution the unit suite uses, including the `server-only`
// stub that the data-access layer imports.
export default defineConfig({
  test: {
    include: ["src/evals/**/*.evals.ts"],
    // A full pass is a dozen multi-round agent runs.
    testTimeout: 300_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    // Only pass through variables that actually exist. Vitest stringifies
    // whatever it's given, so an undefined value arrives in the test process
    // as the literal string "undefined" — which is truthy, and would make
    // the "skip when there's no API key" guard run the live suite against a
    // nonsense key.
    env: definedEnv(["DATABASE_URL", "ANTHROPIC_API_KEY", "EVAL_MODEL", "EVAL_ONLY"]),
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
});
