import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      proxyServerName,
      apiName,
      method,
      path,
      requestFields,
      responseFields,
      mockData,
    } = await req.json();

    // 프록시 서버 존재 확인
    const proxyServer = await prisma.proxyServer.findUnique({
      where: { name: proxyServerName }
    });

    if (!proxyServer) {
      return NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 응답 필드를 객체로 변환
    const responseObject: Record<string, any> = {};

    if (
      mockData &&
      typeof mockData === "object" &&
      Object.keys(mockData).length > 0
    ) {
      Object.assign(responseObject, mockData);
    } else {
      responseFields.forEach((field: Field) => {
        const mockValue = mockData && mockData[field.name];

        if (mockValue !== undefined && mockValue !== null) {
          responseObject[field.name] = mockValue;
        } else {
          responseObject[field.name] = field.type;
        }
      });
    }

    // OpenAI API를 사용하여 OpenAPI 스펙 생성
    const prompt = `다음 정보를 사용하여 OpenAPI 3.0 JSON 스펙을 만들어 주세요.

API 이름: ${apiName}
메서드: ${method}
경로: ${path}
요청 필드: ${JSON.stringify(requestFields)}
응답 필드: ${JSON.stringify(responseFields)}

요구사항: 
- summary, parameters, requestBody, responses 항목을 포함해야 합니다.
- 200 응답의 예제 값을 포함해야 합니다.
- JSON 형식으로만 응답해주세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
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

    const specText = completion.choices[0]?.message?.content || "{}";
    let specJson;

    try {
      specJson = JSON.parse(specText);
    } catch (error) {
      specJson = {
        openapi: "3.0.0",
        info: {
          title: apiName,
          version: "1.0.0",
        },
        paths: {
          [path]: {
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

    // 데이터베이스에 프록시 Mock API 저장
    const proxyMockApi = await prisma.proxyMockApi.create({
      data: {
        proxyServerId: proxyServer.id,
        path,
        method,
        apiName,
        requestSpec: requestFields,
        responseSpec: responseFields,
        mockData: responseObject,
      },
    });

    return NextResponse.json(
      {
        success: true,
        proxyMockApi,
        spec: specJson,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("프록시 Mock API 생성 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "프록시 Mock API 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
} 