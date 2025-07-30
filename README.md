# Mock API AI

AI 기반 Mock API 생성 및 관리 플랫폼

## 🚀 빠른 시작

### Docker를 사용한 배포 (권장)

```bash
# 1. 환경 변수 설정
cp env.sample .env
# .env 파일에서 OPENAI_API_KEY 설정

# 2. Docker Compose로 전체 스택 실행
docker-compose up -d

# 3. 데이터베이스 마이그레이션
docker-compose exec app npx prisma db push

# 4. 애플리케이션 접속
# http://localhost:3000
```

### 개발 환경 설정

```bash
# 1. 개발용 데이터베이스만 실행
docker-compose -f docker-compose.dev.yml up -d

# 2. 의존성 설치
npm install

# 3. Prisma 클라이언트 생성
npx prisma generate

# 4. 개발 서버 실행
npm run dev
```

## 📁 프로젝트 구조

```
mock-api-ai/
├── app/                    # Next.js 애플리케이션
├── prisma/                 # Prisma 스키마
│   └── schema.prisma
├── lib/                    # 유틸리티
│   ├── generated/prisma/   # 생성된 Prisma 클라이언트
│   └── prisma.ts          # Prisma 유틸리티
├── docker-compose.yml      # 프로덕션 Docker 설정
├── docker-compose.dev.yml  # 개발용 Docker 설정
├── Dockerfile              # Next.js Docker 설정
└── docs/
    └── docker-deployment-guide.md
```

## 🛠 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Docker)
- **ORM**: Prisma
- **AI**: OpenAI API
- **Styling**: Tailwind CSS
- **Deployment**: Docker, Docker Compose

## 📊 데이터베이스 스키마

### Template 모델

- API 템플릿 정보 저장
- AI가 생성한 API 스펙과 코드 관리
- 프로젝트별, 사용자별 API 관리

### ApiLog 모델

- API 호출 기록 저장
- 요청/응답 데이터, 성능 메트릭 추적

## 🔧 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트 검사
npm run lint

# Prisma 관련 명령어
npx prisma generate    # 클라이언트 생성
npx prisma db push     # 스키마 적용
npx prisma studio      # 데이터베이스 GUI
```

## 🐳 Docker 명령어

```bash
# 전체 스택 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f app
docker-compose logs -f db

# 컨테이너 중지
docker-compose down

# 볼륨까지 삭제
docker-compose down -v

# 개발용 데이터베이스만 실행
docker-compose -f docker-compose.dev.yml up -d
```

## 📝 환경 변수

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@db:5432/mock_api_ai"
OPENAI_API_KEY="your-openai-api-key"
NODE_ENV="production"
```

## 🔍 모니터링

### 로그 확인

```bash
# 실시간 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f app
```

### 데이터베이스 접속

```bash
# PostgreSQL 컨테이너 접속
docker-compose exec db psql -U postgres -d mock_api_ai

# Prisma Studio 실행
docker-compose exec app npx prisma studio
```

## 🚀 배포

### 자동 배포 스크립트

```bash
# 배포 실행
./deploy.sh
```

### 수동 배포

```bash
# 1. 코드 업데이트
git pull origin main

# 2. 컨테이너 재빌드
docker-compose build --no-cache

# 3. 서비스 재시작
docker-compose up -d

# 4. 마이그레이션 실행
docker-compose exec app npx prisma db push
```

## 📚 문서

- [Docker 배포 가이드](./docs/docker-deployment-guide.md) - 상세한 Docker 배포 과정
- [프로젝트 문서](./project.md) - 프로젝트 상세 정보
- [기술 문서](./tech.md) - 기술 스택 상세 정보

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 지원

문제가 있거나 질문이 있으시면 이슈를 생성해주세요.
