"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    project: "",
    user: "",
    apiName: "",
    method: "GET",
    url: "",
    requestFields: [] as Field[],
    responseFields: [] as Field[],
  });

  const addField = (type: "request" | "response") => {
    const newField: Field = {
      name: "",
      type: "string",
      required: false,
      description: "",
    };

    setFormData((prev) => ({
      ...prev,
      [type === "request" ? "requestFields" : "responseFields"]: [
        ...prev[type === "request" ? "requestFields" : "responseFields"],
        newField,
      ],
    }));
  };

  const updateField = (
    type: "request" | "response",
    index: number,
    field: Partial<Field>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [type === "request" ? "requestFields" : "responseFields"]: prev[
        type === "request" ? "requestFields" : "responseFields"
      ].map((f, i) => (i === index ? { ...f, ...field } : f)),
    }));
  };

  const removeField = (type: "request" | "response", index: number) => {
    setFormData((prev) => ({
      ...prev,
      [type === "request" ? "requestFields" : "responseFields"]: prev[
        type === "request" ? "requestFields" : "responseFields"
      ].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push("/");
      } else {
        alert("API 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("API 생성 오류:", error);
      alert("API 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">새 API 생성</h1>
          <p className="text-gray-600">AI를 활용하여 Mock API를 생성하세요</p>
        </div>

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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, url: e.target.value }))
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* 요청 필드 */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">요청 필드</h3>
              <button
                type="button"
                onClick={() => addField("request")}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                필드 추가
              </button>
            </div>
            {formData.requestFields.map((field, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-4"
              >
                <input
                  type="text"
                  placeholder="필드명"
                  value={field.name}
                  onChange={(e) =>
                    updateField("request", index, { name: e.target.value })
                  }
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    updateField("request", index, { type: e.target.value })
                  }
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
              <h3 className="text-lg font-medium text-gray-900">응답 필드</h3>
              <button
                type="button"
                onClick={() => addField("response")}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
              >
                필드 추가
              </button>
            </div>
            {formData.responseFields.map((field, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-4"
              >
                <input
                  type="text"
                  placeholder="필드명"
                  value={field.name}
                  onChange={(e) =>
                    updateField("response", index, { name: e.target.value })
                  }
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    updateField("response", index, { type: e.target.value })
                  }
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                    updateField("response", index, {
                      description: e.target.value,
                    })
                  }
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "생성 중..." : "API 생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
