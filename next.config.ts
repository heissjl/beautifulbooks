import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared-link cards read their fonts from disk (app/og.tsx), which the
  // file tracer cannot see from a path built at run time.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/book/[id]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/book/[id]/cover/[coverId]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
    "/collections/[slug]/opengraph-image": ["./assets/og/*.woff", "./assets/fonts/*.woff"],
  },
  async redirects() {
    return [
      // The collection was renamed (Julian, 2026-09-25): its works are the Feminist Press list.
      { source: "/collections/women-writers", destination: "/collections/feminist-press", permanent: true },
    ];
  },
};

export default nextConfig;
