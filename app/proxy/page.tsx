"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ProxyServer {
  id: number;
  name: string;
  targetUrl: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    mockApis: number;
  };
}

export default function ProxyPage() {
  const [proxyServers, setProxyServers] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    targetUrl: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchProxyServers();
  }, []);

  const fetchProxyServers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/proxy");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProxyServers(data);
    } catch (error) {
      console.error("프록시 서버 조회 오류:", error);
      setError("프록시 서버를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProxy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.name.trim() || !createForm.targetUrl.trim()) {
      alert("프록시 서버 이름과 목표 URL은 필수입니다.");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "프록시 서버 생성에 실패했습니다.");
      }

      // 폼 초기화 및 목록 새로고침
      setCreateForm({ name: "", targetUrl: "", description: "" });
      setShowCreateForm(false);
      await fetchProxyServers();

      alert("프록시 서버가 성공적으로 생성되었습니다.");
    } catch (error) {
      console.error("프록시 서버 생성 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "프록시 서버 생성 중 오류가 발생했습니다."
      );
    } finally {
      setCreating(false);
    }
  };

  const copyProxyUrl = (proxyName: string, path: string = "") => {
    const proxyUrl = `/api/proxy/${proxyName}${path}`;
    const fullUrl = `${window.location.origin}${proxyUrl}`;

    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        alert("프록시 URL이 클립보드에 복사되었습니다.");
      })
      .catch(() => {
        alert("클립보드 복사에 실패했습니다.");
      });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                프록시 서버 관리
              </h1>
              <p className="text-gray-600">
                외부 API를 프록시하고 Mock API를 추가하여 CORS 문제를 해결하세요
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              ← 메인으로 돌아가기
            </Link>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showCreateForm ? "취소" : "새 프록시 서버 생성"}
          </button>
        </div>

        {/* 프록시 서버 생성 폼 */}
        {showCreateForm && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              새 프록시 서버 생성
            </h3>
            <form onSubmit={handleCreateProxy} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  프록시 서버 이름 *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="예: mobilemanager"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  이 이름으로 /api/proxy/{createForm.name || "[이름]"}/...
                  경로가 생성됩니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  목표 서버 URL *
                </label>
                <input
                  type="url"
                  value={createForm.targetUrl}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      targetUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mock API가 없는 경로는 이 서버로 프록시됩니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="프록시 서버에 대한 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    creating
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {creating ? "생성 중..." : "프록시 서버 생성"}
                </button>
              </div>
            </form>
          </div>
        )}

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
                    onClick={fetchProxyServers}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 프록시 서버 목록 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              프록시 서버 목록
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              생성된 프록시 서버들을 확인하고 관리하세요
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
          ) : proxyServers.length === 0 ? (
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
                아직 생성된 프록시 서버가 없습니다.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                첫 번째 프록시 서버 생성하기
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {proxyServers.map((proxy) => (
                <li key={proxy.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          프록시
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {proxy.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {proxy.targetUrl}
                        </div>
                        {proxy.description && (
                          <div className="text-sm text-gray-400 mt-1">
                            {proxy.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Mock API: {proxy._count.mockApis}개
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        {new Date(proxy.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex space-x-2">
                        {/* 프록시 URL 복사 버튼 */}
                        <button
                          onClick={() => copyProxyUrl(proxy.name)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        >
                          📋 URL 복사
                        </button>

                        {/* Mock API 생성 버튼 */}
                        <Link
                          href={`/proxy/${proxy.name}/create`}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          ➕ Mock API
                        </Link>

                        {/* Mock API 목록 버튼 */}
                        <Link
                          href={`/proxy/${proxy.name}/apis`}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                        >
                          📋 API 목록
                        </Link>
                      </div>
                    </div>
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
