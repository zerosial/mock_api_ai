"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isReservedProjectName, isReservedUserName } from "@/lib/constants";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
  value: string;
}

interface GeneratedFields {
  requestFields: Field[];
  responseFields: Field[];
}

export default function CreateJsonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    project: "",
    user: "",
    apiName: "",
    method: "GET",
    url: "",
    description: "",
  });
  const [jsonInput, setJsonInput] = useState<string>("");
  const [generatedFields, setGeneratedFields] = useState<GeneratedFields>({
    requestFields: [],
    responseFields: [],
  });

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

      setGeneratedFields((prev) => ({
        ...prev,
        responseFields,
      }));

      setError(null);
    } catch (error) {
      setError("올바른 JSON 형식이 아닙니다.");
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

  const validateForm = () => {
    if (!formData.project.trim()) {
      setError("프로젝트명을 입력해주세요.");
      return false;
    }
    
    // 예약된 프로젝트명 검증
    if (isReservedProjectName(formData.project.trim())) {
      setError(`'${formData.project}'은(는) 예약된 프로젝트명입니다. 다른 이름을 사용해주세요.`);
      return false;
    }
    
    if (!formData.user.trim()) {
      setError("사용자명을 입력해주세요.");
      return false;
    }
    
    // 예약된 사용자명 검증
    if (isReservedUserName(formData.user.trim())) {
      setError(`'${formData.user}'은(는) 예약된 사용자명입니다. 다른 이름을 사용해주세요.`);
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
      setError("JSON을 입력하여 응답 필드를 생성해주세요.");
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
          // 값이 없으면 타입에 따라 랜덤 생성
          return field.type;
        }

        // 타입에 따라 값을 파싱
        switch (field.type) {
          case "number":
            return isNaN(Number(fieldValue)) ? field.type : Number(fieldValue);
          case "boolean":
            return fieldValue.toLowerCase() === "true"
              ? true
              : fieldValue.toLowerCase() === "false"
              ? false
              : field.type;
          case "array":
            try {
              return JSON.parse(fieldValue);
            } catch {
              return field.type;
            }
          case "object":
            try {
              return JSON.parse(fieldValue);
            } catch {
              return field.type;
            }
          default:
            return fieldValue;
        }
      };

      // 중첩 객체 구조를 생성
      generatedFields.responseFields.forEach((field) => {
        const value = processFieldValue(field);

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
        } else {
          // 최상위 필드인 경우
          mockData[field.name] = value;
        }
      });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          requestFields: generatedFields.requestFields,
          responseFields: generatedFields.responseFields,
          mockData,
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
            JSON으로 API 생성
          </h1>
          <p className="text-gray-600">
            JSON 데이터를 입력하면 자동으로 필드로 변환되어 Mock API를
            생성합니다. 복잡한 객체나 배열 구조도 지원됩니다.
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
                  API 설명
                </label>
                <textarea
                  rows={3}
                  placeholder="API에 대한 간단한 설명을 입력하세요."
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
          </div>

          {/* JSON 입력 */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              JSON 응답 데이터
            </h3>
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                💡 <strong>JSON 입력:</strong> API가 반환할 JSON 응답 데이터를
                입력하세요. 복잡한 객체나 배열 구조도 지원됩니다.
              </p>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"id": 1023, "name": "김지은", "email": "jieun@example.com", "profile": {"age": 33, "gender": "female"}, "roles": ["user", "editor"]}'
              rows={8}
              className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
            />
            <div className="mt-4">
              <button
                type="button"
                onClick={parseJsonToFields}
                disabled={!jsonInput.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              >
                JSON 파싱하여 필드 생성
              </button>
            </div>
          </div>

          {/* 생성된 필드들 */}
          {generatedFields.responseFields.length > 0 && (
            <>
              {/* 생성 결과 표시 */}
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      JSON에서 생성된 필드
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      JSON 데이터가 성공적으로 필드로 변환되었습니다. 필요에
                      따라 수정하거나 추가 필드를 생성할 수 있습니다.
                    </div>
                  </div>
                </div>
              </div>

              {/* 요청 필드 */}
              <div className="bg-white shadow sm:rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    요청 필드
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
                    className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-4"
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
                        <span className="ml-2 text-sm text-gray-700">필수</span>
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

              {/* 응답 필드 */}
              <div className="bg-white shadow sm:rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    응답 필드 (JSON에서 생성됨)
                  </h3>
                  <button
                    type="button"
                    onClick={() => addField("response")}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                  >
                    필드 추가
                  </button>
                </div>
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    💡 <strong>응답 값 설정:</strong> JSON에서 자동으로 생성된
                    값들이 입력됩니다. 필요에 따라 값을 수정하거나 비워두면 랜덤
                    데이터가 생성됩니다.
                  </p>
                </div>
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
                      placeholder="응답 값"
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
                        <span className="ml-2 text-sm text-gray-700">필수</span>
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
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
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
    </div>
  );
}
