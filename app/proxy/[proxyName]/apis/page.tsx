"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ProxyMockApi {
  id: number;
  path: string;
  method: string;
  apiName: string;
  mockData: Record<string, unknown>;
  delayMs: number;
  errorCode: number | null;
  isActive: boolean;
  createdAt: string;
  requestSpec?: Record<string, unknown>; // 추가: 요청 스펙
}

interface ProxyServer {
  id: number;
  name: string;
  targetUrl: string;
  description: string | null;
}

export default function ProxyMockApisPage() {
  const params = useParams();
  const proxyName = params.proxyName as string;

  const [proxyServer, setProxyServer] = useState<ProxyServer | null>(null);
  const [mockApis, setMockApis] = useState<ProxyMockApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<
      string,
      {
        success: boolean;
        data?: unknown;
        error?: string;
      }
    >
  >({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [expandedMockData, setExpandedMockData] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    fetchData();
  }, [proxyName]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 프록시 서버 정보 조회
      const proxyResponse = await fetch("/api/proxy");
      if (!proxyResponse.ok) {
        throw new Error(`HTTP error! status: ${proxyResponse.status}`);
      }

      const proxyServers = await proxyResponse.json();
      const server = proxyServers.find(
        (p: ProxyServer) => p.name === proxyName
      );

      if (!server) {
        setError("프록시 서버를 찾을 수 없습니다.");
        return;
      }

      setProxyServer(server);

      // Mock API 목록 조회
      const mockApisResponse = await fetch(`/api/proxy/${proxyName}/apis`);
      if (!mockApisResponse.ok) {
        throw new Error(`Mock API 조회 실패: ${mockApisResponse.status}`);
      }

      const mockApisData = await mockApisResponse.json();
      setMockApis(mockApisData);
    } catch (error) {
      console.error("데이터 조회 오류:", error);
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const testApi = async (mockApi: ProxyMockApi) => {
    const testKey = `${mockApi.id}-${mockApi.method}`;

    try {
      setTesting((prev) => ({ ...prev, [testKey]: true }));
      setTestResults((prev) => ({ ...prev, [testKey]: { success: false } }));

      const url = `/api/proxy/${proxyName}${mockApi.path}`;

      const options: RequestInit = {
        method: mockApi.method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      // POST, PUT 요청의 경우 샘플 데이터 추가
      if (mockApi.method === "POST" || mockApi.method === "PUT") {
        options.body = JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          sampleData: `${mockApi.method} 테스트 데이터`,
        });
      }

      const response = await fetch(url, options);
      const data = await response.json();

      setTestResults((prev) => ({
        ...prev,
        [testKey]: {
          success: response.ok,
          data: data,
          error: response.ok
            ? undefined
            : `HTTP ${response.status}: ${data.message || "알 수 없는 오류"}`,
        },
      }));
    } catch (error) {
      console.error(`${mockApi.method} 테스트 오류:`, error);
      setTestResults((prev) => ({
        ...prev,
        [testKey]: {
          success: false,
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [testKey]: false }));
    }
  };

  const getTestResult = (mockApi: ProxyMockApi) => {
    const testKey = `${mockApi.id}-${mockApi.method}`;
    return testResults[testKey];
  };

  const isTesting = (mockApi: ProxyMockApi) => {
    const testKey = `${mockApi.id}-${mockApi.method}`;
    return testing[testKey] || false;
  };

  // Mock API 삭제
  const deleteMockApi = async (mockApi: ProxyMockApi) => {
    if (!confirm(`정말로 "${mockApi.apiName}" Mock API를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch("/api/proxy/mock/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mockApiId: mockApi.id }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert("Mock API가 성공적으로 삭제되었습니다.");
        // 목록에서 제거
        setMockApis((prev) => prev.filter((api) => api.id !== mockApi.id));
      } else {
        throw new Error(result.error || "Mock API 삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Mock API 삭제 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Mock API 삭제 중 오류가 발생했습니다."
      );
    }
  };

  // Mock API 활성화/비활성화 토글
  const toggleMockApi = async (mockApi: ProxyMockApi) => {
    try {
      const response = await fetch("/api/proxy/mock/toggle", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mockApiId: mockApi.id,
          isActive: !mockApi.isActive,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(result.message);
        // 목록 업데이트
        setMockApis((prev) =>
          prev.map((api) =>
            api.id === mockApi.id ? { ...api, isActive: !api.isActive } : api
          )
        );
      } else {
        throw new Error(result.error || "Mock API 상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error("Mock API 상태 변경 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Mock API 상태 변경 중 오류가 발생했습니다."
      );
    }
  };

  // Mock 데이터 표시 토글
  const toggleMockData = (mockApiId: string) => {
    setExpandedMockData((prev) => ({
      ...prev,
      [mockApiId]: !prev[mockApiId],
    }));
  };

  // JSON 데이터를 깔끔하게 포맷팅
  const formatJson = (data: unknown): string => {
    if (!data) return "데이터 없음";

    try {
      let parsedData: unknown;

      // 문자열인 경우 JSON 파싱 시도
      if (typeof data === "string") {
        try {
          parsedData = JSON.parse(data);
        } catch {
          // JSON 파싱 실패 시 일반 문자열로 처리
          return data;
        }
      } else {
        parsedData = data;
      }

      // 이미 객체인 경우 그대로 사용
      return JSON.stringify(parsedData, null, 2);
    } catch (error) {
      console.error("JSON 포맷팅 오류:", error);
      return String(data);
    }
  };

  const copyApiUrl = (mockApi: ProxyMockApi) => {
    const apiUrl = `/api/proxy/${proxyName}${mockApi.path}`;
    const fullUrl = `${window.location.origin}${apiUrl}`;

    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        alert("API URL이 클립보드에 복사되었습니다.");
      })
      .catch(() => {
        alert("클립보드 복사에 실패했습니다.");
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !proxyServer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">오류 발생</h3>
          <p className="text-gray-600 mb-4">
            {error || "프록시 서버를 찾을 수 없습니다."}
          </p>
          <Link
            href="/proxy"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            프록시 서버 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Mock API 목록
              </h1>
              <p className="text-gray-600">
                프록시 서버 <span className="font-semibold">{proxyName}</span>의
                Mock API들을 관리하세요
              </p>
              <p className="text-sm text-gray-500 mt-1">
                목표 서버: {proxyServer.targetUrl}
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/proxy/${proxyName}/create`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
              >
                ➕ 새 Mock API 생성
              </Link>
              <Link
                href="/proxy"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                ← 프록시 서버 목록
              </Link>
            </div>
          </div>
        </div>

        {/* Mock API 목록 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Mock API 목록
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              생성된 Mock API들을 확인하고 테스트하세요
            </p>
          </div>

          {mockApis.length === 0 ? (
            <div className="px-4 py-5 sm:px-6 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 mb-4">
                아직 생성된 Mock API가 없습니다.
              </p>
              <Link
                href={`/proxy/${proxyName}/create`}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                첫 번째 Mock API 생성하기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {mockApis.map((mockApi) => (
                <li key={mockApi.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            mockApi.method === "GET"
                              ? "bg-green-100 text-green-800"
                              : mockApi.method === "POST"
                              ? "bg-blue-100 text-blue-800"
                              : mockApi.method === "PUT"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {mockApi.method}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {mockApi.apiName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {mockApi.path}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {mockApi.delayMs > 0 && (
                            <span className="text-orange-600 mr-3">
                              ⏱️ 지연: {mockApi.delayMs}ms
                            </span>
                          )}
                          {mockApi.errorCode && (
                            <span className="text-red-600">
                              ❌ 에러: {mockApi.errorCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        {new Date(mockApi.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex space-x-2">
                        {/* Mock 데이터 보기 버튼 */}
                        <button
                          onClick={() => toggleMockData(`${mockApi.id}`)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                        >
                          {expandedMockData[`${mockApi.id}`]
                            ? "📖 데이터 숨기기"
                            : "👁️ 데이터 보기"}
                        </button>

                        {/* API URL 복사 버튼 */}
                        <button
                          onClick={() => copyApiUrl(mockApi)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        >
                          📋 URL 복사
                        </button>

                        {/* Mock API 활성화/비활성화 토글 */}
                        <button
                          onClick={() => toggleMockApi(mockApi)}
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                            mockApi.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {mockApi.isActive ? "🟢 ON" : "⚫ OFF"}
                        </button>

                        {/* Mock API 삭제 버튼 */}
                        <button
                          onClick={() => deleteMockApi(mockApi)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          🗑️ 삭제
                        </button>

                        {/* API 테스트 버튼 */}
                        <button
                          onClick={() => testApi(mockApi)}
                          disabled={isTesting(mockApi)}
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                            isTesting(mockApi)
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {isTesting(mockApi) ? "로딩 중..." : "테스트"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 테스트 결과 표시 */}
                  {getTestResult(mockApi) && (
                    <div className="mt-3">
                      <div
                        className={`p-2 rounded text-xs ${
                          getTestResult(mockApi)?.success
                            ? "bg-green-50 border border-green-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        <div className="font-medium mb-1">
                          테스트 결과:
                          {getTestResult(mockApi)?.success ? (
                            <span className="text-green-700 ml-1">성공</span>
                          ) : (
                            <span className="text-red-700 ml-1">실패</span>
                          )}
                        </div>
                        {getTestResult(mockApi)?.error && (
                          <div className="text-red-600">
                            {getTestResult(mockApi)?.error}
                          </div>
                        )}
                        {getTestResult(mockApi)?.data !== undefined && (
                          <div>
                            <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                              {(() => {
                                try {
                                  return JSON.stringify(
                                    getTestResult(mockApi)?.data,
                                    null,
                                    2
                                  );
                                } catch {
                                  return String(
                                    getTestResult(mockApi)?.data || ""
                                  );
                                }
                              })()}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mock 데이터 표시 영역 */}
                  {expandedMockData[`${mockApi.id}`] && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          📊 저장된 Mock 데이터
                        </h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            mockApi.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {mockApi.isActive ? "활성화됨" : "비활성화됨"}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* 요청 스펙 */}
                        {mockApi.requestSpec && (
                          <div>
                            <h5 className="text-xs font-medium text-gray-700 mb-1">
                              📝 요청 스펙:
                            </h5>
                            <pre className="text-xs bg-white p-2 rounded border overflow-x-auto max-h-32 overflow-y-auto">
                              {formatJson(mockApi.requestSpec)}
                            </pre>
                          </div>
                        )}

                        {/* 응답 데이터 */}
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 mb-1">
                            📤 응답 데이터:
                          </h5>
                          <pre className="text-xs bg-white p-2 rounded border overflow-x-auto max-h-32 overflow-y-auto">
                            {formatJson(mockApi.mockData)}
                          </pre>
                        </div>

                        {/* 설정 정보 */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="font-medium text-gray-700">
                              지연 시간:
                            </span>
                            <span className="ml-1 text-gray-600">
                              {mockApi.delayMs > 0
                                ? `${mockApi.delayMs}ms`
                                : "없음"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              에러 코드:
                            </span>
                            <span className="ml-1 text-gray-600">
                              {mockApi.errorCode || "없음"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
