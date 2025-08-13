import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 에러코드 설정
export async function PATCH(req: NextRequest) {
  try {
    const { mockApiId, errorCode } = await req.json();

    if (mockApiId === undefined || errorCode === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 에러코드가 필요합니다." },
        { status: 400 }
      );
    }

    // 에러코드 유효성 검사
    const errorCodeValue = errorCode === "" ? null : parseInt(errorCode);
    if (
      errorCodeValue !== null &&
      (isNaN(errorCodeValue) || errorCodeValue < 100 || errorCodeValue > 599)
    ) {
      return NextResponse.json(
        { error: "에러코드는 100-599 사이의 HTTP 상태 코드여야 합니다." },
        { status: 400 }
      );
    }

    // Mock API 에러코드 업데이트
    const updatedMockApi = await prisma.proxyMockApi.update({
      where: { id: parseInt(mockApiId) },
      data: {
        errorCode: errorCodeValue,
        updatedAt: new Date(),
      },
    });

    const statusText = errorCodeValue
      ? `${errorCodeValue} 에러코드로 설정되었습니다.`
      : "정상 응답(200)으로 설정되었습니다.";

    return NextResponse.json(
      {
        success: true,
        message: statusText,
        mockApi: updatedMockApi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 에러코드 설정 오류:", error);
    return NextResponse.json(
      { error: "Mock API 에러코드 설정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
