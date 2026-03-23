# DB Schema (MVP)

## 핵심 엔티티

### `Application`
- 목적: 한 번의 지원 워크플로우 단위를 저장
- 주요 컬럼:
  - `status`: `CREATED | ANALYZED | FOLLOW_UP_COMPLETED | DOCUMENTS_GENERATED`
  - 입력 원문: `resumeText`, `portfolioText`, `projectDescriptions`, `targetJobPostingText`
  - 분석 JSON: `candidateProfileJson`, `jobPostingJson`, `gapAnalysisJson`
  - 보완 JSON: `followUpQuestions`, `followUpAnswersJson`
  - 생성 JSON: `generatedDraftJson`, `rewrittenDraftJson`
  - 감사: `createdAt`, `updatedAt`

### `WorkflowRun`
- 목적: 단계형 AI 실행 증거를 남기는 이벤트 로그
- 주요 컬럼:
  - `applicationId` (FK)
  - `stage`:
    - `PARSE_SOURCE`
    - `EXTRACT_CANDIDATE`
    - `EXTRACT_JOB`
    - `DETECT_GAP`
    - `GENERATE_FOLLOW_UP`
    - `REGENERATE_CANDIDATE`
    - `GENERATE_DRAFTS`
    - `GENERATE_INTERVIEW`
    - `REWRITE_FOR_JOB`
  - `inputJson`, `outputJson`, `errorMessage`
  - `createdAt`

## 관계
- `Application 1 : N WorkflowRun`
- 인덱스: `(applicationId, stage)` 복합 인덱스

## 영속성 전략
- MVP 속도 우선으로 중간 산출물은 JSON 중심 저장
- 동시에 단계 로그를 별도 테이블에 남겨 디버깅/포트폴리오 증거 확보
- 이후 확장 시 문서 버전 테이블, 평가 지표 테이블로 정규화 가능
