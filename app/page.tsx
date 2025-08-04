"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Template {
  id: number;
  project: string;
  user: string;
  apiName: string;
  method: string;
  apiUrl: string;
  createdAt: string;
  _count: {
    apiLogs: number;
  };
}

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>(
    {}
  );
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/templates");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("템플릿 조회 오류:", error);
      setError("템플릿을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const retryFetch = () => {
    fetchTemplates();
  };

  const testApi = async (
    template: Template,
    method: "GET" | "POST" | "PUT" | "DELETE"
  ) => {
    const testKey = `${template.id}-${method}`;

    try {
      setTesting((prev) => ({ ...prev, [testKey]: true }));
      setTestResults((prev) => ({ ...prev, [testKey]: { success: false } }));

      const url = `/api/${template.project}/${template.user}${template.apiUrl}`;

      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      // POST, PUT 요청의 경우 샘플 데이터 추가
      if (method === "POST" || method === "PUT") {
        options.body = JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          sampleData: `${method} 테스트 데이터`,
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
      console.error(`${method} 테스트 오류:`, error);
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

  const getTestResult = (
    template: Template,
    method: "GET" | "POST" | "PUT" | "DELETE"
  ) => {
    const testKey = `${template.id}-${method}`;
    return testResults[testKey];
  };

  const isTesting = (
    template: Template,
    method: "GET" | "POST" | "PUT" | "DELETE"
  ) => {
    const testKey = `${template.id}-${method}`;
    return testing[testKey] || false;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI API 생성기
          </h1>
          <p className="text-gray-600">
            AI를 활용하여 Mock API를 생성하고 관리하세요
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="mb-8 flex space-x-4">
          <Link
            href="/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            새 API 생성 (랜덤 값)
          </Link>
          <Link
            href="/create-custom"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            커스텀 API 생성 (AI 값 생성)
          </Link>
          <Link
            href="/create-json"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            JSON으로 API 생성
          </Link>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">오류</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={retryFetch}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 템플릿 목록 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              생성된 API 목록
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              AI로 생성된 API 템플릿들을 확인하고 관리하세요
            </p>
          </div>

          {loading ? (
            <div className="px-4 py-5 sm:px-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : templates.length === 0 ? (
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
              <p className="text-gray-500 mb-4">아직 생성된 API가 없습니다.</p>
              <Link
                href="/create"
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                첫 번째 API 생성하기
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {templates.map((template) => (
                <li key={template.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            template.method === "GET"
                              ? "bg-green-100 text-green-800"
                              : template.method === "POST"
                              ? "bg-blue-100 text-blue-800"
                              : template.method === "PUT"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {template.method}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {template.apiName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {template.project} / {template.user} /{" "}
                          {template.apiUrl}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        호출: {template._count.apiLogs}회
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex space-x-2">
                        {/* GET API인 경우에만 GET 테스트 버튼 표시 */}
                        {template.method === "GET" && (
                          <button
                            onClick={() => testApi(template, "GET")}
                            disabled={isTesting(template, "GET")}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                              isTesting(template, "GET")
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {isTesting(template, "GET")
                              ? "로딩 중..."
                              : "GET 테스트"}
                          </button>
                        )}

                        {/* POST API인 경우에만 POST 테스트 버튼 표시 */}
                        {template.method === "POST" && (
                          <button
                            onClick={() => testApi(template, "POST")}
                            disabled={isTesting(template, "POST")}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                              isTesting(template, "POST")
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            }`}
                          >
                            {isTesting(template, "POST")
                              ? "로딩 중..."
                              : "POST 테스트"}
                          </button>
                        )}

                        {/* PUT API인 경우에만 PUT 테스트 버튼 표시 */}
                        {template.method === "PUT" && (
                          <button
                            onClick={() => testApi(template, "PUT")}
                            disabled={isTesting(template, "PUT")}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                              isTesting(template, "PUT")
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            }`}
                          >
                            {isTesting(template, "PUT")
                              ? "로딩 중..."
                              : "PUT 테스트"}
                          </button>
                        )}

                        {/* DELETE API인 경우에만 DELETE 테스트 버튼 표시 */}
                        {template.method === "DELETE" && (
                          <button
                            onClick={() => testApi(template, "DELETE")}
                            disabled={isTesting(template, "DELETE")}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                              isTesting(template, "DELETE")
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                          >
                            {isTesting(template, "DELETE")
                              ? "로딩 중..."
                              : "DELETE 테스트"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 테스트 결과 표시 */}
                  <div className="mt-3 space-y-2">
                    {/* GET 테스트 결과 */}
                    {template.method === "GET" &&
                      getTestResult(template, "GET") && (
                        <div
                          className={`p-2 rounded text-xs ${
                            getTestResult(template, "GET")?.success
                              ? "bg-green-50 border border-green-200"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <div className="font-medium mb-1">
                            GET 테스트 결과:
                            {getTestResult(template, "GET")?.success ? (
                              <span className="text-green-700 ml-1">성공</span>
                            ) : (
                              <span className="text-red-700 ml-1">실패</span>
                            )}
                          </div>
                          {getTestResult(template, "GET")?.error && (
                            <div className="text-red-600">
                              {getTestResult(template, "GET")?.error}
                            </div>
                          )}
                          {getTestResult(template, "GET")?.data && (
                            <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                              {String(
                                JSON.stringify(
                                  getTestResult(template, "GET")?.data,
                                  null,
                                  2
                                )
                              )}
                            </pre>
                          )}
                        </div>
                      )}

                    {/* POST 테스트 결과 */}
                    {template.method === "POST" &&
                      getTestResult(template, "POST") && (
                        <div
                          className={`p-2 rounded text-xs ${
                            getTestResult(template, "POST")?.success
                              ? "bg-green-50 border border-green-200"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <div className="font-medium mb-1">
                            POST 테스트 결과:
                            {getTestResult(template, "POST")?.success ? (
                              <span className="text-green-700 ml-1">성공</span>
                            ) : (
                              <span className="text-red-700 ml-1">실패</span>
                            )}
                          </div>
                          {getTestResult(template, "POST")?.error && (
                            <div className="text-red-600">
                              {getTestResult(template, "POST")?.error}
                            </div>
                          )}
                          {getTestResult(template, "POST")?.data && (
                            <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                              {String(
                                JSON.stringify(
                                  getTestResult(template, "POST")?.data,
                                  null,
                                  2
                                )
                              )}
                            </pre>
                          )}
                        </div>
                      )}

                    {/* PUT 테스트 결과 */}
                    {template.method === "PUT" &&
                      getTestResult(template, "PUT") && (
                        <div
                          className={`p-2 rounded text-xs ${
                            getTestResult(template, "PUT")?.success
                              ? "bg-green-50 border border-green-200"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <div className="font-medium mb-1">
                            PUT 테스트 결과:
                            {getTestResult(template, "PUT")?.success ? (
                              <span className="text-green-700 ml-1">성공</span>
                            ) : (
                              <span className="text-red-700 ml-1">실패</span>
                            )}
                          </div>
                          {getTestResult(template, "PUT")?.error && (
                            <div className="text-red-600">
                              {getTestResult(template, "PUT")?.error}
                            </div>
                          )}
                          {getTestResult(template, "PUT")?.data && (
                            <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                              {String(
                                JSON.stringify(
                                  getTestResult(template, "PUT")?.data,
                                  null,
                                  2
                                )
                              )}
                            </pre>
                          )}
                        </div>
                      )}

                    {/* DELETE 테스트 결과 */}
                    {template.method === "DELETE" &&
                      getTestResult(template, "DELETE") && (
                        <div
                          className={`p-2 rounded text-xs ${
                            getTestResult(template, "DELETE")?.success
                              ? "bg-green-50 border border-green-200"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <div className="font-medium mb-1">
                            DELETE 테스트 결과:
                            {getTestResult(template, "DELETE")?.success ? (
                              <span className="text-green-700 ml-1">성공</span>
                            ) : (
                              <span className="text-red-700 ml-1">실패</span>
                            )}
                          </div>
                          {getTestResult(template, "DELETE")?.error && (
                            <div className="text-red-600">
                              {getTestResult(template, "DELETE")?.error}
                            </div>
                          )}
                          {getTestResult(template, "DELETE")?.data && (
                            <pre className="text-xs bg-gray-100 p-1 rounded overflow-x-auto">
                              {String(
                                JSON.stringify(
                                  getTestResult(template, "DELETE")?.data,
                                  null,
                                  2
                                )
                              )}
                            </pre>
                          )}
                        </div>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
