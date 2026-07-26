import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import puppeteer, { type Browser, type Page } from "puppeteer";

// Smoke tests over the public /demo surface: no auth, no BYOK key, no DB
// writes — exactly what a first-time visitor hits. They catch the class of
// breakage the unit suite can't: a route that 500s, a client component that
// throws on mount, an export endpoint that stops returning its format.
//
// Runs `next start` against the production build (run `npm run build`
// first) — `next dev` refuses to run twice for one directory, and the
// production server doesn't compile pages on demand mid-test.

const PORT = 3111;
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess;
let browser: Browser;

async function waitForServer(url: string, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Dev server did not become ready at ${url}`);
}

// Fails the test on any page error (uncaught client exception) and asserts
// the given text made it into the rendered DOM.
async function openAndExpect(page: Page, path: string, texts: string[]) {
  const pageErrors: unknown[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 90_000 });
  expect(res?.status(), `${path} should respond 200`).toBe(200);

  const body = await page.evaluate(() => document.body.innerText);
  for (const text of texts) {
    expect(body, `${path} should render "${text}"`).toContain(text);
  }
  expect(pageErrors, `${path} should have no client errors`).toEqual([]);
}

beforeAll(async () => {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    stdio: "ignore",
    detached: true,
  });
  await waitForServer(`${BASE}/demo`);
  browser = await puppeteer.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  try {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});

describe("demo smoke", () => {
  it("renders the demo portfolio", async () => {
    const page = await browser.newPage();
    await openAndExpect(page, "/demo", ["Website Relaunch", "Customer Portal"]);
    await page.close();
  });

  it("renders the demo views gallery with the templates teaser", async () => {
    const page = await browser.newPage();
    // Section headings are CSS-uppercased (innerText reflects that), so we
    // assert on the teaser's button copy instead of the "Templates" heading.
    await openAndExpect(page, "/demo/views", [
      "Executive Delivery Overview",
      "Save a view as a template",
    ]);
    await page.close();
  });

  it("renders a dashboard with charts, edit-layout, and share affordances", async () => {
    const page = await browser.newPage();
    await openAndExpect(page, "/demo/views/demo-view-delivery-overview", [
      "Executive Delivery Overview",
      "Velocity — planned vs completed",
      "Edit layout",
      "Share",
    ]);
    // Charts are SVG; at least one should have rendered.
    await page.waitForSelector("svg", { timeout: 30_000 });

    // Entering edit mode swaps in the editor chrome.
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Edit layout")
      );
      button?.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes("Save layout"),
      { timeout: 15_000 }
    );
    await page.close();
  });

  it("renders status-action dropdowns on the workload table", async () => {
    const page = await browser.newPage();
    await openAndExpect(page, "/demo/views/demo-view-team-workload", ["Open tasks"]);
    const comboboxes = await page.$$('table [role="combobox"]');
    expect(comboboxes.length).toBeGreaterThan(0);
    await page.close();
  });

  it("serves the demo chat transcripts and audit log", async () => {
    const page = await browser.newPage();
    await openAndExpect(page, "/demo/chat", ["live render"]);
    await openAndExpect(page, "/demo/audit", ["Published"]);
    await page.close();
  });

  it("exports a demo table as CSV", async () => {
    const res = await fetch(
      `${BASE}/api/demo/views/demo-view-overdue-risk/export?format=csv&widgetId=overdue-table`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv.split("\n").length).toBeGreaterThan(1);
  });

  it("exports a demo view as an Excel workbook", async () => {
    const res = await fetch(`${BASE}/api/demo/views/demo-view-delivery-overview/export?format=xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
  });
});
