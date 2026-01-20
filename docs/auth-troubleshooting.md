# 인증 문제 해결 가이드

## "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" 오류

이 오류는 NextAuth API 엔드포인트가 HTML을 반환하고 있다는 의미입니다. 보통 basePath 설정 문제로 발생합니다.

### 해결 방법

1. **환경 변수 확인**
   ```env
   NEXT_PUBLIC_BASE_PATH=/mockapi
   NEXTAUTH_URL=http://localhost:3000/mockapi
   ```

2. **개발 서버 재시작**
   ```bash
   # Ctrl+C로 서버 중지 후
   npm run dev
   ```

3. **브라우저 콘솔 확인**
   - 브라우저 개발자 도구의 Network 탭에서 `/api/auth/session` 요청을 확인
   - 올바른 경로: `http://localhost:3000/mockapi/api/auth/session`
   - 잘못된 경로: `http://localhost:3000/api/auth/session`

4. **직접 API 테스트**
   브라우저에서 다음 URL로 직접 접근:
   ```
   http://localhost:3000/mockapi/api/auth/providers
   ```
   
   이 URL이 JSON을 반환해야 합니다. HTML이 반환되면 basePath 설정이 잘못된 것입니다.

5. **NextAuth 로그 확인**
   서버 콘솔에서 NextAuth 관련 오류 메시지 확인

6. **캐시 클리어**
   - 브라우저 캐시 클리어
   - `.next` 폴더 삭제 후 재빌드:
     ```bash
     rm -rf .next
     npm run dev
     ```

## 구글 로그인 버튼이 작동하지 않음

1. **Google Cloud Console 설정 확인**
   - 리디렉션 URI가 올바른지 확인:
     ```
     http://localhost:3000/mockapi/api/auth/callback/google
     ```

2. **환경 변수 확인**
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

3. **콘솔 에러 확인**
   - 브라우저 개발자 도구에서 JavaScript 오류 확인
   - Network 탭에서 실패한 요청 확인

## 세션이 유지되지 않음

1. **데이터베이스 연결 확인**
   ```bash
   npx prisma studio
   ```
   `sessions` 테이블이 생성되었는지 확인

2. **쿠키 설정 확인**
   - 브라우저 개발자 도구 > Application > Cookies
   - `next-auth.session-token` 쿠키가 있는지 확인

3. **NEXTAUTH_SECRET 확인**
   ```env
   NEXTAUTH_SECRET=your-secret-key
   ```

