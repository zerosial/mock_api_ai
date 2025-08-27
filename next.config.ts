import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  serverExternalPackages: ["@prisma/client"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    workerThreads: false,
    proxyTimeout: 600000,
    cpus: 1,
  },
  // API route 타임아웃 설정 (10분)
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Connection",
            value: "keep-alive",
          },
        ],
      },
    ];
  },
  // 서버 타임아웃 설정
  serverRuntimeConfig: {
    // API route 타임아웃을 10분으로 설정
    apiTimeout: 10 * 60 * 1000,
  },
};

export default nextConfig;
