import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser } from "@/lib/proxyAccess";
import { ProxyInviteStatus, ProxyMemberRole } from "@/lib/generated/prisma";

export async function POST(req: NextRequest) {
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
        { error: "초대 수락 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (invite.status !== ProxyInviteStatus.PENDING) {
      return NextResponse.json(
        { error: "이미 처리된 초대입니다." },
        { status: 400 }
      );
    }

    const existingMember = await prisma.proxyServerMember.findUnique({
      where: {
        proxyServerId_userId: {
          proxyServerId: invite.proxyServerId,
          userId: authResult.user.id,
        },
      },
    });

    if (!existingMember) {
      await prisma.proxyServerMember.create({
        data: {
          proxyServerId: invite.proxyServerId,
          userId: authResult.user.id,
          role: ProxyMemberRole.EDITOR,
        },
      });
    }

    const updatedInvite = await prisma.proxyServerInvite.update({
      where: { id: invite.id },
      data: { status: ProxyInviteStatus.ACCEPTED },
    });

    return NextResponse.json({ success: true, invite: updatedInvite });
  } catch (error) {
    console.error("초대 수락 오류:", error);
    return NextResponse.json(
      { error: "초대 수락 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

