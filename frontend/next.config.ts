import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shortcut: mock the API until Harshal's backend is live, then set NEXT_PUBLIC_API_MOCK=0
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_API_MOCK: process.env.NEXT_PUBLIC_API_MOCK || "1",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
