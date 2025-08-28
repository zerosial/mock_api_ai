"use client";

import React, { useState, useRef, useEffect } from "react";
import { withBasePath } from "@/lib/basePath";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LLMStatus {
  isHealthy: boolean;
  lastChecked: Date | null;
}

export default function LLMChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LLMStatus>({
    isHealthy: false,
    lastChecked: null,
  });
  const [model, setModel] = useState("exaone-4.0-1.2b");
  const [maxTokens, setMaxTokens] = useState(500);
  const [temperature, setTemperature] = useState(0.7);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // LLM 서비스 상태 확인
  const checkLLMHealth = async () => {
    try {
      const response = await fetch(withBasePath("/api/llm/health"));
      if (response.ok) {
        const data = await response.json();
        console.log("data", data);
        setLlmStatus({
          isHealthy: data.status,
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      console.error("LLM 상태 확인 실패:", error);
      setLlmStatus({
        isHealthy: false,
        lastChecked: new Date(),
      });
    }
  };

  useEffect(() => {
    // 첫 진입 시 즉시 health 체크
    checkLLMHealth();

    // 첫 진입 후에는 3분(180초)마다 체크
    const interval = setInterval(checkLLMHealth, 180000); // 3분마다 체크

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingResponse("");

    if (isStreaming) {
      // 스트리밍 모드
      await handleStreamingChat(userMessage.content);
    } else {
      // 일반 모드
      await handleNormalChat(userMessage.content);
    }
  };

  // 일반 채팅 (비스트리밍)
  const handleNormalChat = async (userContent: string) => {
    try {
      const response = await fetch(withBasePath("/api/llm"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: userContent }],
          max_tokens: maxTokens,
          temperature,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          role: "assistant",
          content:
            data.choices[0]?.message?.content || "응답을 받지 못했습니다.",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("채팅 오류:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 스트리밍 채팅
  const handleStreamingChat = async (userContent: string) => {
    try {
      const response = await fetch(withBasePath("/api/llm"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: userContent }],
          max_tokens: maxTokens,
          temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("스트림을 읽을 수 없습니다.");
      }

      let accumulatedContent = "";
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                // 스트리밍 완료
                const assistantMessage: Message = {
                  role: "assistant",
                  content: accumulatedContent,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setStreamingResponse("");
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices?.[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content;
                  accumulatedContent += content;
                  setStreamingResponse(accumulatedContent);
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
    } catch (error) {
      console.error("스트리밍 채팅 오류:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "스트리밍 중 오류가 발생했습니다. 다시 시도해주세요.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingResponse("");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
          <h1 className="text-2xl font-bold mb-2">AI 채팅</h1>
          <p className="text-blue-100">
            로컬 LLM과 대화하세요. 스트리밍 모드로 실시간 응답을 받을 수
            있습니다.
          </p>
        </div>

        {/* 설정 패널 */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                모델
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="exaone-4.0-1.2b">ExaOne 4.0 (1.2B)</option>
                <option value="lg-exaone">LG ExaOne</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                최대 토큰
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                min="1"
                max="4000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                창의성 (Temperature)
              </label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                응답 모드
              </label>
              <div className="flex items-center space-x-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!isStreaming}
                    onChange={() => setIsStreaming(false)}
                    className="mr-2"
                  />
                  <span className="text-sm">일반</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={isStreaming}
                    onChange={() => setIsStreaming(true)}
                    className="mr-2"
                  />
                  <span className="text-sm">스트리밍</span>
                </label>
              </div>
            </div>
          </div>

          {/* LLM 상태 표시 */}
          <div className="mt-4 flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  llmStatus.isHealthy ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-600">
                LLM 서비스: {llmStatus.isHealthy ? "정상" : "오류"}
              </span>
            </div>
            {llmStatus.lastChecked && (
              <span className="text-sm text-gray-500">
                마지막 확인: {llmStatus.lastChecked.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={checkLLMHealth}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              상태 새로고침
            </button>
          </div>
        </div>

        {/* 채팅 영역 */}
        <div className="p-6">
          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {/* 스트리밍 응답 표시 */}
            {isLoading && isStreaming && streamingResponse && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                  <div className="flex items-center space-x-2">
                    <span>{streamingResponse}</span>
                    <div className="animate-pulse">
                      <span className="inline-block w-2 h-4 bg-gray-400 rounded"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 로딩 표시 */}
            {isLoading && !isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 text-gray-800">
                  <div className="flex items-center space-x-2">
                    <span>생각 중...</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 입력 폼 */}
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? "전송 중..." : "전송"}
            </button>
          </form>

          {/* 모드 설명 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">응답 모드 설명</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                <strong>일반 모드:</strong> 전체 응답을 받은 후 한 번에
                표시됩니다.
              </p>
              <p>
                <strong>스트리밍 모드:</strong> 응답을 실시간으로 받아가며
                표시됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
