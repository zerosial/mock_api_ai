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
      responseData = generateMockData(template.mockData as any);
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
        statusCode: 200,
        responseTime,
        userAgent: req.headers.get("user-agent") || null,
        ipAddress: req.headers.get("x-forwarded-for") || null,
      },
    });

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
  if (Array.isArray(schema)) {
    // 배열인 경우 10개의 항목 생성
    return Array.from({ length: 10 }, () => generateMockData(schema[0]));
  }

  if (typeof schema === "object" && schema !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(schema)) {
      result[key] = generateMockData(value);
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
