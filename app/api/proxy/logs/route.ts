import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessById, getProxyAccessByName, requireAuthUser } from "@/lib/proxyAccess";

// 프록시 통신 로그 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getOptionalAuthUser();

    const { searchParams } = new URL(req.url);
    const proxyServerId = searchParams.get("proxyServerId");
    const proxyServerName = searchParams.get("proxyServerName");
    const path = searchParams.get("path");
    const method = searchParams.get("method");
    const limit = parseInt(searchParams.get("limit") || "3");

    if (!proxyServerId && !proxyServerName) {
      return NextResponse.json(
        { error: "프록시 서버 ID 또는 이름이 필요합니다." },
        { status: 400 }
      );
    }

    const access = proxyServerId
      ? await getProxyAccessById(parseInt(proxyServerId), user?.id)
      : await getProxyAccessByName(proxyServerName as string, user?.id);

    if (access.errorResponse) return access.errorResponse;

    const canManage =
      access.data!.isOwner || access.data!.isMember || access.data!.isPublic;
    if (!canManage) {
      return NextResponse.json(
        { error: "로그 조회 권한이 없습니다." },
        { status: 403 }
      );
    }

    const whereClause: Record<string, number | string> = {
      proxyServerId: access.data!.proxyServer.id,
    };

    // 특정 API 경로와 메서드로 필터링
    if (path && method) {
      whereClause.path = path;
      whereClause.method = method.toUpperCase();
    }

    const logs = await prisma.proxyCommunicationLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        proxyServer: {
          select: {
            name: true,
            targetUrl: true,
          },
        },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("프록시 통신 로그 조회 오류:", error);
    return NextResponse.json(
      { error: "프록시 통신 로그 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 프록시 통신 로그 저장
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthUser();
    if (authResult.errorResponse) return authResult.errorResponse;

    const {
      proxyServerId,
      path,
      method,
      requestBody,
      responseBody,
      statusCode,
      responseTime,
      userAgent,
      ipAddress,
      isMock,
    } = await req.json();

    if (!proxyServerId || !path || !method || !statusCode) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      );
    }

    const access = await getProxyAccessById(
      parseInt(proxyServerId),
      authResult.user.id
    );
    if (access.errorResponse) return access.errorResponse;

    const canManage = access.data!.isOwner || access.data!.isMember;
    if (!canManage) {
      return NextResponse.json(
        { error: "로그 저장 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 기존 로그 개수 확인 (프록시별 1000개 제한)
    const existingLogsCount = await prisma.proxyCommunicationLog.count({
      where: { proxyServerId: parseInt(proxyServerId) },
    });

    if (existingLogsCount >= 1000) {
      // 가장 오래된 로그 삭제
      const oldestLog = await prisma.proxyCommunicationLog.findFirst({
        where: { proxyServerId: parseInt(proxyServerId) },
        orderBy: { createdAt: "asc" },
      });

      if (oldestLog) {
        await prisma.proxyCommunicationLog.delete({
          where: { id: oldestLog.id },
        });
      }
    }

    // 새 로그 저장
    const log = await prisma.proxyCommunicationLog.create({
      data: {
        proxyServerId: parseInt(proxyServerId),
        path,
        method: method.toUpperCase(),
        requestBody,
        responseBody,
        statusCode,
        responseTime,
        userAgent,
        ipAddress,
        isMock: isMock || false,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("프록시 통신 로그 저장 오류:", error);
    return NextResponse.json(
      { error: "프록시 통신 로그 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
