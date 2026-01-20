import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

// basePath 설정 (환경 변수에서 가져옴)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as any,
  trustHost: true, // basePath 사용 시 필요
  secret: process.env.NEXTAUTH_SECRET,
  // basePath를 NextAuth 설정에 직접 포함
  // 이렇게 하면 NextAuth가 basePath를 고려하여 모든 URL을 생성
  basePath: `${basePath}/api/auth`,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // basePath 고려한 리디렉션
      // url이 이미 basePath를 포함하고 있는지 확인하여 중복 방지
      let finalUrl = url;
      
      if (url.startsWith("/")) {
        // 상대 경로인 경우
        // 이미 basePath로 시작하는지 확인
        if (basePath && !url.startsWith(basePath)) {
          finalUrl = basePath + url;
        } else {
          finalUrl = url;
        }
      } else if (url.startsWith(baseUrl)) {
        // 전체 URL인 경우
        const path = url.replace(baseUrl, "");
        // path가 이미 basePath로 시작하는지 확인
        if (basePath && !path.startsWith(basePath)) {
          finalUrl = baseUrl + basePath + path;
        } else {
          finalUrl = url;
        }
      }
      
      console.log("[NextAuth redirect] Original:", url, "Final:", finalUrl, "basePath:", basePath);
      return finalUrl;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  // 디버깅을 위해 로깅 추가
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "database",
  },
};
