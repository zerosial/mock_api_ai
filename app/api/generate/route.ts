import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReservedProjectName, isReservedUserName } from "@/lib/constants";
import { localLLM, createLocalLLMClient } from "@/lib/local-llm";

// 로컬 LLM 클라이언트 생성 (환경변수에서 URL 가져오기)
const llmClient = createLocalLLMClient();

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      apiName,
      method,
      url,
      requestFields,
      responseFields,
      project,
      user,
      mockData, // 사용자가 지정한 값들
    } = await req.json();

    // 예약된 프로젝트명/사용자명 검증
    if (isReservedProjectName(project)) {
      return NextResponse.json(
        {
          success: false,
          error: `'${project}'은(는) 예약된 프로젝트명입니다. 다른 이름을 사용해주세요.`,
        },
        { status: 400 }
      );
    }

    if (isReservedUserName(user)) {
      return NextResponse.json(
        {
          success: false,
          error: `'${user}'은(는) 예약된 사용자명입니다. 다른 이름을 사용해주세요.`,
        },
        { status: 400 }
      );
    }

    // 응답 필드를 객체로 변환 (사용자가 지정한 값이 있으면 그 값을 사용, 없으면 타입 사용)
    const responseObject: Record<string, any> = {};

    // 디버깅을 위한 로그
    console.log("Received mockData:", mockData);
    console.log("Response fields:", responseFields);

    // mockData가 이미 중첩 구조로 되어 있다면 그대로 사용
    if (
      mockData &&
      typeof mockData === "object" &&
      Object.keys(mockData).length > 0
    ) {
      // mockData가 비어있지 않으면 그대로 사용
      Object.assign(responseObject, mockData);
    } else {
      // 필드 기반으로 생성하는 경우 (기존 방식)
      responseFields.forEach((field: Field) => {
        const mockValue = mockData && mockData[field.name];

        if (mockValue !== undefined && mockValue !== null) {
          // 사용자가 지정한 값이 있으면 그 값을 사용
          responseObject[field.name] = mockValue;
        } else {
          // 값이 없으면 타입에 따라 랜덤 생성 (기존 방식)
          responseObject[field.name] = field.type;
        }
      });
    }

    console.log("Final responseObject:", responseObject);

    // 로컬 LLM을 사용하여 OpenAPI 스펙 생성
    const prompt = `다음 정보를 사용하여 OpenAPI 3.0 JSON 스펙을 만들어 주세요.

API 이름: ${apiName}
메서드: ${method}
경로: ${url}
요청 필드: ${JSON.stringify(requestFields)}
응답 필드: ${JSON.stringify(responseFields)}

요구사항: 
- summary, parameters, requestBody, responses 항목을 포함해야 합니다.
- 200 응답의 예제 값을 포함해야 합니다.
- JSON 형식으로만 응답해주세요.`;

    try {
      // 로컬 LLM 서비스 상태 확인
      const health = await llmClient.healthCheck();
      if (!health.model_loaded) {
        throw new Error("로컬 LLM 모델이 아직 로드되지 않았습니다.");
      }

      const completion = await llmClient.createChatCompletion({
        model: "lg-exaone",
        messages: [
          {
            role: "system",
            content:
              "당신은 API 설계자입니다. OpenAPI 3.0 스펙을 생성하는 전문가입니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      console.log("로컬 LLM 응답:", completion);
    } catch (llmError) {
      console.error("로컬 LLM 오류:", llmError);
      // 로컬 LLM 실패 시 기본 스펙 생성
      console.log("기본 스펙 생성으로 폴백");
    }

    const specText = completion?.choices?.[0]?.message?.content || "{}";
    let specJson;

    try {
      specJson = JSON.parse(specText);
    } catch (error) {
      // JSON 파싱 실패 시 기본 스펙 생성
      specJson = {
        openapi: "3.0.0",
        info: {
          title: apiName,
          version: "1.0.0",
        },
        paths: {
          [url]: {
            [method.toLowerCase()]: {
              summary: apiName,
              responses: {
                "200": {
                  description: "Success",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: responseObject,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
    }

    // 데이터베이스에 템플릿 저장
    const template = await prisma.template.create({
      data: {
        project,
        user,
        apiUrl: url,
        method,
        apiName,
        requestSpec: requestFields,
        responseSpec: responseFields,
        generatedCode: JSON.stringify(specJson),
        mockData: responseObject,
      },
    });

    return NextResponse.json(
      {
        success: true,
        template,
        spec: specJson,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API 생성 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "API 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
