import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessByName, requireAuthUser } from "@/lib/proxyAccess";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string }> }
) {
  try {
    const user = await getOptionalAuthUser();

    const { proxyName } = await params;
    const access = await getProxyAccessByName(proxyName, user?.id);
    if (access.errorResponse) return access.errorResponse;

    return NextResponse.json(access.data?.proxyServer);
  } catch (error) {
    console.error("프록시 서버 조회 오류:", error);
    return NextResponse.json(
      { error: "프록시 서버 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string }> }
) {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const { proxyName } = await params;

    // 프록시 서버 조회
    const proxyServer = await prisma.proxyServer.findUnique({
      where: { name: proxyName },
      include: {
        _count: {
          select: {
            mockApis: true,
            communicationLogs: true,
          },
        },
      },
    });

    if (!proxyServer) {
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (proxyServer.ownerId !== authResult.user.id) {
      return NextResponse.json(
        { error: "삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 트랜잭션으로 모든 관련 데이터 삭제
    await prisma.$transaction(async (tx) => {
      // 1. Mock API 삭제
      await tx.proxyMockApi.deleteMany({
        where: { proxyServerId: proxyServer.id },
      });

      // 2. 통신 로그 삭제
      await tx.proxyCommunicationLog.deleteMany({
        where: { proxyServerId: proxyServer.id },
      });

      // 3. 멤버/초대 삭제
      await tx.proxyServerMember.deleteMany({
        where: { proxyServerId: proxyServer.id },
      });
      await tx.proxyServerInvite.deleteMany({
        where: { proxyServerId: proxyServer.id },
      });

      // 4. 프록시 서버 삭제
      await tx.proxyServer.delete({
        where: { id: proxyServer.id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "프록시 서버와 관련 데이터가 성공적으로 삭제되었습니다.",
      deletedData: {
        proxyServer: proxyServer.name,
        mockApis: proxyServer._count.mockApis,
        communicationLogs: proxyServer._count.communicationLogs,
      },
    });
  } catch (error) {
    console.error("프록시 서버 삭제 오류:", error);
    return NextResponse.json(
      { error: "프록시 서버 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
