import { NextRequest, NextResponse } from "next/server";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const { apiName, method, url, description } = await req.json();

    // 로컬 LLM 서비스 URL 확인
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    // 로컬 LLM을 사용하여 필드 생성
    const prompt = `다음 API 정보를 바탕으로 요청 필드와 응답 필드를 생성해주세요.

API 이름: ${apiName}
HTTP 메서드: ${method}
URL: ${url}
API 설명: ${description}

다음 JSON 형식으로 응답해주세요:
{
  "requestFields": [
    {
      "name": "필드명",
      "type": "string|number|boolean|email|phone|name|address|date",
      "required": true/false,
      "description": "필드 설명"
    }
  ],
  "responseFields": [
    {
      "name": "필드명", 
      "type": "string|number|boolean|email|phone|name|address|date",
      "required": true/false,
      "description": "필드 설명"
    }
  ]
}

요청 필드는 API가 받는 파라미터이고, 응답 필드는 API가 반환하는 데이터입니다.
JSON 형식으로만 응답해주세요.`;

    try {
      // 환경변수로 타임아웃 설정 (기본값: 10분)
      const timeoutMinutes = parseInt(process.env.LLM_TIMEOUT_MINUTES || "10");
      const timeoutMs = timeoutMinutes * 60 * 1000;

      console.log(
        `LLM 서비스 호출 시작 - 타임아웃: ${timeoutMinutes}분 (${timeoutMs}ms)`
      );

      // AbortController를 사용하여 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(
          `LLM 서비스 타임아웃 (${timeoutMinutes}분) - 기본 필드로 폴백`
        );
        controller.abort();
      }, timeoutMs);

      const llmResponse = await fetch(`${llmServiceUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "exaone-4.0-1.2b",
          messages: [
            {
              role: "system",
              content:
                "당신은 API 설계자입니다. API 요청/응답 필드를 생성하는 전문가입니다. JSON 형식으로만 응답해주세요.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("LLM 서비스 응답 수신 완료");

      if (!llmResponse.ok) {
        if (llmResponse.status === 504) {
          console.log("LLM 서비스 응답 시간 초과, 기본 필드로 폴백");
          throw new Error("TIMEOUT");
        }
        throw new Error(`LLM 서비스 오류: ${llmResponse.status}`);
      }

      const llmData = await llmResponse.json();
      const responseText = llmData.choices[0]?.message?.content || "{}";

      let generatedFields;

      try {
        generatedFields = JSON.parse(responseText);
      } catch (error) {
        // JSON 파싱 실패 시 기본 필드 생성
        generatedFields = {
          requestFields: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "사용자 ID",
            },
          ],
          responseFields: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "사용자 ID",
            },
            {
              name: "name",
              type: "string",
              required: true,
              description: "사용자 이름",
            },
            {
              name: "email",
              type: "email",
              required: true,
              description: "사용자 이메일",
            },
          ],
        };
      }

      return NextResponse.json(
        {
          success: true,
          fields: generatedFields,
          aiGenerated: true,
        },
        { status: 200 }
      );
    } catch (llmError: unknown) {
      console.error("LLM 서비스 오류:", llmError);

      // 타임아웃이나 기타 LLM 오류 시 기본 필드 생성
      const defaultFields = {
        requestFields: [
          {
            name: "id",
            type: "number",
            required: true,
            description: "사용자 ID",
          },
        ],
        responseFields: [
          {
            name: "id",
            type: "number",
            required: true,
            description: "사용자 ID",
          },
          {
            name: "name",
            type: "string",
            required: true,
            description: "사용자 이름",
          },
          {
            name: "email",
            type: "email",
            required: true,
            description: "사용자 이메일",
          },
        ],
      };

      const errorMessage =
        llmError instanceof Error ? llmError.message : "UNKNOWN_ERROR";

      return NextResponse.json(
        {
          success: true,
          fields: defaultFields,
          aiGenerated: false,
          message:
            errorMessage === "TIMEOUT"
              ? "AI 응답 시간이 초과되어 기본 필드를 생성했습니다."
              : "AI 서비스 오류로 기본 필드를 생성했습니다.",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("필드 생성 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "필드 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
