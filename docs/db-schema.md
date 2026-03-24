# DB Schema (MVP)

## 핵심 엔티티

### `Application`
- 목적: 한 번의 지원 워크플로우 단위를 저장
- 주요 컬럼:
  - `status`: `CREATED | ANALYZED | FOLLOW_UP_COMPLETED | DOCUMENTS_GENERATED`
  - 입력 원문: `resumeText`, `portfolioText`, `projectDescriptions`, `targetJobPostingText`
  - 분석 JSON: `candidateProfileJson`, `jobPostingJson`, `gapAnalysisJson`, `fitAnalysisJson`(적합도 스냅샷·점수 변화)
  - 보완 JSON: `followUpQuestions`, `followUpAnswersJson`
  - 생성 JSON: `generatedDraftJson`, `rewrittenDraftJson`
  - 감사: `createdAt`, `updatedAt`
  - 관계: `workflowRuns` (1:N)

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

## 현재 저장 범위 요약
- 이미 저장되는 데이터:
  - 입력 원문(이력서/포트폴리오/강조 프로젝트/JD)
  - 분석 결과(후보자 프로필/JD 구조화/갭 분석)
  - 후속 질문/후속 답변
  - 생성 문서/리라이트 문서/면접 질문
  - 단계별 실행 로그(`WorkflowRun`)
- 아직 없는 데이터:
  - 사용자 계정(`User`) 및 인증 정보
  - 사용자별 소유권(`application.userId`)
  - 문서 버전 테이블(예: DraftVersion)
  - 세션/권한 감사 로그

## 로그인/개인화 확장 관점의 갭
- 현재 `Application`은 사용자 식별자 없이 독립 저장된다.
- 향후 개인화 지원을 위해 최소 변경이 필요한 항목:
  1. `User` 엔티티 추가
  2. `Application.userId` FK 추가
  3. 조회 API에 소유권 검증(본인 데이터만 접근)
  4. 버전/부분 재생성 메타데이터 분리
