import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@continuity/db", "@continuity/ai", "@continuity/shared"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
