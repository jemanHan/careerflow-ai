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
2. 후보자/채용공고 구조화 + 갭 분석 + **공고 대상 장·단점 스냅샷**(`fitAnalysisJson`, 채용 보장 아님)
3. 서류 보완용 가이드 질문 + 대화형 입력
4. 후속 답변 반영 후 프로필·갭·장·단점 스냅샷 갱신
5. 지원동기/자기소개 초안 + 경력기술서 초안 + 면접 대비 리포트(핵심/심화 질문 카드)
6. 채용공고 맞춤 리라이트
7. 라이트 테스트 계정 기반 저장/재방문 흐름(데모용, 비인증)

## 데모용 저장 흐름 (라이트 개인화)
- 홈에서 `테스트 계정 생성`으로 비밀번호 없는 테스트 ID 발급
  - 형식 규칙: 숫자 3자리 (예: `027`)
  - DB 유니크 보장(충돌 시 재생성)
- 같은 테스트 ID를 입력하면 `나의 CareerFlow 보기`에서 저장된 워크플로우 목록 재조회
- `/new` 입력 폼 저장 시 `testUserId`를 함께 저장해 결과를 사용자별로 묶음
- 생성된 ID는 브라우저 `localStorage`에 저장되어 재방문 시 재사용 가능
- 현재 세션의 활성 테스트 ID와 일치하는 데이터만 조회 가능하도록 제한
- 이 기능은 데모/평가 편의 목적이며, **프로덕션 인증/보안 로그인 대체가 아님**

## 입력이 결과에 반영되는 방식 (간단 로직)
1. 사용자가 이력서/포트폴리오/강조 프로젝트(선택)/채용공고를 입력하면 `Application`에 저장됩니다.
2. 분석 단계에서 후보자 프로필과 채용공고 요구사항을 각각 구조화하고, 둘의 차이를 `gapAnalysis`로 계산합니다. 갭 결과로 **강점·약점·추천 보완 요약**을 `fitAnalysisJson`에 저장합니다(추가 LLM 호출 없음, 수치 점수 없음).
3. 갭 분석을 바탕으로 서류 보완용 가이드 문장을 생성하고, 사용자가 답하면 후보자 프로필을 갱신한 뒤 갭과 `fitAnalysisJson`을 다시 계산합니다.
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
- `GEMINI_DEFAULT_MODEL`: 경량 분석/추출용 Gemini Flash Lite 계열(추출·채용공고·갭·후속·면접 질문)
- `GEMINI_HIGH_QUALITY_MODEL`: 고품질 생성용 Gemini Flash 계열(문서 생성·채용공고 맞춤 리라이트)
- `OPENAI_API_KEY`: OpenAI provider 사용 시 키
- `OPENAI_MODEL`: OpenAI 기본/경량 모델
- `OPENAI_HIGH_QUALITY_MODEL`: OpenAI 고품질 모델
- `OPENAI_TEMPERATURE`: 공통 temperature

### 배포 환경 체크 (중요)
- 프론트 배포 시 `NEXT_PUBLIC_API_BASE_URL`을 반드시 설정해야 합니다.
- 미설정 상태에서 production 빌드가 실행되면 API base 주소를 강제로 요구합니다.

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
- `docs/project-overview.md` — 제품 범위·흐름
- `docs/architecture.md`
- `docs/api-spec.md`
- `docs/db-schema.md`
- `docs/troubleshooting.md`
- `docs/langchain-in-this-project.md` — LangChain 적용 범위

## Repository Hygiene
- 커밋/공유 제외 권장:
  - `.env`, `.env.local`, 실제 API 키/DB 접속 문자열
  - `node_modules/`, `dist/`, `.next/`, 실행 로그 파일
  - 개인 식별 가능 원문 데이터(이력서/연락처 포함 샘플)
  - 로컬 전용 문서(포폴·개발일지·에디터 규칙 등)는 `.gitignore`에 명시됨
- 공유 가능:
  - 코드, 스키마, 위 Docs 목록, `.env.example`
