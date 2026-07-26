import { defineConfig } from "vitest/config";

// E2E smoke tests drive a real Next.js dev server + headless Chrome, so they
// live behind `npm run test:e2e` instead of the default unit run. Files use
// the .e2e.ts suffix so the unit config never picks them up.
export default defineConfig({
  test: {
    include: ["src/test/e2e/**/*.e2e.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    // One server, one browser — run files serially.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
