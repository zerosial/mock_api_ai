import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 프록시 서버 목록 조회
export async function GET() {
  try {
    const proxyServers = await prisma.proxyServer.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { mockApis: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(proxyServers);
  } catch (error) {
    console.error("프록시 서버 조회 오류:", error);
    return NextResponse.json(
      { error: "프록시 서버 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 프록시 서버 생성
export async function POST(req: NextRequest) {
  try {
    const { name, targetUrl, description } = await req.json();

    if (!name || !targetUrl) {
      return NextResponse.json(
        { error: "프록시 서버 이름과 목표 URL은 필수입니다." },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: "유효하지 않은 URL 형식입니다." },
        { status: 400 }
      );
    }

    const proxyServer = await prisma.proxyServer.create({
      data: {
        name,
        targetUrl,
        description
      }
    });

    return NextResponse.json(proxyServer, { status: 201 });
  } catch (error) {
    console.error("프록시 서버 생성 오류:", error);
    
    // Check if error is a Prisma error with code property
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "이미 존재하는 프록시 서버 이름입니다." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "프록시 서버 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
} 