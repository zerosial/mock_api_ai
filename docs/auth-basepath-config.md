# NextAuth basePath 설정 가이드

참고 자료를 바탕으로 NextAuth를 basePath와 함께 사용하는 방법을 정리했습니다.

## 환경 변수 설정

### 필수 환경 변수

```env
# Next.js basePath 설정
NEXT_PUBLIC_BASE_PATH=/mockapi

# NextAuth URL 설정 (basePath를 포함한 전체 URL)
# 참고: basePath를 사용하는 경우 반드시 basePath를 포함한 전체 URL로 설정해야 합니다
NEXTAUTH_URL=http://localhost:3000/mockapi

# NextAuth Secret
NEXTAUTH_SECRET=your-secret-key-here-change-in-production

# Google OAuth 설정
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 중요 사항

1. **NEXTAUTH_URL은 basePath를 포함한 전체 URL로 설정해야 합니다**
   - ✅ 올바른 예: `NEXTAUTH_URL=http://localhost:3000/mockapi`
   - ❌ 잘못된 예: `NEXTAUTH_URL=http://localhost:3000`

2. **Google OAuth 콜백 URL 설정**
   - Google Cloud Console에서 승인된 리디렉션 URI로 다음을 등록:
     - `http://localhost:3000/mockapi/api/auth/callback/google`

## 코드 구조

### 1. lib/auth.ts

NextAuth 설정에 `basePath` 옵션을 추가합니다:

```typescript
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  trustHost: true, // basePath 사용 시 필요
  secret: process.env.NEXTAUTH_SECRET,
  // basePath를 NextAuth 설정에 직접 포함
  basePath: `${basePath}/api/auth`,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // ... 기타 설정
};
```

### 2. app/api/auth/[...nextauth]/route.ts

요청을 rewrite하여 호스트와 basePath를 올바르게 포함합니다:

```typescript
import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const { handlers, auth } = NextAuth(authOptions);

function rewriteRequest(request: NextRequest): NextRequest {
  let { protocol, host, pathname } = request.nextUrl;
  const headers = request.headers;

  const detectedHost = headers.get("x-forwarded-host") ?? host;
  const detectedProtocol = headers.get("x-forwarded-proto") ?? protocol;

  const _protocol = detectedProtocol.endsWith(":")
    ? detectedProtocol
    : detectedProtocol + ":";

  // basePath와 pathname을 포함한 전체 URL 생성
  const url = new URL(
    `${_protocol}//${detectedHost}${basePath}${pathname}${request.nextUrl.search}`
  );

  return new NextRequest(url, request);
}

export { auth };

export async function GET(request: NextRequest, props: any) {
  return await handlers.GET(rewriteRequest(request), props);
}

export async function POST(request: NextRequest, props: any) {
  return await handlers.POST(rewriteRequest(request), props);
}
```

### 3. app/providers.tsx

SessionProvider에 basePath를 포함한 경로를 전달합니다:

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { getBasePath } from "@/lib/basePath";

export function Providers({ children }: { children: React.ReactNode }) {
  const basePath = getBasePath();
  return (
    <SessionProvider basePath={basePath ? `${basePath}/api/auth` : "/api/auth"}>
      {children}
    </SessionProvider>
  );
}
```

## 작동 원리

1. **Next.js basePath 설정**
   - Next.js의 `basePath` 설정으로 인해 모든 경로가 `/mockapi`로 시작합니다.
   - 예: `/mockapi/api/auth/providers`

2. **NextAuth basePath 설정**
   - NextAuth 설정의 `basePath`는 NextAuth가 생성하는 URL (signin URL, callback URL 등)에만 영향을 미칩니다.
   - 예: `basePath: "/mockapi/api/auth"`

3. **요청 Rewrite**
   - `rewriteRequest` 함수는 들어오는 요청의 URL을 NextAuth가 인식할 수 있는 형식으로 변환합니다.
   - 호스트 정보 (X-Forwarded-Host, X-Forwarded-Proto)를 올바르게 처리합니다.

4. **SessionProvider**
   - 클라이언트 측에서 NextAuth API를 호출할 때 사용하는 basePath를 설정합니다.

## 테스트 방법

1. `/mockapi/api/auth/providers` 엔드포인트 확인
   ```bash
   curl http://localhost:3000/mockapi/api/auth/providers
   ```

2. 브라우저에서 로그인 버튼 클릭
   - Google 로그인 페이지로 리디렉션되어야 합니다.
   - 콜백 URL이 `http://localhost:3000/mockapi/api/auth/callback/google`로 설정되어야 합니다.

3. 콜백 후 리디렉션
   - 로그인 성공 후 `/mockapi`로 리디렉션되어야 합니다.

## 문제 해결

### 404 에러가 발생하는 경우

- `NEXTAUTH_URL`이 basePath를 포함한 전체 URL로 설정되어 있는지 확인
- Google Cloud Console에서 콜백 URL이 올바르게 등록되어 있는지 확인

### "Bad request" 에러가 발생하는 경우

- `rewriteRequest` 함수가 올바르게 작동하는지 확인
- 콘솔 로그를 확인하여 원본 pathname과 rewrite된 pathname을 비교

### 리디렉션 문제

- `redirect` 콜백이 basePath를 올바르게 처리하는지 확인
- `callbacks.redirect`에서 basePath를 포함한 경로를 반환하는지 확인

