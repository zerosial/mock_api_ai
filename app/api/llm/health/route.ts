import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 로컬 LLM 서비스 상태 확인
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    const response = await fetch(`${llmServiceUrl}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "LLM 서비스에 연결할 수 없습니다.",
          status_code: response.status,
          llm_service_url: llmServiceUrl,
        },
        { status: 503 }
      );
    }

    const healthData = await response.json();

    return NextResponse.json({
      status: "healthy",
      llm_service: healthData,
      timestamp: new Date().toISOString(),
      service_url: llmServiceUrl,
    });
  } catch (error) {
    console.error("LLM 상태 확인 오류:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "LLM 서비스 상태를 확인할 수 없습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 503 }
    );
  }
}
