import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProxyAccessByName, requireAuthUser } from "@/lib/proxyAccess";
import { ProxyInviteStatus } from "@/lib/generated/prisma";

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

    if (!access.data!.isOwner) {
      return NextResponse.json(
        { error: "초대 목록 조회 권한이 없습니다." },
        { status: 403 }
      );
    }

    const invites = await prisma.proxyServerInvite.findMany({
      where: { proxyServerId: access.data!.proxyServer.id },
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: { select: { id: true, email: true, name: true, image: true } },
      },
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error("초대 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "초대 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string }> }
) {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const { proxyName } = await params;
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "초대할 이메일이 필요합니다." },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return NextResponse.json(
        { error: "유효한 이메일을 입력해주세요." },
        { status: 400 }
      );
    }

    const access = await getProxyAccessByName(proxyName, authResult.user.id);
    if (access.errorResponse) return access.errorResponse;

    if (!access.data!.isOwner) {
      return NextResponse.json(
        { error: "초대 권한이 없습니다." },
        { status: 403 }
      );
    }

    const proxyServerId = access.data!.proxyServer.id;

    if (trimmedEmail === authResult.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "본인은 초대할 수 없습니다." },
        { status: 400 }
      );
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (invitedUser) {
      const existingMember = await prisma.proxyServerMember.findUnique({
        where: {
          proxyServerId_userId: {
            proxyServerId,
            userId: invitedUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "이미 멤버로 등록된 사용자입니다." },
          { status: 409 }
        );
      }
    }

    const existingInvite = await prisma.proxyServerInvite.findFirst({
      where: {
        proxyServerId,
        email: trimmedEmail,
        status: ProxyInviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "이미 초대가 진행 중입니다." },
        { status: 409 }
      );
    }

    const invite = await prisma.proxyServerInvite.create({
      data: {
        proxyServerId,
        email: trimmedEmail,
        invitedById: authResult.user.id,
        status: ProxyInviteStatus.PENDING,
      },
    });

    return NextResponse.json({ success: true, invite });
  } catch (error) {
    console.error("초대 생성 오류:", error);
    return NextResponse.json(
      { error: "초대 생성 중 오류가 발생했습니다." },
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
    const { inviteId } = await req.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "초대 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const access = await getProxyAccessByName(proxyName, authResult.user.id);
    if (access.errorResponse) return access.errorResponse;

    if (!access.data!.isOwner) {
      return NextResponse.json(
        { error: "초대 취소 권한이 없습니다." },
        { status: 403 }
      );
    }

    const invite = await prisma.proxyServerInvite.findUnique({
      where: { id: parseInt(inviteId) },
    });

    if (!invite || invite.proxyServerId !== access.data!.proxyServer.id) {
      return NextResponse.json(
        { error: "초대를 찾을 수 없습니다." },
        { status: 404 }
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
    console.error("초대 취소 오류:", error);
    return NextResponse.json(
      { error: "초대 취소 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

