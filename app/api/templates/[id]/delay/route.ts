import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH: 템플릿의 지연 시간 설정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { delayMs } = await req.json();

    // 지연 시간 유효성 검사
    if (typeof delayMs !== "number" || delayMs < 0 || delayMs > 300000) {
      return NextResponse.json(
        { error: "지연 시간은 0-300000ms 사이여야 합니다." },
        { status: 400 }
      );
    }

    const template = await prisma.template.update({
      where: { id: parseInt(id) },
      data: { delayMs },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error("지연 시간 설정 오류:", error);
    return NextResponse.json(
      { error: "지연 시간 설정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
