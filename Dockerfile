# 1단계: 의존성 설치 및 빌드
FROM node:20-alpine AS builder
WORKDIR /app

# pnpm 설정
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@latest --activate

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install --frozen-lockfile

# 소스 코드 복사
COPY . .

# Prisma 클라이언트 생성 및 빌드
RUN npx prisma generate
RUN npm run build

# 2단계: 경량 실행 이미지
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 필요한 파일들 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# 런타임 의존성 설치
RUN apk add --no-cache openssl

EXPOSE 3000

CMD ["node", "server.js"] 