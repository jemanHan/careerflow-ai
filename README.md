# CareerFlow AI

**이력서·포트폴리오·채용공고**를 같은 흐름에서 다루고, **공고 대비 분석 → 대화형 보완 → 문서 초안 → 면접 준비**까지 이어지는 문서 중심 AI 워크플로우 MVP입니다.  
단발 생성기가 아니라 단계별 실행과 `WorkflowRun` 로그로 **근거와 재현성**을 남기는 것을 목표로 합니다.

---

## 사용 흐름 (제품 관점)

1. **테스트 ID** (`숫자 3자리`) 발급 또는 로그인 → 상단 프로필에서 현재 ID·최근 ID 확인 가능  
2. **`/new`** 에서 이력서·포트폴리오·강조 프로젝트(선택)·채용공고 붙여넣기 → 워크플로 이름 저장(선택)  
3. **분석 시작** → 후보/JD 추출, 갭 분석, 후속 질문 생성 (`POST /v1/analysis/run`)  
4. **`/results/[id]`** 에서 공고 대비 장·단점 스냅샷 확인 → 보완 질문에 답하면 프로필·갭·스냅샷 갱신  
5. **문서 초안 생성** → 지원동기/자기소개 초안 + 경력기술서 초안 (**2종**, `POST /v1/generated-documents/generate`)  
6. **면접 대비 리포트** → 핵심 3 + 심화 2 (`POST /v1/interview/generate`)  
7. **`/my`** 에서 같은 테스트 ID로 저장된 워크플로 목록 재진입

> 데모용 **비인증** 테스트 계정입니다. 정식 로그인·권한 모델은 범위 밖입니다.

---

## 핵심 기능

| 영역 | 설명 |
|------|------|
| 단계형 오케스트레이션 | 후보 추출, JD 추출, 갭 탐지, 보완 질문, 문서/면접 생성을 체인 단위로 분리 |
| 설명 가능한 분석 | `fitAnalysisJson`에 공고 대비 강점·부족·보완 방향을 요약(수치 점수 과장 없음) |
| 운영 제어 | 분당 레이트리밋, 동일 `applicationId+stage` 실행 락, 문서/면접 단계별 재생성 스킵(선택) |
| 문서 생성 실패 시 | LLM 실패 시 **내부 placeholder를 사용자에게 보여주지 않음** → HTTP 503, 기존 유효 초안은 DB 유지 |
| 분석 재실행 | `POST /analysis/run` 호출마다 **전체 분석 파이프라인 실행** (`force`는 API 호환용으로만 유지) |

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
| LLM | `GEMINI_PREMIUM_MODEL` | (선택) 공고 대비 분석 4단계에 premium 라우트 |
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

## 테스트 계정·API 헤더

- 테스트 ID는 **`x-test-user-id`** 헤더(프론트는 `localStorage`와 동기화)와 함께 동작합니다.  
- `GET /v1/source-documents/by-test-user/:testUserId` 는 **헤더의 ID와 URL의 `testUserId`가 같아야** 합니다.  
- 워크플로 제목 등 메타: `PATCH /v1/source-documents/:id/meta`  

---

## API·DB 문서

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

## API 엔드포인트 (MVP 요약)

- `POST /v1/source-documents/test-user` — 테스트 ID 발급  
- `POST /v1/source-documents` — 입력 저장·Application 생성  
- `GET /v1/source-documents/by-test-user/:testUserId` — 목록 (`x-test-user-id` 필요)  
- `GET /v1/source-documents/:id` — 상세 + `workflowRuns`  
- `PATCH /v1/source-documents/:id` / `PATCH /v1/source-documents/:id/meta` — 원문·메타 수정  
- `POST /v1/source-documents/:id/link-my-workflow` — 활성 테스트 ID에 워크플로 연결  
- `POST /v1/analysis/run` — 분석 실행  
- `POST /v1/followup-questions/submit` — 보완 답변 반영  
- `POST /v1/generated-documents/generate` — 문서 초안 생성  
- `POST /v1/interview/generate` — 면접 리포트 생성  

전체는 [docs/api-spec.md](docs/api-spec.md) 참고.
