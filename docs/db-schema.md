# DB Schema (MVP)

PostgreSQL + Prisma. 상세는 `backend/prisma/schema.prisma` 가 기준입니다.

---

## `TestUser`

| 항목 | 설명 |
|------|------|
| `id` | 문자열 PK, **숫자 3자리** 데모 계정 ID |
| `applications` | 연결된 `Application[]` |

---

## `Application`

한 번의 지원 워크플로 단위.

| 구분 | 필드 |
|------|------|
| 식별 | `id`, `testUserId`(선택), `title`(표시용 워크플로 이름) |
| 상태 | `status`: `CREATED` → `ANALYZED` → `FOLLOW_UP_COMPLETED` → `DOCUMENTS_GENERATED` |
| 입력 | `resumeText`, `portfolioText`, `projectDescriptions[]`, `targetJobPostingText` |
| 분석 | `candidateProfileJson`, `jobPostingJson`, `gapAnalysisJson`, `fitAnalysisJson` |
| 보완 | `followUpQuestions[]`, `followUpAnswersJson` |
| 생성 | `generatedDraftJson`(문서·면접 산출물), `rewrittenDraftJson`(리라이트) |
| 기타 | `interviewNotesJson`(질문별 사용자 메모) |
| 관계 | `workflowRuns` 1:N |
| 감사 | `createdAt`, `updatedAt` |

인덱스: `(testUserId, createdAt)` — 목록 조회용.

---

## `WorkflowRun`

단계별 AI 실행 로그.

| 필드 | 설명 |
|------|------|
| `applicationId` | FK → Application |
| `stage` | `WorkflowStage` enum (`PARSE_SOURCE` … `REWRITE_FOR_JOB`) |
| `inputJson`, `outputJson` | 단계 입출력(라우팅·`llmExecution` 포함 가능) |
| `errorMessage` | 실패·스킵 사유 문자열 |

인덱스: `(applicationId, stage)`.

---

## 설계 메모

- MVP는 속도를 위해 **중간 산출물을 JSON 컬럼**에 저장.  
- 동시에 `WorkflowRun`으로 단계 증거를 남겨 디버깅·포트폴리오 설명에 활용.  
- 향후: `User`·`Application.userId`, 문서 버전 테이블 등으로 확장 가능.  
