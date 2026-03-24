# API Spec (MVP)

Base URL: `/v1`

## 공통 규칙
- 모든 생성/분석 API는 현재 `Application` 단위로 실행된다.
- 재실행 제어용 `force` 필드를 지원한다.
- 상세 실행 추적은 `GET /source-documents/:id`의 `workflowRuns`를 사용한다.

## 1) 입력 저장
### `POST /source-documents`
입력 문서 원문을 저장하고 `Application`을 생성한다.

### Request
```json
{
  "resumeText": "string (min 20)",
  "portfolioText": "string (min 20)",
  "projectDescriptions": ["string"],
  "targetJobPostingText": "string (min 20)"
}
```

### Response
- `Application` 레코드 (status=`CREATED`)

## 2) 결과 조회
### `GET /source-documents/:id`
- `Application` 본문 + `workflowRuns` 타임라인 반환
- 단계별 `inputJson/outputJson/errorMessage` 추적 가능
- LLM 단계는 `inputJson.llmRoute`, `inputJson.llmExecution` 포함

## 3) 분석 실행
### `POST /analysis/run`
`PARSE_SOURCE -> EXTRACT_CANDIDATE -> EXTRACT_JOB -> DETECT_GAP -> GENERATE_FOLLOW_UP` 실행.

### Request
```json
{
  "applicationId": 1,
  "force": false
}
```

## 4) 후속 답변 제출
### `POST /followup-questions/submit`
`REGENERATE_CANDIDATE` 단계 실행.

### Request
```json
{
  "applicationId": "1",
  "answers": [
    { "questionId": "q-1", "answer": "..." }
  ],
  "force": false
}
```

### Response
- 업데이트된 `candidateProfileJson`
- 상태: `FOLLOW_UP_COMPLETED`

## 5) 문서 생성
### `POST /generated-documents/generate`
`GENERATE_DRAFTS -> (선택) REWRITE_FOR_JOB` 실행.

### Request
```json
{
  "applicationId": "1",
  "rewriteForJob": true,
  "force": false
}
```

### Response
- `generatedDraftJson`:
  - `coverLetter` (지원동기/자기소개 초안)
  - `careerDescription` (경력기술서 도우미 초안)
  - `projectIntro` (프로젝트 근거 보강 문구)
- `rewrittenDraftJson` (옵션)
- 상태: `DOCUMENTS_GENERATED`

## 6) 면접 질문 생성
### `POST /interview/generate`
`GENERATE_INTERVIEW` 실행.

### Request
```json
{
  "applicationId": "1",
  "force": false
}
```

## 에러/보호 규칙
- `400`: DTO 유효성 실패
- `404`: application 미존재 또는 선행 분석 데이터 미존재
- `409`: 동일 stage 동시 실행 충돌 (`WorkflowExecutionLockService`)
- `429`: 요청 과다 (`RequestRateLimiterService`)
- `500`: 체인 실행/파싱 실패 (서비스는 가능한 fallback 반환)
