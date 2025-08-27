import { NextRequest, NextResponse } from "next/server";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
  value: string; // 실제 JSON 값 (항상 존재)
}

export async function POST(req: NextRequest) {
  try {
    const { apiName, method, url, description } = await req.json();

    // 로컬 LLM 서비스 URL 확인
    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    // 로컬 LLM을 사용하여 필드와 실제 값까지 생성
    const prompt = `다음 API 정보를 바탕으로 요청 필드와 응답 필드를 생성해주세요. 
각 필드에는 실제 JSON 응답에서 사용할 수 있는 적절한 예시 값도 포함해주세요.

API 이름: ${apiName}
HTTP 메서드: ${method}
URL: ${url}
API 설명: ${description}

다음 JSON 형식으로 응답해주세요:
{
  "requestFields": [
    {
      "name": "필드명",
      "type": "string|number|boolean|email|phone|name|address|date|array|object",
      "required": true/false,
      "description": "필드 설명",
      "value": "실제 예시 값"
    }
  ],
  "responseFields": [
    {
      "name": "필드명", 
      "type": "string|number|boolean|email|phone|name|address|date|array|object",
      "required": true/false,
      "description": "필드 설명",
      "value": "실제 예시 값"
    }
  ]
}

요청 필드는 API가 받는 파라미터이고, 응답 필드는 API가 반환하는 데이터입니다.
각 필드의 value에는 실제 JSON 응답에서 사용할 수 있는 적절한 예시 값을 넣어주세요.
예를 들어:
- name 필드: "홍길동", "김철수" 등의 실제 이름
- email 필드: "user@example.com" 등의 실제 이메일
- id 필드: "1", "123" 등의 숫자
- date 필드: "2024-01-15" 등의 날짜
- boolean 필드: true/false
- address 필드: "서울시 강남구..." 등의 실제 주소
- array 필드: ["item1", "item2"] 또는 [1, 2, 3] 등의 배열
- object 필드: {"key": "value"} 등의 객체

JSON 형식으로만 응답해주세요.`;

    try {
      // AbortController를 사용하여 타임아웃 설정 (10분)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("LLM 서비스 타임아웃 (10분) - 기본 필드로 폴백");
        controller.abort();
      }, 10 * 60 * 1000); // 10분

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
                "당신은 API 설계자입니다. API 요청/응답 필드를 생성하고 실제 JSON 응답에 사용할 수 있는 적절한 예시 값까지 제공하는 전문가입니다. JSON 형식으로만 응답해주세요.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1500,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
              value: "1",
            },
          ],
          responseFields: [
            {
              name: "id",
              type: "number",
              required: true,
              description: "사용자 ID",
              value: "1",
            },
            {
              name: "name",
              type: "string",
              required: true,
              description: "사용자 이름",
              value: "홍길동",
            },
            {
              name: "email",
              type: "email",
              required: true,
              description: "사용자 이메일",
              value: "hong@example.com",
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
            value: "1",
          },
        ],
        responseFields: [
          {
            name: "id",
            type: "number",
            required: true,
            description: "사용자 ID",
            value: "1",
          },
          {
            name: "name",
            type: "string",
            required: true,
            description: "사용자 이름",
            value: "홍길동",
          },
          {
            name: "email",
            type: "email",
            required: true,
            description: "사용자 이메일",
            value: "hong@example.com",
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
