import { NextRequest, NextResponse } from "next/server";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// JSON 완성도 검증 및 정리 함수
function validateAndCleanJSON(jsonString: string): {
  isValid: boolean;
  cleaned: string;
  error?: string;
} {
  try {
    // 기본적인 JSON 파싱 시도
    JSON.parse(jsonString);
    return { isValid: true, cleaned: jsonString };
  } catch (parseError) {
    console.log("JSON 파싱 실패, 정리 시도 중...");

    // 중괄호, 대괄호, 따옴표 개수 체크
    const openBraces = (jsonString.match(/\{/g) || []).length;
    const closeBraces = (jsonString.match(/\}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/\]/g) || []).length;
    const quotes = (jsonString.match(/"/g) || []).length;

    console.log("JSON 구조 분석:", {
      openBraces,
      closeBraces,
      openBrackets,
      closeBrackets,
      quotes,
      length: jsonString.length,
    });

    // JSON 정리 시도
    let cleaned = jsonString;

    // 1. 불필요한 공백과 개행 제거
    cleaned = cleaned
      .replace(/\r\n/g, "")
      .replace(/\n/g, "")
      .replace(/\r/g, "");

    // 2. 중괄호 균형 맞추기
    if (openBraces > closeBraces) {
      cleaned += "}".repeat(openBraces - closeBraces);
    } else if (closeBraces > openBraces) {
      cleaned = "{".repeat(closeBraces - openBraces) + cleaned;
    }

    // 3. 대괄호 균형 맞추기
    if (openBrackets > closeBrackets) {
      cleaned += "]".repeat(openBrackets - closeBrackets);
    } else if (closeBrackets > openBrackets) {
      cleaned = "[".repeat(closeBrackets - openBrackets) + cleaned;
    }

    // 4. 따옴표가 홀수인 경우 짝수로 맞추기
    if (quotes % 2 !== 0) {
      cleaned += '"';
    }

    // 5. JSON 시작과 끝 확인
    if (!cleaned.trim().startsWith("{")) {
      cleaned = "{" + cleaned;
    }
    if (!cleaned.trim().endsWith("}")) {
      cleaned = cleaned + "}";
    }

    // 6. 정리된 JSON 파싱 시도
    try {
      JSON.parse(cleaned);
      console.log("JSON 정리 성공");
      return { isValid: true, cleaned };
    } catch (finalError) {
      console.log("JSON 정리 후에도 파싱 실패:", finalError);
      return {
        isValid: false,
        cleaned,
        error: `JSON 정리 실패: ${
          finalError instanceof Error ? finalError.message : "Unknown error"
        }`,
      };
    }
  }
}

// 스트림 데이터에서 JSON 추출 함수
function extractJSONFromStream(content: string): string | null {
  // JSON 객체 패턴 찾기
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // 배열 패턴 찾기
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiName, method, url, description } = body;

    const llmServiceUrl =
      process.env.LLM_SERVICE_URL || "http://localhost:8000";

    // 스트리밍 모드: SSE 응답
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 시작 메시지 전송
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "start",
                  message: "AI 필드 생성 시작...",
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            );
          } catch (controllerError) {
            console.error("컨트롤러 시작 메시지 전송 실패:", controllerError);
          }

          // LLM 서비스에 스트리밍 요청 (타임아웃 3분으로 설정)
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 180000); // 3분

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
                  model: "exaone-4.0-1.2b",
                  messages: [
                    {
                      role: "system",
                      content:
                        "당신은 API 설계자입니다. API 요청/응답 필드를 생성하는 전문가입니다. JSON 형식으로만 응답해주세요.",
                    },
                    {
                      role: "user",
                      content: `다음 API 정보를 바탕으로 요청 필드와 응답 필드를 생성해주세요.

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
JSON 형식으로만 응답해주세요.`,
                    },
                  ],
                  max_tokens: 1000,
                  temperature: 0.2,
                  stream: true,
                }),
                signal: abortController.signal,
              }
            );

            // 타임아웃 클리어
            clearTimeout(timeoutId);

            if (!response.ok) {
              throw new Error(`LLM 서비스 오류: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("스트림을 읽을 수 없습니다.");
            }

            let fullResponse = "";
            let isFirstChunk = true;
            let jsonBuffer = "";

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
                      break;
                    }

                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.choices?.[0]?.delta?.content) {
                        const content = parsed.choices[0].delta.content;
                        fullResponse += content;
                        jsonBuffer += content;

                        // 첫 번째 청크가 아닌 경우에만 진행 상황 전송
                        if (!isFirstChunk) {
                          try {
                            // 컨트롤러가 아직 열려있는지 확인
                            if (
                              controller &&
                              typeof controller.enqueue === "function"
                            ) {
                              controller.enqueue(
                                encoder.encode(
                                  `data: ${JSON.stringify({
                                    type: "progress",
                                    content: content,
                                    timestamp: new Date().toISOString(),
                                  })}\n\n`
                                )
                              );
                            }
                          } catch (controllerError) {
                            console.error(
                              "컨트롤러 진행 상황 전송 실패:",
                              controllerError
                            );
                          }
                        }
                        isFirstChunk = false;
                      }
                    } catch (e) {
                      // JSON 파싱 실패 시 무시
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }

            // 완료 메시지 전송
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "complete",
                    message: "AI 필드 생성 완료",
                    timestamp: new Date().toISOString(),
                  })}\n\n`
                )
              );
            } catch (controllerError) {
              console.error("컨트롤러 완료 메시지 전송 실패:", controllerError);
            }

            // 생성된 필드 파싱 및 전송
            try {
              console.log("원본 응답 길이:", fullResponse.length);
              console.log(
                "원본 응답 미리보기:",
                fullResponse.substring(0, 200) + "..."
              );

              // JSON 추출 시도
              let jsonContent = extractJSONFromStream(fullResponse);
              if (!jsonContent) {
                jsonContent = fullResponse;
              }

              // JSON 완성도 검증 및 정리
              const validation = validateAndCleanJSON(jsonContent);

              if (!validation.isValid) {
                console.log("JSON 검증 실패:", validation.error);
                throw new Error(validation.error || "JSON이 완전하지 않습니다");
              }

              const generatedFields = JSON.parse(validation.cleaned);

              // 필드 검증 및 정리
              const validatedFields = {
                requestFields: Array.isArray(generatedFields.requestFields)
                  ? generatedFields.requestFields.filter(
                      (f) => f.name && f.type
                    )
                  : [],
                responseFields: Array.isArray(generatedFields.responseFields)
                  ? generatedFields.responseFields.filter(
                      (f) => f.name && f.type
                    )
                  : [],
              };

              // 기본 필드가 없는 경우 기본값 추가
              if (validatedFields.responseFields.length === 0) {
                validatedFields.responseFields = [
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
                ];
              }

              try {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "fields",
                      fields: validatedFields,
                      aiGenerated: true,
                      timestamp: new Date().toISOString(),
                    })}\n\n`
                  )
                );
              } catch (controllerError) {
                console.error("컨트롤러 성공 필드 전송 실패:", controllerError);
              }
            } catch (parseError) {
              console.error("생성된 응답 파싱 실패:", parseError);

              // 파싱 실패 시 기본 필드 전송
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

              try {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "fields",
                      fields: defaultFields,
                      aiGenerated: false,
                      message: "AI 응답 파싱 실패로 기본 필드를 생성했습니다.",
                      timestamp: new Date().toISOString(),
                    })}\n\n`
                  )
                );
              } catch (controllerError) {
                console.error("컨트롤러 기본 필드 전송 실패:", controllerError);
              }
            }
          } catch (fetchError) {
            console.error("LLM 서비스 요청 오류:", fetchError);

            // 타임아웃 클리어
            clearTimeout(timeoutId);

            // OpenAI API로 폴백 시도
            try {
              console.log("OpenAI API로 폴백 시도 중...");

              const openaiResponse = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                  },
                  body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                      {
                        role: "system",
                        content:
                          "당신은 API 설계자입니다. API 요청/응답 필드를 생성하는 전문가입니다. JSON 형식으로만 응답해주세요.",
                      },
                      {
                        role: "user",
                        content: `다음 API 정보를 바탕으로 요청 필드와 응답 필드를 생성해주세요.

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
JSON 형식으로만 응답해주세요.`,
                      },
                    ],
                    max_tokens: 1000,
                    temperature: 0.2,
                  }),
                }
              );

              if (openaiResponse.ok) {
                const openaiResult = await openaiResponse.json();
                const content = openaiResult.choices[0]?.message?.content;

                if (content) {
                  try {
                    const generatedFields = JSON.parse(content) as Record<
                      string,
                      unknown
                    >;

                    // 필드 검증 및 정리
                    const validatedFields = {
                      requestFields: Array.isArray(
                        generatedFields.requestFields
                      )
                        ? generatedFields.requestFields.filter(
                            (f) => f.name && f.type
                          )
                        : [],
                      responseFields: Array.isArray(
                        generatedFields.responseFields
                      )
                        ? generatedFields.responseFields.filter(
                            (f) => f.name && f.type
                          )
                        : [],
                    };

                    // 기본 필드가 없는 경우 기본값 추가
                    if (validatedFields.responseFields.length === 0) {
                      validatedFields.responseFields = [
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
                      ];
                    }

                    // OpenAI로 생성된 필드 전송
                    try {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: "fields",
                            fields: validatedFields,
                            aiGenerated: true,
                            message:
                              "OpenAI API로 폴백하여 필드를 생성했습니다.",
                            timestamp: new Date().toISOString(),
                          })}\n\n`
                        )
                      );
                    } catch (controllerError) {
                      console.error(
                        "컨트롤러 OpenAI 필드 전송 실패:",
                        controllerError
                      );
                    }
                  } catch (parseError) {
                    console.error("OpenAI 응답 파싱 실패:", parseError);
                    throw new Error("OpenAI 응답 파싱 실패");
                  }
                } else {
                  throw new Error("OpenAI 응답 내용이 없습니다.");
                }
              } else {
                throw new Error(`OpenAI API 오류: ${openaiResponse.status}`);
              }
            } catch (openaiError) {
              console.error("OpenAI API 폴백 실패:", openaiError);

              // OpenAI도 실패하면 기본 필드 전송
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

              try {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "error",
                      message:
                        "LLM 서비스와 OpenAI API 모두 실패하여 기본 필드를 생성했습니다.",
                      fields: defaultFields,
                      aiGenerated: false,
                      timestamp: new Date().toISOString(),
                    })}\n\n`
                  )
                );
              } catch (controllerError) {
                console.error("컨트롤러 기본 필드 전송 실패:", controllerError);
              }
            }
          }
        } catch (error) {
          console.error("스트리밍 오류:", error);

          // 오류 발생 시 기본 필드 전송
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

          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  message: "AI 필드 생성 중 오류가 발생했습니다.",
                  fields: defaultFields,
                  aiGenerated: false,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            );
          } catch (controllerError) {
            console.error("컨트롤러 오류 전송 실패:", controllerError);
          }
        } finally {
          try {
            // 컨트롤러가 이미 닫혀있지 않은 경우에만 닫기
            if (controller && typeof controller.close === "function") {
              controller.close();
            }
          } catch (closeError) {
            console.error("컨트롤러 닫기 오류:", closeError);
          }
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
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      {
        error: {
          message: "API 호출 중 오류가 발생했습니다.",
          type: "api_error",
        },
      },
      { status: 500 }
    );
  }
}
