import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import puppeteer, { type Browser, type Page } from "puppeteer";

// Smoke tests over /demo, which is no longer a separate implementation of
// the product: it mints a real throwaway workspace behind a signed cookie
// and drops the visitor into the ordinary app. So these now exercise the
// actual pages a paying customer uses — the real renderer, the real catalog
// queries, the real export routes — with no account and no auth provider.
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

// Every test starts by walking through the front door, which sets the guest
// cookie on this page's browser context and lands on the real dashboard.
async function enterDemo(page: Page) {
  const res = await page.goto(`${BASE}/demo`, {
    waitUntil: "networkidle0",
    timeout: 90_000,
  });
  expect(res?.status(), "/demo should respond 200").toBe(200);
  // /demo redirects into the app proper — the URL should no longer say demo.
  expect(page.url()).toContain("/dashboard");
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
  await waitForServer(`${BASE}/health`);
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

describe("demo workspace", () => {
  it("hands a visitor a seeded workspace and lands them in the real app", async () => {
    const page = await browser.newPage();
    await enterDemo(page);

    // The banner is the only thing distinguishing this from a real account.
    const dashboard = await page.evaluate(() => document.body.innerText);
    expect(dashboard).toContain("Demo workspace");

    // Seeded data is reachable through the ordinary pages, not a demo copy.
    // /dashboard is the project list — the nav labels it "Projects".
    expect(dashboard).toContain("Website Relaunch");

    await page.close();
  });

  it("does not end the session just by rendering the sign-up button", async () => {
    const page = await browser.newPage();
    await enterDemo(page);

    // Regression guard: /demo/exit used to be a GET behind a <Link>, and
    // Next prefetches links as they enter the viewport — so the banner
    // logged the visitor out before they clicked anything.
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 90_000 });
    const cookies = await browser.cookies();
    expect(cookies.some((c) => c.name === "clay_guest")).toBe(true);

    await page.close();
  });

  it("bounces an anonymous visitor with no guest cookie to sign-in", async () => {
    // Its own browser context: pages in the default one share the guest
    // cookie the other tests set, which would make this pass for the wrong
    // reason.
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const res = await page.goto(`${BASE}/dashboard`, {
      waitUntil: "networkidle0",
      timeout: 90_000,
    });
    // Never the app: either the sign-in page or a redirect to it.
    expect(res?.status()).toBeLessThan(500);
    expect(page.url()).not.toContain("/dashboard");
    await context.close();
  });

  it("reuses the same workspace on a second visit", async () => {
    const page = await browser.newPage();
    await enterDemo(page);
    const first = await page.$$eval("a[href^='/projects/']", (links) =>
      links.map((a) => a.getAttribute("href"))
    );

    await enterDemo(page);
    const second = await page.$$eval("a[href^='/projects/']", (links) =>
      links.map((a) => a.getAttribute("href"))
    );

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    await page.close();
  });

  it("renders the seeded views gallery", async () => {
    const page = await browser.newPage();
    await enterDemo(page);
    await openAndExpect(page, "/views", ["Delivery Overview"]);
    await page.close();
  });

  it("renders a dashboard with charts and edit-layout", async () => {
    const page = await browser.newPage();
    await enterDemo(page);
    await openAndExpect(page, "/views", ["Delivery Overview"]);

    await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((a) =>
        a.textContent?.includes("Delivery Overview")
      );
      (link as HTMLAnchorElement | undefined)?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes("Edit layout"), {
      timeout: 30_000,
    });
    await page.waitForSelector("svg", { timeout: 30_000 });
    await page.close();
  });

  it("lets the keyboard move and resize widgets in the layout editor", async () => {
    const page = await browser.newPage();
    await enterDemo(page);
    await openAndExpect(page, "/views", ["Delivery Overview"]);

    await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((a) =>
        a.textContent?.includes("Delivery Overview")
      );
      (link as HTMLAnchorElement | undefined)?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes("Edit layout"), {
      timeout: 30_000,
    });

    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Edit layout")
      );
      button?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes("Save layout"), {
      timeout: 15_000,
    });

    // Widget handles expose their geometry in the accessible name, so the
    // assertion reads exactly what a screen-reader user would be told.
    const handleSelector = 'button[aria-label*="Arrow keys move"]';
    await page.waitForSelector(handleSelector, { timeout: 15_000 });

    const labelOf = () =>
      page.$eval(handleSelector, (el) => el.getAttribute("aria-label") ?? "");

    const before = await labelOf();
    await page.focus(handleSelector);

    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (selector, previous) =>
        document.querySelector(selector)?.getAttribute("aria-label") !== previous,
      { timeout: 5_000 },
      handleSelector,
      before
    );
    const afterMove = await labelOf();
    expect(afterMove).not.toBe(before);

    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("Shift");
    await page.waitForFunction(
      (selector, previous) =>
        document.querySelector(selector)?.getAttribute("aria-label") !== previous,
      { timeout: 5_000 },
      handleSelector,
      afterMove
    );

    // Shift+Arrow resizes rather than moves, so the height in the label grew.
    const heightOf = (label: string) => Number(/(\d+) by (\d+)/.exec(label)?.[2] ?? 0);
    expect(heightOf(await labelOf())).toBe(heightOf(afterMove) + 1);

    await page.close();
  });

  it("writes for real — a task created in the demo persists across a reload", async () => {
    const page = await browser.newPage();
    await enterDemo(page);

    await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((a) =>
        a.getAttribute("href")?.startsWith("/projects/")
      );
      (link as HTMLAnchorElement | undefined)?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes("New task"), {
      timeout: 30_000,
    });

    const projectUrl = page.url();
    const title = `E2E task ${Date.now()}`;

    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("New task")
      );
      button?.click();
    });
    await page.waitForSelector("input[name='title']", { timeout: 15_000 });
    await page.type("input[name='title']", title);
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Create task")
      );
      button?.click();
    });

    await page.waitForFunction(
      (needle) => document.body.innerText.includes(needle),
      { timeout: 30_000 },
      title
    );

    // The point of the guest workspace: this is a real row in a real
    // database, not client state, so it survives a full reload.
    await page.goto(projectUrl, { waitUntil: "networkidle0", timeout: 90_000 });
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain(title);

    await page.close();
  });

  it("exports a real workbook from a demo view", async () => {
    const page = await browser.newPage();
    await enterDemo(page);

    const viewHref = await page.evaluate(async () => {
      const res = await fetch("/views");
      return res.ok;
    });
    expect(viewHref).toBe(true);

    await openAndExpect(page, "/views", ["Delivery Overview"]);
    const href = await page.$eval("a[href^='/views/']", (a) => a.getAttribute("href"));
    const viewId = href?.split("/").pop();
    expect(viewId).toBeTruthy();

    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/views/${id}/export?format=xlsx`);
      return { status: res.status, type: res.headers.get("content-type") ?? "" };
    }, viewId);

    expect(result.status).toBe(200);
    expect(result.type).toContain("spreadsheet");

    await page.close();
  });
});
