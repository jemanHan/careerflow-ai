# CareerFlow AI

지원 서류와 채용공고를 **한 흐름**으로 묶어, **공고에 맞는 강·약점 정리 → 근거 보완 → 자기소개·경력기술서 초안 → 면접 준비**까지 이어 주는 **문서 중심 AI 워크플로**입니다.

한 번에 뽑아 내는 생성기가 아니라, **단계마다 근거를 남기고** 같은 지원 건을 다시 열어 이어 갈 수 있게 만든 것이 핵심입니다.

---

## Overview

UI·카피는 **한국어**를 기준으로 두었습니다. 이력서·포트폴리오·채용공고 텍스트를 입력하면 공고 대비 분석, 대화형 보완, 문서 초안, 면접 리포트까지 한 제품 흐름으로 연결합니다.

---

## How it works

1. **로그인** — 편의를 위해 가벼운 **데모 세션**으로 시작합니다. 상단 프로필에서 현재 세션과 최근에 쓴 계정을 확인할 수 있습니다.  
2. **플로우 생성 화면**에서 이력서·포트폴리오·강조 프로젝트(선택)·채용공고를 붙여 넣고, 필요하면 이 작업의 이름만 정리합니다.  
3. **분석**을 실행하면 입력을 바탕으로 후보 요약, 공고 요구, 갭(부족한 신호), 이어서 받을 **보완 질문**이 준비됩니다.  
4. **결과 화면**에서 공고 기준으로 정리된 강점·보완 포인트를 보고, 질문에 답하면 프로필과 분석 요약이 다시 맞춰집니다.  
5. **문서 초안**으로 지원동기·자기소개 초안과 경력기술서 초안 **두 가지**를 받을 수 있습니다.  
6. **면접 준비**에서는 핵심 질문과 심화 질문, 답변 준비 포인트를 함께 제공합니다.  
7. **나의 CareerFlow**에서 진행 중이거나 끝난 작업을 다시 열어 이어갈 수 있습니다.

---

## Key differentiators

| 구분 | 설명 |
|------|------|
| **단계형 실행** | 추출·갭 분석·보완·문서·면접을 한 덩어리 프롬프트가 아니라 파이프라인 단계로 나누어 실행합니다. |
| **설명 가능한 요약** | 공고 대비 강·약점과 보완 방향을 문장형 구조로 남깁니다. 단일 점수로 압축하지 않습니다. |
| **운영·안정성** | 호출 제한, 동시 실행 제어, 문서 단계의 재생성 스킵 등으로 반복 비용과 충돌을 줄입니다. |
| **실패 시 처리** | 문서 생성이 막혀도 내부용 placeholder 문구를 그대로 보여 주지 않고, 기존에 쌓인 유효한 초안은 유지하는 쪽을 우선합니다. |
| **분석 재실행** | 분석을 다시 요청할 때마다 전체 파이프라인을 돌립니다. 저장된 결과만 보는 것은 조회 화면에서 처리합니다. |

---

## Tech stack

- **프론트엔드**: Next.js(App Router), TypeScript, Tailwind CSS  
- **백엔드**: NestJS, TypeScript  
- **DB**: PostgreSQL, Prisma  
- **AI**: LangChain, Gemini Developer API(기본) 또는 OpenAI(선택)

---

## Local development

### 백엔드

```bash
cd backend
npm install
cp .env.example .env
# .env 에 DATABASE_URL, LLM 키 등 설정
npx prisma generate
npx prisma migrate dev
npm run start:dev
# 기본 포트 4000, API prefix /v1
```

### 프론트엔드

```bash
cd frontend
npm install
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
npm run dev
# 기본 포트 3000
```

---

## Environment variables

| 구분 | 변수 | 설명 |
|------|------|------|
| LLM | `LLM_PROVIDER` | `gemini`(기본) 또는 `openai` |
| LLM | `GEMINI_API_KEY` / `OPENAI_API_KEY` | 생성에 필요 |
| LLM | `GEMINI_DEFAULT_MODEL` | 가벼운 작업(추출·갭·후속, 리라이트 보조) |
| LLM | `GEMINI_HIGH_QUALITY_MODEL` | 문서·면접 리포트 등 품질 구간 |
| LLM | `GEMINI_PREMIUM_MODEL` | (선택) 공고 대비 분석 구간에 상위 모델 |
| Backend | `DATABASE_URL` | PostgreSQL 연결 문자열 |
| Backend | `CORS_ORIGIN` | 프론트 Origin(콤마 구분). **production에서 비우면 브라우저 CORS가 사실상 꺼집니다.** |
| Backend | `PORT` | 기본 `4000` |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | 예: `http://localhost:4000/v1` — **production 빌드 시 필수** |

자세한 값은 `backend/.env.example`, `frontend/.env.local.example` 참고.

---

## Deployment

### 프론트엔드 (Vercel)

- Root Directory: `frontend`  
- **HTTPS 프론트 → HTTP EC2 API**일 때 Mixed Content를 피하려면: `BACKEND_URL=http://<EC2공인IP>:4000`, `NEXT_PUBLIC_API_BASE_URL=/v1`, `frontend/next.config.ts`의 rewrites로 `/v1/*` 를 백엔드에 넘깁니다.

### 백엔드 (EC2)

- 서버에서 `git pull` 후 **`backend` 폴더 안에서 Linux 환경으로 빌드**합니다(Windows에서만 빌드한 `dist`만 복사하는 방식은 비권장).  
- PM2: `backend/ecosystem.config.cjs`  
- 스크립트: `backend/deploy-ec2.sh` (`npm ci` → `prisma generate` → `migrate deploy` → `npm run build` → PM2)

### 배포 전 체크

1. 백엔드: `DATABASE_URL`, `CORS_ORIGIN`(Vercel 도메인 포함), LLM 키, `NODE_ENV=production`  
2. 프론트: `NEXT_PUBLIC_API_BASE_URL` — 로컬은 전체 URL, Vercel+프록시는 `/v1`  
3. AWS: API 포트(예: 4000) 인바운드 또는 리버스 프록시·TLS 종단

---

## Integration notes

- 데모 세션은 브라우저가 활성 계정을 **`x-test-user-id`** 헤더로 보냅니다. 목록 API는 **경로의 사용자와 헤더가 같을 때** 통과합니다.  
- 워크플로 제목 등: `PATCH /v1/source-documents/:id/meta`  
- 단계별 실행 기록은 DB의 `WorkflowRun` 등으로 추적합니다. 상세는 [docs/architecture.md](docs/architecture.md).

---

## Documentation

| 문서 | 내용 |
|------|------|
| [docs/project-overview.md](docs/project-overview.md) | 문제 정의, MVP 범위, 산출물 원칙 |
| [docs/architecture.md](docs/architecture.md) | 모듈, 파이프라인 단계, 라우팅, 영속화 |
| [docs/api-spec.md](docs/api-spec.md) | REST 계약 |
| [docs/db-schema.md](docs/db-schema.md) | Prisma 모델 요약 |
| [docs/langchain-in-this-project.md](docs/langchain-in-this-project.md) | LangChain 역할·비범위(RAG/에이전트) |
| [docs/troubleshooting.md](docs/troubleshooting.md) | 빠른 참조·이슈 이력 |

---

## Repository hygiene

- 커밋하지 말 것: `.env`, `.env.local`, 실제 키·DB 접속 정보, `*.pem`  
- 커밋하지 말 것: `node_modules/`, `dist/`, `.next/`, 로그, 대용량 zip  

---

## REST API

전체 명세는 [docs/api-spec.md](docs/api-spec.md). 예: `POST /v1/analysis/run`, `POST /v1/generated-documents/generate`, `POST /v1/interview/generate`.
