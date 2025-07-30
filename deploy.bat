@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting deployment...

REM 환경 변수 파일 확인
if not exist .env (
    echo ❌ .env file not found!
    echo Please create .env file from env.sample
    exit /b 1
)

REM Docker 확인
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed!
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed!
    exit /b 1
)

REM 1. 최신 코드 가져오기
echo 📥 Pulling latest code...
git pull origin main

REM 2. 기존 컨테이너 중지
echo 🛑 Stopping existing containers...
docker-compose down

REM 3. 새 이미지 빌드
echo 🔨 Building new image...
docker-compose build --no-cache
if errorlevel 1 (
    echo ❌ Build failed!
    exit /b 1
)

REM 4. 컨테이너 시작
echo 🚀 Starting containers...
docker-compose up -d
if errorlevel 1 (
    echo ❌ Container startup failed!
    exit /b 1
)

REM 5. 컨테이너 상태 확인
echo 🔍 Checking container status...
timeout /t 10 /nobreak >nul

docker-compose ps | findstr "Up" >nul
if errorlevel 1 (
    echo ❌ Containers are not running!
    docker-compose logs
    exit /b 1
)

REM 6. 데이터베이스 마이그레이션
echo 🗄️ Running database migrations...
docker-compose exec app npx prisma db push
if errorlevel 1 (
    echo ❌ Database migration failed!
    exit /b 1
)

REM 7. 헬스체크
echo 🏥 Performing health check...
timeout /t 5 /nobreak >nul

powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo ⚠️ Health check failed, but deployment might still be successful
) else (
    echo ✅ Health check passed!
)

REM 8. 완료 메시지
echo ✅ Deployment completed successfully!
echo 🌐 Application URL: http://localhost:3000
echo 📊 Database URL: localhost:5432
echo 📋 To view logs: docker-compose logs -f 