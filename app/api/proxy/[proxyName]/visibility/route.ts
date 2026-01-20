import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProxyAccessByName, requireAuthUser } from "@/lib/proxyAccess";
import { ProxyVisibility } from "@/lib/generated/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ proxyName: string }> }
) {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const { proxyName } = await params;
    const { visibility } = await req.json();

    if (!visibility) {
      return NextResponse.json(
        { error: "공개 설정 값이 필요합니다." },
        { status: 400 }
      );
    }

    const access = await getProxyAccessByName(proxyName, authResult.user.id);
    if (access.errorResponse) return access.errorResponse;

    if (!access.data!.isOwner) {
      return NextResponse.json(
        { error: "공개 설정 변경 권한이 없습니다." },
        { status: 403 }
      );
    }

    const resolvedVisibility =
      visibility === ProxyVisibility.PUBLIC
        ? ProxyVisibility.PUBLIC
        : ProxyVisibility.PRIVATE;

    const updatedProxy = await prisma.proxyServer.update({
      where: { id: access.data!.proxyServer.id },
      data: {
        visibility: resolvedVisibility,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, proxyServer: updatedProxy });
  } catch (error) {
    console.error("프록시 공개 설정 변경 오류:", error);
    return NextResponse.json(
      { error: "공개 설정 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

