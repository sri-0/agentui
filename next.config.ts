import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Prune Turbopack's in-memory graph and .next/dev/cache/turbopack. Off by
    // default; without it the dev cache grew to 26 GB on disk and 20 GB resident.
    turbopackGc: true,
    // The radix-ui umbrella otherwise compiles all 35 primitives.
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
