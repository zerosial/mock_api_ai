import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const { handlers } = NextAuth(authOptions);

// 요청 rewrite 함수 - 호스트와 basePath를 올바르게 포함
// 참고: next-auth/packages/core/src/lib/utils/env.ts:createActionURL
function rewriteRequest(request: NextRequest): NextRequest {
  const { protocol, host, pathname } = request.nextUrl;
  const headers = request.headers;

  // Host rewrite - X-Forwarded-Host 또는 기본 host 사용
  const detectedHost = headers.get("x-forwarded-host") ?? host;
  const detectedProtocol = headers.get("x-forwarded-proto") ?? protocol;

  // Protocol이 콜론으로 끝나지 않으면 추가
  const _protocol = detectedProtocol.endsWith(":")
    ? detectedProtocol
    : detectedProtocol + ":";

  // pathname 처리:
  // middleware에서 이미 rewrite된 경우: /api/auth/... 형태 (basePath 제거됨)
  // 직접 호출된 경우: /api/auth/... 형태
  // NextAuth는 basePath를 포함한 경로를 기대하므로, basePath가 없는 경우 추가
  let finalPathname = pathname;
  
  // pathname이 basePath로 시작하지 않으면 basePath 추가
  if (basePath && !pathname.startsWith(basePath)) {
    // /api/auth/... -> /mockapi/api/auth/...
    finalPathname = basePath + pathname;
  } else if (basePath && pathname.startsWith(basePath)) {
    // 이미 basePath가 포함된 경우 그대로 사용
    finalPathname = pathname;
  }

  // URL 생성 시 basePath를 포함한 전체 URL 생성
  const url = new URL(
    `${_protocol}//${detectedHost}${finalPathname}${request.nextUrl.search}`
  );

  console.log("[NextAuth] Rewrite request:", {
    original: pathname,
    final: finalPathname,
    url: url.toString(),
  });

  // NextRequest 생성 - 원본 요청의 메서드, 헤더, body 유지
  return new NextRequest(url, request);
}

export async function GET(request: NextRequest) {
  try {
    console.log("[NextAuth GET] Original pathname:", request.nextUrl.pathname);
    const rewrittenRequest = rewriteRequest(request);
    console.log("[NextAuth GET] Rewritten pathname:", rewrittenRequest.nextUrl.pathname);
    return await handlers.GET(rewrittenRequest);
  } catch (error: unknown) {
    console.error("[NextAuth GET Error]", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[NextAuth POST] Original pathname:", request.nextUrl.pathname);
    const rewrittenRequest = rewriteRequest(request);
    console.log("[NextAuth POST] Rewritten pathname:", rewrittenRequest.nextUrl.pathname);
    return await handlers.POST(rewrittenRequest);
  } catch (error: unknown) {
    console.error("[NextAuth POST Error]", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
