# AI API 생성기

AI를 활용하여 Mock API를 자동으로 생성하고 관리하는 Next.js 애플리케이션입니다.

## 주요 기능

- **AI 기반 API 생성**: 사용자가 요청/응답 규격만 입력하면 AI가 OpenAPI 스펙과 API 핸들러 코드를 자동 생성
- **Mock 데이터 자동 생성**: Faker.js를 활용하여 현실적인 Mock 데이터 제공
- **동적 엔드포인트**: `/api/:project/:user/:apiUrl` 형태로 생성된 API 즉시 호출 가능
- **API 관리**: 생성된 API 목록 조회, 수정, 삭제 기능

## 기술 스택

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **AI**: OpenAI GPT-4
- **Mock Data**: Faker.js
- **Deployment**: Docker, Docker Compose

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mock_api_ai"
OPENAI_API_KEY="your-openai-api-key-here"
```

### 3. 데이터베이스 설정

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 마이그레이션
npx prisma migrate dev --name init
```

### 4. 개발 서버 실행

```bash
npm run dev
```

### 5. Docker로 실행 (선택사항)

```bash
# Docker Compose로 전체 스택 실행
docker-compose up -d

# 마이그레이션 적용
docker-compose exec app npx prisma migrate deploy
```

## 사용법

### 1. API 생성

1. 메인 페이지에서 "새 API 생성" 버튼 클릭
2. 기본 정보 입력 (프로젝트명, 사용자명, API 이름, HTTP 메서드, URL)
3. 요청/응답 필드 정의
4. "API 생성" 버튼 클릭하여 AI로 API 스펙 생성

### 2. 생성된 API 호출

생성된 API는 다음 URL 형태로 호출할 수 있습니다:

```
GET /api/{project}/{user}{apiUrl}
POST /api/{project}/{user}{apiUrl}
PUT /api/{project}/{user}{apiUrl}
DELETE /api/{project}/{user}{apiUrl}
```

예시:

```
GET /api/myproject/user1/api/users
POST /api/myproject/user1/api/users
```

### 3. API 관리

- 메인 페이지에서 생성된 API 목록 확인
- 각 API의 호출 횟수와 생성 날짜 확인
- "테스트" 버튼으로 API 직접 호출 가능

## API 엔드포인트

### API 생성

- `POST /api/generate` - AI를 사용하여 새 API 생성

### 템플릿 관리

- `GET /api/templates` - 템플릿 목록 조회
- `POST /api/templates` - 새 템플릿 생성

### 동적 API 호출

- `GET /api/:project/:user/:apiUrl` - 생성된 API 호출
- `POST /api/:project/:user/:apiUrl` - 생성된 API 호출
- `PUT /api/:project/:user/:apiUrl` - 생성된 API 호출
- `DELETE /api/:project/:user/:apiUrl` - 생성된 API 호출

## 데이터베이스 스키마

### Template 테이블

- `id`: 기본 키
- `project`: 프로젝트명
- `user`: 사용자명
- `apiUrl`: API URL 경로
- `method`: HTTP 메서드
- `apiName`: API 이름
- `requestSpec`: 요청 스펙 (JSON)
- `responseSpec`: 응답 스펙 (JSON)
- `generatedCode`: 생성된 코드
- `mockData`: Mock 데이터
- `isActive`: 활성화 여부
- `createdAt`: 생성일
- `updatedAt`: 수정일

### ApiLog 테이블

- `id`: 기본 키
- `templateId`: Template 외래키
- `requestBody`: 요청 본문
- `responseBody`: 응답 본문
- `statusCode`: HTTP 상태 코드
- `responseTime`: 응답 시간 (ms)
- `userAgent`: 사용자 에이전트
- `ipAddress`: IP 주소
- `createdAt`: 생성일

## 개발 가이드

### 새로운 기능 추가

1. **API 라우트 추가**: `app/api/` 디렉토리에 새 라우트 파일 생성
2. **데이터베이스 스키마 수정**: `prisma/schema.prisma` 파일 수정 후 마이그레이션 실행
3. **프론트엔드 페이지 추가**: `app/` 디렉토리에 새 페이지 파일 생성

### 환경 변수

- `DATABASE_URL`: PostgreSQL 연결 문자열
- `OPENAI_API_KEY`: OpenAI API 키
- `NODE_ENV`: 실행 환경 (development/production)

## 배포

### Docker 배포

```bash
# 이미지 빌드
docker-compose build

# 컨테이너 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### Vercel 배포

1. GitHub 저장소에 코드 푸시
2. Vercel에서 프로젝트 연결
3. 환경 변수 설정
4. 자동 배포 완료

## 라이선스

MIT License

## 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
