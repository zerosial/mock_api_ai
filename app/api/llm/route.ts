import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatCompletionRequest = await request.json();

    // 로컬 LLM 서비스 URL (Docker 내부 네트워크)
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    // 요청 데이터 검증
    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: "메시지가 필요합니다." },
        { status: 400 }
      );
    }

    // 로컬 LLM 서비스로 요청 전달
    const response = await fetch(`${llmServiceUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || "exaone-4.0-1.2b",
        messages: body.messages,
        max_tokens: body.max_tokens || 500,
        temperature: body.temperature || 0.7,
        stream: body.stream || false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM 서비스 오류:", errorText);
      return NextResponse.json(
        { error: `LLM 서비스 오류: ${response.status}` },
        { status: response.status }
      );
    }

    const data: ChatCompletionResponse = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("LLM API 오류:", error);
    return NextResponse.json(
      { error: "내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 로컬 LLM 서비스 상태 확인
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    const response = await fetch(`${llmServiceUrl}/health`);

    if (!response.ok) {
      return NextResponse.json(
        { status: "unhealthy", error: "LLM 서비스에 연결할 수 없습니다." },
        { status: 503 }
      );
    }

    const healthData = await response.json();

    return NextResponse.json({
      status: "healthy",
      llm_service: healthData,
      endpoints: {
        chat: "/api/llm",
        health: "/api/llm/health",
      },
    });
  } catch (error) {
    console.error("LLM 상태 확인 오류:", error);
    return NextResponse.json(
      { status: "unhealthy", error: "LLM 서비스 상태를 확인할 수 없습니다." },
      { status: 503 }
    );
  }
}
