"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface Template {
  id: number;
  project: string;
  user: string;
  apiName: string;
  method: string;
  apiUrl: string;
  delayMs: number;
  errorCode: number | null;
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

  // 필터 상태 추가
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");

  // 지연 시간 설정 상태
  const [delayModalOpen, setDelayModalOpen] = useState<number | null>(null);
  const [delayValue, setDelayValue] = useState<string>("");
  const [updatingDelay, setUpdatingDelay] = useState<number | null>(null);

  // 에러 코드 설정 상태
  const [errorCodeModalOpen, setErrorCodeModalOpen] = useState<number | null>(
    null
  );
  const [errorCodeValue, setErrorCodeValue] = useState<string>("");
  const [updatingErrorCode, setUpdatingErrorCode] = useState<number | null>(
    null
  );

  // 삭제 상태
  const [deleteModalOpen, setDeleteModalOpen] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

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

  // 필터링된 템플릿 계산
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesProject =
        !projectFilter ||
        template.project.toLowerCase().includes(projectFilter.toLowerCase());
      const matchesUser =
        !userFilter ||
        template.user.toLowerCase().includes(userFilter.toLowerCase());
      const matchesMethod = !methodFilter || template.method === methodFilter;

      return matchesProject && matchesUser && matchesMethod;
    });
  }, [templates, projectFilter, userFilter, methodFilter]);

  // 고유한 프로젝트명과 유저명 추출
  const uniqueProjects = useMemo(() => {
    return [...new Set(templates.map((t) => t.project))].sort();
  }, [templates]);

  const uniqueUsers = useMemo(() => {
    return [...new Set(templates.map((t) => t.user))].sort();
  }, [templates]);

  const uniqueMethods = useMemo(() => {
    return [...new Set(templates.map((t) => t.method))].sort();
  }, [templates]);

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

  // 필터 초기화 함수
  const clearFilters = () => {
    setProjectFilter("");
    setUserFilter("");
    setMethodFilter("");
  };

  // 지연 시간 설정 함수
  const setDelay = async (templateId: number) => {
    try {
      setUpdatingDelay(templateId);
      const delayMs = parseInt(delayValue);

      if (isNaN(delayMs) || delayMs < 0 || delayMs > 30000) {
        alert("지연 시간은 0-30000ms 사이여야 합니다.");
        return;
      }

      const response = await fetch(`/api/templates/${templateId}/delay`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ delayMs }),
      });

      if (!response.ok) {
        throw new Error("지연 시간 설정에 실패했습니다.");
      }

      // 템플릿 목록 새로고침
      await fetchTemplates();
      setDelayModalOpen(null);
      setDelayValue("");
    } catch (error) {
      console.error("지연 시간 설정 오류:", error);
      alert("지연 시간 설정 중 오류가 발생했습니다.");
    } finally {
      setUpdatingDelay(null);
    }
  };

  // 지연 시간 모달 열기
  const openDelayModal = (template: Template) => {
    setDelayModalOpen(template.id);
    setDelayValue(template.delayMs?.toString() || "0");
  };

  // 에러 코드 설정 함수
  const setErrorCode = async (templateId: number) => {
    try {
      setUpdatingErrorCode(templateId);
      const errorCode = errorCodeValue === "" ? null : parseInt(errorCodeValue);

      if (
        errorCode !== null &&
        (isNaN(errorCode) || errorCode < 100 || errorCode > 599)
      ) {
        alert("에러 코드는 100-599 사이의 숫자이거나 비워두어야 합니다.");
        return;
      }

      const response = await fetch(`/api/templates/${templateId}/error-code`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ errorCode }),
      });

      if (!response.ok) {
        throw new Error("에러 코드 설정에 실패했습니다.");
      }

      // 템플릿 목록 새로고침
      await fetchTemplates();
      setErrorCodeModalOpen(null);
      setErrorCodeValue("");
    } catch (error) {
      console.error("에러 코드 설정 오류:", error);
      alert("에러 코드 설정 중 오류가 발생했습니다.");
    } finally {
      setUpdatingErrorCode(null);
    }
  };

  // 에러 코드 모달 열기
  const openErrorCodeModal = (template: Template) => {
    setErrorCodeModalOpen(template.id);
    setErrorCodeValue(template.errorCode?.toString() || "");
  };

  // 삭제 함수
  const deleteTemplate = async (templateId: number) => {
    try {
      setDeleting(templateId);

      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("템플릿 삭제에 실패했습니다.");
      }

      // 템플릿 목록 새로고침
      await fetchTemplates();
      setDeleteModalOpen(null);
    } catch (error) {
      console.error("템플릿 삭제 오류:", error);
      alert("템플릿 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  // 삭제 모달 열기
  const openDeleteModal = (template: Template) => {
    setDeleteModalOpen(template.id);
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

        {/* 필터 섹션 */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">필터</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              필터 초기화
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 프로젝트 필터 */}
            <div>
              <label
                htmlFor="project-filter"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                프로젝트명
              </label>
              <select
                id="project-filter"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">모든 프로젝트</option>
                {uniqueProjects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>

            {/* 유저 필터 */}
            <div>
              <label
                htmlFor="user-filter"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                유저명
              </label>
              <select
                id="user-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">모든 유저</option>
                {uniqueUsers.map((user) => (
                  <option key={user} value={user}>
                    {user}
                  </option>
                ))}
              </select>
            </div>

            {/* HTTP 메서드 필터 */}
            <div>
              <label
                htmlFor="method-filter"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                HTTP 메서드
              </label>
              <select
                id="method-filter"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">모든 메서드</option>
                {uniqueMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 필터 결과 요약 */}
          <div className="mt-4 text-sm text-gray-600">
            총 {templates.length}개 중 {filteredTemplates.length}개 표시
            {(projectFilter || userFilter || methodFilter) && (
              <span className="ml-2 text-blue-600">(필터 적용됨)</span>
            )}
          </div>
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
          ) : filteredTemplates.length === 0 ? (
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
                {templates.length === 0
                  ? "아직 생성된 API가 없습니다."
                  : "필터 조건에 맞는 API가 없습니다."}
              </p>
              {templates.length === 0 ? (
                <Link
                  href="/create"
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                >
                  첫 번째 API 생성하기
                </Link>
              ) : (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  필터 초기화
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredTemplates.map((template) => (
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
                        <div className="text-xs text-gray-500 mt-1">
                          {template.delayMs > 0 && (
                            <span className="text-orange-600 mr-3">
                              ⏱️ 지연: {template.delayMs}ms
                            </span>
                          )}
                          {template.errorCode && (
                            <span className="text-red-600">
                              ❌ 에러: {template.errorCode}
                            </span>
                          )}
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
                        {/* 지연 시간 설정 버튼 */}
                        <button
                          onClick={() => openDelayModal(template)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                        >
                          ⏱️ 지연
                        </button>

                        {/* 에러 코드 설정 버튼 */}
                        <button
                          onClick={() => openErrorCodeModal(template)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          ❌ 에러
                        </button>

                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => openDeleteModal(template)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          🗑️ 삭제
                        </button>

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
                    {template.method === "GET" && (
                      <>
                        {isTesting(template, "GET") && (
                          <div className="p-2 rounded text-xs bg-blue-50 border border-blue-200">
                            <div className="font-medium mb-1 text-blue-700">
                              GET 테스트: 통신 중...
                            </div>
                          </div>
                        )}
                        {!isTesting(template, "GET") &&
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
                                  <span className="text-green-700 ml-1">
                                    성공
                                  </span>
                                ) : (
                                  <span className="text-red-700 ml-1">
                                    실패
                                  </span>
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
                      </>
                    )}

                    {/* POST 테스트 결과 */}
                    {template.method === "POST" && (
                      <>
                        {isTesting(template, "POST") && (
                          <div className="p-2 rounded text-xs bg-blue-50 border border-blue-200">
                            <div className="font-medium mb-1 text-blue-700">
                              POST 테스트: 통신 중...
                            </div>
                          </div>
                        )}
                        {!isTesting(template, "POST") &&
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
                                  <span className="text-green-700 ml-1">
                                    성공
                                  </span>
                                ) : (
                                  <span className="text-red-700 ml-1">
                                    실패
                                  </span>
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
                      </>
                    )}

                    {/* PUT 테스트 결과 */}
                    {template.method === "PUT" && (
                      <>
                        {isTesting(template, "PUT") && (
                          <div className="p-2 rounded text-xs bg-blue-50 border border-blue-200">
                            <div className="font-medium mb-1 text-blue-700">
                              PUT 테스트: 통신 중...
                            </div>
                          </div>
                        )}
                        {!isTesting(template, "PUT") &&
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
                                  <span className="text-green-700 ml-1">
                                    성공
                                  </span>
                                ) : (
                                  <span className="text-red-700 ml-1">
                                    실패
                                  </span>
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
                      </>
                    )}

                    {/* DELETE 테스트 결과 */}
                    {template.method === "DELETE" && (
                      <>
                        {isTesting(template, "DELETE") && (
                          <div className="p-2 rounded text-xs bg-blue-50 border border-blue-200">
                            <div className="font-medium mb-1 text-blue-700">
                              DELETE 테스트: 통신 중...
                            </div>
                          </div>
                        )}
                        {!isTesting(template, "DELETE") &&
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
                                  <span className="text-green-700 ml-1">
                                    성공
                                  </span>
                                ) : (
                                  <span className="text-red-700 ml-1">
                                    실패
                                  </span>
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
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 지연 시간 설정 모달 */}
      {delayModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                지연 시간 설정
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  지연 시간 (밀리초)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30000"
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0-30000ms 사이의 값을 입력하세요
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setDelayModalOpen(null);
                    setDelayValue("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  취소
                </button>
                <button
                  onClick={() => setDelay(delayModalOpen)}
                  disabled={updatingDelay === delayModalOpen}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    updatingDelay === delayModalOpen
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {updatingDelay === delayModalOpen ? "설정 중..." : "설정"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에러 코드 설정 모달 */}
      {errorCodeModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                에러 코드 설정
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HTTP 에러 코드
                </label>
                <input
                  type="number"
                  min="100"
                  max="599"
                  value={errorCodeValue}
                  onChange={(e) => setErrorCodeValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="비워두면 정상 응답 (200)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  100-599 사이의 HTTP 에러 코드를 입력하세요. 비워두면 정상
                  응답(200)을 반환합니다.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setErrorCodeModalOpen(null);
                    setErrorCodeValue("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  취소
                </button>
                <button
                  onClick={() => setErrorCode(errorCodeModalOpen)}
                  disabled={updatingErrorCode === errorCodeModalOpen}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    updatingErrorCode === errorCodeModalOpen
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {updatingErrorCode === errorCodeModalOpen
                    ? "설정 중..."
                    : "설정"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
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
              <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">
                API 삭제 확인
              </h3>
              <p className="text-sm text-gray-500 mb-6 text-center">
                이 API를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteModalOpen(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  취소
                </button>
                <button
                  onClick={() => deleteTemplate(deleteModalOpen!)}
                  disabled={deleting === deleteModalOpen}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    deleting === deleteModalOpen
                      ? "bg-red-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {deleting === deleteModalOpen ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
