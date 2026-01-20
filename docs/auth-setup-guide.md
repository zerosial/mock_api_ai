# 인증 기능 설정 가이드

## 1. 환경 변수 설정

`.env` 파일에 다음 환경 변수를 추가하세요:

```env
# NextAuth 설정
# ⚠️ 중요: NEXT_PUBLIC_BASE_PATH를 사용하는 경우, NEXTAUTH_URL에도 basePath를 포함해야 합니다
# 예: NEXT_PUBLIC_BASE_PATH=/mockapi 인 경우
#     NEXTAUTH_URL=http://localhost:3000/mockapi
NEXTAUTH_URL=http://localhost:3000/mockapi
NEXTAUTH_SECRET=your-secret-key-here-change-in-production

# Google OAuth 설정
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### NEXTAUTH_SECRET 생성 방법

터미널에서 다음 명령어를 실행하여 시크릿 키를 생성할 수 있습니다:

```bash
openssl rand -base64 32
```

또는 온라인 생성기를 사용하세요: https://generate-secret.vercel.app/32

## 2. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. "API 및 서비스" > "사용자 인증 정보"로 이동
4. "사용자 인증 정보 만들기" > "OAuth 클라이언트 ID" 선택
5. 애플리케이션 유형: "웹 애플리케이션" 선택
6. 승인된 리디렉션 URI 추가:

   - 개발 환경 (basePath 없음): `http://localhost:3000/api/auth/callback/google`
   - 개발 환경 (basePath=/mockapi): `http://localhost:3000/mockapi/api/auth/callback/google`
   - 프로덕션 환경 (basePath 없음): `https://your-domain.com/api/auth/callback/google`
   - 프로덕션 환경 (basePath=/mockapi): `https://your-domain.com/mockapi/api/auth/callback/google`

   ⚠️ **중요**: `NEXT_PUBLIC_BASE_PATH`를 사용하는 경우, 리디렉션 URI에도 반드시 basePath를 포함해야 합니다!

7. 생성된 클라이언트 ID와 클라이언트 보안 비밀번호를 `.env` 파일에 추가

## 3. 데이터베이스 마이그레이션

### 기존 데이터가 없는 경우

```bash
npx prisma migrate dev --name add_user_auth
```

### 기존 데이터가 있는 경우

데이터베이스를 리셋하고 싶지 않다면, 다음 명령어를 사용하세요:

```bash
npx prisma db push
```

이 명령어는 마이그레이션 파일을 생성하지 않고 스키마 변경사항을 직접 데이터베이스에 적용합니다.

### Prisma Client 재생성

마이그레이션 후 Prisma Client를 재생성하세요:

```bash
npx prisma generate
```

## 4. 기능 확인

1. 개발 서버 실행:

   ```bash
   npm run dev
   ```

2. 브라우저에서 `http://localhost:3000` 접속

3. 네비게이션 바 우측 상단의 "구글 로그인" 버튼 클릭

4. Google 계정으로 로그인

5. 로그인 성공 시 프로필 이미지와 이름이 표시됩니다

## 5. 생성된 테이블

다음 테이블이 데이터베이스에 생성됩니다:

- `users`: 사용자 정보
- `accounts`: OAuth 계정 정보
- `sessions`: 세션 정보
- `verification_tokens`: 이메일 인증 토큰 (향후 사용)

## 문제 해결

### "Configuration" 오류

- `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`이 올바르게 설정되었는지 확인
- Google Cloud Console에서 리디렉션 URI가 올바르게 설정되었는지 확인

### "AccessDenied" 오류

- Google Cloud Console에서 OAuth 동의 화면이 올바르게 설정되었는지 확인
- 테스트 사용자로 추가되었는지 확인 (앱이 아직 검증되지 않은 경우)

### 세션이 유지되지 않는 경우

- `NEXTAUTH_SECRET`이 설정되었는지 확인
- 데이터베이스 연결이 올바른지 확인
- `sessions` 테이블이 생성되었는지 확인
