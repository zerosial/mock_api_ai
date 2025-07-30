import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: 템플릿 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project");
    const user = searchParams.get("user");

    const where: any = { isActive: true };
    if (project) where.project = project;
    if (user) where.user = user;

    const templates = await prisma.template.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { apiLogs: true },
        },
      },
    });

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error("템플릿 조회 오류:", error);
    return NextResponse.json(
      { error: "템플릿 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 새 템플릿 생성
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const template = await prisma.template.create({
      data: {
        project: data.project,
        user: data.user,
        apiUrl: data.apiUrl,
        method: data.method,
        apiName: data.apiName,
        requestSpec: data.requestSpec,
        responseSpec: data.responseSpec,
        generatedCode: data.generatedCode,
        mockData: data.mockData,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("템플릿 생성 오류:", error);
    return NextResponse.json(
      { error: "템플릿 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
