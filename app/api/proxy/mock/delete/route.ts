import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessById } from "@/lib/proxyAccess";

// Mock API 삭제
export async function DELETE(req: NextRequest) {
  try {
    const user = await getOptionalAuthUser();

    const { mockApiId } = await req.json();

    if (!mockApiId) {
      return NextResponse.json(
        { error: "Mock API ID가 필요합니다." },
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
        { error: "Mock API 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    // Mock API 삭제
    await prisma.proxyMockApi.delete({
      where: { id: parseInt(mockApiId) },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Mock API가 성공적으로 삭제되었습니다.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 삭제 오류:", error);
    return NextResponse.json(
      { error: "Mock API 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
