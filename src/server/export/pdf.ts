import "server-only";
import type { Browser } from "puppeteer-core";

// Renders one of our own print pages with headless Chrome. The page is the
// same ViewRenderer the app uses, under the same print stylesheet, so the PDF
// is the dashboard rather than a re-implementation of it — and because the
// widgets are real SVG and text, it stays vector-sharp instead of rasterized.

async function launch(): Promise<Browser> {
  // On Vercel the function ships a headless build of Chromium; locally the
  // full puppeteer package brings its own.
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 1600 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const puppeteer = await import("puppeteer");
  return (await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 1600 },
  })) as unknown as Browser;
}

export class PdfRenderError extends Error {}

export async function renderPagePdf(url: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    // Not networkidle: the dev server holds an HMR connection open, so
    // "no network for 500ms" never happens and navigation times out. The
    // page tells us when it's actually ready instead.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Charts mount and size themselves after hydration, so waiting on the
    // marker is what guarantees the capture isn't of an empty grid.
    try {
      await page.waitForSelector("[data-print-ready='true']", { timeout: 20_000 });
    } catch {
      throw new PdfRenderError(
        "The view didn't finish rendering in time, so no PDF was produced."
      );
    }

    // page.pdf() already renders print media, but the widgets read it too.
    await page.emulateMediaType("print");

    return Buffer.from(
      await page.pdf({
        // @page in globals.css owns size and margins, so there's one source
        // of truth for both the browser's print dialog and this.
        preferCSSPageSize: true,
        printBackground: true,
      })
    );
  } finally {
    await browser.close();
  }
}
