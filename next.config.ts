import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "www.cordobadigital.net",
      },
      {
        protocol: "https",
        hostname: "cordobadigital.net",
      },
    ],
  },
};

export default nextConfig;
