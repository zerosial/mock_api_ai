"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ProxyServer {
  id: number;
  name: string;
  targetUrl: string;
  description: string | null;
}

interface CommunicationLog {
  id: number;
  path: string;
  method: string;
  requestBody: unknown;
  responseBody: unknown;
  statusCode: number;
  responseTime: number;
  userAgent: string | null;
  ipAddress: string | null;
  isMock: boolean;
  createdAt: string;
}

interface RouteGroup {
  path: string;
  method: string;
  count: number;
  lastRequest: string;
  lastResponse: unknown;
  lastStatusCode: number;
}

export default function ProxyLogsPage() {
  const params = useParams();
  const proxyName = params.proxyName as string;

  const [proxyServer, setProxyServer] = useState<ProxyServer | null>(null);
  const [routeGroups, setRouteGroups] = useState<RouteGroup[]>([]);
  const [filteredRouteGroups, setFilteredRouteGroups] = useState<RouteGroup[]>(
    []
  );
  const [selectedRoute, setSelectedRoute] = useState<{
    path: string;
    method: string;
  } | null>(null);
  const [routeLogs, setRouteLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검색 및 필터 상태
  const [searchPath, setSearchPath] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");

  const httpMethods = [
    { value: "ALL", label: "전체", color: "bg-gray-100 text-gray-800" },
    { value: "GET", label: "GET", color: "bg-green-100 text-green-800" },
    { value: "POST", label: "POST", color: "bg-blue-100 text-blue-800" },
    { value: "PUT", label: "PUT", color: "bg-yellow-100 text-yellow-800" },
    { value: "DELETE", label: "DELETE", color: "bg-red-100 text-red-800" },
    { value: "PATCH", label: "PATCH", color: "bg-purple-100 text-purple-800" },
  ];

  useEffect(() => {
    if (proxyName) {
      fetchProxyServer();
      fetchRouteGroups();
    }
  }, [proxyName]);

  // 검색 및 필터링 적용
  useEffect(() => {
    let filtered = routeGroups;

    // 경로 검색 필터
    if (searchPath.trim()) {
      filtered = filtered.filter((route) =>
        route.path.toLowerCase().includes(searchPath.toLowerCase())
      );
    }

    // HTTP 메서드 필터
    if (selectedMethod !== "ALL") {
      filtered = filtered.filter((route) => route.method === selectedMethod);
    }

    setFilteredRouteGroups(filtered);
  }, [routeGroups, searchPath, selectedMethod]);

  const fetchProxyServer = async () => {
    try {
      const response = await fetch(`/api/proxy`);
      if (!response.ok) throw new Error("프록시 서버 조회 실패");

      const proxyServers = await response.json();
      const server = proxyServers.find(
        (p: ProxyServer) => p.name === proxyName
      );

      if (!server) {
        setError("프록시 서버를 찾을 수 없습니다.");
        return;
      }

      setProxyServer(server);
    } catch (error) {
      console.error("프록시 서버 조회 오류:", error);
      setError("프록시 서버를 불러오는 중 오류가 발생했습니다.");
    }
  };

  const fetchRouteGroups = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/proxy/logs/routes?proxyServerName=${proxyName}`
      );
      if (!response.ok) throw new Error("라우트 그룹 조회 실패");

      const data = await response.json();
      setRouteGroups(data);
    } catch (error) {
      console.error("라우트 그룹 조회 오류:", error);
      setError("라우트 그룹을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRouteLogs = async (path: string, method: string) => {
    try {
      setLogsLoading(true);
      setSelectedRoute({ path, method });

      const response = await fetch(
        `/api/proxy/logs?proxyServerName=${proxyName}&path=${encodeURIComponent(
          path
        )}&method=${method}&limit=3`
      );
      if (!response.ok) throw new Error("라우트 로그 조회 실패");

      const data = await response.json();
      setRouteLogs(data);
    } catch (error) {
      console.error("라우트 로그 조회 오류:", error);
      alert("라우트 로그를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLogsLoading(false);
    }
  };

  const closeRouteLogs = () => {
    setSelectedRoute(null);
    setRouteLogs([]);
  };

  // 통신 로그를 기반으로 Mock API 생성
  const createMockApiFromLog = async (log: CommunicationLog) => {
    try {
      const response = await fetch("/api/proxy/mock/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proxyServerName: proxyName,
          path: log.path,
          method: log.method,
          requestBody: log.requestBody,
          responseBody: log.responseBody,
          statusCode: log.statusCode,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert("Mock API가 성공적으로 생성되었습니다!");

        // Mock API 목록 페이지로 이동
        window.location.href = `/proxy/${proxyName}/apis`;
      } else {
        throw new Error(result.error || "Mock API 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("Mock API 생성 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Mock API 생성 중 오류가 발생했습니다."
      );
    }
  };

  // JSON 데이터를 깔끔하게 파싱하고 포맷팅
  const formatJson = (data: unknown): string => {
    if (!data) return "데이터 없음";

    try {
      // 이미 객체인 경우
      if (typeof data === "object") {
        return JSON.stringify(data, null, 2);
      }

      // 문자열인 경우 JSON 파싱 시도
      if (typeof data === "string") {
        // 이스케이프된 따옴표 처리
        let cleanData = data;
        if (data.includes('\\"')) {
          try {
            cleanData = JSON.parse(data);
          } catch {
            // 이스케이프 제거 시도
            cleanData = data.replace(/\\"/g, '"');
            try {
              cleanData = JSON.parse(cleanData);
            } catch {
              // 파싱 실패 시 원본 반환
              return data;
            }
          }
        } else {
          try {
            cleanData = JSON.parse(data);
          } catch {
            return data;
          }
        }

        return JSON.stringify(cleanData, null, 2);
      }

      return String(data);
    } catch {
      return String(data);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <Link
            href="/proxy"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            프록시 목록으로 돌아가기
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
                {proxyServer?.name} - 통신 로그
              </h1>
              <p className="text-gray-600">{proxyServer?.targetUrl}</p>
            </div>
            <Link
              href="/proxy"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              ← 프록시 목록으로
            </Link>
          </div>
        </div>

        {/* 라우트 그룹 목록 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              API 라우트별 통신 현황
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              각 API 경로별로 통신 횟수와 최근 응답을 확인할 수 있습니다
            </p>
          </div>

          {/* 검색 및 필터 */}
          <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 경로 검색 */}
              <div className="flex-1">
                <label
                  htmlFor="search-path"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  경로 검색
                </label>
                <input
                  type="text"
                  id="search-path"
                  value={searchPath}
                  onChange={(e) => setSearchPath(e.target.value)}
                  placeholder="예: /api/product/v2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* HTTP 메서드 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTTP 메서드
                </label>
                <div className="flex flex-wrap gap-2">
                  {httpMethods.map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setSelectedMethod(method.value)}
                      className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                        selectedMethod === method.value
                          ? `${method.color} border-gray-300`
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 검색 결과 요약 */}
            {searchPath || selectedMethod !== "ALL" ? (
              <div className="mt-3 text-sm text-gray-600">
                검색 결과: {filteredRouteGroups.length}개 라우트
                {searchPath && (
                  <span className="ml-2">(경로: &quot;{searchPath}&quot;)</span>
                )}
                {selectedMethod !== "ALL" && (
                  <span className="ml-2">(메서드: {selectedMethod})</span>
                )}
              </div>
            ) : null}
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
          ) : filteredRouteGroups.length === 0 ? (
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
              <p className="text-gray-500 mb-4">아직 통신 로그가 없습니다.</p>
              <p className="text-sm text-gray-400">
                프록시를 통해 API를 호출하면 통신 로그가 생성됩니다.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredRouteGroups.map((route, index) => (
                <li
                  key={index}
                  className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                >
                  <div
                    className="flex items-center justify-between"
                    onClick={() => fetchRouteLogs(route.path, route.method)}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            route.method === "GET"
                              ? "bg-green-100 text-green-800"
                              : route.method === "POST"
                              ? "bg-blue-100 text-blue-800"
                              : route.method === "PUT"
                              ? "bg-yellow-100 text-yellow-800"
                              : route.method === "DELETE"
                              ? "bg-red-100 text-red-800"
                              : route.method === "PATCH"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {route.method}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {route.path}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          마지막 통신:{" "}
                          {new Date(route.lastRequest).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-gray-500">
                        총 {route.count}회 통신
                      </div>
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 라우트별 상세 로그 모달 */}
      {selectedRoute && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedRoute.method} {selectedRoute.path} - 최근 통신 로그
                  (최대 3개)
                </h3>
                <button
                  onClick={closeRouteLogs}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {logsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">로그를 불러오는 중...</p>
                </div>
              ) : routeLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    해당 라우트의 통신 로그가 없습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {routeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              log.isMock
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {log.isMock ? "Mock" : "Proxy"}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              log.method === "GET"
                                ? "bg-green-100 text-green-800"
                                : log.method === "POST"
                                ? "bg-blue-100 text-blue-800"
                                : log.method === "PUT"
                                ? "bg-yellow-100 text-yellow-800"
                                : log.method === "DELETE"
                                ? "bg-red-100 text-red-800"
                                : log.method === "PATCH"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {log.method}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {log.path}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* 요청 정보 */}
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2 text-sm">
                            요청 정보
                          </h4>
                          <div className="bg-white p-3 rounded border">
                            <pre className="text-xs overflow-x-auto max-h-32 overflow-y-auto">
                              {formatJson(log.requestBody)}
                            </pre>
                          </div>
                        </div>

                        {/* 응답 정보 */}
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2 text-sm">
                            응답 정보
                          </h4>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center space-x-2 mb-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  log.statusCode >= 200 && log.statusCode < 300
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {log.statusCode}
                              </span>
                              <span className="text-xs text-gray-500">
                                {log.responseTime}ms
                              </span>
                            </div>
                            <pre className="text-xs overflow-x-auto max-h-32 overflow-y-auto">
                              {formatJson(log.responseBody)}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* 메타데이터 */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {log.userAgent && (
                              <div className="text-xs text-gray-500 mb-1">
                                <strong>User-Agent:</strong> {log.userAgent}
                              </div>
                            )}

                            {log.ipAddress && (
                              <div className="text-xs text-gray-500">
                                <strong>IP:</strong> {log.ipAddress}
                              </div>
                            )}
                          </div>

                          {/* Mock API 생성 버튼 */}
                          <button
                            onClick={() => createMockApiFromLog(log)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                          >
                            ➕ Mock API 생성
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
