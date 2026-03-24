# 성능/운영 지표 (포트폴리오용)

## 측정 목적
- LLM 워크플로우의 **안정성**, **중복 실행 억제 효과**, **운영 가시성**을 정량으로 설명하기 위한 문서
- 데이터 출처: `Application.workflowRuns` (`llmExecution`, `errorMessage`)

## 측정 스냅샷 (2026-03-24, sample applicationId=8)
- 최근 30개 LLM 단계 실행 중 fallback 발생: **17회**
- 최근 7개 핵심 단계(분석~생성) fallback: **0회**
- 최근 7개 핵심 단계 성공: **7/7 (100%)**
- 최근 정상 실행 provider: **gemini** (단계별로 light `gemini-3.1-flash-lite` vs quality `gemini-2.5-flash` — `workflowRuns.inputJson.llmRoute.model`로 확인)

> 해석: 초기에는 키 인식/파싱 이슈로 fallback 비율이 높았으나,  
> Gemini 고정 + 파싱 정규화 이후 최근 전체 단계는 fallback 없이 성공.

## 성능 개선(운영 최적화) 항목과 효과

### 1) 중복 실행 방지
- 적용:
  - `RequestRateLimiterService` (분당 호출 제한)
  - `WorkflowExecutionLockService` (동일 stage 동시 실행 차단)
  - 재사용 스킵 (`SKIPPED_REUSE_*`, `SKIPPED_DUPLICATE_*`)
- 효과:
  - 연속 클릭/중복 요청 시 불필요한 LLM 호출 감소
  - 동일 application/stage 경쟁 상태 감소

### 2) fallback 원인 가시화
- 적용:
  - `llmRoute` + `llmExecution` 메타데이터 저장
  - `fallbackUsed`, `fallbackReason`, `hasProviderApiKey` 기록
- 효과:
  - "왜 실패했는지"를 즉시 분류 가능
  - 키 누락/quota/파싱 실패를 재시도 전에 진단 가능

### 3) 파싱 안정성 보강
- 적용:
  - candidate 단계 `projects[].evidence` 타입 정규화(string -> string[])
- 효과:
  - 스키마 미스매치 fallback 감소
  - 최근 분석 단계 성공률 안정화

## 포트폴리오/면접에서 쓰는 문장 예시
- "단계별 실행 메타데이터를 DB에 저장해 fallback 원인을 키/쿼터/파싱으로 분류하고, 재시도 이전에 원인 진단이 가능하도록 설계했습니다."
- "레이트 리밋 + 실행 락 + 재사용 스킵을 조합해 중복 호출을 줄이고 API 비용과 장애 가능성을 함께 관리했습니다."
- "초기 fallback 이슈를 키 로딩 경로와 structured output 정규화로 해결했고, 최근 핵심 7단계 실행은 100% 성공으로 안정화했습니다."
