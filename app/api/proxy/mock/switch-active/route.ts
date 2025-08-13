import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 활성화 전환
export async function PATCH(req: NextRequest) {
  try {
    const { mockApiId } = await req.json();

    if (mockApiId === undefined) {
      return NextResponse.json(
        { error: "Mock API ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 활성화할 Mock API 조회
    const targetMockApi = await prisma.proxyMockApi.findUnique({
      where: { id: parseInt(mockApiId) },
    });

    if (!targetMockApi) {
      return NextResponse.json(
        { error: "Mock API를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 같은 경로/메서드의 모든 Mock API를 비활성화
    await prisma.proxyMockApi.updateMany({
      where: {
        proxyServerId: targetMockApi.proxyServerId,
        path: targetMockApi.path,
        method: targetMockApi.method,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // 선택된 Mock API만 활성화
    const updatedMockApi = await prisma.proxyMockApi.update({
      where: { id: parseInt(mockApiId) },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Mock API "${updatedMockApi.apiName}"이(가) 활성화되었습니다.`,
        mockApi: updatedMockApi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 활성화 전환 오류:", error);
    return NextResponse.json(
      { error: "Mock API 활성화 전환 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
