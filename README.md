# CareerFlow AI

CareerFlow AI는 이력서, 포트폴리오, 채용공고를 한 흐름으로 연결해  
공고 기준 분석, 보완 질문, 문서 초안 생성, 면접 대비까지 이어 주는 AI 기반 지원 준비 서비스입니다.

단순히 결과만 한 번 뽑아내는 형태보다,  
같은 지원 건을 다시 열어 수정하고 이어갈 수 있는 단계형 워크플로우로 구성한 것이 핵심입니다.

---

## 프로젝트 개요

지원 준비 과정에서는 보통 아래 작업이 따로 놀기 쉽습니다.

- 이력서와 포트폴리오 정리
- 채용공고 분석
- 부족한 경험 보완
- 자기소개서/경력기술서 초안 작성
- 면접 질문 대비

CareerFlow AI는 이 과정을 하나의 제품 흐름으로 묶었습니다.  
사용자가 입력한 문서를 바탕으로 공고 적합도를 구조적으로 정리하고, 부족한 부분은 질문으로 보완한 뒤, 문서 초안과 면접 대비까지 이어서 사용할 수 있게 설계했습니다.

---

## 사용 흐름

1. 테스트 세션 또는 로그인 상태로 진입합니다.
2. 이력서, 포트폴리오, 강조 프로젝트, 채용공고를 입력합니다.
3. 공고 기준으로 강점과 부족 신호를 분석합니다.
4. 부족한 부분은 follow-up 질문으로 보완합니다.
5. 보완된 내용을 반영해 자기소개/경력기술서 초안을 생성합니다.
6. 같은 데이터를 기반으로 면접 대비 리포트를 생성합니다.
7. 저장된 워크플로우를 다시 열어 이어서 수정할 수 있습니다.

---

## 주요 기능

### 1. 공고 대비 분석
- 이력서, 포트폴리오, 채용공고를 함께 비교해 강점과 부족 신호를 정리합니다.
- 단순 점수화보다, 왜 맞고 왜 부족한지를 문장형으로 설명하는 데 초점을 뒀습니다.

### 2. 보완 질문 기반 개선 흐름
- 부족한 근거가 있는 경우 follow-up 질문을 생성합니다.
- 사용자가 답변하면 분석 결과와 프로필 요약이 다시 갱신됩니다.

### 3. 문서 초안 생성
- 지원동기/자기소개 초안
- 경력기술서 초안

### 4. 면접 대비 리포트
- 핵심 질문
- 심화 질문
- 답변 준비 포인트

### 5. 저장형 워크플로우
- 한 번 생성하고 끝나는 구조가 아니라, 같은 지원 건을 다시 열어 이어서 수정할 수 있습니다.

---

## 구현 포인트

### 단계형 워크플로우
분석, 보완 질문, 문서 생성, 면접 대비를 한 번에 처리하지 않고 단계별로 분리했습니다.  
덕분에 어떤 단계에서 결과가 바뀌었는지 추적할 수 있고, 필요한 단계만 다시 실행하기 쉬운 구조가 되었습니다.

### 실행 기록과 추적
워크플로우 실행 결과를 `WorkflowRun` 단위로 남겨서  
어떤 단계가 실행되었는지, 어떤 모델이 사용되었는지, 어디서 fallback이 발생했는지 확인할 수 있게 했습니다.

### 운영 안정성
- 동시 실행 제어
- 중복 실행 방지
- 문서/면접 결과 재사용
- 과호출 제한

단순히 “생성된다”에서 끝나지 않고, 반복 호출과 충돌 상황까지 운영 관점에서 다룬 점이 이 프로젝트의 중요한 구현 포인트입니다.

---

## 운영 검증

이 프로젝트는 로컬 테스트에서 끝내지 않고, EC2 운영 환경에서 실제로 보호 장치가 제대로 동작하는지 다시 검증했습니다.

확인한 내용:

- 동일 분석 요청 동시 호출 시 `409`로 즉시 차단되는지
- 동일 follow-up 답변 재제출 시 중복 실행 없이 skip 되는지
- 문서/면접 생성 결과가 재호출에서 재사용되는지
- 실행 메타데이터와 상태 코드가 운영 환경에서도 일관되게 남는지

관련 문서:

- [docs/real-benchmark-2026-04-15.md](docs/real-benchmark-2026-04-15.md)
- [docs/ops-deploy-verification-2026-04-14.md](docs/ops-deploy-verification-2026-04-14.md)

---

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL, Prisma
- **AI**: LangChain, Gemini Developer API, OpenAI

---

## 로컬 실행

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

- 기본 포트: `4000`
- API prefix: `/v1`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

- 기본 포트: `3000`

---

## 환경 변수

| 구분 | 변수 | 설명 |
|------|------|------|
| LLM | `LLM_PROVIDER` | `gemini` 또는 `openai` |
| LLM | `GEMINI_API_KEY` / `OPENAI_API_KEY` | 모델 호출 키 |
| LLM | `GEMINI_DEFAULT_MODEL` | 추출/갭 분석/후속 질문 중심 모델 |
| LLM | `GEMINI_HIGH_QUALITY_MODEL` | 문서/면접 생성용 모델 |
| LLM | `GEMINI_PREMIUM_MODEL` | 상위 분석 단계용 선택 모델 |
| Backend | `DATABASE_URL` | PostgreSQL 연결 문자열 |
| Backend | `CORS_ORIGIN` | 허용할 프론트 Origin |
| Frontend | `NEXT_PUBLIC_API_BASE_URL` | 프론트에서 사용할 API base URL |

자세한 예시는 `backend/.env.example`, `frontend/.env.local.example`을 참고하면 됩니다.

---

## 배포

### Frontend
- Vercel 기준 `frontend` 디렉터리를 Root Directory로 사용합니다.
- 프론트에서 `/v1` 경로를 백엔드 API로 프록시하도록 구성할 수 있습니다.

### Backend
- EC2에서 `backend` 디렉터리 기준으로 빌드 및 실행합니다.
- PM2 설정 파일: `backend/ecosystem.config.cjs`
- 배포 스크립트: `backend/deploy-ec2.sh`

---

## 문서

- [docs/project-overview.md](docs/project-overview.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/db-schema.md](docs/db-schema.md)
- [docs/langchain-in-this-project.md](docs/langchain-in-this-project.md)
- [docs/portfolio-case-study.md](docs/portfolio-case-study.md)
- [docs/real-benchmark-2026-04-15.md](docs/real-benchmark-2026-04-15.md)
- [docs/ops-deploy-verification-2026-04-14.md](docs/ops-deploy-verification-2026-04-14.md)
