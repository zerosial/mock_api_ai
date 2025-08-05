import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH: 템플릿의 에러 코드 설정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { errorCode } = await req.json();

    // 에러 코드 유효성 검사
    if (
      errorCode !== null &&
      (typeof errorCode !== "number" || errorCode < 100 || errorCode > 599)
    ) {
      return NextResponse.json(
        { error: "에러 코드는 100-599 사이의 숫자이거나 null이어야 합니다." },
        { status: 400 }
      );
    }

    const template = await prisma.template.update({
      where: { id: parseInt(id) },
      data: { errorCode },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error("에러 코드 설정 오류:", error);
    return NextResponse.json(
      { error: "에러 코드 설정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
