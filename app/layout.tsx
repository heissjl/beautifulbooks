import type { Metadata, Viewport } from "next";
import { Geist_Mono, Jost } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import Analytics from "@/components/Analytics";

// Typography (ROADMAP 6.61, SPEC §5): Xanh where Fraunces stood — every
// heading, the wordmark and the font-display lines — and Jost where Geist
// stood, which is everything else. The Xanh is Xanh Mono respaced
// proportionally (lab/xanh-spacing, built with its respace.py); the
// monospaced original set commas and "r"s in cells far wider than their ink.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const xanh = localFont({
  variable: "--font-xanh",
  src: [
    { path: "../assets/fonts/xanh-proportional-regular.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/xanh-proportional-italic.woff2", weight: "400", style: "italic" },
  ],
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
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
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
    <html lang="en" className={`${jost.variable} ${xanh.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
