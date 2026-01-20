# Google OAuth redirect_uri_mismatch 오류 해결 가이드

## 오류 메시지

```
400 오류: redirect_uri_mismatch
액세스 차단됨: 이 앱의 요청이 잘못되었습니다
```

## 원인

Google Cloud Console에서 설정한 **승인된 리디렉션 URI**와 NextAuth가 실제로 사용하는 리디렉션 URI가 일치하지 않아 발생합니다.

## 해결 방법

### 1단계: 현재 설정 확인

터미널에서 다음 명령어로 NextAuth가 생성하는 콜백 URL을 확인하세요:

```bash
curl http://localhost:3000/api/auth/providers
```

응답에서 `callbackUrl`을 확인하세요. 예:
```json
{
  "google": {
    "callbackUrl": "http://localhost:3000/mockapi/api/auth/callback/google"
  }
}
```

### 2단계: Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택
3. **APIs & Services** > **Credentials** 이동
4. OAuth 2.0 Client ID 클릭
5. **승인된 리디렉션 URI** 섹션 확인

### 3단계: 올바른 리디렉션 URI 추가

**현재 basePath 설정 (`NEXT_PUBLIC_BASE_PATH=/mockapi`)에 따라 다음 URL을 추가하세요:**

```
http://localhost:3000/mockapi/api/auth/callback/google
```

**중요 사항:**
- ✅ basePath(`/mockapi`)를 포함한 전체 URL
- ✅ `http://` 또는 `https://` 프로토콜 포함
- ✅ 포트 번호 포함 (`:3000`)
- ✅ 경로 끝에 `/google` 포함

### 4단계: 잘못된 URI 제거

다음과 같은 잘못된 URI가 있다면 제거하세요:
- ❌ `http://localhost:3000/api/auth/callback/google` (basePath 없음)
- ❌ `http://localhost:3000/mockapi/api/auth/callback` (끝에 `/google` 없음)
- ❌ `http://localhost/mockapi/api/auth/callback/google` (포트 번호 없음)

### 5단계: 변경 사항 저장 및 테스트

1. Google Cloud Console에서 **저장** 클릭
2. 변경 사항이 적용되는 데 몇 분이 걸릴 수 있습니다
3. 브라우저에서 로그인 다시 시도

## 프로덕션 환경 설정

프로덕션 환경에서는 다음 URL도 추가해야 합니다:

```
https://your-domain.com/mockapi/api/auth/callback/google
```

## 디버깅 팁

### 실제 요청되는 URL 확인

브라우저 개발자 도구의 Network 탭에서:
1. 로그인 버튼 클릭
2. Google OAuth 페이지로 리디렉션되는 요청 확인
3. URL 파라미터에서 `redirect_uri` 값 확인

또는 터미널에서:
```bash
# 로그인 시도 후 터미널 로그 확인
# [NextAuth] Rewrite request: { url: "..." } 로그 확인
```

### 환경 변수 확인

`.env` 파일에서 다음이 올바르게 설정되어 있는지 확인:

```env
NEXT_PUBLIC_BASE_PATH=/mockapi
NEXTAUTH_URL=http://localhost:3000/mockapi
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## 일반적인 실수

1. **basePath 누락**: `http://localhost:3000/api/auth/callback/google` ❌
2. **포트 번호 누락**: `http://localhost/mockapi/api/auth/callback/google` ❌
3. **프로토콜 누락**: `localhost:3000/mockapi/api/auth/callback/google` ❌
4. **끝 경로 누락**: `http://localhost:3000/mockapi/api/auth/callback` ❌

## 확인 체크리스트

- [ ] Google Cloud Console에서 올바른 리디렉션 URI 추가
- [ ] 잘못된 리디렉션 URI 제거
- [ ] 변경 사항 저장
- [ ] `.env` 파일의 `NEXTAUTH_URL` 확인
- [ ] 개발 서버 재시작 (`npm run dev`)
- [ ] 브라우저 캐시 클리어
- [ ] 로그인 다시 시도

