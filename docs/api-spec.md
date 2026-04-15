# API Spec (MVP)

Base URL: `/v1`  
공통: 프론트는 `NEXT_PUBLIC_API_BASE_URL` 기준으로 호출. 테스트 ID 사용 시 요청 헤더에 `x-test-user-id` 포함.

---

## 공통 규칙

- 분석·문서·면접 실행은 **`Application` 단위**  
- `force` 필드: DTO에 있으면 **문서/면접 재생성 스킵 해제** 등에 사용.  
  **`POST /analysis/run`의 `force`는 호환용이며, 분석 파이프라인 스킵에는 사용하지 않음**(매 호출 전체 실행).  
- 상세 추적: `GET /source-documents/:id` 의 `workflowRuns`  

---

## 1) 테스트 ID 발급

### `POST /source-documents/test-user`

- 숫자 3자리 `TestUser` 생성(충돌 시 재시도)

---

## 2) 입력 저장

### `POST /source-documents`

**Body (요약)**

| 필드 | 설명 |
|------|------|
| `resumeText`, `portfolioText`, `targetJobPostingText` | 최소 길이 등 검증 있음 |
| `projectDescriptions` | 문자열 배열(강조 프로젝트) |
| `testUserId` | 선택, 3자리 문자열 |

**Response**: 생성된 `Application` (status `CREATED`)

---

## 3) 목록·상세 조회

### `GET /source-documents/by-test-user/:testUserId`

- 해당 테스트 사용자에 연결된 워크플로 목록  
- **필수 헤더**: `x-test-user-id` — **URL의 `testUserId`와 동일한 값**이어야 함(불일치 시 403)

### `GET /source-documents/:id`

- 단건 + `workflowRuns` 타임라인  
- 테스트 ID가 연결된 경우 `x-test-user-id` 검증  

### `PATCH /source-documents/:id`

- 입력 원문 일부 갱신  

### `PATCH /source-documents/:id/meta`

- 워크플로 표시명 등 메타데이터 갱신 (워크플로 이름 변경)  
- **CORS**: 브라우저에서 `PATCH` 프리플라이트 허용 필요(백엔드 `OPTIONS` + 메서드 허용)  

### `POST /source-documents/:id/link-my-workflow`

- 현재 활성 테스트 ID(`x-test-user-id`)에 해당 `Application`을 연결(나의 CareerFlow에 묶기)  

---

## 4) 분석 실행

### `POST /analysis/run`

`PARSE_SOURCE → EXTRACT_CANDIDATE → EXTRACT_JOB → DETECT_GAP → GENERATE_FOLLOW_UP`

**Body**

```json
{ "applicationId": 1, "force": false }
```

- **매 요청마다 위 파이프라인 전체 실행**. 저장된 결과만 다시 보는 것은 `GET`으로 처리.

---

## 5) 후속 답변 (대화형 보완)

### `POST /followup-questions/submit`

- `REGENERATE_CANDIDATE` 후 **`DETECT_GAP` 재실행**, `gapAnalysisJson`·`fitAnalysisJson` 갱신  
- 상태: `FOLLOW_UP_COMPLETED`  

---

## 6) 문서 생성

### `POST /generated-documents/generate`

`GENERATE_DRAFTS` → (옵션) `REWRITE_FOR_JOB`

**Body**

```json
{ "applicationId": "1", "rewriteForJob": true, "force": false }
```

**`generatedDraftJson` 필드 (문서 2종)**

| 필드 | 의미 |
|------|------|
| `coverLetter` | 지원동기/자기소개 초안 |
| `careerDescription` | 경력기술서 초안(프롬프트상 섹션 구조 포함 가능) |

- 기존에 두 필드가 **비어 있지 않으면** `force: false`일 때 재생성 **스킵**(비용·중복 방지). `force: true`로 재생성.  
- LLM 실패 시: **`generatedDraftJson`을 내부 placeholder로 덮어쓰지 않음** → HTTP **503** (`ServiceUnavailableException`), `WorkflowRun`에 `DOCUMENT_GENERATION_FAILED` 기록  
- `rewriteForJob: true`인데 리라이트만 실패한 경우: 초안은 저장하고 `rewrittenDraftJson` 갱신은 생략할 수 있음(기존 값 유지)  

---

## 7) 면접 대비 리포트

### `POST /interview/generate`

- `GENERATE_INTERVIEW` — `generatedDraftJson` 내 면접 관련 필드에 병합 저장(문서 초안 필드는 덮어쓰지 않도록 서비스에서 처리)  

**면접 카드 구조**

```json
{
  "section": "core | deep",
  "question": "질문 본문",
  "whyAsked": "JD/입력 근거 기준 생성 이유",
  "answerPoints": ["답변 준비 포인트"],
  "caution": "과장 위험 시 주의 (선택)"
}
```

- 규칙: 핵심 3 + 심화 2 등 제품 정의에 맞는 개수  

---

## HTTP 상태·에러 (요약)

| 코드 | 상황 |
|------|------|
| 400 | DTO 검증 실패, 선행 단계 미완료 등 |
| 403 | `x-test-user-id`와 조회 대상 테스트 ID 불일치 |
| 404 | Application 없음, 선행 데이터 없음 |
| 409 | 동일 `applicationId+stage` 동시 실행 락 |
| 429 | 레이트리밋 |
| 503 | 문서 생성 LLM 실패 등(메시지 본문 참고) |
| 500 | 기타 서버 오류 |

---

## 비고

- 운영 디버깅은 `WorkflowRun`의 `inputJson.llmRoute`, `inputJson.llmExecution` 참고  
