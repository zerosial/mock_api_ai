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

    // 기존 Mock API가 있는지 확인 (활성화 상태와 관계없이)
    const existingMockApis = await prisma.proxyMockApi.findMany({
      where: {
        proxyServerId: proxyServer.id,
        path,
        method: method.toUpperCase(),
        // isActive 상태와 관계없이 조회
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("Mock API 생성 요청:", {
      proxyServerId: proxyServer.id,
      path,
      method: method.toUpperCase(),
      existingMockApis: existingMockApis.map((api) => ({
        id: api.id,
        isActive: api.isActive,
        apiName: api.apiName,
      })),
      existingCount: existingMockApis.length,
      willCreateNew: true,
    });

    // 자동 이름 생성 함수
    const generateApiName = (
      baseName: string,
      existingNames: string[]
    ): string => {
      if (!existingNames.includes(baseName)) {
        return baseName;
      }

      let counter = 2;
      let newName = `${baseName} (${counter})`;

      while (existingNames.includes(newName)) {
        counter++;
        newName = `${baseName} (${counter})`;
      }

      return newName;
    };

    // 기본 API 이름
    const baseApiName = `${method.toUpperCase()} ${path}`;
    const existingNames = existingMockApis.map((api) => api.apiName);
    const newApiName = generateApiName(baseApiName, existingNames);

    // 새로운 Mock API 생성
    const mockApi = await prisma.proxyMockApi.create({
      data: {
        proxyServerId: proxyServer.id,
        path,
        method: method.toUpperCase(),
        apiName: newApiName,
        requestSpec: normalizedRequestBody
          ? { schema: normalizedRequestBody }
          : undefined,
        responseSpec: normalizedResponseBody
          ? { schema: normalizedResponseBody }
          : undefined,
        mockData: normalizedResponseBody,
        delayMs: 0,
        errorCode: null,
        isActive: true, // 새로 생성된 Mock API는 활성화
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 같은 경로/메서드의 다른 Mock API들을 비활성화
    if (existingMockApis.length > 0) {
      await prisma.proxyMockApi.updateMany({
        where: {
          proxyServerId: proxyServer.id,
          path,
          method: method.toUpperCase(),
          id: { not: mockApi.id }, // 새로 생성된 Mock API 제외
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
    }

    const isUpdate = false; // 항상 새로 생성
    const wasInactive = false; // 새로 생성된 것이므로 비활성화 상태가 아님

    console.log("Mock API 생성 완료:", {
      id: mockApi.id,
      apiName: mockApi.apiName,
      isActive: mockApi.isActive,
      deactivatedCount: existingMockApis.length,
    });

    return NextResponse.json(
      {
        success: true,
        message: isUpdate
          ? existingMockApis &&
            existingMockApis.length > 0 &&
            !existingMockApis[0].isActive
            ? "비활성화된 Mock API가 활성화되면서 정보가 업데이트되었습니다."
            : "기존 Mock API가 성공적으로 업데이트되었습니다."
          : "Mock API가 성공적으로 생성되었습니다.",
        mockApi,
        isUpdate,
        wasInactive:
          isUpdate &&
          existingMockApis &&
          existingMockApis.length > 0 &&
          !existingMockApis[0].isActive,
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (error) {
    console.error("Mock API 생성 오류:", error);

    // Prisma 에러 상세 정보 제공
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint failed")) {
        // 기존 Mock API가 있는 경우 더 명확한 메시지 제공
        return NextResponse.json(
          {
            error:
              "이미 동일한 경로와 메서드의 Mock API가 존재합니다. 기존 Mock API를 찾을 수 없어 생성에 실패했습니다. 이는 시스템 오류일 수 있습니다.",
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Mock API 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
