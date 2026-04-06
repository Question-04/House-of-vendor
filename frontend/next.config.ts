import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ ADD THIS
  },

  experimental: {
    optimizePackageImports: ["framer-motion", "gsap", "lucide-react"],
  },

  turbopack: {},

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },

  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "image.goat.com" },
      { protocol: "https", hostname: "media.darveys.com" },
      { protocol: "https", hostname: "www.fridaycharm.com" },
      { protocol: "https", hostname: "luxurysouq.com" },
      { protocol: "https", hostname: "marketplace.mainstreet.co.in" },
      { protocol: "https", hostname: "images.stockx.com" },
      { protocol: "https", hostname: "**" },
    ],
    unoptimized: false,
  },

  compress: true,
  poweredByHeader: false,
  generateEtags: false,

  typescript: {
    ignoreBuildErrors: true,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
      ],
    },
    {
      source: "/static/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
};

export default nextConfig;