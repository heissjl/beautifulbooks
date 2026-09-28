import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The collection was renamed (Julian, 2026-09-25): its works are the Feminist Press list.
      { source: "/collections/women-writers", destination: "/collections/feminist-press", permanent: true },
    ];
  },
};

export default nextConfig;
