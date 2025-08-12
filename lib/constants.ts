// 예약된 프로젝트명과 사용자명 (시스템에서 사용하는 이름들)
export const RESERVED_PROJECT_NAMES = [
  "proxy", // 프록시 시스템
  "history", // 히스토리 관리 시스템
  "api", // API 관리 시스템
  "admin", // 관리자 시스템
  "system", // 시스템 관리
  "config", // 설정 관리
  "auth", // 인증 시스템
  "user", // 사용자 관리
  "template", // 템플릿 관리
  "log", // 로그 시스템
  "stats", // 통계 시스템
  "monitor", // 모니터링 시스템
  "health", // 헬스체크
  "status", // 상태 확인
  "metrics", // 메트릭 수집
] as const;

export const RESERVED_USER_NAMES = [
  "admin", // 관리자
] as const;

// 예약된 이름인지 확인하는 함수
export function isReservedProjectName(name: string): boolean {
  return RESERVED_PROJECT_NAMES.some(
    (reserved) => reserved === name.toLowerCase()
  );
}

export function isReservedUserName(name: string): boolean {
  return RESERVED_USER_NAMES.some(
    (reserved) => reserved === name.toLowerCase()
  );
}

// 예약된 이름 목록을 문자열로 반환하는 함수
export function getReservedProjectNamesString(): string {
  return RESERVED_PROJECT_NAMES.join(", ");
}

export function getReservedUserNamesString(): string {
  return RESERVED_USER_NAMES.join(", ");
}
