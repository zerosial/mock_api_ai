# Local LLM Service 배포 가이드

이 가이드는 Mock API AI 프로젝트에 로컬 LLM 서비스를 배포하는 방법을 설명합니다.

## 🎯 개요

- **목표**: OpenAI API 대신 로컬에서 실행되는 LLM 서비스 사용
- **모델**: LG 엑사원 모델 (저사양 환경 최적화)
- **아키텍처**: Docker + FastAPI + Transformers

## 🚀 빠른 시작

### 1. 환경 준비

```bash
# 프로젝트 클론
git clone <your-repo>
cd mock-api-ai

# 환경변수 설정
cp env.example .env.local
# .env.local 파일을 편집하여 필요한 값들을 설정
```

### 2. Docker Compose로 배포

```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f local-llm-container
```

### 3. 서비스 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 로컬 LLM 서비스 헬스체크
curl http://localhost:8000/health
```

## 📋 서비스 구성

### 서비스 목록

1. **local-llm-container**: 로컬 LLM 서비스 (포트 8000)
2. **mock-api-container**: Mock API 서비스 (포트 3000)
3. **postgres-container**: PostgreSQL 데이터베이스 (포트 5432)
4. **nginx-container**: 리버스 프록시 (포트 8720)

### 포트 매핑

- **8000**: Local LLM Service
- **3000**: Mock API
- **5432**: PostgreSQL
- **8720**: Nginx

## 🔧 상세 설정

### 환경변수

`.env.local` 파일에서 설정할 수 있는 주요 환경변수:

```env
# 로컬 LLM 서비스
LLM_SERVICE_URL=http://localhost:8000

# 데이터베이스
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mockapi

# OpenAI API (폴백용)
OPENAI_API_KEY=your-openai-api-key
```

### 모델 설정

로컬 LLM 서비스는 다음 순서로 모델을 찾습니다:

1. `MODEL_PATH` 환경변수에 지정된 경로
2. Hugging Face에서 한국어 모델 자동 다운로드
3. 테스트용 간단한 모델 생성

## 🐛 문제 해결

### 일반적인 문제들

#### 1. 모델 로딩 실패

```bash
# 로컬 LLM 컨테이너 로그 확인
docker-compose logs local-llm-container

# 모델 상태 확인
curl http://localhost:8000/health
```

**해결 방법**:

- 컨테이너 재시작: `docker-compose restart local-llm-container`
- 모델 다운로드 재시도: `docker-compose exec local-llm-container python download_model.py`

#### 2. 메모리 부족

저사양 환경에서 메모리 부족이 발생할 경우:

```bash
# Docker 메모리 제한 설정
docker-compose down
docker-compose up -d --memory=2g
```

#### 3. 서비스 연결 실패

```bash
# 네트워크 상태 확인
docker network ls
docker network inspect mock-api-ai_mm-app-network

# 컨테이너 간 통신 테스트
docker-compose exec mock-api-container curl http://local-llm-container:8000/health
```

### 로그 분석

```bash
# 실시간 로그 모니터링
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f local-llm-container
docker-compose logs -f mock-api-container

# 로그 레벨 조정
# llm-service/main.py에서 logging.basicConfig(level=logging.DEBUG) 설정
```

## 📊 성능 최적화

### 저사양 환경 최적화

1. **모델 크기 조정**: 더 작은 모델 사용
2. **메모리 최적화**: `torch.float16` 사용
3. **배치 크기 조정**: 작은 배치 크기 사용

### 모니터링

```bash
# 리소스 사용량 확인
docker stats

# 컨테이너 상태 확인
docker-compose ps
```

## 🔄 업데이트 및 유지보수

### 모델 업데이트

```bash
# 컨테이너 재빌드
docker-compose build local-llm-container

# 서비스 재시작
docker-compose up -d local-llm-container
```

### 코드 업데이트

```bash
# 최신 코드 가져오기
git pull origin main

# 전체 서비스 재배포
./deploy.sh
```

## 🧪 테스트

### 로컬 LLM 서비스 테스트

```bash
# 헬스체크
curl http://localhost:8000/health

# 간단한 채팅 테스트
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lg-exaone",
    "messages": [{"role": "user", "content": "안녕하세요"}],
    "max_tokens": 100
  }'
```

### Mock API 연동 테스트

1. 웹 브라우저에서 `http://localhost:3000` 접속
2. Mock API 생성 시도
3. 로컬 LLM 응답 확인

## 📚 추가 리소스

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [Transformers 라이브러리](https://huggingface.co/docs/transformers/)
- [Docker Compose 문서](https://docs.docker.com/compose/)

## 🆘 지원

문제가 발생하거나 질문이 있으면:

1. 이 문서의 문제 해결 섹션 확인
2. GitHub Issues에 문제 보고
3. 프로젝트 팀에 문의

---

**참고**: 이 서비스는 개발 및 테스트 환경을 위한 것입니다. 프로덕션 환경에서는 보안 및 성능을 고려한 추가 설정이 필요할 수 있습니다.
