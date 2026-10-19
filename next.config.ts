import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["./data/articles.json", "./var/article-media/**/*", "./.env*", "./data/*Candidates.json", "./data/articleTemplates.json"],
  },
  outputFileTracingIncludes: {
    "/*": ["./content/public/**/*"],
  },
  agentRules: false,
  reactStrictMode: true,
  images: {
    // Article media rechecks draft/public authorization on every request. Never cache it in /_next/image.
    localPatterns: [{ pathname: "/images/**", search: "" }],
    remotePatterns: [],
  },
};

export default nextConfig;
