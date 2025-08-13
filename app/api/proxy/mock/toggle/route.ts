import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 활성화/비활성화 토글
export async function PATCH(req: NextRequest) {
  try {
    const { mockApiId, isActive } = await req.json();

    if (mockApiId === undefined || isActive === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 활성화 상태가 필요합니다." },
        { status: 400 }
      );
    }

    // Mock API 상태 업데이트
    const updatedMockApi = await prisma.proxyMockApi.update({
      where: { id: parseInt(mockApiId) },
      data: {
        isActive: Boolean(isActive),
        updatedAt: new Date(),
      },
    });

    const statusText = updatedMockApi.isActive ? "활성화" : "비활성화";

    return NextResponse.json(
      {
        success: true,
        message: `Mock API가 성공적으로 ${statusText}되었습니다.`,
        mockApi: updatedMockApi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 상태 변경 오류:", error);
    return NextResponse.json(
      { error: "Mock API 상태 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
