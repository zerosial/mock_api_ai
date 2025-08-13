export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div className="text-gray-600 text-lg">
          Mock API 목록을 불러오는 중...
        </div>
      </div>
    </div>
  );
}
