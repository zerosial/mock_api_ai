"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isReservedProjectName, isReservedUserName } from "@/lib/constants";
import { withBasePath } from "@/lib/basePath";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
  value: string; // 사용자가 지정한 값 (항상 존재)
}

interface GeneratedFields {
  requestFields: Field[];
  responseFields: Field[];
}

export default function CreateCustomPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    project: "",
    user: "",
    apiName: "",
    method: "GET",
    url: "",
    description: "", // AI가 필드를 생성할 때 사용할 설명
  });
  const [generatedFields, setGeneratedFields] = useState<GeneratedFields>({
    requestFields: [],
    responseFields: [],
  });
  const [jsonInput, setJsonInput] = useState<string>("");
  const [showJsonInput, setShowJsonInput] = useState<boolean>(false);

  const [streamingContent, setStreamingContent] = useState<string>("");
  const [showStreamingModal, setShowStreamingModal] = useState<boolean>(false);

  const generateFieldsWithAI = async () => {
    if (!formData.apiName.trim() || !formData.description.trim()) {
      setError("API 이름과 설명을 입력해주세요.");
      return;
    }

    setGenerating(true);
    setError(null);
    setStreamingContent("");
    setShowStreamingModal(true);

    try {
      const response = await fetch(
        withBasePath("/api/generate-fields-with-values-stream"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiName: formData.apiName,
            method: formData.method,
            url: formData.url,
            description: formData.description,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("스트림을 읽을 수 없습니다.");
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);

                switch (parsed.type) {
                  case "start":
                    setStreamingContent(
                      (prev) => prev + `🚀 ${parsed.message}\n`
                    );
                    break;
                  case "progress":
                    setStreamingContent((prev) => prev + parsed.content);
                    break;
                  case "complete":
                    setStreamingContent(
                      (prev) => prev + `\n✅ ${parsed.message}\n`
                    );
                    break;
                  case "fields":
                    setGeneratedFields(parsed.fields);
                    setAiGenerated(parsed.aiGenerated);
                    setStreamingContent(
                      (prev) =>
                        prev +
                        `\n🎯 필드 및 값 생성 완료! ${parsed.fields.responseFields.length}개의 응답 필드가 생성되었습니다.\n`
                    );
                    break;
                  case "error":
                    setError(parsed.message);
                    setStreamingContent(
                      (prev) => prev + `\n❌ ${parsed.message}\n`
                    );
                    break;
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
      console.error("필드 생성 오류:", error);
      setError("필드 생성 중 오류가 발생했습니다.");
      setStreamingContent(
        (prev) =>
          prev +
          `\n❌ 오류 발생: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }\n`
      );
    } finally {
      setGenerating(false);
      // 오류가 발생했거나 필드가 생성되지 않았으면 더 오래 모달을 유지
      const delay =
        error || generatedFields.responseFields.length === 0 ? 10000 : 5000; // 10초 또는 5초
      setTimeout(() => {
        setShowStreamingModal(false);
      }, delay);
    }
  };

  const updateField = (
    type: "request" | "response",
    index: number,
    field: Partial<Field>
  ) => {
    setGeneratedFields((prev) => ({
      ...prev,
      [type === "request" ? "requestFields" : "responseFields"]: prev[
        type === "request" ? "requestFields" : "responseFields"
      ].map((f, i) => (i === index ? { ...f, ...field } : f)),
    }));
  };

  const removeField = (type: "request" | "response", index: number) => {
    setGeneratedFields((prev) => ({
      ...prev,
      [type === "request" ? "requestFields" : "responseFields"]: prev[
        type === "request" ? "requestFields" : "responseFields"
      ].filter((_, i) => i !== index),
    }));
  };

  const addField = (type: "request" | "response") => {
    const newField: Field = {
      name: "",
      type: "string",
      required: false,
      description: "",
      value: "",
    };

    setGeneratedFields((prev) => ({
      ...prev,
      [type === "request" ? "requestFields" : "responseFields"]: [
        ...prev[type === "request" ? "requestFields" : "responseFields"],
        newField,
      ],
    }));
  };

  // JSON 입력을 파싱하여 필드로 변환하는 함수
  const parseJsonToFields = () => {
    try {
      const jsonData = JSON.parse(jsonInput);
      const fields: Field[] = [];

      const processValue = (key: string, value: any, parentKey = ""): Field => {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        let type = "string";
        let stringValue = "";

        if (typeof value === "number") {
          type = "number";
          stringValue = value.toString();
        } else if (typeof value === "boolean") {
          type = "boolean";
          stringValue = value.toString();
        } else if (Array.isArray(value)) {
          type = "array";
          stringValue = JSON.stringify(value);
        } else if (typeof value === "object" && value !== null) {
          type = "object";
          stringValue = JSON.stringify(value);
        } else {
          type = "string";
          stringValue = String(value);
        }

        // 디버깅을 위한 로그
        console.log(
          `Processing field: ${fullKey}, type: ${type}, value: ${stringValue}`
        );

        // 값이 제대로 저장되었는지 확인
        if (
          stringValue === "" ||
          stringValue === "undefined" ||
          stringValue === "null"
        ) {
          console.warn(`Warning: Empty value for field ${fullKey}`);
        }

        return {
          name: fullKey,
          type,
          required: true,
          description: `${fullKey} 필드`,
          value: stringValue,
        };
      };

      const extractFields = (obj: any, parentKey = ""): Field[] => {
        const fields: Field[] = [];

        for (const [key, value] of Object.entries(obj)) {
          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            // 중첩 객체인 경우 재귀적으로 처리
            fields.push(
              ...extractFields(value, parentKey ? `${parentKey}.${key}` : key)
            );
          } else {
            // 기본 값인 경우 필드로 추가
            fields.push(processValue(key, value, parentKey));
          }
        }

        return fields;
      };

      const responseFields = extractFields(jsonData);

      // 디버깅을 위한 로그
      console.log("Generated fields from JSON:", responseFields);
      responseFields.forEach((field) => {
        console.log(
          `Field: ${field.name}, Type: ${field.type}, Value: "${field.value}"`
        );
      });

      setGeneratedFields((prev) => ({
        ...prev,
        responseFields,
      }));

      setShowJsonInput(false);
      setJsonInput("");
    } catch (error) {
      setError("올바른 JSON 형식이 아닙니다.");
    }
  };

  const validateForm = () => {
    if (!formData.project.trim()) {
      setError("프로젝트명을 입력해주세요.");
      return false;
    }

    // 예약된 프로젝트명 검증
    if (isReservedProjectName(formData.project.trim())) {
      setError(
        `'${formData.project}'은(는) 예약된 프로젝트명입니다. 다른 이름을 사용해주세요.`
      );
      return false;
    }

    if (!formData.user.trim()) {
      setError("사용자명을 입력해주세요.");
      return false;
    }

    // 예약된 사용자명 검증
    if (isReservedUserName(formData.user.trim())) {
      setError(
        `'${formData.user}'은(는) 예약된 사용자명입니다. 다른 이름을 사용해주세요.`
      );
      return false;
    }

    if (!formData.apiName.trim()) {
      setError("API 이름을 입력해주세요.");
      return false;
    }
    if (!formData.url.trim()) {
      setError("API URL을 입력해주세요.");
      return false;
    }
    if (generatedFields.responseFields.length === 0) {
      setError("응답 필드를 최소 하나 이상 생성해주세요.");
      return false;
    }

    // 응답 필드 이름 중복 확인
    const responseFieldNames = generatedFields.responseFields.map(
      (f) => f.name
    );
    const uniqueNames = new Set(responseFieldNames);
    if (responseFieldNames.length !== uniqueNames.size) {
      setError("응답 필드 이름이 중복됩니다.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 응답 필드에서 사용자가 지정한 값들을 mockData로 변환
      const mockData: Record<string, any> = {};

      const processFieldValue = (field: Field): any => {
        const fieldValue = field.value || "";

        if (fieldValue.trim() === "") {
          // 값이 없으면 null 반환 (나중에 제거됨)
          return null;
        }

        // 타입에 따라 값을 파싱
        switch (field.type) {
          case "number":
            return isNaN(Number(fieldValue)) ? null : Number(fieldValue);
          case "boolean":
            return fieldValue.toLowerCase() === "true"
              ? true
              : fieldValue.toLowerCase() === "false"
              ? false
              : null;
          case "array":
            try {
              const parsed = JSON.parse(fieldValue);
              return Array.isArray(parsed) ? parsed : null;
            } catch {
              return null;
            }
          case "object":
            try {
              const parsed = JSON.parse(fieldValue);
              return typeof parsed === "object" && parsed !== null
                ? parsed
                : null;
            } catch {
              return null;
            }
          default:
            return fieldValue;
        }
      };

      // 중첩 객체 구조를 생성
      generatedFields.responseFields.forEach((field) => {
        const value = processFieldValue(field);

        console.log(
          `Processing field: ${field.name}, type: ${field.type}, original value: "${field.value}", processed value:`,
          value
        );

        if (value === null) {
          // 값이 null이면 건너뛰기
          console.log(`Skipping field: ${field.name} (null value)`);
          return;
        }

        if (field.name.includes(".")) {
          // 중첩 필드인 경우 (예: profile.age)
          const keys = field.name.split(".");
          let current = mockData;

          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }

          current[keys[keys.length - 1]] = value;
          console.log(`Set nested field: ${field.name} =`, value);
        } else {
          // 최상위 필드인 경우
          mockData[field.name] = value;
          console.log(`Set top-level field: ${field.name} =`, value);
        }
      });

      // 빈 값이나 null인 경우 제거
      Object.keys(mockData).forEach((key) => {
        if (
          mockData[key] === "" ||
          mockData[key] === null ||
          mockData[key] === undefined
        ) {
          delete mockData[key];
        }
      });

      // 중첩 객체에서도 빈 값 제거
      const cleanNestedObjects = (obj: any) => {
        Object.keys(obj).forEach((key) => {
          if (obj[key] && typeof obj[key] === "object") {
            cleanNestedObjects(obj[key]);
            if (Object.keys(obj[key]).length === 0) {
              delete obj[key];
            }
          }
        });
      };
      cleanNestedObjects(mockData);

      // 디버깅을 위한 로그
      console.log("Generated mockData:", mockData);

      const response = await fetch(withBasePath("/api/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          requestFields: generatedFields.requestFields,
          responseFields: generatedFields.responseFields,
          mockData, // 사용자가 지정한 값들을 포함한 mockData 전달
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        router.push("/");
      } else {
        setError(result.error || "API 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("API 생성 오류:", error);
      setError("API 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            커스텀 API 생성
          </h1>
          <p className="text-gray-600">
            AI를 활용하여 Mock API를 생성하되, AI가 필드와 실제 JSON 값까지
            자동으로 생성합니다. 생성된 값은 수정 가능하며, 비워두면 랜덤
            데이터가 생성됩니다.
          </p>
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
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 기본 정보 */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              기본 정보
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  프로젝트명
                </label>
                <input
                  type="text"
                  required
                  value={formData.project}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      project: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  사용자명
                </label>
                <input
                  type="text"
                  required
                  value={formData.user}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, user: e.target.value }))
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  API 이름
                </label>
                <input
                  type="text"
                  required
                  value={formData.apiName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      apiName: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  HTTP 메서드
                </label>
                <select
                  value={formData.method}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, method: e.target.value }))
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  API URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="/api/users"
                  value={formData.url}
                  onChange={(e) => {
                    let url = e.target.value;
                    // URL이 비어있지 않고 /로 시작하지 않으면 /를 추가
                    if (url && !url.startsWith("/")) {
                      url = "/" + url;
                    }
                    setFormData((prev) => ({ ...prev, url }));
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  API 설명 (AI가 필드를 생성할 때 사용)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="예: 사용자 정보를 조회하는 API입니다. 사용자 ID를 받아서 이름, 이메일, 가입일을 반환합니다."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {/* AI 필드 생성 버튼 */}
            <div className="mt-6">
              <button
                type="button"
                onClick={generateFieldsWithAI}
                disabled={
                  generating ||
                  !formData.apiName.trim() ||
                  !formData.description.trim()
                }
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    AI 생성 중...
                  </>
                ) : (
                  <>
                    <svg
                      className="-ml-1 mr-3 h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    AI로 필드 자동 생성
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI 생성된 필드들 */}
          {(generatedFields.requestFields.length > 0 ||
            generatedFields.responseFields.length > 0) && (
            <>
              {/* AI 생성 결과 표시 */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      {aiGenerated
                        ? "AI가 생성한 필드"
                        : "기본 필드 (AI 키 미설정)"}
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      {aiGenerated
                        ? "AI가 API 설명을 분석하여 요청/응답 필드와 실제 JSON 값까지 자동으로 생성했습니다. 생성된 값은 수정 가능하며, 비워두면 랜덤 데이터가 생성됩니다."
                        : "OpenAI API 키가 설정되지 않아 기본 필드가 생성되었습니다. .env 파일에 API 키를 설정하면 AI 기능을 사용할 수 있습니다."}
                    </div>
                  </div>
                </div>
              </div>

              {/* 요청 필드 */}
              {generatedFields.requestFields.length > 0 && (
                <div className="bg-white shadow sm:rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      요청 필드 {aiGenerated && "(AI 생성)"}
                    </h3>
                    <button
                      type="button"
                      onClick={() => addField("request")}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                    >
                      필드 추가
                    </button>
                  </div>
                  {generatedFields.requestFields.map((field, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-5 mb-4"
                    >
                      <input
                        type="text"
                        placeholder="필드명"
                        value={field.name}
                        onChange={(e) =>
                          updateField("request", index, {
                            name: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField("request", index, {
                            type: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="name">Name</option>
                        <option value="address">Address</option>
                        <option value="date">Date</option>
                      </select>
                      <input
                        type="text"
                        placeholder="설명"
                        value={field.description}
                        onChange={(e) =>
                          updateField("request", index, {
                            description: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              updateField("request", index, {
                                required: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            필수
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeField("request", index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 응답 필드 */}
              {generatedFields.responseFields.length > 0 && (
                <div className="bg-white shadow sm:rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      응답 필드 {aiGenerated && "(AI 생성)"}
                    </h3>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowJsonInput(!showJsonInput)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-green-600 bg-green-100 hover:bg-green-200"
                      >
                        JSON으로 입력
                      </button>
                      <button
                        type="button"
                        onClick={() => addField("response")}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                      >
                        필드 추가
                      </button>
                    </div>
                  </div>
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      💡 <strong>응답 값 설정:</strong> AI가 생성한 값이
                      자동으로 입력됩니다. 필요에 따라 값을 수정하거나 비워두면
                      랜덤 데이터가 생성됩니다. JSON 형태로도 입력 가능합니다.
                    </p>
                  </div>

                  {/* JSON 입력 UI */}
                  {showJsonInput && (
                    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        JSON 응답 데이터 입력
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        복잡한 JSON 구조를 입력하면 자동으로 필드로 변환됩니다.
                      </p>
                      <textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder='{"id": 1023, "name": "김지은", "profile": {"age": 33, "gender": "female"}}'
                        rows={6}
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <div className="mt-3 flex space-x-2">
                        <button
                          type="button"
                          onClick={parseJsonToFields}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          JSON 파싱
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowJsonInput(false);
                            setJsonInput("");
                          }}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                  {generatedFields.responseFields.map((field, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-5 mb-4"
                    >
                      <input
                        type="text"
                        placeholder="필드명"
                        value={field.name}
                        onChange={(e) =>
                          updateField("response", index, {
                            name: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField("response", index, {
                            type: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="name">Name</option>
                        <option value="address">Address</option>
                        <option value="date">Date</option>
                        <option value="array">Array</option>
                        <option value="object">Object</option>
                      </select>
                      <input
                        type="text"
                        placeholder="설명"
                        value={field.description}
                        onChange={(e) =>
                          updateField("response", index, {
                            description: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <input
                        type="text"
                        placeholder="응답 값 (비워두면 랜덤)"
                        value={field.value || ""}
                        onChange={(e) =>
                          updateField("response", index, {
                            value: e.target.value,
                          })
                        }
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              updateField("response", index, {
                                required: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            필수
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeField("response", index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 제출 버튼 */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || generatedFields.responseFields.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  생성 중...
                </div>
              ) : (
                "API 생성"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 스트리밍 모달 */}
      {showStreamingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  🤖 AI 필드 및 값 생성 진행 상황
                </h3>
                <button
                  onClick={() => setShowStreamingModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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

              <div
                className={`p-4 rounded-md font-mono text-sm h-96 overflow-y-auto ${
                  error
                    ? "bg-red-900 text-red-400"
                    : "bg-gray-900 text-green-400"
                }`}
              >
                <pre className="whitespace-pre-wrap">
                  {streamingContent || "AI가 필드와 값을 생성하고 있습니다..."}
                </pre>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowStreamingModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
