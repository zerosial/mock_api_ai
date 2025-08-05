import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE: 템플릿 삭제 (소프트 삭제)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await prisma.template.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json(
      { message: "템플릿이 성공적으로 삭제되었습니다." },
      { status: 200 }
    );
  } catch (error) {
    console.error("템플릿 삭제 오류:", error);
    return NextResponse.json(
      { error: "템플릿 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
