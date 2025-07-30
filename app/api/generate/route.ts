import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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
    } = await req.json();

    // OpenAI API를 사용하여 OpenAPI 스펙 생성
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
                        properties: responseFields,
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
        mockData: responseFields,
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
