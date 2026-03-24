# Portfolio Core Summary (2026-03)

## 한 줄 소개
CareerFlow AI는 이력서/포트폴리오/채용공고를 입력받아 **적합도 분석 -> 보완 -> 문서 생성 -> 면접 준비**까지 이어지는 저장형 취업 지원 워크플로우 MVP입니다.

## 페이지 기준 핵심 구역 정리

### 1) 지원 적합도 분석
- **목적**: 채용공고 대비 현재 상태를 빠르게 파악하고 보완 우선순위를 제시
- **핵심 로직**:
  - 갭 분석(`matched/missing/weak`) + 증거 강도 기반 가중치로 단일 점수 산출
  - TypeScript 등 명시된 핵심 스택은 과도 감점되지 않도록 보정
- **코드 포인트**:
  - `backend/src/common/fit-analysis.util.ts`
  - `frontend/components/results-client.tsx` (`FitAnalysisPanel`)

### 2) 대화형 보완
- **목적**: 부족 근거를 짧은 입력으로 보완하고 점수/프로필을 재계산
- **핵심 로직**:
  - 질문 1~3개 생성 -> 답변 제출 시 후보자 재생성 + 갭 재탐지
  - 1회 제출 후 입력창 숨김(UX 단순화)
- **코드 포인트**:
  - `backend/src/modules/langchain/chains/follow-up-questions.chain.ts`
  - `backend/src/modules/followup-questions/followup-questions.service.ts`
  - `frontend/components/results-client.tsx` (`GuidedFollowUpSection`)

### 3) 문서 생성
- **목적**: 자기소개/경력기술서/프로젝트 문구를 읽기 가능한 초안으로 제공
- **핵심 로직**:
  - LLM 응답이 객체/배열이어도 텍스트로 정규화해 fallback 감소
  - 문서 재생성 시 기존 면접 리포트가 사라지지 않도록 병합 저장
- **코드 포인트**:
  - `backend/src/modules/langchain/chains/document-generation.chain.ts`
  - `backend/src/modules/langchain/chains/rewrite-tailoring.chain.ts`
  - `backend/src/modules/generated-documents/generated-documents.service.ts`
  - `frontend/components/results-client.tsx` (`DocumentBlock`)

### 4) 면접 대비 리포트
- **목적**: 질문 리스트를 넘어서 실제 답변 준비까지 지원
- **핵심 로직**:
  - `core` 3 + `deep` 2 구조
  - 각 항목: `question`, `whyAsked`, `answerPoints`, `modelAnswer`, `caution`
  - 모범답안은 생성 시점에 함께 생성
- **코드 포인트**:
  - `backend/src/modules/langchain/chains/interview-questions.chain.ts`
  - `backend/src/modules/interview/interview.service.ts`
  - `frontend/components/results-client.tsx` (`InterviewSection`)

## 모델 라우팅 선정 이유 (핵심만)
- **light**: 추출/갭/보완/면접
- **quality**: 문서 생성/리라이트
- 이유: 작업 성격별 품질-비용 균형 + 모델별 쿼터 분산 + 설계 의사결정 설명 가능성

## 운영/안정성 포인트
- `WorkflowRun`에 라우팅/폴백/실패 원인 기록
- 레이트리밋 + 실행락 + 재사용 스킵
- 503은 사용자 화면 노출 최소화, 429(한도)는 안내 노출

## 현재 범위와 향후 확장
- **현재**: 비로그인 MVP, `Application`/`WorkflowRun` 기반 저장/재실행
- **확장**: 로그인 + `userId` 연결, 버전 관리, 부분 재생성(save-first)
- 해석: 인증은 의도적으로 MVP 범위에서 제외했지만, 저장 구조는 개인화 확장을 전제로 설계
