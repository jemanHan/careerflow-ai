# CareerFlow AI

AI 기반 취업 지원 문서 워크플로우 MVP입니다.  
이력서/포트폴리오/채용공고를 입력하면 분석, 갭 탐지, 후속 질문, 문서 생성, 채용공고 맞춤 리라이트까지 수행합니다.

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: NestJS + TypeScript
- DB: PostgreSQL + Prisma
- AI: Gemini Developer API (default) / OpenAI (optional) + LangChain

## MVP 기능
1. 입력 문서 수집
2. 후보자/채용공고 구조화 + 갭 분석 + **AI 추정 적합도 스냅샷**(참고 지표, 채용 보장 아님)
3. 서류 보완용 가이드 질문 + 대화형 입력
4. 후속 답변 반영 후 프로필·갭·적합도 갱신
5. 지원동기/자기소개 초안 + 경력기술서 초안 + 면접 대비 리포트(핵심/심화 질문 카드)
6. 채용공고 맞춤 리라이트

## 입력이 결과에 반영되는 방식 (간단 로직)
1. 사용자가 이력서/포트폴리오/강조 프로젝트(선택)/채용공고를 입력하면 `Application`에 저장됩니다.
2. 분석 단계에서 후보자 프로필과 채용공고 요구사항을 각각 구조화하고, 둘의 차이를 `gapAnalysis`로 계산합니다. 갭 결과로 **휴리스틱 적합도 점수**를 `fitAnalysisJson`에 저장합니다(추가 LLM 호출 없음).
3. 갭 분석을 바탕으로 서류 보완용 가이드 문장을 생성하고, 사용자가 답하면 후보자 프로필을 갱신한 뒤 갭을 재계산하고 적합도 점수를 업데이트합니다(이전 대비 변화량 표시).
4. 문서 생성 단계는 최종 후보자 프로필 + 채용공고 요구사항 + 강조 프로젝트 컨텍스트를 함께 사용해 초안을 만듭니다.
5. 면접 대비 리포트 단계는 제출된 근거와 채용공고를 바탕으로 심층 질문을 생성하며, 각 질문에 `whyAsked`/`answerPoints`/`caution`을 함께 제공합니다.
6. 각 단계 실행 결과/모델/폴백 여부는 `WorkflowRun`에 기록되어, 왜 해당 결과가 나왔는지 추적할 수 있습니다.

## Backend 시작 (Node 설치 후)
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

### LLM 환경변수 (provider/model routing)
- `LLM_PROVIDER`: `gemini`(기본) 또는 `openai`
- `GEMINI_API_KEY`: Gemini Developer API 키
- `GEMINI_DEFAULT_MODEL`: 기본/경량 작업용 모델 (기본값 `gemini-3.1-flash-lite` — 추출·채용공고·갭·후속·면접 질문)
- `GEMINI_HIGH_QUALITY_MODEL`: 문서 생성·채용공고 맞춤 리라이트용 (기본값 `gemini-2.5-flash`; light와 별도 모델로 유지)
- `OPENAI_API_KEY`: OpenAI provider 사용 시 키
- `OPENAI_MODEL`: OpenAI 기본/경량 모델
- `OPENAI_HIGH_QUALITY_MODEL`: OpenAI 고품질 모델
- `OPENAI_TEMPERATURE`: 공통 temperature

### 과호출 보호(기본 내장)
- AI 라우트별 분당 호출 제한
- 동일 워크플로우 단계 동시 실행 차단
- 기존 결과가 있으면 중복 재생성 스킵

## Frontend 시작
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

## Safe Local Run Rules
- 백엔드 실행 전:
  - `netstat -ano | findstr :4000`
- 프론트 실행 전:
  - `netstat -ano | findstr :3000`
- 포트 점유 PID 종료:
  - `cmd.exe /c "taskkill /PID 26500 /F"`
- 규칙:
  - 정상 서버가 이미 떠 있으면 재사용
  - 비정상 프로세스만 종료 후 재기동
  - 동일 서버 중복 실행 금지
  - 동일 실패 명령 반복 전 원인 진단 우선

## Docs
- `docs/project-overview.md`
- `docs/job-alignment.md`
- `docs/architecture.md`
- `docs/api-spec.md`
- `docs/db-schema.md`
- `docs/troubleshooting.md`
- `docs/dev-log.md`
- `docs/portfolio-points.md`
- `docs/portfolio-core.md` (포트폴리오용 핵심 로직/의사결정 요약)
- `docs/next-roadmap.md`
- `docs/performance-metrics.md`
- `docs/agent-rules.md` (runtime/documentation single rules source)

## Repository Hygiene
- 커밋/공유 제외 권장:
  - `.env`, `.env.local`, 실제 API 키/DB 접속 문자열
  - `node_modules/`, `dist/`, `.next/`, 실행 로그 파일
  - 개인 식별 가능 원문 데이터(이력서/연락처 포함 샘플)
- 공유 가능:
  - 코드, 스키마, 문서, `.env.example`
  - 트러블슈팅/운영 규칙/지표 문서(민감정보 마스킹 전제)
