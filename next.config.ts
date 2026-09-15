import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "jose"],
  devIndicators: false,
};

export default nextConfig;
