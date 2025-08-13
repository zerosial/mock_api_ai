import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 통신 로그 기반 Mock API 생성
export async function POST(req: NextRequest) {
  try {
    const {
      proxyServerName,
      path,
      method,
      requestBody,
      responseBody,
      statusCode,
    } = await req.json();

    if (!proxyServerName || !path || !method) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 프록시 서버 조회
    const proxyServer = await prisma.proxyServer.findUnique({
      where: { name: proxyServerName, isActive: true },
    });

    if (!proxyServer) {
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // JSON 데이터 정규화 (이중 인코딩 방지)
    const normalizeJsonData = (data: unknown) => {
      if (typeof data === "string") {
        try {
          // 이미 JSON 문자열인 경우 파싱
          return JSON.parse(data);
        } catch {
          // 일반 문자열인 경우 그대로 반환
          return data;
        }
      }
      return data;
    };

    const normalizedRequestBody = normalizeJsonData(requestBody);
    const normalizedResponseBody = normalizeJsonData(responseBody);

    // 이미 존재하는 Mock API가 있는지 확인
    const existingMockApi = await prisma.proxyMockApi.findFirst({
      where: {
        proxyServerId: proxyServer.id,
        path,
        method: method.toUpperCase(),
        isActive: true,
      },
    });

    let mockApi;
    let isUpdate = false;

    if (existingMockApi) {
      // 기존 Mock API가 있으면 덮어쓰기
      mockApi = await prisma.proxyMockApi.update({
        where: { id: existingMockApi.id },
        data: {
          apiName: `${method} ${path}`,
          requestSpec: normalizedRequestBody
            ? { schema: normalizedRequestBody }
            : undefined,
          responseSpec: normalizedResponseBody
            ? { schema: normalizedResponseBody }
            : undefined,
          mockData: normalizedResponseBody,
          delayMs: 0,
          errorCode: null,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      isUpdate = true;
    } else {
      // 새로운 Mock API 생성
      mockApi = await prisma.proxyMockApi.create({
        data: {
          proxyServerId: proxyServer.id,
          path,
          method: method.toUpperCase(),
          apiName: `${method} ${path}`,
          requestSpec: normalizedRequestBody
            ? { schema: normalizedRequestBody }
            : undefined,
          responseSpec: normalizedResponseBody
            ? { schema: normalizedResponseBody }
            : undefined,
          mockData: normalizedResponseBody,
          delayMs: 0,
          errorCode: null,
          isActive: true,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: isUpdate
          ? "기존 Mock API가 성공적으로 업데이트되었습니다."
          : "Mock API가 성공적으로 생성되었습니다.",
        mockApi,
        isUpdate,
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (error) {
    console.error("Mock API 생성 오류:", error);
    return NextResponse.json(
      { error: "Mock API 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
