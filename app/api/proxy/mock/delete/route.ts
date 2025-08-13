import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock API 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { mockApiId } = await req.json();

    if (!mockApiId) {
      return NextResponse.json(
        { error: "Mock API ID가 필요합니다." },
        { status: 400 }
      );
    }

    // Mock API 삭제
    await prisma.proxyMockApi.delete({
      where: { id: parseInt(mockApiId) },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Mock API가 성공적으로 삭제되었습니다.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Mock API 삭제 오류:", error);
    return NextResponse.json(
      { error: "Mock API 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
