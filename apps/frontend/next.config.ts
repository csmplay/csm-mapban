import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    env: {
        FRONTEND_URL: process.env.FRONTEND_URL,
        BACKEND_URL: process.env.BACKEND_URL,
    },
};

export default nextConfig;
