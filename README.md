# AI API 생성기

AI를 활용하여 Mock API를 생성하고 관리하는 웹 애플리케이션입니다.

## 주요 기능

### 1. Mock API 생성

- **랜덤 값 생성**: AI가 자동으로 Mock 데이터를 생성
- **커스텀 값 생성**: 사용자가 지정한 값으로 Mock 데이터 생성
- **JSON 직접 입력**: JSON 형식으로 Mock 데이터 직접 입력

### 2. 프록시 서버 기능 (신규!)

- **CORS 문제 해결**: 외부 API를 프록시하여 CORS 에러 방지
- **Mock API 혼합**: 프록시 서버에 Mock API 추가 가능
- **자동 라우팅**: Mock API가 있으면 Mock 데이터, 없으면 실제 서버로 프록시

### 3. API 관리

- **지연 시간 설정**: API 응답 지연 시간 설정 (0-30초)
- **에러 코드 설정**: 특정 HTTP 에러 코드 반환 설정
- **실시간 테스트**: 생성된 API를 즉시 테스트 가능
- **JSON 편집**: 응답 데이터를 실시간으로 편집 가능

## 사용법

### Mock API 생성

1. 메인 페이지에서 원하는 생성 방식을 선택
2. API 이름, 메서드, URL, 필드 정보 입력
3. AI가 자동으로 Mock 데이터 생성
4. 생성된 API를 테스트하고 편집

### 프록시 서버 사용

1. **프록시 서버 생성**

   - `/proxy` 페이지에서 새 프록시 서버 생성
   - 프록시 서버 이름과 목표 URL 설정
   - 예: `mobilemanager` → `https://mobilemanager.com`

2. **Mock API 추가**

   - 프록시 서버에 Mock API 추가
   - 특정 경로에 대한 Mock 데이터 설정
   - 예: `/users/{id}` 경로에 사용자 정보 Mock 데이터

3. **프록시 사용**
   - `/api/proxy/mobilemanager/users/123` 접속
   - Mock API가 있으면 Mock 데이터 반환
   - Mock API가 없으면 `https://mobilemanager.com/users/123`으로 프록시

## 기술 스택

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Prisma ORM)
- **AI**: Local LLM (LG 엑사원 모델) + OpenAI GPT-4 (폴백)
- **Deployment**: Docker + Docker Compose

## 설치 및 실행

### Docker를 사용한 배포 (권장)

#### 1. 환경 변수 설정

`env.example` 파일을 `.env`로 복사하고 필요한 값들을 설정하세요:

```bash
cp env.example .env
```

#### 2. Docker Compose로 서비스 시작

```bash
# 모든 서비스 시작
docker-compose up -d

# 또는 배포 스크립트 사용
./deploy.sh
```

#### 3. 서비스 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f local-llm-container
docker-compose logs -f mock-api-container
```

### 로컬 개발 환경

#### 1. 의존성 설치

```bash
npm install
```

#### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mockapi"
LOCAL_LLM_URL="http://localhost:8000"
OPENAI_API_KEY="your_openai_api_key"  # 폴백용
```

#### 3. 데이터베이스 마이그레이션

```bash
npx prisma migrate dev
```

#### 4. 개발 서버 실행

```bash
npm run dev
```

## 프로젝트 구조

```
app/
├── api/                    # API 라우트
│   ├── generate/          # Mock API 생성
│   ├── proxy/             # 프록시 서버 관련 API
│   └── templates/         # 템플릿 관리
├── create/                # Mock API 생성 페이지
├── create-custom/         # 커스텀 Mock API 생성
├── create-json/           # JSON으로 API 생성
├── proxy/                 # 프록시 서버 관리
│   ├── [proxyName]/       # 특정 프록시 서버
│   │   ├── create/        # Mock API 생성
│   │   └── apis/          # Mock API 목록
│   └── page.tsx           # 프록시 서버 목록
└── page.tsx               # 메인 페이지
```

## 라이센스

MIT License
