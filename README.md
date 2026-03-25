# CareerFlow AI

CareerFlow AI는 취업 준비에서 반복되는 문서 커스터마이징 업무를  
**분석 -> 보완 -> 생성 -> 면접 준비** 워크플로우로 구조화한 AI 제품 MVP입니다.

단순 one-shot 생성기가 아니라, 입력 근거를 추적 가능한 단계로 분해해  
실행 로그와 함께 결과 품질을 개선할 수 있도록 설계했습니다.

## 핵심 가치
- **단계형 오케스트레이션**: 후보자 추출, JD 추출, 갭 탐지, 보완 질문, 문서/면접 리포트를 분리 실행
- **설명 가능한 분석**: `fitAnalysisJson`에 강점/약점/보완 포인트를 저장(수치 점수 과장 없음)
- **운영 안정성**: 레이트리밋, 실행 락, 중복 재실행 스킵, fallback 메타데이터 기록
- **재방문 UX**: 테스트 계정 기반 워크플로우 저장/조회 + 프론트 입력 초안 저장

## Tech Stack
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL + Prisma
- **AI**: LangChain + Gemini Developer API(default) / OpenAI(optional)

## 제품 흐름
1. `/new`에서 이력서/포트폴리오/강조 프로젝트(선택)/채용공고 입력
2. `PARSE_SOURCE -> EXTRACT_CANDIDATE -> EXTRACT_JOB -> DETECT_GAP`
3. `fitAnalysisJson` 생성(공고 대비 강점/약점/보완 요약)
4. `GENERATE_FOLLOW_UP`으로 보완 질문 제시, 답변 제출 시 `REGENERATE_CANDIDATE` + 갭 재분석
5. `GENERATE_DRAFTS`로 문서 3종 생성, 선택적으로 `REWRITE_FOR_JOB`
6. `GENERATE_INTERVIEW`로 면접 대비 리포트(핵심 3 + 심화 2) 생성

## 아키텍처 하이라이트
- **단일 워크플로우 경로**: `LangchainWorkflowService` 중심으로 단계 실행/예외 처리 일원화
- **단계별 모델 라우팅**:
  - `light`: 추출/갭/후속/면접
  - `quality`: 문서 생성/리라이트
  - `premium`(선택, `GEMINI_PREMIUM_MODEL`): **최초 공고 대비 분석 1회**에만 적용(미설정 시 해당 경로 비활성)
- **증거 기반 로그**: `WorkflowRun`에 `stage`, `inputJson`, `outputJson`, `errorMessage`, `llmRoute`, `llmExecution` 기록
- **단계 독립성 보장**: 문서 생성 시 면접 리포트를 덮어쓰지 않도록 병합 저장

## 데모 저장 흐름 (비인증)
- 테스트 ID(숫자 3자리) 발급 후 워크플로우를 계정별로 저장/조회
- `/my`에서 본인 테스트 ID의 결과 목록 재진입 가능
- 입력 폼 초안은 브라우저 스토리지에 자동 저장되어 뒤로가기/재방문 복구 지원
- 주의: 데모 편의 기능이며 프로덕션 인증/권한 모델 대체가 아님

## 빠른 실행

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

### 2) Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## 환경변수 핵심
- `LLM_PROVIDER`: `gemini`(기본) | `openai`
- `GEMINI_API_KEY`
- `GEMINI_DEFAULT_MODEL` (light)
- `GEMINI_HIGH_QUALITY_MODEL` (quality)
- `GEMINI_PREMIUM_MODEL` (선택): 최초 공고 대비 분석 1회에만 사용. 비우면 premium 경로 비활성 → 기본/고품질 라우트만 사용
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_HIGH_QUALITY_MODEL`
- `NEXT_PUBLIC_API_BASE_URL` (프론트 배포 시 필수)

## API 엔드포인트 (MVP)
- `POST /v1/source-documents/test-user`
- `POST /v1/source-documents`
- `GET /v1/source-documents/by-test-user/:testUserId`
- `GET /v1/source-documents/:id`
- `POST /v1/analysis/run`
- `POST /v1/followup-questions/submit`
- `POST /v1/generated-documents/generate`
- `POST /v1/interview/generate`

## 운영/안정성 포인트
- **Rate limit**: 라우트별 분당 호출 제한(429)
- **Execution lock**: 동일 `applicationId + stage` 동시 실행 차단(409)
- **Skip strategy**: 기존 결과 재사용으로 비용/지연 최소화
- **Fallback**: 외부 모델 오류 시 원인 기록 후 흐름 지속

## 문서
- `docs/project-overview.md` — 제품 목표/범위
- `docs/architecture.md` — 시스템 설계/워크플로우/라우팅
- `docs/api-spec.md` — 요청/응답 계약
- `docs/db-schema.md` — 저장 모델
- `docs/troubleshooting.md` — 장애 사례/원인/조치
- `docs/langchain-in-this-project.md` — LangChain 적용 범위와 비범위

## Repository Hygiene
- 커밋 금지: `.env`, `.env.local`, 실제 API 키/DB 접속 정보
- 커밋 금지: `node_modules/`, `dist/`, `.next/`, 실행 로그
- 커밋 금지: 개인 포트폴리오/개발일지 등 로컬 전용 문서(`.gitignore` 적용)
