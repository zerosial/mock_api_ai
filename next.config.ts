import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 배포를 위한 설정
  serverExternalPackages: ["@prisma/client"],
  eslint: {
    // 빌드 시 ESLint 검사 비활성화 (개발 시에는 여전히 작동)
    ignoreDuringBuilds: true,
  },
  // 빌드 시 환경변수 검증 건너뛰기
  experimental: {
    // 빌드 시 정적 생성 건너뛰기
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
