import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCProvider } from "@/lib/trpc/provider";
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
  title: "SelfSoftware",
  description: "Dynamic software interfaces — ask your interface into existence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "oklch(0.205 0 0)",
          borderRadius: "1rem",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          card: "shadow-2xl ring-1 ring-black/[0.06]",
          formButtonPrimary:
            "rounded-full bg-black hover:bg-black/85 shadow-sm text-sm normal-case",
          socialButtonsBlockButton: "rounded-full",
          formFieldInput: "rounded-xl",
          footerActionLink: "text-foreground",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
