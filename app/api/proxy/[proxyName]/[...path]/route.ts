import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { proxyName: string; path: string[] } }
) {
  return handleProxyRequest(req, params, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { proxyName: string; path: string[] } }
) {
  return handleProxyRequest(req, params, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { proxyName: string; path: string[] } }
) {
  return handleProxyRequest(req, params, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { proxyName: string; path: string[] } }
) {
  return handleProxyRequest(req, params, "DELETE");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { proxyName: string; path: string[] } }
) {
  return handleProxyRequest(req, params, "PATCH");
}

async function handleProxyRequest(
  req: NextRequest,
  params: { proxyName: string; path: string[] },
  method: string
) {
  try {
    const { proxyName, path } = params;
    const fullPath = `/${path.join("/")}`;

    // 프록시 서버 정보 조회
    const proxyServer = await prisma.proxyServer.findUnique({
      where: { name: proxyName, isActive: true }
    });

    if (!proxyServer) {
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Mock API가 있는지 확인
    const mockApi = await prisma.proxyMockApi.findFirst({
      where: {
        proxyServerId: proxyServer.id,
        path: fullPath,
        method: method.toUpperCase(),
        isActive: true
      }
    });

    // Mock API가 있으면 Mock 데이터 반환
    if (mockApi) {
      // 지연 시간 처리
      if (mockApi.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, mockApi.delayMs));
      }

      // 에러 코드 설정이 있으면 해당 코드로 응답
      if (mockApi.errorCode) {
        return NextResponse.json(
          { error: "Mock API 에러", code: mockApi.errorCode },
          { status: mockApi.errorCode }
        );
      }

      // Mock 데이터 반환
      return NextResponse.json(mockApi.mockData || {});
    }

    // Mock API가 없으면 실제 서버로 프록시
    const targetUrl = new URL(fullPath, proxyServer.targetUrl);
    
    // 쿼리 파라미터 복사
    req.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    // 헤더 준비 (민감한 헤더 제외)
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      if (!key.toLowerCase().startsWith('host') && 
          !key.toLowerCase().startsWith('origin') &&
          !key.toLowerCase().startsWith('referer')) {
        headers.set(key, value);
      }
    });

    // 요청 본문 준비
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await req.text();
    }

    // 프록시 요청 실행
    const proxyResponse = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
    });

    // 응답 헤더 복사 (CORS 관련 헤더 추가)
    const responseHeaders = new Headers(proxyResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 응답 본문 가져오기
    const responseBody = await proxyResponse.text();

    // 프록시 응답 반환
    return new NextResponse(responseBody, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("프록시 요청 처리 오류:", error);
    return NextResponse.json(
      { error: "프록시 요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS(
  req: NextRequest,
  { params }: { params: { proxyName: string; path: string[] } }
) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 