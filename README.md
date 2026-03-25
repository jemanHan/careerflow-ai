# CareerFlow AI

지원 서류와 채용공고를 **한 흐름**으로 묶어, **공고에 맞는 강·약점 정리 → 부족한 근거를 질문으로 보완 → 자기소개·경력기술서 초안 → 면접 질문까지** 이어 주는 문서 중심 AI 워크플로 제품입니다.

한 번에 뽑아 내는 생성기가 아니라, **단계마다 근거를 남기고** 같은 지원 건을 다시 열어 이어 갈 수 있게 만든 것이 핵심입니다.

---

## 이렇게 사용합니다

1. **로그인** — 편의를 위해 가벼운 **데모 세션**으로 시작할 수 있습니다. 상단 프로필에서 현재 세션과 최근에 쓴 계정을 바로 확인할 수 있습니다.  
2. **플로우 생성 페이지**에서 이력서·포트폴리오·강조하고 싶은 프로젝트(선택)·채용공고를 붙여 넣고, 필요하면 이 작업의 이름만 정리해 둡니다.  
3. **분석**을 실행하면 입력을 바탕으로 후보 요약, 공고 요구, 갭(부족한 신호), 이어서 받을 **보완 질문**이 준비됩니다.  
4. **결과 페이지**에서 공고 기준으로 정리된 강점·보완 포인트를 보고, 질문에 답하면 프로필과 분석 요약이 다시 맞춰집니다.  
5. **문서 초안**으로 지원동기·자기소개와 경력기술서 형태의 초안 **두 가지**를 받을 수 있습니다.  
6. **면접 준비**에서는 핵심 질문과 심화 질문, 답변 준비 포인트를 함께 제공합니다.  
7. **나의 CareerFlow**(저장된 흐름 목록)에서 진행 중이거나 끝난 작업을 다시 열어 이어갈 수 있습니다.

---

## 무엇이 다른가

| | |
|--|--|
| **단계형 실행** | 추출·갭 분석·보완·문서·면접을 한 덩어리 프롬프트가 아니라 단계로 나누어 실행합니다. |
| **설명 가능한 요약** | 공고 대비 강·약점과 보완 방향을 문장형으로 정리합니다(단일 점수로 압축하지 않음). |
| **운영·안정성** | 호출 제한, 동시 실행 제어, 문서 단계의 재생성 스킵 등으로 반복 비용과 충돌을 줄입니다. |
| **실패 시** | 문서 생성이 막히면 내부용 placeholder 문구를 그대로 보여 주지 않고, 기존에 쌓인 유효한 초안은 유지하는 쪽을 우선합니다. |
| **분석 요청** | 분석을 다시 누르면 그때마다 전체 분석 파이프라인을 돌립니다(저장된 결과만 보는 것은 조회 화면에서). |

---

## Tech Stack

- **Frontend**: Next.js (App Router) · TypeScript · Tailwind CSS  
- **Backend**: NestJS · TypeScript  
- **Database**: PostgreSQL · Prisma  
- **AI**: LangChain · Gemini Developer API(기본) / OpenAI(선택)

---

## 로컬 실행

### Backend

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

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
npm run dev
# 기본 포트 3000
```

---

## 환경 변수 요약

| 구분 | 변수 | 의미 |
|------|------|------|
| LLM | `LLM_PROVIDER` | `gemini` (기본) 또는 `openai` |
| LLM | `GEMINI_API_KEY` / `OPENAI_API_KEY` | 필수 |
| LLM | `GEMINI_DEFAULT_MODEL` | light(추출·갭·후속 등, 리라이트 보조) |
| LLM | `GEMINI_HIGH_QUALITY_MODEL` | quality(문서 생성·면접 리포트) |
| LLM | `GEMINI_PREMIUM_MODEL` | (선택) 공고 대비 분석 상위 모델 |
| Backend | `DATABASE_URL` | PostgreSQL 연결 문자열 |
| Backend | `CORS_ORIGIN` | 프론트 Origin (콤마 구분). **production에서 비우면 브라우저 CORS 비활성** |
| Backend | `PORT` | 기본 4000 |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | 예: `http://localhost:4000/v1` — **production 빌드 시 필수** |

상세는 `backend/.env.example`, `frontend/.env.local.example` 참고.

---

## 배포 (요약)

### Frontend — Vercel

- Root Directory: `frontend`  
- **HTTPS 프론트 → HTTP EC2 API** 시 브라우저 Mixed Content 방지:  
  - Vercel 환경변수 `BACKEND_URL=http://<EC2공인IP>:4000`  
  - `NEXT_PUBLIC_API_BASE_URL=/v1`  
  - `frontend/next.config.ts`의 `rewrites`가 `/v1/*` → 백엔드로 프록시  

### Backend — EC2

- 저장소를 서버에서 `git pull` 후 **`backend` 디렉터리에서 Linux 빌드** (Windows에서 빌드한 `dist`만 올리는 방식은 비권장)  
- `backend/ecosystem.config.cjs` + PM2  
- 배포 스크립트: `backend/deploy-ec2.sh` (`npm ci` → `prisma generate` → `migrate deploy` → `npm run build` → PM2)

### 배포 전 체크리스트

1. **Backend**: `DATABASE_URL`, `CORS_ORIGIN`(Vercel 도메인 포함), LLM 키, `NODE_ENV=production`  
2. **Frontend**: `NEXT_PUBLIC_API_BASE_URL` — 로컬은 직접 URL, Vercel+프록시는 `/v1`  
3. **보안 그룹**: EC2에서 API 포트(예: 4000) 인바운드 허용 또는 리버스 프록시 뒤에 두기  

---

## 개발·연동 참고

- 데모 세션은 브라우저에서 활성 계정을 **`x-test-user-id`** 헤더로 보내며, 목록 조회 시에는 요청 경로의 사용자와 헤더가 일치해야 합니다.  
- 워크플로 제목 등 표시 정보는 `PATCH /v1/source-documents/:id/meta` 로 갱신합니다.  
- 단계별 실행 기록은 DB의 `WorkflowRun` 등으로 추적합니다. 상세는 [docs/architecture.md](docs/architecture.md) 참고.

---

## 문서

| 문서 | 내용 |
|------|------|
| [docs/project-overview.md](docs/project-overview.md) | 문제 정의, MVP 범위, 산출물 원칙 |
| [docs/architecture.md](docs/architecture.md) | 모듈 구조, 워크플로 단계, 라우팅, 영속화 |
| [docs/api-spec.md](docs/api-spec.md) | REST 계약, 요청/응답 필드 |
| [docs/db-schema.md](docs/db-schema.md) | Prisma 엔티티 요약 |
| [docs/langchain-in-this-project.md](docs/langchain-in-this-project.md) | LangChain 역할·비범위(RAG/에이전트) |
| [docs/troubleshooting.md](docs/troubleshooting.md) | 빠른 참조 + 이슈 이력 |

---

## Repository hygiene

- 커밋 금지: `.env`, `.env.local`, 실제 키·DB 접속 정보, `*.pem`  
- 커밋 금지: `node_modules/`, `dist/`, `.next/`, 실행 로그, 대용량 zip  

---

## REST API 개요

엔드포인트 전체와 필드는 [docs/api-spec.md](docs/api-spec.md) 를 기준으로 합니다.

- 세션·소스 생성·조회, 분석 실행, 보완 답변 제출, 문서 초안 생성, 면접 생성 등  
- 예: `POST /v1/analysis/run`, `POST /v1/generated-documents/generate`, `POST /v1/interview/generate`  
