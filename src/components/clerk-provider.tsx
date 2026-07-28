import { ClerkProvider } from "@clerk/nextjs";

// Clerk's provider is mounted per-area rather than at the root layout.
//
// Only three surfaces need it: the signed-in app (UserMenu), and the
// sign-in/sign-up pages (Clerk's own components). Mounting it at the root
// made every public page — the landing page, /demo, /share links, the print
// routes — load Clerk's frontend bundle and reach for its API for nothing.
// It also made the /demo e2e suite unrunnable in CI: with throwaway keys,
// Clerk's script fails to load and the page errors, which is why that suite
// was previously local-only.
export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "oklch(0.5 0.17 264)",
          borderRadius: "1rem",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          card: "shadow-2xl ring-1 ring-black/[0.06]",
          formButtonPrimary: "rounded-full shadow-sm text-sm normal-case hover:opacity-90",
          socialButtonsBlockButton: "rounded-full",
          formFieldInput: "rounded-xl",
          footerActionLink: "text-foreground",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
