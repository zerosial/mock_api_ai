import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { mockData } = await req.json();

    const template = await prisma.template.update({
      where: { id: parseInt(id) },
      data: { mockData },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Mock 데이터 업데이트 오류:", error);
    return NextResponse.json(
      { error: "Mock 데이터 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}
