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

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Deliberately `frame-ancestors` and nothing else. A full CSP here
          // would have to account for Clerk's scripts and Next's inline
          // bootstrap, and a script-src that isn't maintained in lockstep
          // with those is a CSP that gets switched off the first time it
          // breaks a deploy. Framing is the part with a real attack behind
          // it and no such upkeep: without it, a share or print page can be
          // dropped invisibly into someone else's chrome.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Same intent, for anything that predates frame-ancestors.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Vercel serves the app over HTTPS already; this stops the first
          // request of a session from being the one that isn't. Two years,
          // subdomains included — the values a preload submission needs.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here asks for any of these, and a generated view renders
          // agent-proposed layouts — so the answer is no by default.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Both of these carry their authorization *in the URL* — a share
        // token, a signed print token. The default policy above still sends
        // the origin cross-origin, which is harmless, but these paths have a
        // sharper requirement: a viewer who clicks a link out of a shared
        // dashboard must not hand the destination a working capability URL.
        // So: no Referer at all.
        source: "/(share|print)/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
