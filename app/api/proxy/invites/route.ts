import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser } from "@/lib/proxyAccess";
import { ProxyInviteStatus } from "@/lib/generated/prisma";

export async function GET() {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const invites = await prisma.proxyServerInvite.findMany({
      where: {
        email: authResult.user.email.toLowerCase(),
        status: ProxyInviteStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      include: {
        proxyServer: {
          select: {
            id: true,
            name: true,
            targetUrl: true,
            description: true,
            visibility: true,
          },
        },
        invitedBy: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error("내 초대 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "초대 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const { inviteId } = await req.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "초대 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const invite = await prisma.proxyServerInvite.findUnique({
      where: { id: parseInt(inviteId) },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "초대를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (invite.email !== authResult.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "초대 취소 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (invite.status !== ProxyInviteStatus.PENDING) {
      return NextResponse.json(
        { error: "이미 처리된 초대입니다." },
        { status: 400 }
      );
    }

    const updatedInvite = await prisma.proxyServerInvite.update({
      where: { id: invite.id },
      data: { status: ProxyInviteStatus.REVOKED },
    });

    return NextResponse.json({ success: true, invite: updatedInvite });
  } catch (error) {
    console.error("초대 거절 오류:", error);
    return NextResponse.json(
      { error: "초대 거절 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

