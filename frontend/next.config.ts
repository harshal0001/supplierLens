import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shortcut: set NEXT_PUBLIC_API_MOCK=1 to use frontend/lib/mocks.ts without the backend
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_API_MOCK: process.env.NEXT_PUBLIC_API_MOCK || "0",
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
