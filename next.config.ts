import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 배포를 위한 설정
  basePath: "/mockapi",
  serverExternalPackages: ["@prisma/client"],
  eslint: {
    // 빌드 시 ESLint 검사 비활성화 (개발 시에는 여전히 작동)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
