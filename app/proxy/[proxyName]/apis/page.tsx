"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { withBasePath } from "@/lib/basePath";

interface ProxyMockApi {
  id: number;
  proxyServerId: number; // 프록시 서버 ID 추가
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
  const [delayModalOpen, setDelayModalOpen] = useState<number | null>(null);
  const [errorCodeModalOpen, setErrorCodeModalOpen] = useState<number | null>(
    null
  );
  const [delayValue, setDelayValue] = useState<string>("");
  const [errorCodeValue, setErrorCodeValue] = useState<string>("");
  const [updatingDelay, setUpdatingDelay] = useState<number | null>(null);
  const [updatingErrorCode, setUpdatingErrorCode] = useState<number | null>(
    null
  );
  const [editingResponse, setEditingResponse] = useState<number | null>(null);
  const [responseEditValue, setResponseEditValue] = useState<string>("");
  const [updatingResponse, setUpdatingResponse] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [nameEditValue, setNameEditValue] = useState<string>("");
  const [updatingName, setUpdatingName] = useState<number | null>(null);
  const [togglingMock, setTogglingMock] = useState<number | null>(null);
  const [searchPath, setSearchPath] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [filteredMockApis, setFilteredMockApis] = useState<ProxyMockApi[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  const httpMethods = [
    { value: "ALL", label: "전체", color: "bg-gray-100 text-gray-800" },
    { value: "GET", label: "GET", color: "bg-green-100 text-green-800" },
    { value: "POST", label: "POST", color: "bg-blue-100 text-blue-800" },
    { value: "PUT", label: "PUT", color: "bg-yellow-100 text-yellow-800" },
    { value: "DELETE", label: "DELETE", color: "bg-red-100 text-red-800" },
    { value: "PATCH", label: "PATCH", color: "bg-purple-100 text-purple-800" },
  ];

  useEffect(() => {
    fetchData();
  }, [proxyName]);

  // 검색 및 필터링 적용
  useEffect(() => {
    let filtered = mockApis;

    // 경로 검색 필터
    if (searchPath.trim()) {
      filtered = filtered.filter((api) =>
        api.path.toLowerCase().includes(searchPath.toLowerCase())
      );
    }

    // HTTP 메서드 필터
    if (selectedMethod !== "ALL") {
      filtered = filtered.filter((api) => api.method === selectedMethod);
    }

    setFilteredMockApis(filtered);
  }, [mockApis, searchPath, selectedMethod]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 프록시 서버 정보 조회
      const proxyResponse = await fetch(withBasePath("/api/proxy"));
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
      const mockApisResponse = await fetch(
        withBasePath(`/api/proxy/${proxyName}/apis`)
      );
      if (!mockApisResponse.ok) {
        throw new Error(`Mock API 조회 실패: ${mockApisResponse.status}`);
      }

      const mockApisData = await mockApisResponse.json();
      setMockApis(mockApisData);
      setFilteredMockApis(mockApisData); // 초기값 설정
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

      const url = withBasePath(`/api/proxy/${proxyName}${mockApi.path}`);

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
    if (
      !confirm(`정말로 Mock API "${mockApi.apiName}"을(를) 삭제하시겠습니까?`)
    ) {
      return;
    }

    try {
      setIsWorking(true);
      const response = await fetch(withBasePath("/api/proxy/mock/delete"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mockApiId: mockApi.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Mock API 삭제에 실패했습니다.");
      }

      // 목록에서 제거
      setMockApis((prev) => prev.filter((api) => api.id !== mockApi.id));
      alert("Mock API가 성공적으로 삭제되었습니다.");
    } catch (error) {
      console.error("Mock API 삭제 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Mock API 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setIsWorking(false);
    }
  };

  // Mock API 활성화/비활성화 토글
  const toggleMockApi = async (mockApi: ProxyMockApi) => {
    try {
      setTogglingMock(mockApi.id);
      setIsWorking(true);
      const newActiveState = !mockApi.isActive;

      const response = await fetch(withBasePath("/api/proxy/mock/toggle"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mockApiId: mockApi.id,
          isActive: newActiveState,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 목록 업데이트 - 같은 경로/메서드의 모든 Mock API 상태 업데이트
        setMockApis((prev) =>
          prev.map((api) => {
            if (api.id === mockApi.id) {
              // 현재 Mock API 상태 변경
              return { ...api, isActive: newActiveState };
            } else if (
              api.proxyServerId === mockApi.proxyServerId &&
              api.path === mockApi.path &&
              api.method === mockApi.method
            ) {
              // 같은 경로/메서드의 다른 Mock API들은 비활성화
              return { ...api, isActive: false };
            }
            return api;
          })
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
    } finally {
      setTogglingMock(null);
      setIsWorking(false);
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

  // 지연 시간 설정
  const setDelay = async (mockApiId: number) => {
    try {
      setUpdatingDelay(mockApiId);
      const delayMs = parseInt(delayValue);

      if (isNaN(delayMs) || delayMs < 0 || delayMs > 300000) {
        alert("지연 시간은 0-300000ms 사이의 값이어야 합니다.");
        return;
      }

      const response = await fetch(withBasePath("/api/proxy/mock/delay"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mockApiId, delayMs }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(result.message);
        // 목록 업데이트
        setMockApis((prev) =>
          prev.map((api) =>
            api.id === mockApiId ? { ...api, delayMs: delayMs } : api
          )
        );
        setDelayModalOpen(null);
        setDelayValue("");
      } else {
        throw new Error(result.error || "지연 시간 설정에 실패했습니다.");
      }
    } catch (error) {
      console.error("지연 시간 설정 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "지연 시간 설정 중 오류가 발생했습니다."
      );
    } finally {
      setUpdatingDelay(null);
    }
  };

  // 에러코드 설정
  const setErrorCode = async (mockApiId: number) => {
    try {
      setUpdatingErrorCode(mockApiId);

      // 디버깅을 위한 로그
      console.log("에러코드 설정 시작:", {
        mockApiId,
        errorCodeValue,
        type: typeof errorCodeValue,
      });

      // 빈 문자열이면 null로 처리, 아니면 숫자로 변환
      let finalErrorCode: number | null = null;

      // 입력값이 있고, 공백이 아닐 때만 처리
      if (errorCodeValue && errorCodeValue.trim() !== "") {
        const parsedErrorCode = parseInt(errorCodeValue);
        if (
          isNaN(parsedErrorCode) ||
          parsedErrorCode < 100 ||
          parsedErrorCode > 599
        ) {
          alert("에러코드는 100-599 사이의 HTTP 상태 코드여야 합니다.");
          return;
        }
        finalErrorCode = parsedErrorCode;
      }
      // errorCodeValue가 빈 문자열이면 finalErrorCode는 null (정상 응답)

      console.log("최종 에러코드:", finalErrorCode);

      const response = await fetch(withBasePath("/api/proxy/mock/error-code"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mockApiId, errorCode: finalErrorCode }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(result.message);
        // 목록 업데이트
        setMockApis((prev) =>
          prev.map((api) =>
            api.id === mockApiId ? { ...api, errorCode: finalErrorCode } : api
          )
        );
        setErrorCodeModalOpen(null);
        setErrorCodeValue("");
      } else {
        throw new Error(result.error || "에러코드 설정에 실패했습니다.");
      }
    } catch (error) {
      console.error("에러코드 설정 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "에러코드 설정 중 오류가 발생했습니다."
      );
    } finally {
      setUpdatingErrorCode(null);
    }
  };

  // Mock API 활성화 전환
  const switchActiveMockApi = async (mockApiId: number) => {
    try {
      setTogglingMock(mockApiId);
      setIsWorking(true);
      const response = await fetch(
        withBasePath("/api/proxy/mock/switch-active"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mockApiId }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // 목록 업데이트 - 같은 경로/메서드의 모든 Mock API 상태 업데이트
        setMockApis((prev) =>
          prev.map((api) => {
            // Find the target API's path/method from the current state
            const targetApi = prev.find((a) => a.id === mockApiId);
            if (!targetApi) return api; // Should not happen

            if (api.id === mockApiId) {
              // 선택된 Mock API 활성화
              return { ...api, isActive: true };
            } else if (
              api.proxyServerId === targetApi.proxyServerId &&
              api.path === targetApi.path &&
              api.method === targetApi.method
            ) {
              // 같은 경로/메서드의 다른 Mock API들은 비활성화
              return { ...api, isActive: false };
            }
            return api;
          })
        );
      } else {
        throw new Error(result.error || "Mock API 활성화 전환에 실패했습니다.");
      }
    } catch (error) {
      console.error("Mock API 활성화 전환 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Mock API 활성화 전환 중 오류가 발생했습니다."
      );
    } finally {
      setTogglingMock(null);
      setIsWorking(false);
    }
  };

  // 지연 시간 모달 열기
  const openDelayModal = (mockApi: ProxyMockApi) => {
    setDelayModalOpen(mockApi.id);
    setDelayValue(mockApi.delayMs.toString());
  };

  // 에러코드 모달 열기
  const openErrorCodeModal = (mockApi: ProxyMockApi) => {
    setErrorCodeModalOpen(mockApi.id);
    setErrorCodeValue(mockApi.errorCode?.toString() || "");
  };

  // 응답 데이터 수정 시작
  const startResponseEdit = (mockApi: ProxyMockApi) => {
    setEditingResponse(mockApi.id);
    setResponseEditValue(formatJson(mockApi.mockData));
  };

  // 응답 데이터 수정 취소
  const cancelResponseEdit = () => {
    setEditingResponse(null);
    setResponseEditValue("");
  };

  // 응답 데이터 수정 저장
  const saveResponseEdit = async (mockApiId: number) => {
    try {
      setUpdatingResponse(mockApiId);

      // JSON 유효성 검사
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(responseEditValue);
      } catch (error) {
        alert("올바른 JSON 형식이 아닙니다. JSON 형식을 확인해주세요.");
        return;
      }

      const response = await fetch(
        withBasePath("/api/proxy/mock/update-response"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mockApiId, mockData: parsedData }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        alert("응답 데이터가 성공적으로 수정되었습니다.");
        // 목록 업데이트
        setMockApis((prev) =>
          prev.map((api) =>
            api.id === mockApiId
              ? { ...api, mockData: parsedData as Record<string, unknown> }
              : api
          )
        );
        setEditingResponse(null);
        setResponseEditValue("");
      } else {
        throw new Error(result.error || "응답 데이터 수정에 실패했습니다.");
      }
    } catch (error) {
      console.error("응답 데이터 수정 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "응답 데이터 수정 중 오류가 발생했습니다."
      );
    } finally {
      setUpdatingResponse(null);
    }
  };

  // 제목 수정 시작
  const startNameEdit = (mockApi: ProxyMockApi) => {
    setEditingName(mockApi.id);
    setNameEditValue(mockApi.apiName);
  };

  // 제목 수정 취소
  const cancelNameEdit = () => {
    setEditingName(null);
    setNameEditValue("");
  };

  // 제목 수정 저장
  const saveNameEdit = async (mockApiId: number) => {
    try {
      setUpdatingName(mockApiId);

      // 제목 유효성 검사
      if (!nameEditValue.trim()) {
        alert("제목은 비워둘 수 없습니다.");
        return;
      }

      const response = await fetch(
        withBasePath("/api/proxy/mock/update-name"),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mockApiId, apiName: nameEditValue }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        alert("제목이 성공적으로 수정되었습니다.");
        // 목록 업데이트
        setMockApis((prev) =>
          prev.map((api) =>
            api.id === mockApiId
              ? { ...api, apiName: nameEditValue.trim() }
              : api
          )
        );
        setEditingName(null);
        setNameEditValue("");
      } else {
        throw new Error(result.error || "제목 수정에 실패했습니다.");
      }
    } catch (error) {
      console.error("제목 수정 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "제목 수정 중 오류가 발생했습니다."
      );
    } finally {
      setUpdatingName(null);
    }
  };

  const copyApiUrl = (mockApi: ProxyMockApi) => {
    const apiUrl = withBasePath(`/api/proxy/${proxyName}${mockApi.path}`);
    const fullUrl = `${window.location.origin}${apiUrl}`;

    try {
      // Clipboard API 사용 시도 (HTTPS 환경에서만 작동)
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(fullUrl)
          .then(() => {
            alert("API URL이 클립보드에 복사되었습니다.");
          })
          .catch(() => {
            alert("클립보드 복사에 실패했습니다.");
          });
      } else {
        // Fallback: document.execCommand 사용 (HTTP 환경에서도 작동)
        const textArea = document.createElement("textarea");
        textArea.value = fullUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (successful) {
          alert("API URL이 클립보드에 복사되었습니다.");
        } else {
          alert("클립보드 복사에 실패했습니다.");
        }
      }
    } catch (error) {
      console.error("클립보드 복사 실패:", error);
      alert("클립보드 복사에 실패했습니다.");
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
      {/* 로딩 오버레이 */}
      {isWorking && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl border border-gray-200">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-700 text-lg font-medium">
              Mock API 작업 중...
            </div>
            <div className="text-gray-500 text-sm mt-2">
              잠시만 기다려주세요
            </div>
          </div>
        </div>
      )}

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
            <>
              {/* 검색 및 필터링 UI */}
              <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* 경로 검색 */}
                  <div className="flex-1">
                    <label
                      htmlFor="searchPath"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Mock API 경로 검색
                    </label>
                    <input
                      type="text"
                      id="searchPath"
                      value={searchPath}
                      onChange={(e) => setSearchPath(e.target.value)}
                      placeholder="예: /api/products/v2"
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
                    검색 결과: {filteredMockApis.length}개 Mock API
                    {searchPath && (
                      <span className="ml-2">
                        (경로: &quot;{searchPath}&quot;)
                      </span>
                    )}
                    {selectedMethod !== "ALL" && (
                      <span className="ml-2">(메서드: {selectedMethod})</span>
                    )}
                  </div>
                ) : null}
              </div>

              <ul className="divide-y divide-gray-200">
                {filteredMockApis.map((mockApi) => (
                  <li key={mockApi.id} className="px-4 py-4 sm:px-6">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleMockData(`${mockApi.id}`)}
                    >
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
                            {editingName === mockApi.id ? (
                              // 편집 모드
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={nameEditValue}
                                  onChange={(e) =>
                                    setNameEditValue(e.target.value)
                                  }
                                  className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="제목을 입력하세요"
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // 이벤트 전파 방지
                                    saveNameEdit(mockApi.id);
                                  }}
                                  disabled={updatingName === mockApi.id}
                                  className={`px-2 py-1 text-xs font-medium rounded ${
                                    updatingName === mockApi.id
                                      ? "bg-green-400 text-white cursor-not-allowed"
                                      : "bg-green-600 text-white hover:bg-green-700"
                                  }`}
                                >
                                  {updatingName === mockApi.id
                                    ? "저장 중..."
                                    : "확인"}
                                </button>
                                <button
                                  onClick={cancelNameEdit}
                                  className="px-2 py-1 text-xs font-medium rounded bg-gray-600 text-white hover:bg-gray-700"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              // 읽기 모드
                              <div className="flex items-center space-x-2">
                                <span>{mockApi.apiName}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // 클릭 이벤트 전파 방지
                                    startNameEdit(mockApi);
                                  }}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                  title="제목 수정"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {mockApi.path}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {/* 지연 시간 표시 - 0이 아닐 때만 표시 */}
                            {mockApi.delayMs > 0 && (
                              <span className="text-orange-600 mr-3">
                                ⏱️ 지연: {mockApi.delayMs}ms
                              </span>
                            )}
                            {/* 에러코드 표시 - null이 아닐 때만 표시 */}
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
                          <div className="flex items-center space-x-2">
                            {/* On/Off 토글 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMockApi(mockApi);
                              }}
                              disabled={togglingMock === mockApi.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                togglingMock === mockApi.id
                                  ? "bg-gray-300 cursor-not-allowed"
                                  : mockApi.isActive
                                  ? "bg-blue-600"
                                  : "bg-gray-200"
                              }`}
                              title={
                                togglingMock === mockApi.id
                                  ? "상태 변경 중..."
                                  : "Mock API 활성화/비활성화"
                              }
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  togglingMock === mockApi.id
                                    ? "translate-x-1"
                                    : mockApi.isActive
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                            {/* URL 복사 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyApiUrl(mockApi);
                              }}
                              className="px-2 py-1 text-xs font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              📋 URL
                            </button>
                          </div>

                          {/* 3. 지연 시간 설정 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 클릭 이벤트 전파 방지
                              openDelayModal(mockApi);
                            }}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                          >
                            ⏱️ 지연
                          </button>

                          {/* 4. 에러코드 설정 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 클릭 이벤트 전파 방지
                              openErrorCodeModal(mockApi);
                            }}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            ❌ 에러
                          </button>

                          {/* 5. 삭제 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 클릭 이벤트 전파 방지
                              deleteMockApi(mockApi);
                            }}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            🗑️ 삭제
                          </button>

                          {/* 6. 테스트 버튼 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 클릭 이벤트 전파 방지
                              testApi(mockApi);
                            }}
                            disabled={isTesting(mockApi)}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                              isTesting(mockApi)
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {isTesting(mockApi) ? "로딩 중..." : "테스트"}
                          </button>

                          {/* 7. 데이터 보기 화살표 */}
                          <div className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-700">
                            {expandedMockData[`${mockApi.id}`] ? "▼" : "▶"}
                          </div>
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
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-xs font-medium text-gray-700">
                                📤 응답 데이터:
                              </h5>
                              {/* 응답 데이터 수정하기 버튼 */}
                              <button
                                onClick={() => startResponseEdit(mockApi)}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                              >
                                ✏️ 응답 데이터 수정하기
                              </button>
                            </div>

                            {editingResponse === mockApi.id ? (
                              // 편집 모드
                              <div className="space-y-2">
                                <textarea
                                  value={responseEditValue}
                                  onChange={(e) =>
                                    setResponseEditValue(e.target.value)
                                  }
                                  className="w-full h-64 p-2 text-xs font-mono bg-white border border-blue-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="JSON 데이터를 입력하세요..."
                                />
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => saveResponseEdit(mockApi.id)}
                                    disabled={updatingResponse === mockApi.id}
                                    className={`px-3 py-1 text-xs font-medium rounded ${
                                      updatingResponse === mockApi.id
                                        ? "bg-blue-400 text-white cursor-not-allowed"
                                        : "bg-green-600 text-white hover:bg-green-700"
                                    }`}
                                  >
                                    {updatingResponse === mockApi.id
                                      ? "저장 중..."
                                      : "확인"}
                                  </button>
                                  <button
                                    onClick={cancelResponseEdit}
                                    className="px-3 py-1 text-xs font-medium rounded bg-gray-600 text-white hover:bg-gray-700"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // 읽기 모드
                              <pre className="text-xs bg-white p-2 rounded border overflow-x-auto max-h-64 overflow-y-auto">
                                {formatJson(mockApi.mockData)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
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
                  max="300000"
                  value={delayValue}
                  onChange={(e) => setDelayValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0-300000ms 사이의 값을 입력하세요. 0으로 설정하면 지연이
                  제거되고 정상 응답으로 설정됩니다.
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
                  100-599 사이의 HTTP 에러 코드를 입력하세요.
                  <strong>
                    비워두거나 0으로 설정하면 정상 응답(200)을 반환합니다.
                  </strong>
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
    </div>
  );
}
