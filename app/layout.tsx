import type { Metadata, Viewport } from "next";
import { Geist_Mono, Jost, Xanh_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/seo";
import Analytics from "@/components/Analytics";

// Typography (ROADMAP 6.61, SPEC §5): Xanh Mono where Fraunces stood — every
// heading, the wordmark and the font-display lines — and Jost where Geist
// stood, which is everything else. Xanh Mono has one weight only.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const xanhMono = Xanh_Mono({
  variable: "--font-xanh-mono",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Only the zero and the hyphens of an ISBN use it, and only once a cover is
// selected, so it is not preloaded.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  // Absolute URLs for canonical links and Open Graph images; set
  // NEXT_PUBLIC_SITE_URL in the deployment (SPEC §10 D10).
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Beautiful Books",
    template: "%s · Beautiful Books",
  },
  description:
    "Compare the covers and editions a book has been printed with, side by side. Data from Open Library and Google Books.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#131110" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jost.variable} ${xanhMono.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
