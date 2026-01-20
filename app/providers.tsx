"use client";

import { SessionProvider } from "next-auth/react";
import { getBasePath } from "@/lib/basePath";

export function Providers({ children }: { children: React.ReactNode }) {
  const basePath = getBasePath();
  // NextAuth basePath 설정과 일치하도록 설정
  // Next.js basePath가 있으면 클라이언트에서도 basePath를 포함한 경로를 사용해야 함
  return (
    <SessionProvider basePath={basePath ? `${basePath}/api/auth` : "/api/auth"}>
      {children}
    </SessionProvider>
  );
}
