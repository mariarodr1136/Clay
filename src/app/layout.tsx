import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clay",
  description: "Dynamic software interfaces — ask your interface into existence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No ClerkProvider here on purpose — see AppClerkProvider. Public routes
  // (landing, /demo, /share, /print) render without Clerk entirely.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster />
        </ThemeProvider>
        {/* Page views and Core Web Vitals. Both no-op outside Vercel, so
            local dev and the CI build are unaffected, and neither reads
            cookies or builds a cross-site profile — which is why they sit in
            the root layout rather than behind a consent gate. Nothing here
            reports view contents or prompts; those already have a first-party
            trail in activity_log and agent_runs. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
