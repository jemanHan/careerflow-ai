# 아키텍처

## 시스템 구성

| 계층 | 역할 |
|------|------|
| **Frontend** (Next.js) | `/`, `/new`, `/my`, `/results/[id]` — 입력·목록·결과·테스트 ID(프로필·히스토리) |
| **Backend** (NestJS) | REST API, 워크플로 오케스트레이션, 레이트리밋·락 |
| **DB** (PostgreSQL + Prisma) | Application, WorkflowRun, TestUser |
| **AI** (LangChain + Gemini/OpenAI) | 단계별 `RunnableSequence` 체인 |

---

## 백엔드 모듈

| 모듈 | 책임 |
|------|------|
| `SourceDocumentsModule` | 입력 저장·조회, 메타/원문 PATCH, 테스트 ID 발급 |
| `AnalysisModule` | parse ~ 후속 질문까지 분석 실행 |
| `FollowupQuestionsModule` | 답변 반영 → 후보 재생성 → 갭 재탐지 → `fitAnalysisJson` 갱신 |
| `GeneratedDocumentsModule` | 문서 2종 초안 생성, 선택 리라이트 |
| `InterviewModule` | 면접 리포트 생성 |
| `LangchainModule` | `LangchainWorkflowService` + `chains/*` |
| `PrismaModule` | DB 접근 |

---

## 워크플로 단계 (논리 순서)

1. `PARSE_SOURCE` — 입력 결합·정규화 (LLM 없음)  
2. `EXTRACT_CANDIDATE` / `EXTRACT_JOB` / `DETECT_GAP` / `GENERATE_FOLLOW_UP`  
3. `REGENERATE_CANDIDATE` — 보완 답변 반영 시  
4. `GENERATE_DRAFTS` — **`coverLetter`, `careerDescription` (문서 2종)**  
5. `REWRITE_FOR_JOB` — 선택 (JD 맞춤 리라이트)  
6. `GENERATE_INTERVIEW` — 면접 리포트  

**분석(`POST /analysis/run`)**: 요청마다 **4~5단계 LLM 파이프라인 전체 실행**. `force`는 API 호환용이며 “이미 ANALYZED면 스킵”은 하지 않음.

**문서 생성**: 이미 `coverLetter`·`careerDescription`이 채워져 있으면 `force: false`일 때 **스킵**(`WorkflowRun`에 `SKIPPED_REUSE_EXISTING_DOCUMENTS`). LLM 실패 시 **503**, DB의 기존 유효 초안은 placeholder로 덮지 않음.

---

## `fitAnalysisJson` (공고 대비 스냅샷)

- 갭 분석 결과로부터 강점·부족·보완 방향을 요약. **수치 적합도 점수는 사용하지 않음.**  
- 채용 결과를 보장하지 않는다는 취지의 고지와 함께 UI에 표시.  

---

## 영속화 모델 (요약)

- **`TestUser`**: 3자리 데모 계정 ID  
- **`Application`**: 원문, 분석 JSON, `fitAnalysisJson`, 후속 Q&A, `generatedDraftJson`, `rewrittenDraftJson`, 상태, `testUserId`  
- **`WorkflowRun`**: 단계별 input/output/error, 라우팅·실행 메타데이터  

목록 조회는 **`x-test-user-id` 헤더와 경로의 테스트 ID 일치** 시에만 허용.

---

## 강조 프로젝트

- `projectDescriptions[0]`을 우선 컨텍스트로 사용(추출·문서·면접·리라이트).  

---

## 모델 라우팅 (Gemini 기준)

- **`GEMINI_PREMIUM_MODEL` 설정 시**: 공고 대비 파이프라인 4단계(후보·JD·갭·후속질문)에 **premium** 적용 가능. 미설정 시 해당 단계는 **light** (`GEMINI_DEFAULT_MODEL`).  
- **문서 생성·면접 리포트**: **quality** (`GEMINI_HIGH_QUALITY_MODEL`)  
- **`REWRITE_FOR_JOB`**: **light** (`GEMINI_DEFAULT_MODEL`)  

OpenAI provider 시 `OPENAI_*` 모델 키 사용(상세는 `LangchainWorkflowService.resolveRouting`).

---

## `WorkflowRun.stage`별 라우트 (Gemini, 요약)

| stage | route (일반적) |
|------|------------------|
| 추출·갭·후속질문 | premium(설정 시) / light |
| `GENERATE_DRAFTS` | quality |
| `GENERATE_INTERVIEW` | quality |
| `REWRITE_FOR_JOB` | light |

실제 사용 모델명은 `inputJson.llmRoute`·`llmExecution`에 기록.

---

## API·CORS·배포

- CORS: `CORS_ORIGIN` 콤마 구분. `NODE_ENV=production`이고 비어 있으면 **origin false** (브라우저 요청 불가).  
- `PATCH`, `PUT`, `DELETE` 메서드 허용(메타 수정 등).  
- 프론트 production: `NEXT_PUBLIC_API_BASE_URL` 필수. Vercel→EC2 HTTP는 **Next rewrites + `BACKEND_URL`** 패턴 사용.  

---

## 프론트 결과 화면 (`results-client`)

- 단계별 섹션(분석·보완·문서·면접), 로딩 메시지, 오류 피드백  
- 경력기술서 초안에서 `보완 필요 항목` 등은 본문과 분리해 표시할 수 있음  

---

## 검색·확장 구조

- 현재 구조는 입력 문서와 생성 결과를 중심으로 워크플로우를 구성한다.  
- 단계별 산출물이 DB에 남기 때문에, 이후 검색 보강이나 추가 실행 단계를 붙일 수 있는 형태로 설계되어 있다.  

---

## 인증 확장 시 (계획)

- `User` 엔티티, `Application.userId`, 조회 시 소유권 검증 등.  
