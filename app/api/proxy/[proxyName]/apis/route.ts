import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessByName } from "@/lib/proxyAccess";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string }> }
) {
  try {
    const user = await getOptionalAuthUser();

    const { proxyName } = await params;

    // 프록시 서버 존재 확인
    const access = await getProxyAccessByName(proxyName, user?.id);
    if (access.errorResponse) return access.errorResponse;

    const canManage =
      access.data!.isOwner || access.data!.isMember || access.data!.isPublic;
    if (!canManage) {
      return NextResponse.json(
        { error: "Mock API 조회 권한이 없습니다." },
        { status: 403 }
      );
    }

    // Mock API 목록 조회
    const mockApis = await prisma.proxyMockApi.findMany({
      where: {
        proxyServerId: access.data!.proxyServer.id,
        // isActive 상태와 관계없이 모든 Mock API 조회
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(mockApis);
  } catch (error) {
    console.error("Mock API 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "Mock API 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
