import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared-link cards read their fonts from disk (app/og.tsx), which the
  // file tracer cannot see from a path built at run time.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/book/[id]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/book/[id]/cover/[coverId]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/collections/[slug]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/c/[id]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/api/inspiration/poster": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
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
