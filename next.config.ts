import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "jose", "@simplewebauthn/server"],
  devIndicators: false,
};

export default nextConfig;
