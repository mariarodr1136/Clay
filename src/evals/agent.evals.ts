import { describe, expect, it } from "vitest";
import { runEvals } from "./run";
import { evalCases } from "./cases";
import { DEFAULT_AGENT_MODEL, agentModelIds, type AgentModelId } from "@/lib/agent-models";

// Live evals. Not part of `npm test` — see vitest.evals.config.ts.
//
//   ANTHROPIC_API_KEY=sk-ant-... npm run evals
//   EVAL_MODEL=claude-opus-5 npm run evals
//   EVAL_ONLY=dashboard/delivery npm run evals
//
// Run this after changing the system prompt, adding a catalog query, or
// moving the default model. The pass-rate floor is deliberately below 100:
// these are model outputs, and a suite that fails on one unlucky sample gets
// ignored within a week. Individual case results are printed either way, so
// a regression in a specific behaviour is visible even on a green run.

const PASS_RATE_FLOOR = 80;

const apiKey = process.env.ANTHROPIC_API_KEY;
const envModel = process.env.EVAL_MODEL as AgentModelId | undefined;
const model = envModel && agentModelIds.includes(envModel) ? envModel : DEFAULT_AGENT_MODEL;
const only = process.env.EVAL_ONLY?.split(",").map((id) => id.trim());

describe.skipIf(!apiKey)("agent evals", () => {
  it(`builds usable views for the case set on ${model}`, async () => {
    const { results, summary } = await runEvals({
      apiKey: apiKey!,
      model,
      only,
    });

    for (const result of results) {
      const mark = result.passed ? "PASS" : "FAIL";
      console.log(`${mark}  ${result.caseId}`);
      for (const failure of result.failures) console.log(`        ${failure}`);
      for (const warning of result.warnings) console.log(`      ~ ${warning}`);
    }
    console.log(`\n${summary.passed}/${summary.total} passed (${summary.passRate}%) on ${model}`);

    expect(summary.total).toBeGreaterThan(0);
    expect(summary.passRate).toBeGreaterThanOrEqual(PASS_RATE_FLOOR);
  });
});

// Runs regardless of whether a key is present, so a case set that has drifted
// out of sync with the catalog fails on an ordinary commit rather than the
// next time someone spends tokens.
describe("eval case set", () => {
  it("references only real catalog ids", async () => {
    const { queryCatalog } = await import("@/server/data-access/catalog");
    const known = new Set(Object.keys(queryCatalog));

    for (const evalCase of evalCases) {
      for (const id of [
        ...(evalCase.expect.anyOfQueryIds ?? []),
        ...(evalCase.expect.allOfQueryIds ?? []),
      ]) {
        expect(known.has(id), `${evalCase.id} expects unknown catalog id "${id}"`).toBe(true);
      }
    }
  });
});
