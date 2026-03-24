# 아키텍처

## 시스템 구조
- Frontend (Next.js): 입력/결과 조회/지원 적합도 분석/대화형 보완/문서 초안/면접 대비 리포트 화면
- Backend (NestJS): 모듈형 API + 워크플로우 오케스트레이션
- DB (PostgreSQL + Prisma): 상태, 단계 로그, 산출물 영속화
- AI (Gemini Developer API + LangChain): 단계별 RunnableSequence 체인
- AI Provider: 환경변수 기반 선택(`LLM_PROVIDER`), 현재 운영 기본은 Gemini

## 백엔드 폴더 구조
```text
backend/
  prisma/
    schema.prisma
  src/
    app.module.ts
    main.ts
    modules/
      applications/
        # 제거됨 (중복 책임 정리)
      source-documents/
      analysis/
      followup-questions/
      generated-documents/
      interview/
      langchain/
        chains/
          candidate-profile.chain.ts
          job-posting.chain.ts
          gap-detection.chain.ts
          follow-up-questions.chain.ts
          document-generation.chain.ts
          interview-questions.chain.ts
          rewrite-tailoring.chain.ts
        langchain.module.ts
        langchain-workflow.service.ts
        workflow.types.ts
      prisma/
        prisma.module.ts
        prisma.service.ts
```

## 모듈 책임
- `SourceDocumentsModule`: 입력 원문 저장/조회
- `AnalysisModule`: parse~follow-up 질문 생성까지 실행
- `FollowupQuestionsModule`: 후속 답변 반영 후 후보자 프로필 갱신 + **갭 재탐지(`DETECT_GAP`)** + `fitAnalysisJson` 갱신
- `GeneratedDocumentsModule`: 문서 생성 + 리라이트
- `InterviewModule`: 면접 대비 리포트(질문+생성 이유+답변 포인트+주의) 생성
- `LangchainModule`: 각 단계 체인 실행과 출력 형식 보장
- `PrismaModule`: DB 연결과 트랜잭션/CRUD 접근

## 구조화 AI 워크플로우 단계
1. `PARSE_SOURCE`: 입력 문서 결합/정규화
2. `EXTRACT_CANDIDATE`: 후보자 구조화 JSON 추출
3. `EXTRACT_JOB`: 채용공고 구조화 JSON 추출
4. `DETECT_GAP`: 매칭/누락/근거약함 탐지
5. `GENERATE_FOLLOW_UP`: 보완 질문 생성
6. `REGENERATE_CANDIDATE`: 후속 답변 반영 재분석
7. `GENERATE_DRAFTS`: 문서 3종 초안 생성
8. `GENERATE_INTERVIEW`: 면접 대비 리포트 생성
9. `REWRITE_FOR_JOB`: 채용공고 맞춤 리라이트

## 지원 적합도 스냅샷 (`fitAnalysisJson`)
- 분석 완료 시점에 갭 분석 결과로부터 **휴리스틱 점수(0–100)** 와 강점/약점/추천 보완 방향을 저장한다(LLM 추가 호출 없음).
- 점수는 **AI 추정 서류·직무 적합도**이며 채용 합격을 보장하지 않음(프론트·스냅샷에 고지 문구 포함).
- 후속 답변 제출 후 갭이 재계산되면 점수를 갱신하고 `previousEstimatedFitScore`/`scoreDelta`로 변화량을 남긴다.

## 현재 영속화 모델 (PostgreSQL)
- `TestUser`:
  - 데모/평가용 라이트 계정 ID(숫자 3자리)와 생성 시각 저장(비밀번호/인증 없음)
  - DB 유니크 보장, 충돌 시 재생성
- `Application`:
  - 입력 원문, 분석 결과(`candidateProfileJson`, `jobPostingJson`, `gapAnalysisJson`), **`fitAnalysisJson`**, 후속 질문/답변, 생성 문서, 면접 리포트, 리라이트 결과 저장
  - 선택 필드 `testUserId`로 라이트 테스트 계정과 연결
- `WorkflowRun`:
  - 단계별 input/output/error, 모델 라우팅/실행 메타데이터 저장
- 해석:
  - 라이트 테스트 계정으로 워크플로우 재조회/재방문이 가능(데모 친화 save-first)
  - 목록/상세 조회는 요청 헤더의 활성 테스트 ID와 대상 ID가 일치할 때만 허용
  - 현재는 인증 없는 데모 흐름이며, 프로덕션 로그인/권한 모델은 향후 확장 범위

## 강조 프로젝트(선택) 반영 규칙
- 입력의 첫 번째 프로젝트 텍스트를 `prioritized project context`로 간주
- 반영 지점:
  - 후보자 프로필 추출
  - 문서 생성
  - 면접 대비 리포트 생성
  - 채용공고 맞춤 리라이트
- 목적: 선택 입력이어도 실제 생성 품질에 영향을 주는 우선 컨텍스트로 사용

## 체인 오케스트레이션 원칙
- 각 단계는 독립 함수 + 독립 PromptTemplate 사용
- 단계별 입출력은 JSON으로 강제(파싱 실패 지점 명확화)
- 단계 실행 결과는 `WorkflowRun`으로 DB에 누적 기록
- one-shot 프롬프트 금지, 단계별 재실행 가능성 우선
- 문서/면접 생성 프롬프트는 과장 방지 규칙을 포함:
  - 입력 근거 없는 RAG/Agent/성과 단정 표현 금지
  - 근거 약한 항목은 `구현/검증 중`, `초기 버전` 톤으로 생성
  - 면접 리포트는 `whyAsked`(근거 연결), `answerPoints`(실전 준비), `caution`(과장 리스크)를 구조화해 출력

## 모델 라우팅 (현재 기준)
- **역할 기반 이중 라우트**를 유지한다(기본·고품질을 한 모델로 합치지 않음). 무료 티어는 모델별 일일 한도가 분리되어 있어, 작업·비용·품질을 분리해 설명·포트폴리오 가치를 보존한다.
- 기본 모델(`GEMINI_DEFAULT_MODEL`, 기본값 `gemini-3.1-flash-lite`) — **light**:
  - 후보자 프로필 추출
  - 채용공고 분석
  - 갭 탐지
  - 후속 질문 생성(서류 보완용)
  - 면접 대비 리포트 생성
- 고품질 모델(`GEMINI_HIGH_QUALITY_MODEL`, 기본값 `gemini-2.5-flash`) — **quality**:
  - 문서 3종 생성
  - 채용공고 맞춤 리라이트
- provider를 `openai`로 바꾸면 `OPENAI_*` 모델 키를 사용
- API 키 미설정/할당량/파싱 오류 시 fallback 응답을 반환하고 `llmExecution`에 원인을 기록

## 모델 사용 검증 방법
- `GET /v1/source-documents/:id`의 `workflowRuns`를 확인
- 각 LLM 단계의 `inputJson.llmRoute`에 아래 값이 기록됨:
  - `provider` (gemini/openai)
  - `route` (light/quality)
  - `model` (실제 사용 모델명 — `GEMINI_DEFAULT_MODEL` 또는 `GEMINI_HIGH_QUALITY_MODEL` 값과 일치해야 함)
- 실제 실행 결과 확인은 `inputJson.llmExecution`으로 판단:
  - `fallbackUsed` (true/false)
  - `fallbackReason` (실패 원인)
  - `hasProviderApiKey` (키 인식 여부)

### `WorkflowRun.stage`별 기대 라우트 (Gemini)
| stage | route | 용도 |
| --- | --- | --- |
| `EXTRACT_CANDIDATE` | light | 후보 추출 |
| `EXTRACT_JOB` | light | 채용공고 분석 |
| `DETECT_GAP` | light | 갭 탐지 |
| `GENERATE_FOLLOW_UP` | light | 후속 질문 생성 |
| `REGENERATE_CANDIDATE` | light | 후속 답변 반영 시 프로필 재생성(`extractCandidateProfile`과 동일 라우트) |
| `GENERATE_DRAFTS` | quality | 문서 3종 |
| `GENERATE_INTERVIEW` | light | 면접 질문 |
| `REWRITE_FOR_JOB` | quality | 채용공고 맞춤 리라이트 |
| `PARSE_SOURCE` | (LLM 없음) | 원문 결합만 |

## API 과호출 방지 설계(MVP)
- `RequestRateLimiterService`: 라우트별 분당 호출 제한(429)
- `WorkflowExecutionLockService`: 동일 `applicationId+stage` 동시 실행 차단(409)
- 재사용 캐시 전략:
  - 분석 결과가 이미 있으면 재분석 스킵
  - 동일 후속답변 재제출 시 재실행 스킵
  - 문서/면접질문이 이미 있으면 재생성 스킵
  - 문서 생성은 `generatedDraftJson`의 문서 필드만 갱신하고 기존 면접 리포트는 보존(2번/3번 단계 독립성 유지)
- 스킵 이벤트는 `WorkflowRun.errorMessage`에 기록

## 현재 엔드포인트
- `POST /v1/source-documents/test-user` (테스트 ID 발급)
- `POST /v1/source-documents`
- `GET /v1/source-documents/by-test-user/:testUserId` (테스트 사용자 저장 워크플로우 조회)
- `GET /v1/source-documents/:id`
- `POST /v1/analysis/run`
- `POST /v1/followup-questions/submit`
- `POST /v1/generated-documents/generate`
- `POST /v1/interview/generate`

## 프론트엔드 구현 상태
- `frontend/app/page.tsx`: 진입 페이지
- `frontend/app/new/page.tsx`: 소스 입력 폼
- `frontend/app/results/[id]/page.tsx`: 결과 확인 페이지
- `frontend/components/results-client.tsx`:
  - 분석/문서/면접 실행 버튼
  - 후속 질문별 1:1 답변 입력 폼
  - 후속 답변 진행 상태 표시(질문별 입력/제출 이력)
  - 생성 결과(지원동기/자기소개 초안, 경력기술서 초안, 프로젝트 소개문구 초안)
  - 면접 대비 리포트 카드(핵심 질문 3 + 심화 질문 2, 질문/생성 이유/답변 준비 포인트/주의)
  - 경력기술서 초안 + 프로젝트 근거 통합 뷰
  - `왜 이런 결과가 나왔나` 근거 요약
  - 현재 상태 요약(경력 레벨/특화/보완점)
  - 처리 중 로딩 스피너/진행 문구
  - 강조 프로젝트는 기본 숨김 + 펼치기 UI

## 로그 노출 정책
- 트러블슈팅용 상세 실행 로그는 서버(DB) `WorkflowRun`에 저장
- 프론트 결과 페이지는 사용자 이해를 위한 요약 정보만 노출
- `WorkflowRun` 조회는 운영/디버깅 목적(백엔드 API 또는 DB 조회)으로 사용

## 로그인/개인화 확장 시 영향 범위(계획)
- 추가 예정:
  - 정식 `User` 엔티티, 인증 세션/토큰 전략
  - `Application.userId` 소유권 연결 + 권한 검증
  - 버전형 초안 엔티티(선택)
- 변경 예상:
  - 조회 API에 권한 검증 추가
  - save-first 흐름(부분 재생성/버전 비교) 중심 UX로 확장

## Retrieval-assisted 확장 방향 (미구현)
- 현재 아키텍처는 입력/중간결과/생성결과를 DB에 저장하므로, 추후 retrieval layer를 붙일 기반이 이미 있음.
- 단, 현재는 full RAG(벡터DB 검색 + 주입 파이프라인) 미구현 상태이며, 이를 현재 구현으로 주장하지 않음.
- 확장 시나리오:
  - 경량 단계: 유사 채용공고, 사용자 저장 히스토리, 이전 생성 결과를 선택 조회해 프롬프트 컨텍스트에 보강
  - 고도화 단계: 임베딩 인덱스/검색 전략을 단계별 체인(적합도/문서/면접)에 맞춰 분리 적용
- 설계 원칙:
  - retrieval은 품질 보강 레이어로 추가하고, 기존 워크플로우 안정성(락/재사용/로그)은 유지
  - "현재 동작"과 "향후 확장"을 문서/포트폴리오에서 명확히 분리

### 구현 범위 vs 확장 로드맵 (명확화)
- 현재 구현: 비로그인 MVP. `Application`/`WorkflowRun` 중심으로 입력·분석·생성 결과를 저장하고 재실행한다.
- 향후 확장: 로그인/인증과 `userId` 연결을 추가해 사용자별 저장형 워크플로우로 확장한다.
- 설계 의도: 인증을 미리 넣지 않고 핵심 워크플로우 가치를 먼저 검증한 뒤, 저장 구조를 기반으로 개인화/권한/버전 기능을 단계적으로 붙일 수 있게 함.
- 기대 효과: 이전 결과 재사용과 부분 재생성으로 반복 LLM 호출을 줄여 비용·응답시간·운영 안정성을 개선.
