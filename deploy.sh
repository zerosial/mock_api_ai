#!/bin/bash

# Mock API AI 배포 스크립트
echo "🚀 Mock API AI 배포를 시작합니다..."

# 기존 컨테이너와 볼륨 정리 (선택사항)
read -p "기존 컨테이너와 볼륨을 정리하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 기존 컨테이너와 볼륨을 정리합니다..."
    docker-compose down -v
    docker system prune -f
fi

# 환경변수 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  .env 파일이 없습니다. env.example을 복사합니다..."
    cp env.example .env
    echo "📝 .env 파일을 확인하고 필요한 환경변수를 설정해주세요."
    echo "   특히 OPENAI_API_KEY를 설정해야 합니다."
    exit 1
fi

# Docker 이미지 빌드
echo "🔨 Docker 이미지를 빌드합니다..."
docker-compose build --no-cache

# 컨테이너 시작
echo "🚀 컨테이너를 시작합니다..."
docker-compose up -d

# 상태 확인
echo "📊 컨테이너 상태를 확인합니다..."
docker-compose ps

echo "✅ 배포가 완료되었습니다!"
echo "🌐 애플리케이션: http://localhost:3000"
echo "📊 로그 확인: docker-compose logs -f"
echo "🛑 중지: docker-compose down" 