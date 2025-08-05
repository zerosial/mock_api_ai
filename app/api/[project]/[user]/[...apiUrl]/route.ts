import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { faker } from "@faker-js/faker";

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ project: string; user: string; apiUrl: string[] }> }
) {
  return handleRequest(req, await params, "GET");
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ project: string; user: string; apiUrl: string[] }> }
) {
  return handleRequest(req, await params, "POST");
}

export async function PUT(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ project: string; user: string; apiUrl: string[] }> }
) {
  return handleRequest(req, await params, "PUT");
}

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ project: string; user: string; apiUrl: string[] }> }
) {
  return handleRequest(req, await params, "DELETE");
}

async function handleRequest(
  req: NextRequest,
  params: { project: string; user: string; apiUrl: string[] },
  method: string
) {
  const startTime = Date.now();

  try {
    const { project, user, apiUrl } = params;
    const fullUrl = "/" + apiUrl.join("/");

    // 데이터베이스에서 템플릿 조회
    const template = await prisma.template.findFirst({
      where: {
        project,
        user,
        apiUrl: fullUrl,
        method,
        isActive: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "API not found" }, { status: 404 });
    }

    // 지연 시간 적용 (delayMs가 설정되어 있는 경우)
    if (template.delayMs && template.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, template.delayMs));
    }

    // 요청 본문 로깅
    let requestBody = null;
    try {
      requestBody = await req.json();
    } catch {
      // JSON 파싱 실패 시 null 유지
    }

    // Mock 데이터 생성
    let responseData;
    if (template.mockData) {
      console.log("Template mockData:", template.mockData);
      responseData = generateMockData(template.mockData as any);
      console.log("Generated responseData:", responseData);
    } else {
      responseData = { message: "No mock data available" };
    }

    // API 호출 로그 저장
    const responseTime = Date.now() - startTime;
    await prisma.apiLog.create({
      data: {
        templateId: template.id,
        requestBody,
        responseBody: responseData,
        statusCode: template.errorCode || 200,
        responseTime,
        userAgent: req.headers.get("user-agent") || null,
        ipAddress: req.headers.get("x-forwarded-for") || null,
      },
    });

    // 에러 코드가 설정되어 있으면 해당 코드로 응답
    if (template.errorCode) {
      return NextResponse.json(
        {
          error: "Custom error response",
          message: `Configured error code: ${template.errorCode}`,
          timestamp: new Date().toISOString(),
        },
        { status: template.errorCode }
      );
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("API 호출 오류:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateMockData(schema: any): any {
  // schema가 null이거나 undefined인 경우
  if (schema === null || schema === undefined) {
    return null;
  }

  // 배열인 경우
  if (Array.isArray(schema)) {
    console.log("Processing array:", schema);
    // 배열 자체가 mockData인 경우 그대로 반환
    // 첫 번째 요소가 타입 문자열이 아닌 경우 (예: "string", "number" 등이 아닌 경우)
    if (schema.length > 0 && !isTypeString(schema[0])) {
      console.log("Returning array as-is:", schema);
      return schema;
    }
    // 타입 배열인 경우 10개의 항목 생성
    console.log("Generating array from type:", schema[0]);
    return Array.from({ length: 10 }, () => generateMockData(schema[0]));
  }

  // 객체인 경우
  if (typeof schema === "object" && schema !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(schema)) {
      // 값이 null이거나 undefined인 경우 건너뛰기
      if (value === null || value === undefined) {
        continue;
      }

      // 사용자가 지정한 값이 문자열이고 타입이 아닌 경우 그 값을 그대로 사용
      if (typeof value === "string" && !isTypeString(value)) {
        result[key] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        // 숫자나 불린 값은 그대로 사용
        result[key] = value;
      } else {
        result[key] = generateMockData(value);
      }
    }
    return result;
  }

  // 기본 타입에 따른 Mock 데이터 생성
  switch (schema) {
    case "string":
      return faker.lorem.word();
    case "number":
      return faker.number.int({ min: 1, max: 1000 });
    case "boolean":
      return faker.datatype.boolean();
    case "email":
      return faker.internet.email();
    case "phone":
      return faker.phone.number();
    case "name":
      return faker.person.fullName();
    case "address":
      return faker.location.streetAddress();
    case "date":
      return faker.date.recent().toISOString();
    default:
      return faker.lorem.word();
  }
}

// 타입 문자열인지 확인하는 헬퍼 함수
function isTypeString(value: string): boolean {
  const typeStrings = [
    "string",
    "number",
    "boolean",
    "email",
    "phone",
    "name",
    "address",
    "date",
  ];
  return typeStrings.includes(value);
}
