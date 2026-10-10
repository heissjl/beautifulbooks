import type { NextConfig } from "next";
import { securityHeaders } from "./lib/securityheaders";

const nextConfig: NextConfig = {
  // lab/visitcost (ROADMAP 2.18b) builds into a directory of its own, so its fake catalogue never mixes with a real build.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Covers through Vercel's image optimization (ROADMAP 2.18o, lib/coverurl.ts):
  // on in a Vercel build unless COVER_CDN=off; `next dev` asks /img directly.
  env: {
    NEXT_PUBLIC_COVER_CDN: process.env.VERCEL_ENV && process.env.COVER_CDN !== "off" ? "on" : "off",
  },
  images: {
    // Only our own image route may be a source: the optimizer is not an open proxy.
    remotePatterns: [{ protocol: "https", hostname: "buyitscovers.com", pathname: "/img/**" }],
    // 128, 384 and 828 are OPTIMIZED_WIDTH in lib/coverurl.ts; 828 is a default device size.
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    // A cover under one id does not change; the optimizer keeps it thirty days, across deploys.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // The shared-link cards read their fonts from disk (app/og.tsx), which the
  // file tracer cannot see from a path built at run time.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/book/[id]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/book/[id]/cover/[coverId]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/collections/[slug]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/c/[id]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    // The poster also reads the loading pictures for its mosaic ground (lib/inspiration/mosaicground.ts).
    "/api/inspiration/poster": ["./assets/og/*.woff", "./assets/fonts/*.woff", "./public/loading/*-640.jpg"],
    "/shelfportrait/card.jpg": ["./assets/og/*.woff", "./assets/fonts/*.woff", "./public/loading/*-640.jpg"],
    "/shelfportrait/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff", "./public/loading/*-640.jpg"],
  },
  // What the browser may not do with the site (ROADMAP 2.12, lib/securityheaders.ts): on every route.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ dev: process.env.NODE_ENV !== "production" }) }];
  },
  async redirects() {
    return [
      // The collection was renamed (Julian, 2026-09-25): its works are the Feminist Press list.
      { source: "/collections/women-writers", destination: "/collections/feminist-press", permanent: true },
      // The project's first address, kept by Vercel, sends readers and crawlers
      // to the domain (ROADMAP 2.2). Matched on the exact host, so preview
      // deployments and localhost are untouched.
      {
        source: "/:path*",
        has: [{ type: "host", value: "beautifulcovers.vercel.app" }],
        destination: "https://buyitscovers.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
