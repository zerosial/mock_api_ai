import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export async function POST(req: NextRequest) {
  try {
    const { apiName, method, url, description } = await req.json();

    // OpenAI API 키가 설정되지 않은 경우 기본 필드 생성
    if (!process.env.OPENAI_API_KEY) {
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
          {
            name: "createdAt",
            type: "date",
            required: false,
            description: "생성일",
          },
        ],
      };

      return NextResponse.json(
        {
          success: true,
          fields: defaultFields,
          aiGenerated: false,
        },
        { status: 200 }
      );
    }

    // OpenAI를 사용하여 필드 생성
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
            "당신은 API 설계자입니다. API 요청/응답 필드를 생성하는 전문가입니다.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
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
