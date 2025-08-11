import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { proxyName: string } }
) {
  try {
    const { proxyName } = params;

    // 프록시 서버 존재 확인
    const proxyServer = await prisma.proxyServer.findUnique({
      where: { name: proxyName, isActive: true }
    });

    if (!proxyServer) {
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Mock API 목록 조회
    const mockApis = await prisma.proxyMockApi.findMany({
      where: {
        proxyServerId: proxyServer.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
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