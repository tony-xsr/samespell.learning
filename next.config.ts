import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bản build tự chứa (.next/standalone) cho Docker trên server riêng — Vercel bỏ qua tuỳ chọn này.
  output: "standalone",
};

export default nextConfig;
