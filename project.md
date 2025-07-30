AI 기반 API 생성기 설계 가이드
본 문서는 AI를 활용한 API 생성기의 설계와 구현 방향을 정리한 자료입니다. 앞서 작성한 기술적인 프로젝트 문서가 Next.js + PostgreSQL + Docker 환경에서 동작하는 애플리케이션의 구성과 배포에 초점을 맞추었다면, 여기서는 프론트엔드 개발 시 서버 연동 규격이 없는 상황에서도 AI를 통해 API를 자동 생성하고 Mock 데이터를 제공하는 시스템을 설계합니다.

1. 개요와 목표
   프론트엔드 개발 과정에서 가장 큰 제약 중 하나는 서버 API 사양이 확정되지 않았거나 개발이 지연되는 경우입니다. 이 문제를 해결하기 위해, 사용자가 요청/응답 규격만 입력하면 AI가 내부적으로 OpenAPI 스펙과 API 핸들러 코드를 생성하고, 즉시 테스트 가능한 서버 엔드포인트를 제공하는 AI API 생성기를 제안합니다.

핵심 목표
규격이 없는 상태의 Mock API 생성: 사용자가 예상하는 request와 response 항목만 입력하면 해당 규격에 맞는 API 엔드포인트를 생성해 응답을 반환합니다.

규격이 정의된 상태의 API 자동 생성: 서버 연동 규격이 주어지면, 스펙에 따라 실제 서버 코드(예: Express/Next.js Route Handler)나 OpenAPI 문서를 자동 생성합니다.

데이터 생성 자동화: 응답 데이터가 단순 목록이거나 대량 데이터가 필요한 경우, AI와 Faker.js와 같은 도구를 활용해 현실적인 Mock 데이터를 다양하게 생성합니다.

프로젝트와의 통합: 생성된 API 정의를 데이터베이스에 저장하고, /api/:project/:user/:apiUrl 형태의 동적 엔드포인트에서 즉시 활용할 수 있도록 합니다.

2. 시스템 아키텍처
   아래 흐름은 AI API 생성기의 전체 동작 과정을 요약합니다.

사용자 입력 단계

프론트엔드 화면에서 API 이름, HTTP 메서드, URL, 요청 파라미터, 응답 구조를 입력합니다. (Tailwind CSS + shadcn/ui로 구현 가능)

입력 항목에 대한 필수/선택 여부, 데이터 타입(String, Object, Array 등)을 지정합니다.

AI 생성 단계

입력된 스펙을 기반으로 대형 언어 모델(예: OpenAI GPT)에게 프롬프트를 작성합니다. 예를 들어:

typescript
복사
편집
프롬프트: 주어진 API 이름과 요청/응답 사양에 따라 OpenAPI 3.0 스펙을 생성하고, 응답 예제를 JSON 형식으로 반환하세요.
입력: API 이름 = getUserList, 메서드 = GET, URL = /USER/LIST, 응답 필드 = [{ name: string, phoneNumbers: string[] }]
AI는 스펙과 예시 응답 JSON을 생성합니다. 필요 시 여러 번 호출하여 다양한 Mock 데이터를 만듭니다.

스펙 저장 및 서버 코드 생성

AI가 반환한 OpenAPI 문서와 예제 응답을 파싱하여 데이터베이스에 저장합니다. 저장 시 프로젝트명/유저명/URL 등과 매핑합니다.

저장된 스펙을 기반으로 Express.js 또는 Next.js Route Handler 템플릿을 채워 넣어 API 코드를 생성합니다. 예를 들어, Next.js에서는 app/api/[project]/[user]/[...apiUrl]/route.ts 파일을 동적으로 작성할 수 있습니다.

동적 엔드포인트 서비스

/api/:project/:user/:apiUrl로 들어오는 요청을 가로채 데이터베이스에서 해당 스펙을 찾아 응답을 반환합니다. 규격이 정의된 경우 실제 응답 데이터와 상태 코드를 설정하고, Mock가 필요한 경우 AI 또는 Faker.js를 이용해 데이터를 생성합니다.

관리 및 수정

생성된 API 목록을 조회하고 수정/삭제할 수 있는 UI를 제공합니다. 수정 시에는 스펙을 업데이트하고 코드에도 반영합니다.

배포

전체 시스템은 Next.js 애플리케이션 안에 포함되어 있으므로, 앞서 제안한 Docker Compose 환경을 그대로 활용할 수 있습니다. AI 모델 호출은 외부 API(OpenAI API 등)를 사용하므로, API 키와 요금 정책을 관리해야 합니다.

3. 구현 세부 사항
   3.1 AI 프롬프트 설계
   AI 모델이 원하는 형태의 JSON이나 코드 스니펫을 생성하도록 하기 위해서는 프롬프트를 구체적으로 작성해야 합니다. 예시:

OpenAPI 스펙 생성 요청
css
복사
편집
다음 정보를 사용하여 간단한 OpenAPI 3.0 JSON 스펙을 만들어 주세요.

- API 이름: {{apiName}}
- 메서드: {{method}}
- 경로: {{url}}
- 요청 필드: {{list of request fields with type and description}}
- 응답 필드: {{list of response fields with type and description}}
  요구사항: 스펙에는 summary, parameters, requestBody, responses 항목을 포함하고, 200 응답의 예제 값을 포함해야 합니다.
  Mock 데이터 생성 요청
  typescript
  복사
  편집
  다음 응답 구조에 맞춰 100개의 항목이 있는 JSON 배열을 생성해주세요. 각 항목의 값은 현실적이어야 합니다.
  응답 구조: {
  "name": string,
  "phoneNumbers": string[]
  }
  AI가 생성한 내용은 JSON으로 반환되므로, API 서버에서 JSON.parse()로 파싱 후 데이터베이스에 저장합니다.

  3.2 Next.js에서 AI 호출하기
  OpenAI 등 LLM 서비스를 호출하려면 서버 측 코드에서 비동기 HTTP 요청을 수행합니다. 예를 들어, Next.js Route Handler에서 다음과 같이 구현할 수 있습니다.

typescript
복사
편집
// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: NextRequest) {
const { apiName, method, url, requestFields, responseFields } = await req.json()

const prompt = `다음 정보를 사용하여 OpenAPI 3.0 JSON 스펙을 만들어 주세요.\n` +
`API 이름: ${apiName}\n메서드: ${method}\n경로: ${url}\n` +
`요청 필드: ${JSON.stringify(requestFields)}\n응답 필드: ${JSON.stringify(responseFields)}\n` +
`요구사항: summary, parameters, requestBody, responses 항목을 포함하고, 200 응답의 예제 값을 포함해야 합니다.`

const completion = await openai.chat.completions.create({
model: 'gpt-4',
messages: [
{ role: 'system', content: '당신은 API 설계자입니다.' },
{ role: 'user', content: prompt },
],
temperature: 0.2,
max_tokens: 1000,
})

const specText = completion.choices[0]?.message?.content || '{}'
const specJson = JSON.parse(specText)
// TODO: DB에 specJson 저장 및 코드 생성
return NextResponse.json(specJson, { status: 200 })
}
위 예제는 OpenAI SDK를 사용해 ChatGPT 모델을 호출합니다. 응답에서 반환된 내용을 JSON으로 파싱하여 저장하는 부분은 TODO 주석으로 남겨두고, Cursor를 사용해 구현을 이어갈 수 있습니다. 실제 프로젝트에서는 오류 처리, 요금 제한 처리, 입력 검증을 추가해야 합니다.

3.3 코드 생성 및 저장
AI가 생성한 OpenAPI 스펙을 데이터베이스에 저장한 뒤, 이를 바탕으로 실제 Route Handler 코드를 만들어야 합니다. 자동 코드 생성기는 다음과 같은 단계를 거칠 수 있습니다:

스펙에서 경로(url), 메서드(method), 응답 구조를 읽습니다.

템플릿 문자열을 사용해 Next.js Route Handler 파일을 생성합니다. 예를 들어:

typescript
복사
편집
export async function GET() {
// DB 또는 Mock 데이터 조회
return Response.json({ /_ AI가 생성한 예제 데이터 _/ })
}
생성된 파일을 app/api/[project]/[user]/[...apiUrl]/route.ts에 저장하거나, 데이터베이스에 저장된 스펙을 조회하는 공통 핸들러에서 조건문으로 처리합니다.

수정 요청이 있을 때는 데이터베이스에서 스펙을 업데이트하고, 코드 파일을 다시 생성합니다.

3.4 데이터베이스 통합
AI API 생성기는 이전 기술 문서에서 설명한 데이터베이스 구조를 그대로 활용할 수 있습니다. 예를 들어:

Template 테이블: id, project, user, apiUrl, method, requestSpec, responseSpec, generatedCode, createdAt, updatedAt 등의 필드를 둡니다.

API 호출 기록 테이블(선택): AI로 생성된 API를 호출하는 로그를 저장해 테스트 및 모니터링에 활용합니다.

Next.js Route Handler는 이러한 테이블을 조회해 특정 URL에 대한 응답을 반환합니다. 동적 엔드포인트의 동작은 앞서 설명한 /api/:project/:user/:apiUrl 처리 로직과 동일합니다. 동일한 URL을 다른 사용자가 호출할 경우 응답 일관성을 보장하려면, AI가 생성한 결과를 최초 한 번만 생성해 DB에 저장하고 이후에는 캐싱해야 합니다.

4. 고려해야 할 문제점과 해결책
   문제 해결책
   AI 응답의 일관성 동일한 API에 대한 호출마다 같은 응답을 원한다면, AI가 최초 생성한 결과를 DB에 저장하고 이후에는 재사용합니다. Faker.js를 사용할 경우 시드 값을 고정하거나 결과를 캐시합니다.
   프롬프트 설계 난이도 프롬프트에 요청/응답 구조를 명확히 기재하고, OpenAPI 스펙 형식과 예제 응답을 요구해야 합니다. 필요한 필드를 누락하면 AI가 임의로 추가할 수 있으므로 입력 검증 단계에서 필수 필드를 확인합니다.
   비용과 지연 시간 AI API 호출은 비용이 발생하며 응답 시간이 수초 정도 걸릴 수 있습니다. 따라서 스펙 생성과 Mock 데이터 생성을 개발 초기에 한 번만 실행하고 캐시하는 방식이 적합합니다.
   보안 및 개인정보 실제 사용자 데이터가 포함된 스펙을 AI에게 전달할 때는 개인정보를 제거하거나 마스킹해야 합니다. OpenAI API는 입력된 데이터가 모델 학습에 사용되지 않지만, 내부 정책을 따라야 합니다.
   버전 관리 생성된 스펙과 코드에 버전 번호를 부여하여 변경 이력을 관리하고, 롤백 기능을 구현합니다.

5. 결론
   AI를 활용한 API 생성기는 프론트엔드 개발자에게 큰 생산성 향상을 제공합니다. 서버 연동 규격이 미정이거나 API 개발이 지연되는 상황에서도, 사용자 입력에 따라 즉시 Mock API를 만들고 테스트할 수 있습니다. Next.js App Router와 Prisma, Docker Compose를 결합하면 전체 시스템을 손쉽게 배포할 수 있으며, 데이터베이스에 저장된 API 스펙을 이용해 동적 엔드포인트를 제공할 수 있습니다.

이 문서를 기반으로 Cursor에서 개발을 진행할 때는 TODO 주석과 README 문서를 참고해 구현 단계를 관리하고, AI 프롬프트 설계를 반복적으로 개선하여 원하는 결과를 얻으시기 바랍니다.
