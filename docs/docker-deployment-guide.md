# Docker 배포 가이드 - PostgreSQL + Next.js

## 개요

이 문서는 PostgreSQL 데이터베이스와 Next.js 애플리케이션을 Docker를 사용하여 배포하는 과정을 설명합니다.

## 프로젝트 구조

```
mock-api-ai/
├── app/                    # Next.js 애플리케이션
├── prisma/                 # Prisma 스키마 및 마이그레이션
│   └── schema.prisma
├── lib/                    # 유틸리티 및 생성된 Prisma 클라이언트
│   └── generated/prisma/
├── docker-compose.yml      # Docker Compose 설정
├── Dockerfile              # Next.js 애플리케이션 Docker 설정
├── .env                    # 환경 변수
└── docs/
    └── docker-deployment-guide.md
```

## 1. Prisma 설정 과정

### 1.1 Prisma 스키마 정의

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// API 템플릿 모델
model Template {
  id            Int      @id @default(autoincrement())
  project       String   // 프로젝트명
  user          String   // 사용자명
  apiUrl        String   // API URL 경로
  method        String   // HTTP 메서드
  apiName       String   // API 이름
  requestSpec   Json?    // 요청 스펙
  responseSpec  Json?    // 응답 스펙
  generatedCode String?  // 생성된 코드
  mockData      Json?    // Mock 데이터
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  apiLogs ApiLog[]

  @@unique([project, user, apiUrl, method])
  @@map("templates")
}

// API 호출 기록 모델
model ApiLog {
  id           Int      @id @default(autoincrement())
  templateId   Int
  requestBody  Json?
  responseBody Json?
  statusCode   Int
  responseTime Int
  userAgent    String?
  ipAddress    String?
  createdAt    DateTime @default(now())

  template Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@map("api_logs")
}
```

### 1.2 환경 변수 설정

```bash
# .env
DATABASE_URL="postgresql://postgres:postgres@db:5432/mock_api_ai"
OPENAI_API_KEY="your-openai-api-key"
NODE_ENV="production"
```

### 1.3 Prisma 클라이언트 생성

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 스키마 적용
npx prisma db push
```

## 2. Docker 설정

### 2.1 Dockerfile (Next.js 애플리케이션)

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma 클라이언트 생성
RUN npx prisma generate

# Next.js 빌드
RUN npm run build

# 프로덕션 단계
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 생성된 Prisma 클라이언트 복사
COPY --from=builder /app/lib/generated ./lib/generated

# Next.js 빌드 결과 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 2.2 Docker Compose 설정

```yaml
# docker-compose.yml
version: "3.9"

services:
  # PostgreSQL 데이터베이스
  db:
    image: postgres:15-alpine
    container_name: mock-api-ai-db
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mock_api_ai
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - app-network

  # Next.js 애플리케이션
  app:
    build: .
    container_name: mock-api-ai-app
    restart: always
    depends_on:
      - db
    environment:
      DATABASE_URL: "postgresql://postgres:postgres@db:5432/mock_api_ai"
      OPENAI_API_KEY: "${OPENAI_API_KEY}"
      NODE_ENV: production
    ports:
      - "3000:3000"
    volumes:
      - ./prisma:/app/prisma
    networks:
      - app-network

volumes:
  db_data:

networks:
  app-network:
    driver: bridge
```

### 2.3 Next.js 설정 업데이트

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Docker 배포를 위한 설정
  experimental: {
    outputFileTracingRoot: undefined,
  },
};

export default nextConfig;
```

## 3. 배포 과정

### 3.1 환경 준비

```bash
# 1. 환경 변수 파일 생성
cp env.sample .env

# 2. .env 파일 편집
# DATABASE_URL="postgresql://postgres:postgres@db:5432/mock_api_ai"
# OPENAI_API_KEY="your-openai-api-key"
```

### 3.2 Docker 이미지 빌드 및 실행

```bash
# 1. Docker Compose로 전체 스택 실행
docker-compose up -d

# 2. 로그 확인
docker-compose logs -f

# 3. 데이터베이스 마이그레이션 실행
docker-compose exec app npx prisma db push

# 4. Prisma 클라이언트 생성 (컨테이너 내부에서)
docker-compose exec app npx prisma generate
```

### 3.3 개별 서비스 관리

```bash
# 데이터베이스만 실행
docker-compose up -d db

# 애플리케이션만 실행
docker-compose up -d app

# 서비스 중지
docker-compose down

# 볼륨까지 삭제
docker-compose down -v
```

## 4. 개발 환경 설정

### 4.1 로컬 개발용 Docker Compose

```yaml
# docker-compose.dev.yml
version: "3.9"

services:
  db:
    image: postgres:15-alpine
    container_name: mock-api-ai-db-dev
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: mock_api_ai
    ports:
      - "5432:5432"
    volumes:
      - db_data_dev:/var/lib/postgresql/data

volumes:
  db_data_dev:
```

### 4.2 개발 환경 실행

```bash
# 개발용 데이터베이스만 실행
docker-compose -f docker-compose.dev.yml up -d

# 로컬에서 Next.js 개발 서버 실행
npm run dev
```

## 5. 프로덕션 배포

### 5.1 환경 변수 설정

```bash
# 프로덕션 환경 변수
DATABASE_URL="postgresql://postgres:postgres@db:5432/mock_api_ai"
OPENAI_API_KEY="your-production-openai-api-key"
NODE_ENV="production"
```

### 5.2 배포 스크립트

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Starting deployment..."

# 1. 최신 코드 가져오기
git pull origin main

# 2. 기존 컨테이너 중지
docker-compose down

# 3. 새 이미지 빌드
docker-compose build --no-cache

# 4. 컨테이너 시작
docker-compose up -d

# 5. 데이터베이스 마이그레이션
docker-compose exec app npx prisma db push

# 6. 헬스체크
echo "✅ Deployment completed!"
echo "🌐 Application URL: http://localhost:3000"
```

## 6. 모니터링 및 로그

### 6.1 로그 확인

```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f app
docker-compose logs -f db

# 실시간 로그
docker-compose logs --tail=100 -f
```

### 6.2 데이터베이스 접속

```bash
# PostgreSQL 컨테이너에 접속
docker-compose exec db psql -U postgres -d mock_api_ai

# Prisma Studio 실행
docker-compose exec app npx prisma studio
```

## 7. 백업 및 복원

### 7.1 데이터베이스 백업

```bash
# 백업 생성
docker-compose exec db pg_dump -U postgres mock_api_ai > backup_$(date +%Y%m%d_%H%M%S).sql

# 백업 복원
docker-compose exec -T db psql -U postgres mock_api_ai < backup_file.sql
```

### 7.2 볼륨 백업

```bash
# 볼륨 백업
docker run --rm -v mock-api-ai_db_data:/data -v $(pwd):/backup alpine tar czf /backup/db_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# 볼륨 복원
docker run --rm -v mock-api-ai_db_data:/data -v $(pwd):/backup alpine tar xzf /backup/backup_file.tar.gz -C /data
```

## 8. 트러블슈팅

### 8.1 일반적인 문제들

#### 데이터베이스 연결 실패

```bash
# 데이터베이스 상태 확인
docker-compose ps

# 데이터베이스 로그 확인
docker-compose logs db

# 네트워크 연결 테스트
docker-compose exec app ping db
```

#### Prisma 마이그레이션 실패

```bash
# 스키마 리셋
docker-compose exec app npx prisma db push --force-reset

# 마이그레이션 상태 확인
docker-compose exec app npx prisma migrate status
```

#### 애플리케이션 빌드 실패

```bash
# 캐시 삭제 후 재빌드
docker-compose build --no-cache app

# 의존성 재설치
docker-compose exec app npm ci
```

### 8.2 성능 최적화

```yaml
# docker-compose.yml에 추가
services:
  db:
    # PostgreSQL 성능 설정
    command: >
      postgres
      -c shared_buffers=256MB
      -c max_connections=100
      -c effective_cache_size=1GB
    environment:
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"

  app:
    # Node.js 성능 설정
    environment:
      NODE_OPTIONS: "--max-old-space-size=2048"
```

## 9. 보안 고려사항

### 9.1 환경 변수 관리

```bash
# .env.production (프로덕션용)
DATABASE_URL="postgresql://user:password@host:port/db"
OPENAI_API_KEY="production-key"
NODE_ENV="production"

# .env.development (개발용)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mock_api_ai"
OPENAI_API_KEY="development-key"
NODE_ENV="development"
```

### 9.2 네트워크 보안

```yaml
# docker-compose.yml
services:
  db:
    # 외부 포트 노출 제거 (내부 네트워크만 사용)
    # ports:
    #   - "5432:5432"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
    internal: true # 외부 접근 차단
```

## 10. CI/CD 파이프라인

### 10.1 GitHub Actions 예시

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Docker
        uses: docker/setup-buildx-action@v2

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: your-registry/mock-api-ai:latest

      - name: Deploy to server
        run: |
          # 서버에서 실행할 배포 스크립트
          ssh user@server "cd /app && docker-compose pull && docker-compose up -d"
```

## 11. 결론

이 가이드를 따라하면 PostgreSQL과 Next.js 애플리케이션을 Docker로 성공적으로 배포할 수 있습니다. 주요 포인트:

1. **Prisma 설정**: 데이터베이스 스키마 정의 및 클라이언트 생성
2. **Docker 설정**: 멀티 컨테이너 환경 구성
3. **환경 분리**: 개발/프로덕션 환경 분리
4. **모니터링**: 로그 및 성능 모니터링
5. **보안**: 환경 변수 및 네트워크 보안 설정

추가 질문이나 문제가 있으시면 언제든지 문의해주세요!
