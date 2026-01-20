import { NextRequest, NextResponse } from "next/server";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  console.log("[Middleware] Request pathname:", pathname, "basePath:", basePath);
  
  // NextAuth API 경로 처리
  // Next.js basePath 설정이 있으면, 실제 라우트 파일은 basePath 없이 접근되어야 함
  // basePath 없이 오는 /api/auth/* 요청은 그대로 통과 (Next.js가 자동으로 basePath를 추가하지 않음)
  // 하지만 Next.js basePath 설정이 있으면, /api/auth/*는 자동으로 /mockapi/api/auth/*로 매칭되지 않음
  // 따라서 basePath를 포함한 경로로 rewrite하되, 실제 라우트는 basePath 없이 접근되어야 하므로
  // rewrite는 basePath를 제거한 경로로 해야 함
  // 하지만 이미 basePath가 없으므로 그대로 통과
  if (basePath && pathname.startsWith("/api/auth/") && !pathname.startsWith(basePath + "/api/auth/")) {
    // Next.js basePath 설정으로 인해 실제 라우트는 basePath 없이 접근되어야 함
    // 하지만 요청 경로가 basePath 없이 오면, Next.js가 자동으로 basePath를 추가하지 않음
    // 따라서 그대로 통과시키면 라우트를 찾지 못함
    // 해결: basePath를 포함한 경로로 rewrite하되, 실제 라우트는 basePath 없이 접근되어야 하므로
    // rewrite는 basePath를 제거한 경로로 해야 함
    // 하지만 이미 basePath가 없으므로 그대로 통과
    console.log("[Middleware] Passing through /api/auth/* (no basePath):", pathname);
    const response = NextResponse.next();
    
    // CORS 헤더 추가
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    
    return response;
  }

  // basePath 포함 경로 처리: /mockapi/api/auth/* -> /api/auth/*로 rewrite
  // Next.js basePath 설정으로 인해 실제 라우트는 basePath 없이 접근되어야 함
  if (basePath && pathname.startsWith(basePath + "/api/auth/")) {
    const rewrittenPathname = pathname.replace(basePath, "") || "/api/auth/";
    console.log("[Middleware] Rewriting basePath + /api/auth/*:", pathname, "->", rewrittenPathname);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = rewrittenPathname;
    const response = NextResponse.rewrite(rewriteUrl);
    
    // CORS 헤더 추가
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    
    return response;
  }

  // NextAuth 에러 페이지 경로 처리: /auth/* -> basePath 포함 경로로 rewrite
  if (basePath && pathname.startsWith("/auth/") && !pathname.startsWith(basePath + "/auth/")) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = basePath + pathname;
    console.log("[Middleware] Rewriting /auth/*:", pathname, "->", rewriteUrl.pathname);
    return NextResponse.rewrite(rewriteUrl);
  }
  
  // basePath 제거를 위한 rewrite (다른 API들이 올바르게 동작하도록)
  // NextAuth API는 제외 - 위에서 이미 처리됨
  if (basePath && pathname.startsWith(basePath + "/api/") && !pathname.startsWith(basePath + "/api/auth/")) {
    const rewrittenPathname = pathname.replace(basePath, "") || "/";
    
    // 프록시 경로는 제외
    if (rewrittenPathname.startsWith("/api/proxy/")) {
      return NextResponse.next();
    }
    
    // rewrite URL 생성
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = rewrittenPathname;
    const response = NextResponse.rewrite(rewriteUrl);
    
    // CORS 헤더 추가
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    
    // OPTIONS 요청 처리
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
    
    return response;
  }

  // 프록시 경로는 제외 (프록시 라우트에서 직접 CORS 처리)
  if (pathname.startsWith("/api/proxy/") || (basePath && pathname.startsWith(basePath + "/api/proxy/"))) {
    return NextResponse.next();
  }

  // API 경로에 대해서만 CORS 헤더 추가
  if (pathname.startsWith("/api/") || (basePath && pathname.startsWith(basePath + "/api/"))) {
    // Preflight 요청 처리
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 200 });
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept, Origin"
      );
      response.headers.set("Access-Control-Max-Age", "86400");
      return response;
    }

    // 일반 요청에 대한 CORS 헤더 추가
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin"
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/auth/:path*",
    "/mockapi/api/:path*",
    "/mockapi/auth/:path*",
    "/mockapi/:path*",
  ],
};
