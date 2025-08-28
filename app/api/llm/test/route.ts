import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    // 로컬 LLM 서비스 상태 확인
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    console.log("LLM 서비스 URL:", llmServiceUrl);

    // 간단한 테스트 요청
    const testResponse = await fetch(`${llmServiceUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "exaone-4.0-1.2b",
        messages: [
          { role: "user", content: "안녕하세요! 간단한 테스트입니다." },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error("LLM 테스트 요청 실패:", errorText);
      return NextResponse.json(
        {
          status: "test_failed",
          error: `LLM 테스트 요청 실패: ${testResponse.status}`,
          details: errorText,
        },
        { status: 503 }
      );
    }

    const testData = await testResponse.json();

    return NextResponse.json({
      status: "test_success",
      message: "LLM 서비스 연결 테스트 성공",
      test_response: testData,
      service_url: llmServiceUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("LLM 테스트 오류:", error);
    return NextResponse.json(
      {
        status: "test_error",
        error: "LLM 서비스 테스트 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}
