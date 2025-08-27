"use client";

import React, { useState, useRef, useEffect } from "react";
import { withBasePath } from "@/lib/basePath";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface LLMServiceStatus {
  status: string;
  llm_service?: {
    status: string;
    model_loaded: boolean;
    model_name?: string;
  };
  error?: string;
}

export default function LLMChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<LLMServiceStatus | null>(
    null
  );
  const [model, setModel] = useState("exaone-4.0-1.2b");
  const [maxTokens, setMaxTokens] = useState(500);
  const [temperature, setTemperature] = useState(0.7);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 서비스 상태 확인
  useEffect(() => {
    checkServiceStatus();
  }, []);

  // 메시지가 추가될 때마다 스크롤을 아래로 이동
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const checkServiceStatus = async () => {
    try {
      const response = await fetch(withBasePath("/api/llm/health"));
      const data = await response.json();
      setServiceStatus(data);
    } catch (error) {
      console.error("서비스 상태 확인 실패:", error);
      setServiceStatus({
        status: "unhealthy",
        error: "서비스 상태를 확인할 수 없습니다.",
      });
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(withBasePath("/api/llm"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            ...messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: "user", content: inputMessage },
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.choices[0].message.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "죄송합니다. 메시지를 처리하는 중 오류가 발생했습니다.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <h2 className="text-xl font-bold">로컬 LLM 채팅</h2>
          <div className="flex items-center space-x-4 mt-2 text-sm">
            <span
              className={`px-2 py-1 rounded ${
                serviceStatus?.status === "healthy"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            >
              {serviceStatus?.status === "healthy" ? "연결됨" : "연결 안됨"}
            </span>
            {serviceStatus?.llm_service?.model_name && (
              <span>모델: {serviceStatus.llm_service.model_name}</span>
            )}
          </div>
        </div>

        {/* 설정 패널 */}
        <div className="bg-gray-50 p-4 border-b">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                모델
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="exaone-4.0-1.2b">EXAONE 4.0 1.2B</option>
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
                min="100"
                max="4096"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                창의성 (Temperature)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{temperature}</span>
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="h-96 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">메시지를 입력하여 대화를 시작하세요!</p>
              <p className="text-sm mt-2">
                로컬에서 실행 중인 AI 모델과 대화할 수 있습니다.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-800 border"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-white text-gray-800 border px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">
                    AI가 응답을 생성하고 있습니다...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="p-4 bg-white border-t">
          <div className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              전송
            </button>
            <button
              onClick={clearChat}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {/* 서비스 상태 상세 정보 */}
      {serviceStatus && (
        <div className="mt-4 bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-2">서비스 상태</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p>
                <strong>상태:</strong> {serviceStatus.status}
              </p>
              {serviceStatus.llm_service && (
                <>
                  <p>
                    <strong>LLM 서비스:</strong>{" "}
                    {serviceStatus.llm_service.status}
                  </p>
                  <p>
                    <strong>모델 로드:</strong>{" "}
                    {serviceStatus.llm_service.model_loaded ? "완료" : "실패"}
                  </p>
                  {serviceStatus.llm_service.model_name && (
                    <p>
                      <strong>모델명:</strong>{" "}
                      {serviceStatus.llm_service.model_name}
                    </p>
                  )}
                </>
              )}
            </div>
            <div>
              {serviceStatus.error && (
                <p className="text-red-600">
                  <strong>오류:</strong> {serviceStatus.error}
                </p>
              )}
              <button
                onClick={checkServiceStatus}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
              >
                상태 새로고침
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
