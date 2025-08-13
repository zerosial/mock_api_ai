import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 에러코드 설정
export async function PATCH(req: NextRequest) {
  try {
    const { mockApiId, errorCode } = await req.json();

    console.log("에러코드 API 요청:", {
      mockApiId,
      errorCode,
      type: typeof errorCode,
    });

    if (mockApiId === undefined || errorCode === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 에러코드가 필요합니다." },
        { status: 400 }
      );
    }

    // 에러코드 유효성 검사
    let errorCodeValue: number | null = null;

    // 빈 문자열이 아닐 때만 숫자로 변환
    if (errorCode !== "" && errorCode !== null && errorCode !== undefined) {
      const parsedErrorCode = parseInt(errorCode);
      if (
        isNaN(parsedErrorCode) ||
        parsedErrorCode < 100 ||
        parsedErrorCode > 599
      ) {
        return NextResponse.json(
          { error: "에러코드는 100-599 사이의 HTTP 상태 코드여야 합니다." },
          { status: 400 }
        );
      }
      errorCodeValue = parsedErrorCode;
    }
    // errorCode가 빈 문자열이면 errorCodeValue는 null (정상 응답)

    console.log("처리된 에러코드:", errorCodeValue);

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

    console.log("업데이트 완료:", statusText);

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
