import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only floating badge; invisible in production builds regardless.
  devIndicators: false,

  // @sparticuz/chromium ships the browser as a compressed archive under
  // bin/, which no JavaScript imports — so file tracing doesn't see it and
  // the deployed function ends up with the package but not the browser
  // ("input directory .../bin does not exist"). The package itself is
  // already externalized by Next's built-in list; only its payload needs
  // help. Nothing here affects local dev, which uses full puppeteer.
  outputFileTracingIncludes: {
    "/api/**/export": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
