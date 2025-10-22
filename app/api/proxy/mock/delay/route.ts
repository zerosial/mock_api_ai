import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 지연 시간 설정
export async function PATCH(req: NextRequest) {
  try {
    const { mockApiId, delayMs } = await req.json();

    if (mockApiId === undefined || delayMs === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 지연 시간이 필요합니다." },
        { status: 400 }
      );
    }

    // 지연 시간 유효성 검사
    const delayValue = parseInt(delayMs);
    if (isNaN(delayValue) || delayValue < 0 || delayValue > 300000) {
      return NextResponse.json(
        { error: "지연 시간은 0-300000ms 사이의 값이어야 합니다." },
        { status: 400 }
      );
    }

    // Mock API 지연 시간 업데이트
    const updatedMockApi = await prisma.proxyMockApi.update({
      where: { id: parseInt(mockApiId) },
      data: {
        delayMs: delayValue,
        updatedAt: new Date(),
      },
    });

    const statusText =
      delayValue === 0
        ? "지연 시간이 제거되었습니다. 정상 응답으로 설정됩니다."
        : `지연 시간이 ${delayValue}ms로 설정되었습니다.`;

    return NextResponse.json(
      {
        success: true,
        message: statusText,
        mockApi: updatedMockApi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 지연 시간 설정 오류:", error);
    return NextResponse.json(
      { error: "Mock API 지연 시간 설정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
