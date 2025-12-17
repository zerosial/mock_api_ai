@echo off
chcp 65001 >nul

echo 🚀 Mock API AI 배포를 시작합니다...

REM 환경변수 파일 확인
if not exist .env (
    echo ⚠️  .env 파일이 없습니다. env.example을 복사합니다...
    copy env.example .env
    echo 📝 .env 파일을 확인하고 필요한 환경변수를 설정해주세요.
    echo    특히 OPENAI_API_KEY를 설정해야 합니다.
    pause
    exit /b 1
)

REM Docker 이미지 빌드
echo 🔨 Docker 이미지를 빌드합니다...
docker-compose build --no-cache

if %errorlevel% neq 0 (
    echo ❌ 빌드에 실패했습니다.
    pause
    exit /b 1
)

REM 컨테이너 시작
echo 🚀 컨테이너를 시작합니다...
docker-compose up -d

if %errorlevel% neq 0 (
    echo ❌ 컨테이너 시작에 실패했습니다.
    pause
    exit /b 1
)

REM 상태 확인
echo 📊 컨테이너 상태를 확인합니다...
docker-compose ps

echo ✅ 배포가 완료되었습니다!
echo 🌐 애플리케이션: http://localhost:3000
echo 📊 로그 확인: docker-compose logs -f
echo 🛑 중지: docker-compose down

pause 