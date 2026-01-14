# Google OAuth 콜백 404 에러 해결 가이드

## 문제 상황

Google OAuth 로그인 후 콜백이 `/api/auth/callback/google` (basePath 없이)로 리디렉션되어 404 에러가 발생합니다.

## 원인

Google Cloud Console에서 승인된 리디렉션 URI가 basePath를 포함하지 않은 `/api/auth/callback/google`로 설정되어 있거나, NextAuth가 basePath를 포함하지 않은 URL을 생성하고 있을 수 있습니다.

## 해결 방법

### 1. Google Cloud Console 설정 확인

Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs에서 승인된 리디렉션 URI가 다음으로 설정되어 있는지 확인하세요:

```
http://localhost:3000/mockapi/api/auth/callback/google
```

**중요**: basePath(`/mockapi`)를 포함한 전체 URL로 설정해야 합니다.

### 2. 환경 변수 확인

`.env` 파일에서 `NEXTAUTH_URL`이 basePath를 포함한 전체 URL로 설정되어 있는지 확인하세요:

```env
NEXTAUTH_URL=http://localhost:3000/mockapi
NEXT_PUBLIC_BASE_PATH=/mockapi
```

### 3. 현재 설정 상태 확인

다음 명령어로 현재 설정을 확인할 수 있습니다:

```bash
# providers 엔드포인트 확인
curl http://localhost:3000/api/auth/providers

# callbackUrl이 basePath를 포함한 URL로 설정되어 있어야 함
# 예: "callbackUrl": "http://localhost:3000/mockapi/api/auth/callback/google"
```

### 4. middleware 확인

`middleware.ts`에서 `/api/auth/*` 경로를 basePath 포함 경로로 rewrite하는 로직이 있는지 확인하세요:

```typescript
if (basePath && pathname.startsWith("/api/auth/") && !pathname.startsWith(basePath + "/api/auth/")) {
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = basePath + pathname;
  return NextResponse.rewrite(rewriteUrl);
}
```

## 테스트 방법

1. Google Cloud Console에서 콜백 URL을 `http://localhost:3000/mockapi/api/auth/callback/google`로 설정
2. 서버 재시작: `npm run dev`
3. 로그인 버튼 클릭
4. Google 로그인 완료 후 콜백 URL 확인
5. 터미널에서 다음 로그 확인:
   - `[Middleware] Request pathname: /api/auth/callback/google`
   - `[Middleware] Rewriting /api/auth/*: /api/auth/callback/google -> /mockapi/api/auth/callback/google`
   - `[NextAuth GET] Original pathname: /mockapi/api/auth/callback/google`

## 추가 디버깅

콜백이 여전히 작동하지 않으면 다음을 확인하세요:

1. **터미널 로그 확인**: `[auth][warn][env-url-basepath-mismatch]` 경고가 나타나는지 확인
2. **브라우저 네트워크 탭**: 실제 콜백 URL이 무엇인지 확인
3. **NextAuth 설정**: `lib/auth.ts`에서 `basePath: "/mockapi/api/auth"`가 올바르게 설정되어 있는지 확인

