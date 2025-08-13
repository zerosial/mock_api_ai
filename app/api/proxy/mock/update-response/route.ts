import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 응답 데이터 수정
export async function PATCH(req: NextRequest) {
  try {
    const { mockApiId, mockData } = await req.json();

    if (mockApiId === undefined || mockData === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 응답 데이터가 필요합니다." },
        { status: 400 }
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

    const normalizedMockData = normalizeJsonData(mockData);

    // Mock API 응답 데이터 업데이트
    const updatedMockApi = await prisma.proxyMockApi.update({
      where: { id: parseInt(mockApiId) },
      data: {
        mockData: normalizedMockData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "응답 데이터가 성공적으로 수정되었습니다.",
        mockApi: updatedMockApi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 응답 데이터 수정 오류:", error);
    return NextResponse.json(
      { error: "Mock API 응답 데이터 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
