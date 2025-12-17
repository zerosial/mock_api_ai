# Docker 배포 가이드

## 개요

이 가이드는 Mock API AI 애플리케이션을 Docker를 사용하여 다른 컴퓨터에 안전하게 배포하는 방법을 설명합니다.

## 사전 요구사항

- Docker Desktop 설치
- Docker Compose 설치
- Git 설치

## 배포 방법

### 1. 자동 배포 스크립트 사용 (권장)

#### Linux/Mac

```bash
chmod +x deploy.sh
./deploy.sh
```

#### Windows

```cmd
deploy.bat
```

### 2. 수동 배포

#### 1) 환경변수 설정

```bash
cp env.example .env
```

`.env` 파일을 열고 다음 환경변수를 설정하세요:

```env
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=postgresql://postgres:postgres@postgres-container:5432/mockapi
LLM_SERVICE_URL=http://local-llm-container:8000
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/mockapi
```

#### 2) 기존 컨테이너 정리 (선택사항)

```bash
docker-compose down -v
docker system prune -f
```

#### 3) 이미지 빌드 및 실행

```bash
docker-compose build --no-cache
docker-compose up -d
```

## 문제 해결

### 마이그레이션 실패 에러 (P3009)

이 에러는 다른 컴퓨터에서 배포할 때 자주 발생합니다. 해결 방법:

1. **자동 해결**: 수정된 Dockerfile이 자동으로 `npx prisma migrate reset --force`를 실행하여 데이터베이스를 초기화합니다.

2. **수동 해결**:

```bash
docker-compose exec mock-api-container npx prisma migrate reset --force
```

### 포트 충돌

포트 3000, 5432, 8000이 이미 사용 중인 경우:

```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :3000
netstat -tulpn | grep :5432
netstat -tulpn | grep :8000

# 해당 프로세스 종료 후 재시작
docker-compose down
docker-compose up -d
```

### 데이터베이스 연결 실패

```bash
# PostgreSQL 컨테이너 상태 확인
docker-compose logs postgres-container

# 수동으로 PostgreSQL 재시작
docker-compose restart postgres-container
```

## 서비스 접속 정보

- **Mock API**: http://localhost:3000
- **Local LLM Service**: http://localhost:8000
- **PostgreSQL**: localhost:5432
  - Database: mockapi
  - Username: postgres
  - Password: postgres

## 유용한 명령어

```bash
# 로그 확인
docker-compose logs -f

# 특정 서비스 로그 확인
docker-compose logs -f mock-api-container

# 컨테이너 상태 확인
docker-compose ps

# 컨테이너 중지
docker-compose down

# 컨테이너와 볼륨 모두 삭제
docker-compose down -v

# 특정 서비스 재시작
docker-compose restart mock-api-container
```

## 주의사항

1. **데이터 손실**: `docker-compose down -v` 명령어는 모든 데이터를 삭제합니다.
2. **환경변수**: `.env` 파일의 `OPENAI_API_KEY`를 반드시 설정해야 합니다.
3. **네트워크**: 방화벽에서 필요한 포트(3000, 5432, 8000)가 열려있는지 확인하세요.
4. **리소스**: Local LLM 서비스는 상당한 메모리를 사용할 수 있습니다.

## 트러블슈팅

### 컨테이너가 시작되지 않는 경우

```bash
# 상세한 로그 확인
docker-compose logs

# 컨테이너 재빌드
docker-compose build --no-cache
docker-compose up -d
```

### 데이터베이스 마이그레이션 문제

```bash
# 데이터베이스 초기화
docker-compose exec mock-api-container npx prisma migrate reset --force

# 또는 컨테이너 재시작
docker-compose restart mock-api-container
```

### Local LLM 서비스 문제

```bash
# LLM 서비스 로그 확인
docker-compose logs local-llm-container

# LLM 서비스 재시작
docker-compose restart local-llm-container
```
