import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Variable font: no fixed weights, optical size axis for large headings.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
