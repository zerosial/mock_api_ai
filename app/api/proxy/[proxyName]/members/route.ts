import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProxyAccessByName, requireAuthUser } from "@/lib/proxyAccess";
import { ProxyMemberRole } from "@/lib/generated/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string }> }
) {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const { proxyName } = await params;
    const access = await getProxyAccessByName(proxyName, authResult.user.id);
    if (access.errorResponse) return access.errorResponse;

    const canView = access.data!.isOwner || access.data!.isMember;
    if (!canView) {
      return NextResponse.json(
        { error: "멤버 조회 권한이 없습니다." },
        { status: 403 }
      );
    }

    const proxyServer = await prisma.proxyServer.findUnique({
      where: { id: access.data!.proxyServer.id },
      include: {
        owner: { select: { id: true, email: true, name: true, image: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, image: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!proxyServer) {
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      owner: proxyServer.owner,
      members: proxyServer.members.map((member) => ({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        user: member.user,
      })),
    });
  } catch (error) {
    console.error("프록시 멤버 조회 오류:", error);
    return NextResponse.json(
      { error: "멤버 조회 중 오류가 발생했습니다." },
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
    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json(
        { error: "멤버 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const access = await getProxyAccessByName(proxyName, authResult.user.id);
    if (access.errorResponse) return access.errorResponse;

    if (!access.data!.isOwner) {
      return NextResponse.json(
        { error: "멤버 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    const member = await prisma.proxyServerMember.findUnique({
      where: { id: parseInt(memberId) },
    });

    if (!member || member.proxyServerId !== access.data!.proxyServer.id) {
      return NextResponse.json(
        { error: "멤버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (member.role === ProxyMemberRole.OWNER) {
      return NextResponse.json(
        { error: "소유자는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    await prisma.proxyServerMember.delete({ where: { id: member.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("프록시 멤버 삭제 오류:", error);
    return NextResponse.json(
      { error: "멤버 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

