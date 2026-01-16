import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessById } from "@/lib/proxyAccess";

// Mock API 제목 수정
export async function PATCH(req: NextRequest) {
  try {
    const user = await getOptionalAuthUser();

    const { mockApiId, apiName } = await req.json();

    if (mockApiId === undefined || apiName === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 제목이 필요합니다." },
        { status: 400 }
      );
    }

    // 제목 유효성 검사
    if (!apiName.trim()) {
      return NextResponse.json(
        { error: "제목은 비워둘 수 없습니다." },
        { status: 400 }
      );
    }

    const mockApi = await prisma.proxyMockApi.findUnique({
      where: { id: parseInt(mockApiId) },
    });

    if (!mockApi) {
      return NextResponse.json(
        { error: "Mock API를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const access = await getProxyAccessById(
      mockApi.proxyServerId,
      user?.id
    );
    if (access.errorResponse) return access.errorResponse;

    const canManage =
      access.data!.isOwner || access.data!.isMember || access.data!.isPublic;
    if (!canManage) {
      return NextResponse.json(
        { error: "Mock API 수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    // Mock API 제목 업데이트
    const updatedMockApi = await prisma.proxyMockApi.update({
      where: { id: parseInt(mockApiId) },
      data: {
        apiName: apiName.trim(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "제목이 성공적으로 수정되었습니다.",
        mockApi: updatedMockApi,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 제목 수정 오류:", error);
    return NextResponse.json(
      { error: "Mock API 제목 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
