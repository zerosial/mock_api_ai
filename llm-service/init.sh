#!/bin/bash

# Local LLM Service Initialization Script

echo "🚀 Local LLM Service 초기화 시작..."

# Python 가상환경 확인 및 생성
if [ ! -d "venv" ]; then
    echo "📦 Python 가상환경 생성 중..."
    python3 -m venv venv
fi

# 가상환경 활성화
echo "🔧 가상환경 활성화 중..."
source venv/bin/activate

# 의존성 설치
echo "📚 Python 패키지 설치 중..."
pip install -r requirements-llm.txt

# 모델 다운로드
echo "🤖 AI 모델 다운로드 중..."
python download_model.py

echo "✅ Local LLM Service 초기화 완료!"
echo "🚀 서비스 시작: python main.py" 