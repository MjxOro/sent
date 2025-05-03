import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true, // Or your other configurations
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "ggpht.com",
      },
    ],
  },
};

export default nextConfig;
