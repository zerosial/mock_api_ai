"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ProxyServer {
  id: number;
  name: string;
  targetUrl: string;
  description: string | null;
}

export default function CreateProxyMockApiPage() {
  const params = useParams();
  const router = useRouter();
  const proxyName = params.proxyName as string;

  const [proxyServer, setProxyServer] = useState<ProxyServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    apiName: "",
    method: "GET",
    path: "",
    requestFields: [] as Field[],
    responseFields: [] as Field[],
    mockData: {} as Record<string, unknown>,
  });

  const [showRequestFields, setShowRequestFields] = useState(false);
  const [showResponseFields, setShowResponseFields] = useState(false);
  const [showMockData, setShowMockData] = useState(false);

  useEffect(() => {
    fetchProxyServer();
  }, [proxyName]);

  const fetchProxyServer = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/proxy");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
    } finally {
      setLoading(false);
    }
  };

  const addRequestField = () => {
    setFormData((prev) => ({
      ...prev,
      requestFields: [
        ...prev.requestFields,
        {
          name: "",
          type: "string",
          required: false,
          description: "",
        },
      ],
    }));
  };

  const updateRequestField = (index: number, field: Partial<Field>) => {
    setFormData((prev) => ({
      ...prev,
      requestFields: prev.requestFields.map((f, i) =>
        i === index ? { ...f, ...field } : f
      ),
    }));
  };

  const removeRequestField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      requestFields: prev.requestFields.filter((_, i) => i !== index),
    }));
  };

  const addResponseField = () => {
    setFormData((prev) => ({
      ...prev,
      responseFields: [
        ...prev.responseFields,
        {
          name: "",
          type: "string",
          required: false,
          description: "",
        },
      ],
    }));
  };

  const updateResponseField = (index: number, field: Partial<Field>) => {
    setFormData((prev) => ({
      ...prev,
      responseFields: prev.responseFields.map((f, i) =>
        i === index ? { ...f, ...field } : f
      ),
    }));
  };

  const removeResponseField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      responseFields: prev.responseFields.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.apiName.trim() || !formData.path.trim()) {
      alert("API 이름과 경로는 필수입니다.");
      return;
    }

    // Mock 데이터가 있으면 응답 필드 검증 건너뛰기
    const hasMockData =
      formData.mockData &&
      typeof formData.mockData === "object" &&
      Object.keys(formData.mockData).length > 0;

    if (!hasMockData && formData.responseFields.length === 0) {
      alert(
        "응답 필드는 최소 1개 이상 필요하거나, Mock 데이터를 입력해주세요."
      );
      return;
    }

    try {
      setCreating(true);
      const response = await fetch("/api/proxy/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proxyServerName: proxyName,
          ...formData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Mock API 생성에 실패했습니다.");
      }

      alert("Mock API가 성공적으로 생성되었습니다.");
      router.push(`/proxy/${proxyName}/apis`);
    } catch (error) {
      console.error("Mock API 생성 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Mock API 생성 중 오류가 발생했습니다."
      );
    } finally {
      setCreating(false);
    }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Mock API 생성
              </h1>
              <p className="text-gray-600">
                프록시 서버 <span className="font-semibold">{proxyName}</span>에
                Mock API를 추가하세요
              </p>
              <p className="text-sm text-gray-500 mt-1">
                목표 서버: {proxyServer.targetUrl}
              </p>
            </div>
            <Link
              href={`/proxy/${proxyName}/apis`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              ← API 목록으로 돌아가기
            </Link>
          </div>
        </div>

        {/* 생성 폼 */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API 이름 *
                </label>
                <input
                  type="text"
                  value={formData.apiName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      apiName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="예: 사용자 정보 조회"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTTP 메서드 *
                </label>
                <select
                  value={formData.method}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, method: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API 경로 *
              </label>
              <input
                type="text"
                value={formData.path}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, path: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: /users/{id}"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                이 경로로 요청이 오면 Mock 데이터를 반환합니다. Mock API가 없는
                경로는 실제 서버로 프록시됩니다.
              </p>
            </div>

            {/* 요청 필드 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">요청 필드</h3>
                <button
                  type="button"
                  onClick={() => setShowRequestFields(!showRequestFields)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {showRequestFields ? "숨기기" : "보기/편집"}
                </button>
              </div>

              {showRequestFields && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                  {formData.requestFields.map((field, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4"
                    >
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) =>
                          updateRequestField(index, { name: e.target.value })
                        }
                        placeholder="필드명"
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateRequestField(index, { type: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="object">object</option>
                        <option value="array">array</option>
                      </select>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateRequestField(index, {
                              required: e.target.checked,
                            })
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          필수
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={field.description}
                          onChange={(e) =>
                            updateRequestField(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder="설명"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeRequestField(index)}
                          className="px-2 py-2 text-red-600 hover:text-red-700"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRequestField}
                    className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700"
                  >
                    + 요청 필드 추가
                  </button>
                </div>
              )}
            </div>

            {/* 응답 필드 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  응답 필드 (Mock 데이터가 없을 때 필요)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowResponseFields(!showResponseFields)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {showResponseFields ? "숨기기" : "보기/편집"}
                </button>
              </div>

              {showResponseFields && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                  {formData.responseFields.map((field, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-4 gap-4"
                    >
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) =>
                          updateResponseField(index, { name: e.target.value })
                        }
                        placeholder="필드명"
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateResponseField(index, { type: e.target.value })
                        }
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="object">object</option>
                        <option value="array">array</option>
                      </select>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateResponseField(index, {
                              required: e.target.checked,
                            })
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          필수
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={field.description}
                          onChange={(e) =>
                            updateResponseField(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder="설명"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeResponseField(index)}
                          className="px-2 py-2 text-red-600 hover:text-red-700"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addResponseField}
                    className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-700"
                  >
                    + 응답 필드 추가
                  </button>
                </div>
              )}
            </div>

            {/* Mock 데이터 */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Mock 데이터 (응답 필드 대신 사용 가능)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMockData(!showMockData)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {showMockData ? "숨기기" : "보기/편집"}
                </button>
              </div>

              {showMockData && (
                <div className="p-4 bg-gray-50 rounded-md">
                  <textarea
                    value={JSON.stringify(formData.mockData, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setFormData((prev) => ({ ...prev, mockData: parsed }));
                      } catch {
                        // JSON 파싱 실패 시 무시
                      }
                    }}
                    placeholder='{"message": "Hello World", "status": "success", "data": {"id": 1, "name": "Test"}}'
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    JSON 형식으로 Mock 데이터를 입력하세요. Mock 데이터가 있으면
                    응답 필드 없이도 Mock API를 생성할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 제출 버튼 */}
            <div className="flex justify-end space-x-3">
              <Link
                href={`/proxy/${proxyName}/apis`}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={creating}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  creating
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {creating ? "생성 중..." : "Mock API 생성"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
