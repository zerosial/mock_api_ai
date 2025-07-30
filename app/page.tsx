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

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            새 API 생성 (랜덤)
          </Link>
          <Link
            href="/create-custom"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            커스텀 API 생성
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
                      <Link
                        href={`/api/${template.project}/${template.user}${template.apiUrl}`}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        테스트
                      </Link>
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
