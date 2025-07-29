프로젝트 가이드: Next.js + PostgreSQL + Docker

1. 프로젝트 개요
   이 프로젝트는 Next.js App Router를 백엔드로 삼아 RESTful API를 제공하고, 사용자 데이터는 PostgreSQL에 저장하는 전체 스택 애플리케이션입니다. 프론트엔드와 API는 Next.js 한 프로젝트 내에서 관리하며, 스타일링은 Tailwind CSS와 shadcn/ui를 이용해 빠르게 구성합니다. 데이터베이스와 애플리케이션 모두 Docker 컨테이너로 배포할 예정이므로, 로컬 개발 환경과 배포 환경을 쉽게 동일하게 유지할 수 있습니다.

이 문서는 Cursor를 사용해 프로젝트를 개발할 때 참고할 수 있도록 설계되었습니다. 파일 구조, 개발 순서, Docker 설정, 데이터베이스 초기화, API 경로(Next.js Route Handler) 구현 예제를 순서대로 설명합니다. 필요 시 각 단계가 끝난 후 체크리스트나 TODO 주석을 추가해 Cursor의 커서가 방향을 잃지 않도록 합니다.

2. 기술 스택 및 주요 선택 사항
   구성 요소 선택 사유 및 대안
   Next.js 15 App Router 기반으로 백엔드와 프론트엔드가 단일 저장소에서 관리됩니다. 파일 시스템 기반 라우팅과 API Route Handler가 있어 간단한 서버를 별도로 만들 필요가 없습니다.
   Tailwind CSS + shadcn/ui Tailwind의 유틸리티 클래스와 shadcn/ui 컴포넌트를 함께 사용해 빠르게 UI를 구성할 수 있습니다.
   PostgreSQL 오픈소스 관계형 데이터베이스로 Next.js와 호환성이 좋으며, Vercel의 공식 튜토리얼에서도 추천합니다
   nextjs.org
   .
   Prisma ORM 타입 안전성과 마이그레이션 도구를 제공해 PostgreSQL과의 연동을 간단하게 합니다. 다른 대안으로는 Drizzle ORM, pg 라이브러리 등이 있으나 Prisma는 문서와 커뮤니티가 풍부합니다.
   Docker/Docker Compose Postgres와 Next.js를 각각 컨테이너로 실행하여 동일한 환경을 재현합니다. Next.js 공식 문서에서도 Docker를 통해 배포하는 것을 지원하며, 프로덕션 환경에서 모든 기능을 사용할 수 있다고 명시합니다
   nextjs.org
   .

3. 프로젝트 구조 제안
   graphql
   복사
   편집
   my-app/
   ├─ app/
   │ ├─ api/
   │ │ └─ items/
   │ │ └─ route.ts # CRUD API Route Handler 예시
   │ ├─ layout.tsx # 기본 레이아웃
   │ └─ page.tsx # 프론트엔드 페이지
   ├─ prisma/
   │ ├─ schema.prisma # 데이터베이스 모델 정의
   │ └─ seed.ts # 초기 데이터 삽입 스크립트
   ├─ Dockerfile # Next.js 애플리케이션 빌드/실행용
   ├─ docker-compose.yml # 앱과 DB를 함께 실행
   ├─ package.json
   ├─ tailwind.config.js
   └─ README.md (이 문서를 포함)
   이 구조는 App Router를 사용하는 Next.js 15를 기반으로 하며, app/api 폴더 아래에 라우트 핸들러를 정의합니다. Prisma 스키마는 prisma/ 폴더에 위치하고, 마이그레이션과 시드를 관리합니다.

4. 개발 및 설정 단계
   다음 순서로 개발을 진행하면 됩니다. 각 단계마다 Cursor TODO 주석을 추가해 진행 상황을 관리하세요.

4.1 Next.js 프로젝트 초기화
Node.js (v18 이상)과 pnpm/npm/yarn이 설치되어 있어야 합니다. 터미널에서 프로젝트를 생성합니다:

bash
복사
편집
npx create-next-app@latest my-app --typescript --app --tailwind --eslint
cd my-app
tailwind.config.js와 postcss.config.js는 create-next-app에서 자동으로 생성됩니다. shadcn/ui를 추가하려면 다음을 실행합니다:

bash
복사
편집
pnpm install @shadcn/ui
npx shadcn-ui init
초기 설정 시 사용할 스타일 옵션을 선택하고 components.json 파일이 생성됩니다. 필요에 따라 컴포넌트를 추가합니다.

4.2 Prisma 설정 및 데이터 모델링
Prisma를 설치하고 초기화합니다:

bash
복사
편집
pnpm install prisma @prisma/client
npx prisma init
prisma/schema.prisma 파일을 열고 데이터 모델을 정의합니다. 예를 들어 사용자와 연락처 목록을 저장하는 간단한 모델은 다음과 같습니다.

prisma
복사
편집
datasource db {
provider = "postgresql"
url = env("DATABASE_URL")
}

generator client {
provider = "prisma-client-js"
}

model Person {
id Int @id @default(autoincrement())
name String
phone String
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}
.env 파일에 데이터베이스 URL을 지정합니다. 로컬 개발과 Docker를 모두 고려해 다음과 같이 설정합니다:

env
복사
편집

# 로컬 개발용

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb"
초기 마이그레이션과 Prisma Client 생성을 실행합니다:

bash
복사
편집
npx prisma generate
npx prisma migrate dev --name init
필요하다면 prisma/seed.ts 파일을 만들어 초기 데이터를 삽입할 수 있습니다. 예시는 다음과 같습니다:

typescript
복사
편집
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
await prisma.person.createMany({
data: Array.from({ length: 100 }, (\_, i) => ({
name: `사용자${i + 1}`,
phone: `010-0000-${String(i + 1).padStart(4, '0')}`,
})),
})
}

main()
.then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
process.exit(1)
})
실행은 ts-node prisma/seed.ts로 할 수 있으며, Docker 컨테이너 안에서는 node로 실행합니다.

4.3 API Route Handler 구현
Next.js App Router에서는 /app/api/<경로>/route.ts 파일에 각각의 HTTP 메서드를 export하여 API를 작성합니다
dev.to
. 아래는 app/api/items/route.ts에서 사용자 데이터를 CRUD하는 예제입니다.

typescript
복사
편집
// app/api/items/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET: 모든 사람 목록
export async function GET() {
const people = await prisma.person.findMany({ orderBy: { id: 'asc' } })
return NextResponse.json(people, { status: 200 })
}

// POST: 새로운 사람 추가
export async function POST(req: NextRequest) {
const data = await req.json()
const created = await prisma.person.create({ data })
return NextResponse.json(created, { status: 201 })
}

// PUT: 사람 정보 수정 (id는 body에 포함)
export async function PUT(req: NextRequest) {
const data = await req.json()
const updated = await prisma.person.update({
where: { id: data.id },
data: { name: data.name, phone: data.phone },
})
return NextResponse.json(updated, { status: 200 })
}

// DELETE: 사람 삭제 (id는 쿼리 매개변수로 전달)
export async function DELETE(req: NextRequest) {
const { searchParams } = new URL(req.url)
const id = parseInt(searchParams.get('id') ?? '0', 10)
await prisma.person.delete({ where: { id } })
return new NextResponse(null, { status: 204 })
}
이 예제는 Prisma Client를 통해 PostgreSQL과 통신합니다. 요청의 쿼리나 body 값을 읽어 조건에 따라 다른 응답을 반환할 수 있으며, 필요하면 searchParams.get()를 사용해 파라미터를 추출합니다
codeparrot.ai
. 실제 서비스에서는 오류 처리와 입력 검증을 추가하세요.

5. Docker 및 Docker Compose 설정
   5.1 Dockerfile (Next.js 애플리케이션)
   Next.js 공식 문서는 Docker 컨테이너 배포를 지원하며, 프로덕션에서는 모든 Next.js 기능을 사용할 수 있다고 설명합니다
   nextjs.org
   . 멀티 스테이지 빌드를 사용해 이미지를 최소화합니다.

Dockerfile
복사
편집

# 1단계: 의존성 설치 및 빌드

FROM node:20-alpine AS builder
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml\* ./
RUN pnpm install --frozen-lockfile

COPY . .

# Prisma 마이그레이션과 빌드

RUN npx prisma generate
RUN pnpm run build

# 2단계: 경량 실행 이미지

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# 런타임 의존성 설치 (필요시)

RUN apk add --no-cache openssl

EXPOSE 3000
CMD ["node", "server.js"]
이 Dockerfile은 next build에서 생성된 standalone 출력을 이용해 Node 서버(server.js)를 실행합니다. 필요하다면 server.js 파일을 커스터마이징할 수 있습니다. 빌드 단계에서 npx prisma generate를 통해 Prisma Client를 생성하며, 컨테이너 안에서도 데이터베이스를 연결할 수 있도록 prisma/schema.prisma와 .env가 포함되어야 합니다.

5.2 PostgreSQL용 Docker 설정
PostgreSQL은 공식 이미지를 사용합니다. 별도의 Dockerfile 없이 docker-compose에서 정의할 수 있습니다.

5.3 docker-compose.yml
다음 설정은 DB와 앱을 동시에 실행합니다. 볼륨을 통해 DB 데이터를 유지하고, 앱 컨테이너가 DB에 접근할 수 있도록 네트워크를 구성합니다.

yaml
복사
편집
version: '3.9'
services:
db:
image: postgres:15-alpine
container_name: myapp-db
restart: always
environment:
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
POSTGRES_DB: mydb
ports: - '5432:5432'
volumes: - db_data:/var/lib/postgresql/data

app:
build: .
container_name: myapp-next
restart: always
depends_on: - db
environment:
DATABASE_URL: "postgresql://postgres:postgres@db:5432/mydb"
ports: - '3000:3000' # 개발 시 라이브 리로드를 원한다면 volumes를 마운트하고 pnpm dev 명령을 사용하세요.

volumes:
db_data:
위 DATABASE_URL은 컨테이너 네트워크에서 DB 서비스 이름(db)을 사용해 연결합니다. 개발 중에는 docker-compose up -d로 두 서비스를 띄우고, 컨테이너 내에서 npx prisma migrate deploy 또는 npm run seed 스크립트를 실행해 스키마와 초기 데이터를 반영합니다.

6. 실행 및 테스트
   .env에 로컬 DB 연결 문자열을 설정했다면, 로컬에서 pnpm run dev로 개발 서버를 가동하고 프론트엔드와 API를 확인하세요.

도커를 사용해 전체 스택을 실행하려면:

bash
복사
편집
docker-compose build
docker-compose up -d

# 앱 컨테이너에 접속하여 마이그레이션 적용

docker-compose exec app npx prisma migrate deploy
docker-compose exec app node prisma/seed.ts
브라우저에서 http://localhost:3000/api/items를 호출하면 JSON 형식의 사용자 목록을 받을 수 있습니다. Postman이나 curl을 사용해 POST, PUT, DELETE 요청을 테스트하고 DB 반영 여부를 확인합니다.

7. 문서화 및 Cursor 사용 팁
   README 유지: 프로젝트 루트에 있는 README.md를 지속적으로 업데이트하세요. 새 API를 추가할 때마다 엔드포인트, 요청 형식, 응답 형식을 표로 정리하면 Cursor에서 검색하기 쉬워집니다.

TODO 주석: 구현할 기능이나 고려할 점은 코드 안에 // TODO: 주석으로 남겨 나중에 Cursor에서 검색할 수 있게 합니다.

커밋 메시지: 데이터베이스 스키마 변경, API 추가 등 중요한 변경 사항은 명확한 커밋 메시지로 기록합니다. Cursor가 기록을 추적할 때 도움이 됩니다.

8. 추가 고려 사항 및 대안
   ORM 선택: Prisma 외에도 Drizzle ORM이나 @vercel/postgres 등 경량화된 클라이언트를 사용할 수 있습니다. 단순한 CRUD만 필요하다면 pg 패키지를 사용해 쿼리를 직접 작성해도 됩니다. ORM 선택은 팀의 익숙함과 유지보수 정책에 따라 결정하세요.

보안 설정: 프로덕션 환경에서는 Docker 컨테이너를 non-root 사용자로 실행하고, .env 파일을 Git 저장소에 포함시키지 않도록 합니다. Arcjet의 블로그에서도 Next.js의 셀프 호스팅이 과거에는 까다로웠으나 최근 업데이트로 컨테이너화가 단순해졌다고 언급하며 보안 강화를 위해 Alpine 이미지 대신 Debian 기반 이미지를 사용할 것을 권장합니다

blog.arcjet.com

blog.arcjet.com
.

프록시 및 HTTPS: 배포 환경에서는 Nginx나 Caddy와 같은 프록시를 두어 HTTPS를 설정하고, 각 서비스의 포트를 매핑합니다. Next.js App Router는 스트리밍 응답을 사용할 수 있으므로 프록시에서 버퍼링을 비활성화해야 할 수 있습니다
nextjs.org
.

9. 요약
   이 가이드는 Next.js, Tailwind CSS + shadcn/ui, PostgreSQL, Prisma, Docker를 이용하여 풀스택 애플리케이션을 구축하고 배포하는 전체 과정을 설명합니다. Next.js의 App Router를 활용해 API Route Handler를 구현하고, Prisma로 데이터베이스 모델을 정의하며, Docker Compose로 앱과 데이터베이스를 동시에 관리합니다. 이러한 구조를 통해 로컬 개발과 배포 환경의 차이를 최소화하고, 팀원들이 Cursor를 통해 빠르게 문서를 검색하고 프로젝트를 파악할 수 있도록 합니다.
