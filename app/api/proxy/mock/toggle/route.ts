import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessById } from "@/lib/proxyAccess";

// Mock API 활성화/비활성화 토글
export async function PATCH(req: NextRequest) {
  try {
    const user = await getOptionalAuthUser();

    const { mockApiId, isActive } = await req.json();

    if (mockApiId === undefined || isActive === undefined) {
      return NextResponse.json(
        { error: "Mock API ID와 활성화 상태가 필요합니다." },
        { status: 400 }
      );
    }

    // 활성화하려는 Mock API 정보 조회
    const targetMockApi = await prisma.proxyMockApi.findUnique({
      where: { id: parseInt(mockApiId) },
    });

    if (!targetMockApi) {
      return NextResponse.json(
        { error: "Mock API를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const access = await getProxyAccessById(
      targetMockApi.proxyServerId,
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

    // 활성화하려는 경우, 같은 경로/메서드의 다른 Mock API들을 비활성화
    if (Boolean(isActive)) {
      await prisma.proxyMockApi.updateMany({
        where: {
          proxyServerId: targetMockApi.proxyServerId,
          path: targetMockApi.path,
          method: targetMockApi.method,
          id: { not: parseInt(mockApiId) }, // 현재 Mock API 제외
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
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
    const deactivatedCount = Boolean(isActive)
      ? await prisma.proxyMockApi.count({
          where: {
            proxyServerId: targetMockApi.proxyServerId,
            path: targetMockApi.path,
            method: targetMockApi.method,
            isActive: false,
          },
        })
      : 0;

    return NextResponse.json(
      {
        success: true,
        message: `Mock API가 성공적으로 ${statusText}되었습니다.${
          Boolean(isActive) && deactivatedCount > 0
            ? ` 같은 경로/메서드의 ${deactivatedCount}개 Mock API가 자동으로 비활성화되었습니다.`
            : ""
        }`,
        mockApi: updatedMockApi,
        deactivatedCount: Boolean(isActive) ? deactivatedCount : 0,
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
