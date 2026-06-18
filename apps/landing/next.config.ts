import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["walletwright.landing.localhost", "*.walletwright.landing.localhost"],
  reactStrictMode: true,
};

export default nextConfig;
