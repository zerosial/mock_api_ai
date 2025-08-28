import LLMChat from "@/app/components/LLMChat";

export default function LLMChatPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            로컬 LLM 채팅
          </h1>
          <p className="text-gray-600">
            도커 환경에서 실행 중인 AI 모델과 실시간으로 대화하세요
          </p>
        </div>

        <LLMChat />

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>이 서비스는 로컬에서 실행되는 LG 엑사원 모델을 사용합니다.</p>
          <p className="mt-1">
            모델 로딩에는 시간이 걸릴 수 있으며, 첫 번째 응답은 지연될 수
            있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
