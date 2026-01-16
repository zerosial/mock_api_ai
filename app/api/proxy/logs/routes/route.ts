import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOptionalAuthUser, getProxyAccessByName } from "@/lib/proxyAccess";

// 프록시 서버별 라우트 그룹 조회
export async function GET(req: NextRequest) {
  try {
    const user = await getOptionalAuthUser();

    const { searchParams } = new URL(req.url);
    const proxyServerName = searchParams.get("proxyServerName");

    if (!proxyServerName) {
      return NextResponse.json(
        { error: "프록시 서버 이름이 필요합니다." },
        { status: 400 }
      );
    }

    const access = await getProxyAccessByName(proxyServerName, user?.id);
    if (access.errorResponse) return access.errorResponse;

    const canManage =
      access.data!.isOwner || access.data!.isMember || access.data!.isPublic;
    if (!canManage) {
      return NextResponse.json(
        { error: "라우트 조회 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 먼저 모든 로그를 가져와서 JavaScript로 그룹화
    const allLogs = await prisma.proxyCommunicationLog.findMany({
      where: { proxyServerId: access.data!.proxyServer.id },
      orderBy: { createdAt: "desc" },
      select: {
        path: true,
        method: true,
        statusCode: true,
        responseBody: true,
        createdAt: true,
      },
    });

    // 라우트별로 그룹화
    const routeMap = new Map<
      string,
      {
        path: string;
        method: string;
        count: number;
        lastRequest: string;
        lastResponse: unknown;
        lastStatusCode: number;
      }
    >();

    allLogs.forEach((log) => {
      const key = `${log.method}:${log.path}`;

      if (!routeMap.has(key)) {
        routeMap.set(key, {
          path: log.path,
          method: log.method,
          count: 0,
          lastRequest: log.createdAt.toISOString(),
          lastResponse: log.responseBody,
          lastStatusCode: log.statusCode,
        });
      }

      const route = routeMap.get(key)!;
      route.count++;

      // 더 최근 로그로 업데이트
      if (new Date(log.createdAt) > new Date(route.lastRequest)) {
        route.lastRequest = log.createdAt.toISOString();
        route.lastResponse = log.responseBody;
        route.lastStatusCode = log.statusCode;
      }
    });

    // 배열로 변환하고 최근 요청 순으로 정렬
    const routeGroups = Array.from(routeMap.values()).sort(
      (a, b) =>
        new Date(b.lastRequest).getTime() - new Date(a.lastRequest).getTime()
    );

    return NextResponse.json(routeGroups);
  } catch (error) {
    console.error("라우트 그룹 조회 오류:", error);
    return NextResponse.json(
      { error: "라우트 그룹 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
