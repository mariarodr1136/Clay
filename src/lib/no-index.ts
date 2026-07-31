import type { Metadata } from "next";

// `noindex, nofollow` for the routes that are public by design but were never
// meant to be *discoverable* — shared views, print renders, the demo, health.
//
// Shared alongside the Disallow rules in app/robots.ts rather than folded
// into them, because the two work at different moments: robots.txt asks a
// crawler not to fetch the page, this tells one that fetched it anyway not to
// index it. `follow: false` matters as much as `index: false` here — a share
// page links to nothing sensitive today, but a crawler that walks onward from
// a capability URL is exactly the thing to shut off at the source.
export const noIndex: Metadata = {
  robots: { index: false, follow: false },
};
