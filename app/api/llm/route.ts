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

export async function POST(request: NextRequest) {
  try {
    const body: ChatCompletionRequest = await request.json();
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    // 스트리밍 모드 확인
    const isStreaming = body.stream === true;

    if (isStreaming) {
      // 스트리밍 모드: SSE 응답
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response = await fetch(
              `${llmServiceUrl}/v1/chat/completions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "text/event-stream",
                },
                body: JSON.stringify({
                  model: body.model || "exaone-4.0-1.2b",
                  messages: body.messages,
                  max_tokens: body.max_tokens || 500,
                  temperature: body.temperature || 0.7,
                  stream: true,
                }),
              }
            );

            if (!response.ok) {
              throw new Error(`LLM 서비스 오류: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("스트림을 읽을 수 없습니다.");
            }

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data === "[DONE]") {
                      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                      break;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`)
                      );
                    } catch (e) {
                      // JSON 파싱 실패 시 무시
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
          } catch (error) {
            console.error("스트리밍 오류:", error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error: {
                    message: "스트리밍 중 오류가 발생했습니다.",
                    type: "stream_error",
                  },
                })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        },
      });
    } else {
      // 일반 모드: JSON 응답
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
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM 서비스 오류: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("LLM API 오류:", error);
    return NextResponse.json(
      {
        error: {
          message: "LLM 서비스 호출 중 오류가 발생했습니다.",
          type: "api_error",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    console.log("Health 체크 시작 - LLM 서비스 URL:", llmServiceUrl);

    const response = await fetch(`${llmServiceUrl}/health`);

    if (response.ok) {
      const data = await response.json();
      console.log("Health 체크 응답:", data);

      // LLM 서비스 응답 구조에 맞게 변환
      const isHealthy =
        data.status === "healthy" && data.llm_service?.status === "healthy";

      console.log("Health 상태 판단:", {
        status: data.status,
        llm_service_status: data.llm_service?.status,
        isHealthy: isHealthy,
      });

      return NextResponse.json({
        isHealthy: isHealthy,
        status: data.status,
        llm_service: data.llm_service,
        timestamp: data.timestamp,
        service_url: data.service_url,
      });
    } else {
      console.error("Health 체크 HTTP 오류:", response.status);
      throw new Error(`LLM 서비스 오류: ${response.status}`);
    }
  } catch (error) {
    console.error("LLM 상태 확인 오류:", error);
    return NextResponse.json(
      {
        isHealthy: false,
        error: {
          message: "LLM 서비스 상태를 확인할 수 없습니다.",
          type: "health_check_error",
        },
      },
      { status: 500 }
    );
  }
}
