import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string; path: string[] }> }
) {
  return handleProxyRequest(req, await params, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string; path: string[] }> }
) {
  return handleProxyRequest(req, await params, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string; path: string[] }> }
) {
  return handleProxyRequest(req, await params, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string; path: string[] }> }
) {
  return handleProxyRequest(req, await params, "DELETE");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string; path: string[] }> }
) {
  return handleProxyRequest(req, await params, "PATCH");
}

async function handleProxyRequest(
  req: NextRequest,
  params: { proxyName: string; path: string[] },
  method: string
) {
  const startTime = Date.now();

  try {
    const { proxyName, path } = params;
    const fullPath = `/${path.join("/")}`;

    console.log(`🔍 프록시 요청: ${method} /api/proxy/${proxyName}${fullPath}`);

    // 프록시 서버 정보 조회
    const proxyServer = await prisma.proxyServer.findUnique({
      where: { name: proxyName, isActive: true },
    });

    if (!proxyServer) {
      console.log(`❌ 프록시 서버를 찾을 수 없음: ${proxyName}`);
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    console.log(
      `✅ 프록시 서버 발견: ${proxyName} -> ${proxyServer.targetUrl}`
    );

    // Mock API가 있는지 확인
    console.log(`🔍 Mock API 조회 조건:`);
    console.log(`  - proxyServerId: ${proxyServer.id}`);
    console.log(`  - fullPath: ${fullPath}`);
    console.log(`  - pathWithoutQuery: ${fullPath.split("?")[0]}`);
    console.log(`  - method: ${method.toUpperCase()}`);
    console.log(`  - isActive: true`);

    // Mock API 조회 (쿼리 파라미터 제외한 경로로 매칭)
    const pathWithoutQuery = fullPath.split("?")[0];

    // 1. 정확한 경로 매칭 시도
    let mockApi = await prisma.proxyMockApi.findFirst({
      where: {
        proxyServerId: proxyServer.id,
        path: fullPath,
        method: method.toUpperCase(),
        isActive: true,
      },
    });

    // 2. 정확한 매칭이 없으면 쿼리 파라미터 제외한 경로로 매칭
    if (!mockApi) {
      mockApi = await prisma.proxyMockApi.findFirst({
        where: {
          proxyServerId: proxyServer.id,
          path: pathWithoutQuery,
          method: method.toUpperCase(),
          isActive: true,
        },
      });
    }

    // 3. 여전히 없으면 경로가 포함된 Mock API 찾기
    if (!mockApi) {
      const allMockApis = await prisma.proxyMockApi.findMany({
        where: {
          proxyServerId: proxyServer.id,
          method: method.toUpperCase(),
          isActive: true,
        },
      });

      console.log(`🔍 전체 Mock API 목록:`);
      allMockApis.forEach((api) => {
        console.log(`  - ID: ${api.id}, 경로: ${api.path}`);
      });

      // 경로가 포함된 Mock API 찾기
      const foundMockApi = allMockApis.find((api) => {
        const apiPathWithoutQuery = api.path.split("?")[0];
        return apiPathWithoutQuery === pathWithoutQuery;
      });

      if (foundMockApi) {
        mockApi = foundMockApi;
      }
    }

    console.log(
      `🔍 Mock API 조회 결과:`,
      mockApi
        ? `찾음 (ID: ${mockApi.id}, 경로: ${mockApi.path})`
        : "찾을 수 없음"
    );

    let isMock = false;
    let responseData: any = null;
    let statusCode = 200;
    let responseTime = 0;

    if (mockApi) {
      console.log(`🎭 Mock API 발견: ${fullPath} (${method})`);
      isMock = true;

      // 지연 시간 처리
      if (mockApi.delayMs && mockApi.delayMs > 0) {
        console.log(`⏰ 지연 시간: ${mockApi.delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, mockApi.delayMs));
      }

      // 에러 코드 처리 - 상태 코드만 변경하고 응답 데이터는 유지
      if (mockApi.errorCode && mockApi.errorCode > 0) {
        console.log(`❌ 에러 코드: ${mockApi.errorCode}`);
        statusCode = mockApi.errorCode;
      }

      console.log(`📤 Mock 데이터 반환:`, mockApi.mockData);
      responseData = mockApi.mockData || {};

      responseTime = Date.now() - startTime;

      // Mock API 응답 시 통신 로그 저장
      try {
        await prisma.proxyCommunicationLog.create({
          data: {
            proxyServerId: proxyServer.id,
            path: fullPath,
            method: method.toUpperCase(),
            requestBody: await getRequestBody(req),
            responseBody: responseData,
            statusCode,
            responseTime,
            userAgent: req.headers.get("user-agent"),
            ipAddress:
              req.headers.get("x-forwarded-for") ||
              req.headers.get("x-real-ip"),
            isMock: true,
          },
        });
      } catch (logError) {
        console.error("통신 로그 저장 실패:", logError);
      }

      if (statusCode !== 200) {
        return NextResponse.json(responseData, {
          status: statusCode,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods":
              "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
            "Access-Control-Allow-Credentials": "true",
          },
        });
      }

      return NextResponse.json(responseData, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    console.log(`🌐 Mock API 없음, 실제 서버로 프록시: ${fullPath}`);

    // Mock API가 없으면 실제 서버로 프록시
    // 올바른 URL 조합: baseUrl + path
    let targetUrl: URL;

    if (proxyServer.targetUrl.endsWith("/")) {
      // baseUrl이 /로 끝나는 경우
      targetUrl = new URL(proxyServer.targetUrl + path.join("/"));
    } else {
      // baseUrl이 /로 끝나지 않는 경우
      targetUrl = new URL(proxyServer.targetUrl + "/" + path.join("/"));
    }

    console.log(`🎯 프록시 대상 URL: ${targetUrl.toString()}`);
    console.log(`🔗 원본 baseUrl: ${proxyServer.targetUrl}`);
    console.log(`🛣️ 요청 경로: ${fullPath}`);
    console.log(`🎯 최종 타겟 URL: ${targetUrl.toString()}`);

    // 쿼리 파라미터 복사
    req.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    // 헤더 준비 - 모든 헤더를 그대로 전달 (필터링 제거)
    const headers = new Headers();

    // 원본 요청의 모든 헤더를 그대로 복사
    req.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    // 기본 헤더만 추가/덮어쓰기
    headers.set("Host", new URL(targetUrl.toString()).host);
    headers.set("User-Agent", "Mock-API-Proxy/1.0");

    // 요청 본문 준비
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await req.text();
    }

    console.log(`📤 프록시 요청 전송: ${method} ${targetUrl.toString()}`);
    console.log(`📋 요청 헤더:`, Object.fromEntries(headers.entries()));

    // 프록시 요청 실행 (에러 처리 강화)
    let proxyResponse;
    try {
      proxyResponse = await fetch(targetUrl.toString(), {
        method,
        headers,
        body,
      });
    } catch (fetchError) {
      console.error(`❌ 프록시 요청 실패:`, fetchError);

      // 에러 상세 정보 로깅
      if (fetchError instanceof Error) {
        console.error(`   - 메시지: ${fetchError.message}`);
        console.error(`   - 스택: ${fetchError.stack}`);
        if (fetchError.cause) {
          console.error(`   - 원인: ${fetchError.cause}`);
        }
      }

      return NextResponse.json(
        {
          error: "프록시 요청 실패",
          details:
            fetchError instanceof Error ? fetchError.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        { status: 502 }
      );
    }

    console.log(
      `📥 프록시 응답 수신: ${proxyResponse.status} ${proxyResponse.statusText}`
    );

    // 응답 헤더 정보 로깅
    console.log(`📋 응답 헤더 정보:`);
    proxyResponse.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    // 응답 헤더 복사 (중요한 헤더들 보존)
    const responseHeaders = new Headers();

    // 원본 응답의 모든 헤더를 복사하되, 압축 관련 헤더는 제거
    proxyResponse.headers.forEach((value, key) => {
      // 압축 관련 헤더 제거 (브라우저 호환성을 위해)
      if (
        !key.toLowerCase().includes("content-encoding") &&
        !key.toLowerCase().includes("transfer-encoding") &&
        !key.toLowerCase().includes("content-length")
      ) {
        responseHeaders.set(key, value);
      }
    });

    // CORS 관련 헤더 추가/덮어쓰기
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD"
    );
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Access-Control-Max-Age", "86400");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    // 수정된 응답 헤더 정보 로깅
    console.log(`📋 수정된 응답 헤더 정보:`);
    responseHeaders.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    // 응답 본문 처리
    let responseBody: string | null = null;
    const contentType = proxyResponse.headers.get("content-type") || "";

    if (
      contentType.includes("application/json") ||
      contentType.includes("text/")
    ) {
      // JSON이나 텍스트 응답
      responseBody = await proxyResponse.text();
      console.log(
        `📄 응답 본문 (텍스트): ${responseBody.substring(0, 200)}...`
      );
    } else if (
      contentType.includes("image/") ||
      contentType.includes("application/")
    ) {
      // 바이너리 응답 - JSON으로 저장할 수 있도록 메타데이터만 저장
      const arrayBuffer = await proxyResponse.arrayBuffer();
      responseBody = JSON.stringify({
        type: "binary",
        size: arrayBuffer.byteLength,
        contentType: contentType,
        note: "Binary response - content not stored",
      });
      console.log(`📄 응답 본문 (바이너리): ${arrayBuffer.byteLength} bytes`);
    } else {
      // 기본적으로 텍스트로 처리
      responseBody = await proxyResponse.text();
      console.log(`📄 응답 본문 (기본): ${responseBody.substring(0, 200)}...`);
    }

    responseTime = Date.now() - startTime;

    // 프록시 응답 시 통신 로그 저장
    try {
      await prisma.proxyCommunicationLog.create({
        data: {
          proxyServerId: proxyServer.id,
          path: fullPath,
          method: method.toUpperCase(),
          requestBody: await getRequestBody(req),
          responseBody: responseBody,
          statusCode: proxyResponse.status,
          responseTime,
          userAgent: req.headers.get("user-agent"),
          ipAddress:
            req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
          isMock: false,
        },
      });
    } catch (logError) {
      console.error("프록시 통신 로그 저장 실패:", logError);
    }

    // 프록시 응답 반환
    return new NextResponse(responseBody, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("프록시 요청 처리 오류:", error);

    // 더 구체적인 에러 메시지 제공
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          error: "프록시 서버 연결 실패",
          details:
            "목표 서버에 연결할 수 없습니다. URL과 네트워크 연결을 확인해주세요.",
          targetUrl: error.message,
        },
        {
          status: 502,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods":
              "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }

    return NextResponse.json(
      {
        error: "프록시 요청 처리 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string; path: string[] }> }
) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods":
        "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// 요청 본문을 가져오는 헬퍼 함수
async function getRequestBody(req: NextRequest): Promise<any> {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      const result: any = {};
      params.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    } else if (contentType.includes("multipart/form-data")) {
      return { type: "multipart/form-data", size: "binary" };
    } else {
      const text = await req.text();
      return text || null;
    }
  } catch {
    return null;
  }
}
