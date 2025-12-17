/**
 * Local LLM Service Client
 * OpenAI API와 호환되는 인터페이스로 로컬 LLM과 통신합니다.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LocalLLMClient {
  private baseUrl: string;
  private timeout: number;

  constructor(
    baseUrl: string = "http://localhost:8000",
    timeout: number = 300000
  ) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * 로컬 LLM 서비스의 상태를 확인합니다.
   */
  async healthCheck(): Promise<{
    status: string;
    model_loaded: boolean;
    model_name?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(
          `Health check failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Local LLM health check failed:", error);
      throw error;
    }
  }

  /**
   * 채팅 완성을 요청합니다.
   */
  async createChatCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Chat completion failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Local LLM chat completion failed:", error);
      throw error;
    }
  }

  /**
   * 간단한 텍스트 생성 요청을 처리합니다.
   */
  async generateText(
    prompt: string,
    maxTokens: number = 1000,
    temperature: number = 0.7
  ): Promise<string> {
    const request: ChatCompletionRequest = {
      model: "lg-exaone",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    };

    try {
      const response = await this.createChatCompletion(request);
      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("Text generation failed:", error);
      throw error;
    }
  }

  /**
   * OpenAI 클라이언트와 호환되는 인터페이스를 제공합니다.
   */
  get openaiCompatible() {
    return {
      chat: {
        completions: {
          create: (params: any) => this.createChatCompletion(params),
        },
      },
    };
  }
}

// 기본 인스턴스 생성
export const localLLM = new LocalLLMClient();

// 환경변수에서 URL을 가져오는 팩토리 함수
export function createLocalLLMClient(): LocalLLMClient {
  const baseUrl = process.env.LLM_SERVICE_URL || "http://localhost:8000";
  return new LocalLLMClient(baseUrl);
}
