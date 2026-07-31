import type { MetadataRoute } from "next";

// The landing page is the only thing here worth indexing.
//
// Everything under /share is a capability URL: the token *is* the
// authorization, so a shared dashboard that gets crawled is a shared
// dashboard that stays readable after the link is revoked, out of a search
// index rather than from the app. /print is the same bargain with a signed
// token, /demo mints a real tenant on visit (a crawler would provision one
// per crawl), and /health is an operational endpoint with nothing to rank.
//
// This is the polite half of the fix and only binds crawlers that choose to
// read it — the pages themselves also send `noindex`, which is the half that
// holds when robots.txt is ignored.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/share/", "/print/", "/demo", "/health", "/api/"],
    },
  };
}
