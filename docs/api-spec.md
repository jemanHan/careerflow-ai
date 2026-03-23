# API Spec (MVP)

Base URL: `/v1`

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
- Application 본문 + `workflowRuns` 타임라인 반환
- 단계별 input/output/error 추적 가능

## 3) 분석 실행
### `POST /analysis/run`
`PARSE_SOURCE -> EXTRACT_CANDIDATE -> EXTRACT_JOB -> DETECT_GAP -> GENERATE_FOLLOW_UP` 실행.

### Request
```json
{
  "applicationId": 1
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
    { "questionId": "q1", "answer": "..." }
  ]
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
  "rewriteForJob": true
}
```

### Response
- `generatedDraftJson`:
  - `coverLetter`
  - `careerDescription`
  - `projectIntro`
  - `interviewQuestions`
- `rewrittenDraftJson` (옵션)
- 상태: `DOCUMENTS_GENERATED`

## 6) 면접 질문 생성
### `POST /interview/generate`
`GENERATE_INTERVIEW` 실행.

### Request
```json
{
  "applicationId": "1"
}
```

## 에러 규칙
- `404`: application 미존재 또는 분석 결과 미존재
- `400`: DTO 유효성 실패
- `500`: 체인 실행/파싱 실패
