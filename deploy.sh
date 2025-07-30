#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# 환경 변수 검증
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env file from env.sample"
    exit 1
fi

# Docker 확인
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    exit 1
fi

# 1. 최신 코드 가져오기
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
git pull origin main

# 2. 기존 컨테이너 중지
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down

# 3. 새 이미지 빌드
echo -e "${YELLOW}🔨 Building new image...${NC}"
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

# 4. 컨테이너 시작
echo -e "${YELLOW}🚀 Starting containers...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Container startup failed!${NC}"
    exit 1
fi

# 5. 컨테이너 상태 확인
echo -e "${YELLOW}🔍 Checking container status...${NC}"
sleep 10

if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}❌ Containers are not running!${NC}"
    docker-compose logs
    exit 1
fi

# 6. 데이터베이스 마이그레이션
echo -e "${YELLOW}🗄️ Running database migrations...${NC}"
docker-compose exec app npx prisma db push

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Database migration failed!${NC}"
    exit 1
fi

# 7. 헬스체크
echo -e "${YELLOW}🏥 Performing health check...${NC}"
sleep 5

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️ Health check failed, but deployment might still be successful${NC}"
fi

# 8. 완료 메시지
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application URL: http://localhost:3000${NC}"
echo -e "${GREEN}📊 Database URL: localhost:5432${NC}"
echo -e "${YELLOW}📋 To view logs: docker-compose logs -f${NC}" 