# CareerFlow AI

이력서, 포트폴리오, 채용공고를 한 흐름으로 연결해  
`분석 → 보완 질문 → 문서 초안 → 면접 대비`까지 이어 주는 문서 중심 AI 워크플로우 서비스입니다.

단순히 한 번에 답을 뽑아내는 생성기가 아니라,  
단계마다 판단 근거를 남기고 같은 지원 건을 다시 열어 이어서 개선할 수 있는 구조를 만드는 데 집중했습니다.

---

## What problem it solves

취업 준비에서 시간이 가장 많이 드는 구간은  
지원자 정보와 채용공고를 비교하고, 부족한 부분을 보완하며, 문서를 반복 수정하는 작업입니다.

CareerFlow AI는 이 과정을 one-shot 생성이 아닌 단계형 워크플로우로 풀어  
사용자가 왜 이런 결과를 받았는지 이해하고, 다시 수정하고, 다음 단계로 이어갈 수 있게 만드는 것을 목표로 했습니다.

---

## Core workflow

1. 이력서, 포트폴리오, 채용공고 입력
2. 후보자 정보 / 공고 정보 구조화 추출
3. 공고 대비 강점·약점·보완 포인트 분석
4. 부족한 정보에 대한 보완 질문 생성
5. 답변 반영 후 재분석
6. 지원동기·자기소개 초안, 경력기술서 초안 생성
7. 핵심 질문·심화 질문 기반 면접 준비 리포트 생성

---

## Technical highlights

- `LangChain` 기반으로 추출, 갭 분석, 보완, 문서 생성, 면접 대비를 단계별 체인으로 분리
- `PromptTemplate + RunnableSequence + JsonOutputParser + Zod` 조합으로 구조화 출력 적용
- `WorkflowRun`, `llmExecution` 메타데이터를 저장해 provider / model / fallback / 실행 상태를 추적
- `light / quality / premium` 라우팅 구조로 비용과 품질 균형을 조정
- 데모 세션 기반 저장 / 재방문 UX를 지원해 비로그인 상태에서도 제품 흐름 검증 가능

---

## Reliability and operational decisions

- `RequestRateLimiterService`로 과호출 제한
- `WorkflowExecutionLockService`로 동일 단계 동시 실행 방지
- `SKIPPED_REUSE_*`, `SKIPPED_DUPLICATE_*` 처리로 불필요한 재실행 감소
- `fallbackUsed`, `fallbackReason`, `hasProviderApiKey` 저장으로 장애 원인 추적
- structured output 정규화 이후 최근 핵심 7단계 실행 기준 `7/7 성공`, fallback `0회`

관련 지표는 [docs/performance-metrics.md](docs/performance-metrics.md)에서 확인할 수 있습니다.

---

## What makes this project different

- 단일 프롬프트 기반 챗봇이 아니라 **단계별 파이프라인** 구조입니다.
- 결과만 주는 것이 아니라 **강점 / 약점 / 보완 포인트**를 설명 가능한 형태로 남깁니다.
- 문서 생성 실패 시 내부 디버그 문구를 노출하지 않고, 기존 유효 초안을 우선 보존합니다.
- 저장된 결과와 실행 로그를 기반으로 재실행, 재분석, 후속 작업이 가능한 **운영형 AI 서비스**로 설계했습니다.

---

## This project is not

과장된 설명을 피하기 위해 현재 범위를 명확히 적습니다.

- 완전한 RAG 기반 서비스는 아닙니다.
- 자율 멀티툴 에이전트 런타임도 아닙니다.

현재는 **입력 문서 비교 중심의 구조화 파이프라인**에 가깝고,  
검색 보강과 에이전트형 확장은 이후 확장 가능성으로 남겨두었습니다.

---

## Tech stack

- Frontend: Next.js(App Router), TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript
- Database: PostgreSQL, Prisma
- AI: LangChain, Gemini Developer API, OpenAI

---

## My role

- 제품 문제 정의 및 MVP 범위 정리
- Next.js 기반 입력 / 결과 / 재방문 흐름 구현
- NestJS + Prisma 기반 저장 / 조회 / 실행 로그 API 설계
- LangChain 기반 단계형 워크플로우 구성
- 모델 라우팅, fallback, 과호출 방지 등 운영 안정성 설계
- 포트폴리오 / 면접용 기술 문서화

---

## Local development

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

기본 포트: `4000`  
API prefix: `/v1`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

기본 포트: `3000`

---

## Environment variables

| Scope | Variable | Description |
|------|------|------|
| LLM | `LLM_PROVIDER` | `gemini` 또는 `openai` |
| LLM | `GEMINI_API_KEY` / `OPENAI_API_KEY` | 모델 호출에 필요 |
| LLM | `GEMINI_DEFAULT_MODEL` | 경량 단계용 |
| LLM | `GEMINI_HIGH_QUALITY_MODEL` | 문서 생성 등 품질 단계용 |
| LLM | `GEMINI_PREMIUM_MODEL` | 선택적 상위 분석 단계 |
| Backend | `DATABASE_URL` | PostgreSQL 연결 문자열 |
| Backend | `CORS_ORIGIN` | 프론트 Origin |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | 프론트 API 베이스 URL |

자세한 값은 `backend/.env.example`, `frontend/.env.local.example`를 참고하세요.

---

## Deployment

### Frontend

- Vercel 배포 기준 `frontend` 폴더를 Root Directory로 사용
- 프록시를 쓸 경우 `NEXT_PUBLIC_API_BASE_URL=/v1` + rewrites 사용

### Backend

- Linux 서버에서 `backend` 폴더 기준 빌드 및 실행
- PM2 설정: `backend/ecosystem.config.cjs`
- 배포 스크립트: `backend/deploy-ec2.sh`

---

## Documentation

- [docs/project-overview.md](docs/project-overview.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/db-schema.md](docs/db-schema.md)
- [docs/langchain-in-this-project.md](docs/langchain-in-this-project.md)
- [docs/performance-metrics.md](docs/performance-metrics.md)
- [docs/portfolio-case-study.md](docs/portfolio-case-study.md)
